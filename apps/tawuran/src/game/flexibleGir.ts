import * as THREE from 'three';
import { buildGearHeadMesh, createLeatherBeltMaterial } from './models';
import { clampGirLength } from './rules';

const NODE_COUNT = 18;
const RIBBON_SAMPLES = 36;
const TRAIL_SAMPLES = 40;
const TRAIL_MAX_AGE = 0.22;
const BELT_HALF_W = 0.029;
const BELT_HALF_T = 0.009;

const _up = new THREE.Vector3(0, 1, 0);
const _altUp = new THREE.Vector3(0, 0, 1);
const _tangent = new THREE.Vector3();
const _side = new THREE.Vector3();
const _norm = new THREE.Vector3();
const _negDir = new THREE.Vector3();
const _target = new THREE.Vector3();
const _prevTip = new THREE.Vector3();
const _q = new THREE.Quaternion();

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export interface GirUpdateParams {
  dt: number;
  anchorPos: THREE.Vector3;
  fighterX: number;
  fighterZ: number;
  fighterYaw: number;
  lengthMeters: number;
  attackPhase: 'idle' | 'windup' | 'active' | 'recovery';
  attackTimer: number;
  windupSec: number;
  activeSec: number;
  recoverySec: number;
  isTitlePreview: boolean;
  simTime: number;
  onAsphaltSpark?: (x: number, y: number, z: number) => void;
}

interface TrailKeyframe {
  time: number;
  cx: number;
  cz: number;
  angle: number;
  radius: number;
  y: number;
}

export class FlexibleGirVisual {
  public readonly group = new THREE.Group();
  private beltGeo: THREE.BufferGeometry;
  private beltMat: THREE.MeshStandardMaterial;
  private beltMesh: THREE.Mesh;
  private gearHead: THREE.Group;

  private trailGeo: THREE.BufferGeometry;
  private trailMat: THREE.MeshBasicMaterial;
  private trailMesh: THREE.Mesh;
  private trailKeys: TrailKeyframe[] = [];
  private trailAlpha = 0;
  private trailClock = 0;
  private prevAttackPhase: 'idle' | 'windup' | 'active' | 'recovery' = 'idle';
  private prevLengthMeters = -1;

  private nodes: THREE.Vector3[] = [];
  private prevNodes: THREE.Vector3[] = [];
  private splinePts: THREE.Vector3[] = [];
  private initialized = false;
  private lastSparkCooldown = 0;
  private gearSpinAngle = 0;
  private lastSwingAngle = 0;
  private hasSwingAngle = false;

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < NODE_COUNT; i++) {
      this.nodes.push(new THREE.Vector3());
      this.prevNodes.push(new THREE.Vector3());
    }
    for (let i = 0; i < RIBBON_SAMPLES; i++) {
      this.splinePts.push(new THREE.Vector3());
    }

    // Pre-allocated flat 4-sided leather belt ribbon geometry (zero per-frame GC)
    const vertsPerRing = 4;
    const vertCount = RIBBON_SAMPLES * vertsPerRing;
    const positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
    const indices: number[] = [];

    for (let i = 0; i < RIBBON_SAMPLES - 1; i++) {
      const a = i * vertsPerRing;
      const b = (i + 1) * vertsPerRing;
      for (let f = 0; f < 4; f++) {
        const fNext = (f + 1) % 4;
        const a0 = a + f;
        const a1 = a + fNext;
        const b0 = b + f;
        const b1 = b + fNext;
        indices.push(a0, b0, a1, a1, b0, b1);
      }
    }

    this.beltGeo = new THREE.BufferGeometry();
    this.beltGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.beltGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    this.beltGeo.setIndex(indices);

    this.beltMat = createLeatherBeltMaterial();
    this.beltMesh = new THREE.Mesh(this.beltGeo, this.beltMat);
    this.beltMesh.frustumCulled = false;
    this.beltMesh.castShadow = true;
    this.beltMesh.receiveShadow = true;

    this.gearHead = buildGearHeadMesh();

    // Smooth additive vertex-colored swing whip motion trail (seamless fade to transparent at tail)
    const trailVerts = TRAIL_SAMPLES * 2;
    const trailPos = new Float32Array(trailVerts * 3);
    const trailColors = new Float32Array(trailVerts * 3);
    const trailIndices: number[] = [];
    for (let i = 0; i < TRAIL_SAMPLES - 1; i++) {
      const a0 = i * 2;
      const a1 = i * 2 + 1;
      const b0 = (i + 1) * 2;
      const b1 = (i + 1) * 2 + 1;
      trailIndices.push(a0, b0, a1, a1, b0, b1);
    }
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    this.trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
    this.trailGeo.setIndex(trailIndices);
    this.trailMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.trailMesh = new THREE.Mesh(this.trailGeo, this.trailMat);
    this.trailMesh.frustumCulled = false;
    this.trailMesh.visible = false;

    this.group.add(this.beltMesh, this.gearHead, this.trailMesh);
    scene.add(this.group);
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (!visible) {
      this.initialized = false;
      this.hasSwingAngle = false;
      this.trailAlpha = 0;
      this.trailKeys.length = 0;
      this.trailMesh.visible = false;
    }
  }

  public snapToAnchor(
    anchorPos: THREE.Vector3,
    fighterYaw: number,
    lengthMeters: number,
    coilForPreview = false,
  ): void {
    const strapLen = Math.max(1.5, clampGirLength(lengthMeters) - 0.24);
    const segLen = strapLen / (NODE_COUNT - 1);

    let cx = anchorPos.x;
    let cy = anchorPos.y;
    let cz = anchorPos.z;

    if (coilForPreview) {
      for (let i = 0; i < NODE_COUNT; i++) {
        const u = i / (NODE_COUNT - 1);
        if (i > 0) {
          if (cy > 0.07) {
            cy = Math.max(0.055, cy - segLen * 0.82);
            cx += segLen * 0.48;
            cz -= segLen * 0.25;
          } else {
            cy = 0.055;
            const arcAngle = u * Math.PI * 1.35;
            cx += Math.cos(arcAngle) * segLen * 0.72;
            cz -= Math.sin(arcAngle) * segLen * 0.72;
          }
        }
        this.nodes[i].set(cx, cy, cz);
        this.prevNodes[i].set(cx, cy, cz);
      }
    } else {
      const rightX = -Math.cos(fighterYaw);
      const rightZ = Math.sin(fighterYaw);
      const backX = -Math.sin(fighterYaw);
      const backZ = -Math.cos(fighterYaw);

      for (let i = 0; i < NODE_COUNT; i++) {
        const u = i / (NODE_COUNT - 1);
        if (i > 0) {
          if (cy > 0.07) {
            cy = Math.max(0.055, cy - segLen * 0.85);
            cx += (rightX * 0.38 + backX * 0.35) * segLen;
            cz += (rightZ * 0.38 + backZ * 0.35) * segLen;
          } else {
            cy = 0.055;
            const curve = Math.sin(u * Math.PI * 1.1) * 0.25;
            cx += (backX * 0.88 + rightX * (0.35 + curve)) * segLen;
            cz += (backZ * 0.88 + rightZ * (0.35 + curve)) * segLen;
          }
        }
        this.nodes[i].set(cx, cy, cz);
        this.prevNodes[i].set(cx, cy, cz);
      }
    }
    this.trailKeys.length = 0;
    this.trailAlpha = 0;
    this.initialized = true;
    this.hasSwingAngle = false;
    this.updateMeshes(0);
  }

  public update(p: GirUpdateParams): void {
    this.group.visible = true;
    const len = clampGirLength(p.lengthMeters);
    const strapLen = Math.max(1.5, len - 0.24);
    const segLen = strapLen / (NODE_COUNT - 1);

    if (this.prevLengthMeters !== len) {
      this.trailKeys.length = 0;
      this.trailAlpha = 0;
      this.prevLengthMeters = len;
    }
    if (
      p.attackPhase !== this.prevAttackPhase &&
      (p.attackPhase === 'active' || p.attackPhase === 'windup')
    ) {
      // Fresh trail arc at start of active whip so windup pullback never creates a V-kink
      this.trailKeys.length = 0;
      if (p.attackPhase === 'windup') this.trailAlpha = 0;
    }
    this.prevAttackPhase = p.attackPhase;

    if (!this.initialized || this.nodes[0].distanceToSquared(p.anchorPos) > 16) {
      this.snapToAnchor(p.anchorPos, p.fighterYaw, len, p.isTitlePreview);
    }

    const dt = Math.min(Math.max(p.dt, 0.001), 0.05);
    this.trailClock += dt;
    const substeps = 4;
    const subDt = dt / substeps;
    const lenRatio = (len - 2.0) / 4.0; // 0 at 2m, 1 at 6m

    // Continuous smooth swing curve: windup gathers centrifugal tension -> active whips 270deg -> recovery coasts smoothly
    let swingActive = false;
    let targetAngle = p.fighterYaw - Math.PI * 0.55;
    let swingHeightBias = 0;
    let whipStrength = 0;
    let lagAmount = 0.22;
    let radiusFactor = 0.96;

    if (p.attackPhase === 'windup') {
      const prog = smoothstep(
        1 - Math.max(0, Math.min(1, p.attackTimer / Math.max(0.05, p.windupSec))),
      );
      swingActive = true;
      // Smoothly lift and draw back from rest right-side (-0.85) to cocked windup (-2.55)
      targetAngle = p.fighterYaw - 0.85 - prog * 1.7;
      swingHeightBias = 0.04 + prog * 0.28;
      whipStrength = 0.22 + prog * 0.78;
      lagAmount = 0.22 + lenRatio * 0.18;
      radiusFactor = 0.68 + prog * 0.28;
    } else if (p.attackPhase === 'active') {
      const rawProg =
        1 - Math.max(0, Math.min(1, p.attackTimer / Math.max(0.05, p.activeSec)));
      const prog = smoothstep(rawProg);
      swingActive = true;
      // Continuous forward sweep from -2.55 through front (0) to +2.15 (~270 deg)
      targetAngle = p.fighterYaw - 2.55 + prog * 4.7;
      swingHeightBias = 0.32 - prog * 0.38;
      whipStrength = 1.0;
      lagAmount = (1 - rawProg * 0.55) * (0.24 + lenRatio * 0.28);
      radiusFactor = 0.96 + Math.sin(rawProg * Math.PI) * 0.04;
    } else if (p.attackPhase === 'recovery') {
      const rawProg =
        1 - Math.max(0, Math.min(1, p.attackTimer / Math.max(0.05, p.recoverySec)));
      const prog = smoothstep(rawProg);
      swingActive = rawProg < 0.72;
      // Coast forward smoothly in the same direction before gravity lowers it cleanly
      targetAngle = p.fighterYaw + 2.15 + prog * 0.75;
      swingHeightBias = -0.06 - prog * 0.45;
      whipStrength = rawProg < 0.72 ? 1 - smoothstep(rawProg / 0.72) : 0;
      lagAmount = 0.12 * (1 - prog * 0.5);
      radiusFactor = 0.96 - prog * 0.22;
    }

    // Smooth angular rate to avoid sudden jumps between phases
    if (swingActive) {
      if (!this.hasSwingAngle) {
        this.lastSwingAngle = targetAngle;
        this.hasSwingAngle = true;
      } else {
        let diff = targetAngle - this.lastSwingAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const angK = 1 - Math.exp(-34 * dt);
        this.lastSwingAngle += diff * angK;
      }
    } else {
      this.hasSwingAngle = false;
    }

    const rightX = -Math.cos(p.fighterYaw);
    const rightZ = Math.sin(p.fighterYaw);
    const backX = -Math.sin(p.fighterYaw);
    const backZ = -Math.cos(p.fighterYaw);

    _prevTip.copy(this.nodes[NODE_COUNT - 1]);

    // Frame-rate independent damping and spring rates
    const dampCoeff = swingActive ? -2.0 : -5.2;
    const damp = Math.exp(dampCoeff * subDt);
    const springRate = (28 - lenRatio * 6) * whipStrength;

    for (let s = 0; s < substeps; s++) {
      for (let i = 1; i < NODE_COUNT; i++) {
        const cur = this.nodes[i];
        const prev = this.prevNodes[i];
        const u = i / (NODE_COUNT - 1);

        const vx = (cur.x - prev.x) * damp;
        const vy = (cur.y - prev.y) * damp;
        const vz = (cur.z - prev.z) * damp;

        prev.copy(cur);

        const grav = swingActive ? 6.0 : 16.0 * (0.85 + u * 0.4);
        let nx = cur.x + vx;
        let ny = cur.y + vy - grav * subDt * subDt;
        let nz = cur.z + vz;

        if (swingActive && whipStrength > 0.02) {
          const nodeLag =
            p.attackPhase === 'windup'
              ? u * lagAmount
              : -u * (0.45 + 0.55 * u) * lagAmount;
          const nodeAngle = this.lastSwingAngle + nodeLag;
          const dirX = Math.sin(nodeAngle);
          const dirZ = Math.cos(nodeAngle);
          const desiredR = 0.24 + u * strapLen * radiusFactor;
          const arcLift = Math.sin(nodeAngle - p.fighterYaw) * 0.12 * u;

          _target.set(
            p.fighterX + dirX * desiredR,
            Math.max(0.24, p.anchorPos.y - 0.06 + u * swingHeightBias + arcLift),
            p.fighterZ + dirZ * desiredR,
          );

          const pullAlpha = 1 - Math.exp(-(springRate * (0.72 + (1 - u) * 0.48)) * subDt);
          nx += (_target.x - nx) * pullAlpha;
          ny += (_target.y - ny) * pullAlpha;
          nz += (_target.z - nz) * pullAlpha;
        } else if (p.isTitlePreview) {
          const sway = Math.sin(p.simTime * 2.0 - u * 2.1) * (0.16 + u * 0.24);
          nx += (0.25 + sway * 0.35) * subDt * 2.5;
          nz -= (0.2 + Math.cos(p.simTime * 1.5 - u * 1.7) * 0.12) * subDt * 2.0;
        } else {
          nx += (rightX * 0.16 + backX * 0.08) * subDt * 1.3;
          nz += (rightZ * 0.16 + backZ * 0.08) * subDt * 1.3;
        }

        cur.set(nx, ny, nz);
      }

      // Pin root & relax distance constraints
      this.nodes[0].copy(p.anchorPos);
      this.prevNodes[0].copy(p.anchorPos);

      const iterations = 10;
      for (let it = 0; it < iterations; it++) {
        this.nodes[0].copy(p.anchorPos);
        for (let i = 0; i < NODE_COUNT - 1; i++) {
          const a = this.nodes[i];
          const b = this.nodes[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const dist = Math.hypot(dx, dy, dz) || 0.0001;
          const diff = (dist - segLen) / dist;

          if (i === 0) {
            b.x -= dx * diff;
            b.y -= dy * diff;
            b.z -= dz * diff;
          } else {
            const wA = 0.5;
            const wB = i + 1 === NODE_COUNT - 1 ? 0.32 : 0.5;
            const sum = wA + wB;
            a.x += dx * diff * (wA / sum);
            a.y += dy * diff * (wA / sum);
            a.z += dz * diff * (wA / sum);
            b.x -= dx * diff * (wB / sum);
            b.y -= dy * diff * (wB / sum);
            b.z -= dz * diff * (wB / sum);
          }

          const minY = i + 1 === NODE_COUNT - 1 ? 0.18 : 0.045;
          if (b.y < minY) {
            b.y = minY;
            this.prevNodes[i + 1].x = THREE.MathUtils.lerp(this.prevNodes[i + 1].x, b.x, 0.22);
            this.prevNodes[i + 1].z = THREE.MathUtils.lerp(this.prevNodes[i + 1].z, b.z, 0.22);
          }
        }
      }
    }

    const tip = this.nodes[NODE_COUNT - 1];
    const tipSpeed = tip.distanceTo(_prevTip) / dt;
    this.gearSpinAngle += tipSpeed * dt * 2.4;

    // Asphalt friction sparks when heavy gear grazes low during active swing
    this.lastSparkCooldown = Math.max(0, this.lastSparkCooldown - dt);
    if (
      p.attackPhase === 'active' &&
      tip.y < 0.38 &&
      this.lastSparkCooldown <= 0 &&
      p.onAsphaltSpark
    ) {
      this.lastSparkCooldown = 0.055;
      p.onAsphaltSpark(tip.x, 0.08, tip.z);
    }

    // Record smooth polar trail keyframes ONLY during active swing & immediate coast follow-through
    const recordTrail =
      p.attackPhase === 'active' ||
      (p.attackPhase === 'recovery' &&
        1 - Math.max(0, Math.min(1, p.attackTimer / Math.max(0.05, p.recoverySec))) < 0.45);

    if (recordTrail) {
      const dx = tip.x - p.fighterX;
      const dz = tip.z - p.fighterZ;
      const radius = Math.hypot(dx, dz);
      let angle = Math.atan2(dx, dz);
      if (this.trailKeys.length > 0) {
        const prevAngle = this.trailKeys[this.trailKeys.length - 1].angle;
        let dAng = angle - prevAngle;
        while (dAng > Math.PI) dAng -= Math.PI * 2;
        while (dAng < -Math.PI) dAng += Math.PI * 2;
        angle = prevAngle + dAng;
      }
      this.trailKeys.push({
        time: this.trailClock,
        cx: p.fighterX,
        cz: p.fighterZ,
        angle,
        radius,
        y: tip.y,
      });
    }

    // Expire old trail keyframes by elapsed time (so trail length stays consistent at any FPS)
    const minKeepTime = this.trailClock - TRAIL_MAX_AGE;
    while (this.trailKeys.length > 0 && this.trailKeys[0].time < minKeepTime) {
      this.trailKeys.shift();
    }

    const targetTrailAlpha = p.attackPhase === 'active' ? 0.92 : 0;
    const trailBlend = 1 - Math.exp(-(targetTrailAlpha > this.trailAlpha ? 20 : 12) * dt);
    this.trailAlpha += (targetTrailAlpha - this.trailAlpha) * trailBlend;

    this.updateMeshes(tipSpeed);
  }

  private updateMeshes(tipSpeed: number): void {
    // 1. Sample smooth Catmull-Rom spline points along Verlet chain
    for (let s = 0; s < RIBBON_SAMPLES; s++) {
      const t = (s / (RIBBON_SAMPLES - 1)) * (NODE_COUNT - 1);
      const idx = Math.min(NODE_COUNT - 2, Math.floor(t));
      const frac = t - idx;
      const p0 = this.nodes[Math.max(0, idx - 1)];
      const p1 = this.nodes[idx];
      const p2 = this.nodes[idx + 1];
      const p3 = this.nodes[Math.min(NODE_COUNT - 1, idx + 2)];

      const f2 = frac * frac;
      const f3 = f2 * frac;
      this.splinePts[s].set(
        0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * frac +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f3),
        0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * frac +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f3),
        0.5 *
          (2 * p1.z +
            (-p0.z + p2.z) * frac +
            (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * f2 +
            (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * f3),
      );
      if (this.splinePts[s].y < 0.03) this.splinePts[s].y = 0.03;
    }

    // 2. Parallel-transport (Bishop frame) leather ribbon vertices — zero 90-degree flips!
    const posAttr = this.beltGeo.getAttribute('position') as THREE.BufferAttribute;
    const normAttr = this.beltGeo.getAttribute('normal') as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const normArr = normAttr.array as Float32Array;

    for (let s = 0; s < RIBBON_SAMPLES; s++) {
      const curr = this.splinePts[s];
      const prev = this.splinePts[Math.max(0, s - 1)];
      const next = this.splinePts[Math.min(RIBBON_SAMPLES - 1, s + 1)];
      _tangent.subVectors(next, prev);
      if (_tangent.lengthSq() < 1e-6) _tangent.set(0, -1, 0);
      else _tangent.normalize();

      if (s === 0) {
        const refUp = Math.abs(_tangent.dot(_up)) > 0.9 ? _altUp : _up;
        _side.crossVectors(_tangent, refUp).normalize();
      } else {
        // Carry previous frame smoothly along curve without snapping
        _side.addScaledVector(_tangent, -_side.dot(_tangent));
        if (_side.lengthSq() < 1e-6) {
          const refUp = Math.abs(_tangent.dot(_up)) > 0.9 ? _altUp : _up;
          _side.crossVectors(_tangent, refUp);
        }
        _side.normalize();
      }
      _norm.crossVectors(_side, _tangent).normalize();

      const base = s * 4 * 3;
      posArr[base + 0] = curr.x + _side.x * BELT_HALF_W + _norm.x * BELT_HALF_T;
      posArr[base + 1] = curr.y + _side.y * BELT_HALF_W + _norm.y * BELT_HALF_T;
      posArr[base + 2] = curr.z + _side.z * BELT_HALF_W + _norm.z * BELT_HALF_T;
      normArr[base + 0] = _side.x * 0.7 + _norm.x * 0.7;
      normArr[base + 1] = _side.y * 0.7 + _norm.y * 0.7;
      normArr[base + 2] = _side.z * 0.7 + _norm.z * 0.7;

      posArr[base + 3] = curr.x - _side.x * BELT_HALF_W + _norm.x * BELT_HALF_T;
      posArr[base + 4] = curr.y - _side.y * BELT_HALF_W + _norm.y * BELT_HALF_T;
      posArr[base + 5] = curr.z - _side.z * BELT_HALF_W + _norm.z * BELT_HALF_T;
      normArr[base + 3] = -_side.x * 0.7 + _norm.x * 0.7;
      normArr[base + 4] = -_side.y * 0.7 + _norm.y * 0.7;
      normArr[base + 5] = -_side.z * 0.7 + _norm.z * 0.7;

      posArr[base + 6] = curr.x - _side.x * BELT_HALF_W - _norm.x * BELT_HALF_T;
      posArr[base + 7] = curr.y - _side.y * BELT_HALF_W - _norm.y * BELT_HALF_T;
      posArr[base + 8] = curr.z - _side.z * BELT_HALF_W - _norm.z * BELT_HALF_T;
      normArr[base + 6] = -_side.x * 0.7 - _norm.x * 0.7;
      normArr[base + 7] = -_side.y * 0.7 - _norm.y * 0.7;
      normArr[base + 8] = -_side.z * 0.7 - _norm.z * 0.7;

      posArr[base + 9] = curr.x + _side.x * BELT_HALF_W - _norm.x * BELT_HALF_T;
      posArr[base + 10] = curr.y + _side.y * BELT_HALF_W - _norm.y * BELT_HALF_T;
      posArr[base + 11] = curr.z + _side.z * BELT_HALF_W - _norm.z * BELT_HALF_T;
      normArr[base + 9] = _side.x * 0.7 - _norm.x * 0.7;
      normArr[base + 10] = _side.y * 0.7 - _norm.y * 0.7;
      normArr[base + 11] = _side.z * 0.7 - _norm.z * 0.7;
    }
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;

    // 3. Orient motorcycle sprocket gear head along final strap tangent & accumulate continuous spin
    const last = this.nodes[NODE_COUNT - 1];
    const beforeLast = this.nodes[NODE_COUNT - 2];
    _negDir.subVectors(beforeLast, last);
    if (_negDir.lengthSq() < 1e-6) _negDir.set(0, 1, 0);
    else _negDir.normalize();

    this.gearHead.position.copy(last);
    _q.setFromUnitVectors(_up, _negDir);
    this.gearHead.quaternion.copy(_q);
    this.gearHead.rotateY(this.gearSpinAngle);

    // 4. Polar-arc resampled swing trail — smooth circular arc with zero jagged corners or bowties at any FPS
    if (this.trailAlpha > 0.03 && this.trailKeys.length >= 2) {
      this.trailMesh.visible = true;
      const tPos = this.trailGeo.getAttribute('position') as THREE.BufferAttribute;
      const tCol = this.trailGeo.getAttribute('color') as THREE.BufferAttribute;
      const tArr = tPos.array as Float32Array;
      const cArr = tCol.array as Float32Array;

      const oldest = this.trailKeys[0];
      const newest = this.trailKeys[this.trailKeys.length - 1];
      const tSpan = Math.max(0.001, newest.time - oldest.time);
      let keyIdx = 0;

      for (let i = 0; i < TRAIL_SAMPLES; i++) {
        const u = i / (TRAIL_SAMPLES - 1); // 0 = oldest tail, 1 = live tip head
        const sampleTime = oldest.time + u * tSpan;

        while (
          keyIdx < this.trailKeys.length - 2 &&
          this.trailKeys[keyIdx + 1].time < sampleTime
        ) {
          keyIdx++;
        }
        const k0 = this.trailKeys[keyIdx];
        const k1 = this.trailKeys[Math.min(this.trailKeys.length - 1, keyIdx + 1)];
        const denom = Math.max(1e-5, k1.time - k0.time);
        const f = Math.max(0, Math.min(1, (sampleTime - k0.time) / denom));

        const cx = THREE.MathUtils.lerp(k0.cx, k1.cx, f);
        const cz = THREE.MathUtils.lerp(k0.cz, k1.cz, f);
        const ang = THREE.MathUtils.lerp(k0.angle, k1.angle, f);
        const rad = THREE.MathUtils.lerp(k0.radius, k1.radius, f);
        const py = THREE.MathUtils.lerp(k0.y, k1.y, f);

        const outX = Math.sin(ang);
        const outZ = Math.cos(ang);
        const px = cx + outX * rad;
        const pz = cz + outZ * rad;

        const headTaper = Math.min(1, (1 - u) * 10 + 0.14);
        const tailFade = Math.pow(u, 1.85);
        const fade = headTaper * tailFade * this.trailAlpha;
        const halfWidth = headTaper * u * 0.15;

        const b = i * 6;
        tArr[b + 0] = px + outX * halfWidth;
        tArr[b + 1] = py + 0.01;
        tArr[b + 2] = pz + outZ * halfWidth;
        tArr[b + 3] = px - outX * halfWidth;
        tArr[b + 4] = py - 0.01;
        tArr[b + 5] = pz - outZ * halfWidth;

        // Warm amber-steel outer edge tapering softly inward to subtle inner glow
        cArr[b + 0] = 0.98 * fade;
        cArr[b + 1] = 0.72 * fade;
        cArr[b + 2] = 0.24 * fade;
        cArr[b + 3] = 0.36 * fade;
        cArr[b + 4] = 0.24 * fade;
        cArr[b + 5] = 0.08 * fade;
      }
      tPos.needsUpdate = true;
      tCol.needsUpdate = true;
    } else {
      this.trailMesh.visible = false;
    }
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.beltGeo.dispose();
    this.beltMat.dispose();
    this.trailGeo.dispose();
    this.trailMat.dispose();
    this.gearHead.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      }
    });
  }
}
