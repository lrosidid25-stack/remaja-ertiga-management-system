import * as THREE from 'three';
import type { CharacterConfig, EnemyArchetype, WeaponId } from './types';

export interface FighterRig {
  // Sengaja `Object3D` (bukan `Group`) supaya rig dari GLB bisa memakai
  // tulang (`THREE.Bone`) sebagai sendi tanpa kehilangan tipe.
  root: THREE.Object3D;
  hips: THREE.Object3D;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  leftShoulder: THREE.Object3D;
  leftElbow: THREE.Object3D;
  rightShoulder: THREE.Object3D;
  rightElbow: THREE.Object3D;
  weaponMount: THREE.Object3D;
  leftHip: THREE.Object3D;
  leftKnee: THREE.Object3D;
  rightHip: THREE.Object3D;
  rightKnee: THREE.Object3D;
  shadowDisc: THREE.Mesh;
  telegraphRing: THREE.Mesh;
  hpBarGroup: THREE.Group | null;
  hpBarFill: THREE.Mesh | null;
  hitFlashMaterials: THREE.MeshStandardMaterial[];
  weaponGroup: THREE.Group | null;
  girAnchor: THREE.Object3D | null;
}

let cachedContactShadowTex: THREE.CanvasTexture | null = null;
let cachedRulerTex: THREE.CanvasTexture | null = null;
let cachedFabricBump: THREE.CanvasTexture | null = null;

function getContactShadowTexture(): THREE.CanvasTexture {
  if (cachedContactShadowTex) return cachedContactShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedContactShadowTex = tex;
  return tex;
}

function getFabricBumpTexture(): THREE.CanvasTexture {
  if (cachedFabricBump) return cachedFabricBump;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 2) {
    for (let x = 0; x < 64; x += 2) {
      const v = 115 + ((x + y) % 4 === 0 ? 22 : -14);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  cachedFabricBump = tex;
  return tex;
}

function getRulerTexture(): THREE.CanvasTexture {
  if (cachedRulerTex) return cachedRulerTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#cfd4db';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#1f2937';
  for (let x = 4; x < 252; x += 6) {
    const h = x % 24 === 4 ? 26 : 14;
    ctx.fillRect(x, 0, 2, h);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedRulerTex = tex;
  return tex;
}

/**
 * Builds composite 3-12 part realistic improvised street-brawl weapons.
 */
export function buildWeaponMesh(weaponId: WeaponId): THREE.Group {
  const group = new THREE.Group();
  group.name = `weapon_${weaponId}`;

  const steelPolished = new THREE.MeshStandardMaterial({
    color: 0xd6dde6,
    metalness: 0.92,
    roughness: 0.18,
  });
  const forgedIron = new THREE.MeshStandardMaterial({
    color: 0x353942,
    metalness: 0.78,
    roughness: 0.56,
  });
  const galvanizedPipe = new THREE.MeshStandardMaterial({
    color: 0x8f97a3,
    metalness: 0.8,
    roughness: 0.36,
  });
  const blackTape = new THREE.MeshStandardMaterial({
    color: 0x161619,
    metalness: 0.05,
    roughness: 0.78,
  });

  if (weaponId === 'sabit_modif') {
    // 1. Long galvanized steel extension pipe handle
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.019, 0.78, 12),
      galvanizedPipe,
    );
    handle.position.y = 0.28;
    group.add(handle);

    // 2. Black electrical-tape grip wraps
    for (let i = 0; i < 3; i++) {
      const wrap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.021, 0.021, 0.06, 12),
        blackTape,
      );
      wrap.position.y = 0.02 + i * 0.11;
      group.add(wrap);
    }

    // 3. Welded steel collar clamp + bolt
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.024, 0.09, 12),
      forgedIron,
    );
    collar.position.y = 0.67;
    group.add(collar);

    // 4. Forged spine & curved crescent sickle blade (ExtrudeGeometry with bevels)
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.quadraticCurveTo(0.08, 0.28, 0.26, 0.54);
    bladeShape.quadraticCurveTo(0.42, 0.72, 0.28, 0.86);
    bladeShape.quadraticCurveTo(0.14, 0.94, -0.02, 0.88);
    bladeShape.quadraticCurveTo(0.16, 0.82, 0.23, 0.68);
    bladeShape.quadraticCurveTo(0.26, 0.52, 0.06, 0.26);
    bladeShape.lineTo(-0.02, 0);
    bladeShape.closePath();

    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 2,
    });
    bladeGeo.center();
    const blade = new THREE.Mesh(bladeGeo, steelPolished);
    blade.position.set(0.1, 1.06, 0);
    blade.rotation.z = -0.15;
    group.add(blade);

    // 5. Darkened forged rib along spine
    const spineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.7, 0),
      new THREE.Vector3(0.09, 0.95, 0),
      new THREE.Vector3(0.24, 1.24, 0),
      new THREE.Vector3(0.18, 1.44, 0),
    ]);
    const spine = new THREE.Mesh(
      new THREE.TubeGeometry(spineCurve, 14, 0.011, 8, false),
      forgedIron,
    );
    group.add(spine);
  } else if (weaponId === 'gir_sabuk') {
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x261a14,
      roughness: 0.84,
      metalness: 0.06,
      bumpMap: getFabricBumpTexture(),
      bumpScale: 0.008,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xc29b45,
      metalness: 0.88,
      roughness: 0.28,
    });

    // 1. Hand-wrapped leather belt grip loop in fist
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.15, 12),
      leatherMat,
    );
    grip.position.y = 0.0;
    group.add(grip);

    // 2. Heavy brass belt buckle dangling from fist where flexible belt exits
    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.058, 0.022),
      brassMat,
    );
    buckle.position.y = -0.095;
    group.add(buckle);

    // 3. Anchor point for the flexible 2-6m Verlet belt simulation
    const anchor = new THREE.Object3D();
    anchor.name = 'gir_anchor';
    anchor.position.set(0, -0.125, 0);
    group.add(anchor);
  } else if (weaponId === 'kayu_paku') {
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x7b5638,
      roughness: 0.88,
      metalness: 0.04,
      bumpMap: getFabricBumpTexture(),
      bumpScale: 0.014,
    });

    // 1. Weathered rectangular timber beam
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(0.056, 0.86, 0.044),
      woodMat,
    );
    beam.position.y = 0.4;
    group.add(beam);

    // 2. Tape handle wrap
    const wrap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.034, 0.2, 10),
      blackTape,
    );
    wrap.position.y = 0.06;
    group.add(wrap);

    // 3. 6 Protruding steel nails through strike head
    const nailGeo = new THREE.CylinderGeometry(0.004, 0.001, 0.085, 6);
    for (let i = 0; i < 6; i++) {
      const nail = new THREE.Mesh(nailGeo, steelPolished);
      nail.rotation.z = Math.PI * 0.5;
      nail.position.set(
        i % 2 === 0 ? 0.042 : -0.042,
        0.64 + (i % 3) * 0.075,
        (i % 2 === 0 ? 1 : -1) * 0.01,
      );
      group.add(nail);
    }
  } else {
    // penggaris_baja
    const rulerMat = new THREE.MeshStandardMaterial({
      map: getRulerTexture(),
      metalness: 0.88,
      roughness: 0.22,
    });

    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.98, 0.007),
      rulerMat,
    );
    blade.position.y = 0.46;
    group.add(blade);

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.18, 0.018),
      blackTape,
    );
    grip.position.y = 0.05;
    group.add(grip);
  }

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Builds the heavy toothed motorcycle sprocket gear head + steel shackle
 * attached to the tip of the flexible 2-6m leather belt.
 * Oriented so +Y points along the belt back toward the hand and the sprocket disc extends down -Y.
 */
export function buildGearHeadMesh(): THREE.Group {
  const head = new THREE.Group();

  const steelPolished = new THREE.MeshStandardMaterial({
    color: 0xd6dde6,
    metalness: 0.92,
    roughness: 0.18,
  });
  const forgedIron = new THREE.MeshStandardMaterial({
    color: 0x353942,
    metalness: 0.8,
    roughness: 0.48,
  });
  const galvanizedPipe = new THREE.MeshStandardMaterial({
    color: 0x8f97a3,
    metalness: 0.82,
    roughness: 0.34,
  });
  const leatherCollarMat = new THREE.MeshStandardMaterial({
    color: 0x2a1c15,
    roughness: 0.82,
    metalness: 0.08,
  });

  // 1. Folded leather rivet tab clamping onto D-ring
  const tab = new THREE.Mesh(
    new THREE.BoxGeometry(0.044, 0.06, 0.022),
    leatherCollarMat,
  );
  tab.position.y = -0.02;
  head.add(tab);

  // 2. Steel D-ring shackle
  const shackle = new THREE.Mesh(
    new THREE.TorusGeometry(0.036, 0.008, 8, 16),
    galvanizedPipe,
  );
  shackle.position.y = -0.06;
  head.add(shackle);

  // 3. Authentic 14-tooth motorcycle sprocket gear
  const gearShape = new THREE.Shape();
  const teeth = 14;
  const outerR = 0.165;
  const rootR = 0.132;
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.22) / teeth) * Math.PI * 2;
    const a2 = ((i + 0.45) / teeth) * Math.PI * 2;
    const a3 = ((i + 0.68) / teeth) * Math.PI * 2;
    const p0x = Math.cos(a0) * rootR;
    const p0y = Math.sin(a0) * rootR;
    if (i === 0) gearShape.moveTo(p0x, p0y);
    else gearShape.lineTo(p0x, p0y);
    gearShape.lineTo(Math.cos(a1) * outerR, Math.sin(a1) * outerR);
    gearShape.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
    gearShape.lineTo(Math.cos(a3) * rootR, Math.sin(a3) * rootR);
  }
  gearShape.closePath();

  const centerHole = new THREE.Path();
  centerHole.absarc(0, 0, 0.036, 0, Math.PI * 2, true);
  gearShape.holes.push(centerHole);
  for (let h = 0; h < 5; h++) {
    const ha = (h / 5) * Math.PI * 2;
    const hole = new THREE.Path();
    hole.absarc(Math.cos(ha) * 0.082, Math.sin(ha) * 0.082, 0.02, 0, Math.PI * 2, true);
    gearShape.holes.push(hole);
  }

  const gearGeo = new THREE.ExtrudeGeometry(gearShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.002,
    bevelSegments: 2,
  });
  gearGeo.center();
  // Lay sprocket flat in XZ so when swinging horizontally its teeth slice cleanly through air
  gearGeo.rotateX(Math.PI * 0.5);
  const gear = new THREE.Mesh(gearGeo, forgedIron);
  gear.position.y = -0.21;
  head.add(gear);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.125, 0.007, 8, 24),
    steelPolished,
  );
  ring.rotation.x = Math.PI * 0.5;
  ring.position.y = -0.21;
  head.add(ring);

  head.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return head;
}

export function createLeatherBeltMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x45291a,
    roughness: 0.78,
    metalness: 0.08,
    bumpMap: getFabricBumpTexture(),
    bumpScale: 0.012,
  });
}

export function buildPetasanMesh(isRoman = false): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: isRoman ? 0xd97706 : 0xdc2626,
    roughness: 0.55,
    metalness: 0.08,
  });
  const labelMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.4,
    metalness: 0.25,
  });
  const paperCrimpMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.85,
    metalness: 0.02,
  });
  const emberMat = new THREE.MeshBasicMaterial({
    color: 0xfff3b0,
  });
  const emberHaloMat = new THREE.MeshBasicMaterial({
    color: 0xff6b00,
    transparent: true,
    opacity: 0.82,
  });

  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, isRoman ? 0.26 : 0.16, 12),
    bodyMat,
  );
  g.add(cyl);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.05, 12),
    labelMat,
  );
  g.add(band);

  const bottomCrimp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.026, 0.028, 10),
    paperCrimpMat,
  );
  bottomCrimp.position.y = isRoman ? -0.14 : -0.09;
  g.add(bottomCrimp);

  const fuse = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.075, 6),
    new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.9 }),
  );
  fuse.position.y = isRoman ? 0.16 : 0.11;
  fuse.rotation.z = 0.22;
  g.add(fuse);

  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), emberMat);
  ember.position.set(-0.01, isRoman ? 0.195 : 0.145, 0);
  g.add(ember);

  const emberHalo = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), emberHaloMat);
  emberHalo.position.copy(ember.position);
  g.add(emberHalo);

  return g;
}

function getShirtColors(
  config: CharacterConfig,
  isEnemy: boolean,
  archetype?: EnemyArchetype,
): { shirtHex: string; tieOrAccentHex: string; jacketHex: string } {
  if (!isEnemy) {
    if (config.outfit === 'pramuka') {
      return { shirtHex: '#b48a5a', tieOrAccentHex: '#7f1d1d', jacketHex: config.jacketColor };
    }
    if (config.outfit === 'jaket_bomber') {
      return { shirtHex: '#e5e7eb', tieOrAccentHex: '#dc2626', jacketHex: config.jacketColor };
    }
    if (config.outfit === 'kemeja_terbuka') {
      return { shirtHex: '#f1f5f9', tieOrAccentHex: '#18181b', jacketHex: config.jacketColor };
    }
    return { shirtHex: '#f4f4f5', tieOrAccentHex: '#64748b', jacketHex: config.jacketColor };
  }

  // Distinct readable rival silhouettes by archetype
  switch (archetype) {
    case 'gir_spinner':
      return { shirtHex: '#d4d4d8', tieOrAccentHex: '#ea580c', jacketHex: '#3f1d16' };
    case 'petasan_kiter':
      return { shirtHex: '#fef3c7', tieOrAccentHex: '#eab308', jacketHex: '#1e3a5f' };
    case 'pentolan':
      return { shirtHex: '#18181b', tieOrAccentHex: '#dc2626', jacketHex: '#450a0a' };
    default:
      return { shirtHex: '#e4e4e7', tieOrAccentHex: '#334155', jacketHex: '#27272a' };
  }
}

/**
 * Builds a sculpted anatomical human torso (waist -> ribcage -> pectorals -> trapezius slope)
 * using LatheGeometry with non-uniform elliptical cross-sections and subtle chest/back asymmetry.
 */
function buildAnatomicalTorsoGeo(isJacket: boolean): THREE.BufferGeometry {
  const expand = isJacket ? 0.014 : 0;
  const profile: Array<[number, number]> = [
    [0.01 + expand * 0.4, 0.0],
    [0.168 + expand, 0.02],
    [0.162 + expand * 0.8, 0.11],
    [0.186 + expand, 0.23],
    [0.214 + expand, 0.34],
    [0.218 + expand, 0.42],
    [0.145 + expand * 0.6, 0.48],
    [0.072, 0.515],
    [0.005, 0.525],
  ];
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Human ribcage is wider side-to-side (X) than front-to-back (Z)
    const depthScale = THREE.MathUtils.lerp(0.62, 0.58, Math.min(1, y / 0.5));
    let nextZ = z * depthScale;
    // Subtle pectoral projection in front (+Z) and slight lumbar curve on back (-Z)
    const chestFactor = Math.max(0, 1 - Math.abs(y - 0.34) / 0.16);
    if (nextZ > 0) {
      nextZ += chestFactor * 0.022;
    } else {
      const lumbar = Math.max(0, 1 - Math.abs(y - 0.14) / 0.12);
      nextZ += lumbar * 0.014;
    }
    pos.setXYZ(i, x * 1.04, y, nextZ);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an organic tapered limb segment (biceps, forearm, thigh with quads, or calf).
 */
function buildTaperedLimbGeo(
  length: number,
  topR: number,
  midR: number,
  botR: number,
  midOffset = 0.45,
): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.005, 0),
    new THREE.Vector2(topR, -0.01),
    new THREE.Vector2(midR, -length * midOffset),
    new THREE.Vector2(botR, -length + 0.01),
    new THREE.Vector2(0.005, -length),
  ];
  const geo = new THREE.LatheGeometry(pts, 14);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a contoured sneaker silhouette using ExtrudeGeometry (curved toe, instep, heel collar).
 */
function buildSneakerUpperGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.085, 0);
  shape.lineTo(0.115, 0);
  shape.quadraticCurveTo(0.138, 0.006, 0.135, 0.032);
  shape.quadraticCurveTo(0.12, 0.056, 0.06, 0.068);
  shape.quadraticCurveTo(0.015, 0.092, -0.02, 0.095);
  shape.lineTo(-0.072, 0.092);
  shape.quadraticCurveTo(-0.095, 0.055, -0.085, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.086,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.014,
    bevelSegments: 3,
  });
  geo.center();
  // Extrude is along Z; rotate so sneaker length points toward +Z
  geo.rotateY(-Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an articulated composite 3D student fighter pivoted at bottom-center (y = 0).
 */
export function buildFighterRig(
  config: CharacterConfig,
  isEnemy = false,
  archetype?: EnemyArchetype,
  isAlly = false,
): FighterRig {
  const root = new THREE.Group();
  const hitFlashMaterials: THREE.MeshStandardMaterial[] = [];

  const fabricBump = getFabricBumpTexture();
  const makeMat = (
    color: string | number,
    roughness: number,
    metalness = 0.04,
    useBump = false,
  ) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      bumpMap: useBump ? fabricBump : null,
      bumpScale: useBump ? 0.01 : 0,
    });
    hitFlashMaterials.push(m);
    return m;
  };

  const skinMat = makeMat(
    isEnemy
      ? archetype === 'pentolan'
        ? '#9d6b43'
        : '#b87f52'
      : config.skinTone,
    0.66,
    0.02,
  );
  const hairMat = makeMat(isEnemy ? '#151518' : config.hairColor, 0.82, 0.05);

  const { shirtHex, tieOrAccentHex, jacketHex } = getShirtColors(
    config,
    isEnemy,
    archetype,
  );

  const pantsColor = isEnemy
    ? archetype === 'pentolan'
      ? '#18181b'
      : '#3b4252'
    : config.pants === 'abu_sekolah'
      ? '#64748b'
      : config.pants === 'hitam_bahan'
        ? '#1f2937'
        : '#2b456b';

  const shirtMat = makeMat(shirtHex, 0.78, 0.02, true);
  const jacketMat = makeMat(jacketHex, 0.62, 0.08, true);
  const accentMat = makeMat(tieOrAccentHex, 0.52, 0.12);
  const pantsMat = makeMat(pantsColor, 0.84, 0.03, true);
  const shoeMat = makeMat('#18181b', 0.68, 0.06);
  const soleMat = makeMat('#e4e4e7', 0.55, 0.02);

  const isPentolan = isEnemy && archetype === 'pentolan';
  const scaleFactor = isPentolan ? 1.14 : 1.0;

  // Ground contact shadow disc (never floating)
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.58 * scaleFactor, 24),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  shadowDisc.rotation.x = -Math.PI * 0.5;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // Enemy windup telegraph ring on ground
  const telegraphRing = new THREE.Mesh(
    new THREE.RingGeometry(0.56, 0.74, 28),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  telegraphRing.rotation.x = -Math.PI * 0.5;
  telegraphRing.position.y = 0.025;
  root.add(telegraphRing);

  const hips = new THREE.Group();
  hips.position.y = 0.92 * scaleFactor;
  hips.scale.setScalar(scaleFactor);
  root.add(hips);

  // Organic anatomical pelvis + curved belt
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.185, 18, 12), pantsMat);
  pelvis.scale.set(1.04, 0.54, 0.68);
  hips.add(pelvis);

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.172, 0.176, 0.04, 20),
    makeMat('#18181b', 0.45, 0.25),
  );
  belt.scale.set(1.04, 1, 0.66);
  belt.position.y = 0.062;
  hips.add(belt);

  const buckle = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.016, 0.026, 4, 8),
    makeMat('#d4af37', 0.25, 0.88),
  );
  buckle.rotation.z = Math.PI * 0.5;
  buckle.scale.set(1, 1, 0.45);
  buckle.position.set(0, 0.062, 0.115);
  hips.add(buckle);

  // Sculpted Torso
  const torso = new THREE.Group();
  torso.position.y = 0.065;
  hips.add(torso);

  const useJacket =
    (!isEnemy && config.outfit === 'jaket_bomber') ||
    (isEnemy && (archetype === 'pentolan' || archetype === 'gir_spinner'));
  const openShirt = !isEnemy && config.outfit === 'kemeja_terbuka';

  const chestMat = useJacket ? jacketMat : shirtMat;
  const chest = new THREE.Mesh(buildAnatomicalTorsoGeo(useJacket), chestMat);
  torso.add(chest);

  if (openShirt) {
    // Inner dark tee peeking down center chest
    const innerTee = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.056, 0.34, 6, 12),
      accentMat,
    );
    innerTee.scale.set(1.15, 1, 0.48);
    innerTee.position.set(0, 0.25, 0.106);
    torso.add(innerTee);
  } else if (useJacket) {
    // Bomber jacket dark ribbed waist hem, metallic zipper & ribbed collar
    const jacketTrimMat = makeMat('#18181b', 0.72, 0.06, true);
    const waistRib = new THREE.Mesh(
      new THREE.TorusGeometry(0.156, 0.022, 8, 22),
      jacketTrimMat,
    );
    waistRib.rotation.x = Math.PI * 0.5;
    waistRib.scale.set(1.16, 0.72, 1);
    waistRib.position.y = 0.024;
    torso.add(waistRib);

    const zipper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.42, 8),
      makeMat('#a1a1aa', 0.3, 0.82),
    );
    zipper.scale.set(1, 1, 0.4);
    zipper.position.set(0, 0.24, 0.142);
    torso.add(zipper);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.078, 0.022, 8, 16),
      jacketTrimMat,
    );
    collar.rotation.x = Math.PI * 0.5;
    collar.position.set(0, 0.495, 0.005);
    torso.add(collar);
  } else {
    // School shirt collar + contoured tie / Pramuka neckerchief
    const shirtCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.074, 0.018, 8, 16),
      shirtMat,
    );
    shirtCollar.rotation.x = Math.PI * 0.5;
    shirtCollar.position.set(0, 0.495, 0.005);
    torso.add(shirtCollar);

    const tie = new THREE.Mesh(
      new THREE.ConeGeometry(0.036, 0.27, 8),
      accentMat,
    );
    tie.rotation.x = Math.PI - 0.12;
    tie.scale.set(1.05, 1, 0.3);
    tie.position.set(0, 0.33, 0.132);
    torso.add(tie);

    const badge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.01, 12),
      makeMat('#dc2626', 0.5, 0.1),
    );
    badge.rotation.x = Math.PI * 0.5;
    badge.position.set(0.11, 0.34, 0.136);
    torso.add(badge);
  }

  // Head + Neck (human proportions with cranium, sculpted jaw, ears, brows & nose)
  const head = new THREE.Group();
  head.position.y = 0.5;
  torso.add(head);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.054, 0.07, 0.11, 14),
    skinMat,
  );
  neck.position.set(0, 0.04, -0.004);
  head.add(neck);

  const cranium = new THREE.Mesh(
    new THREE.SphereGeometry(0.116, 20, 16),
    skinMat,
  );
  cranium.scale.set(0.88, 1.04, 0.96);
  cranium.position.set(0, 0.2, 0);
  head.add(cranium);

  const jaw = new THREE.Mesh(
    new THREE.SphereGeometry(0.084, 16, 12),
    skinMat,
  );
  jaw.scale.set(0.84, 0.88, 0.9);
  jaw.position.set(0, 0.142, 0.026);
  head.add(jaw);

  // Subtle ears so the head silhouette reads naturally from behind and the sides
  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), skinMat);
    ear.scale.set(0.42, 1.05, 0.72);
    ear.position.set(side * 0.102, 0.192, -0.005);
    head.add(ear);
  }

  const nose = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.011, 0.022, 6, 8),
    skinMat,
  );
  nose.rotation.x = -0.25;
  nose.position.set(0, 0.185, 0.112);
  head.add(nose);

  // Eyes & eyebrows
  const eyeMat = makeMat('#111827', 0.2, 0.1);
  for (const side of [-1, 1] as const) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), eyeMat);
    eye.scale.set(1.15, 0.78, 0.55);
    eye.position.set(side * 0.038, 0.205, 0.102);
    head.add(eye);

    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.006, 0.024, 4, 6),
      hairMat,
    );
    brow.rotation.z = Math.PI * 0.5 + side * 0.16;
    brow.position.set(side * 0.038, 0.226, 0.105);
    head.add(brow);
  }

  // Headgear / Hair variants
  const headgear = isEnemy
    ? archetype === 'petasan_kiter'
      ? 'topi_sekolah'
      : archetype === 'gir_spinner'
        ? 'slayer_wajah'
        : archetype === 'pentolan'
          ? 'helm_proyek'
          : 'rambut_rapih'
    : config.headgear;

  // Sculpted hair cap + natural front fringe
  const hairTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.121, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat,
  );
  hairTop.scale.set(0.9, 1.02, 0.98);
  hairTop.position.set(0, 0.22, -0.008);
  head.add(hairTop);

  const hairBackCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.114, 16, 12),
    hairMat,
  );
  hairBackCap.scale.set(0.88, 0.88, 0.72);
  hairBackCap.position.set(0, 0.205, -0.038);
  head.add(hairBackCap);

  if (headgear === 'rambut_gondrong') {
    const hairBack = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.095, 0.12, 8, 12),
      hairMat,
    );
    hairBack.scale.set(1.06, 1, 0.72);
    hairBack.position.set(0, 0.145, -0.056);
    head.add(hairBack);
  } else if (headgear === 'topi_sekolah') {
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.126, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      makeMat(isEnemy ? '#1e3a8a' : '#334155', 0.72, 0.05),
    );
    capDome.scale.set(0.92, 1.0, 1.0);
    capDome.position.set(0, 0.225, 0);
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.118, 0.014, 16, 1, false, -Math.PI * 0.38, Math.PI * 0.76),
      makeMat('#111827', 0.65, 0.05),
    );
    visor.position.set(0, 0.238, 0.065);
    visor.rotation.x = 0.16;
    head.add(capDome, visor);
  } else if (headgear === 'slayer_wajah') {
    const slayerMat = makeMat(
      isEnemy ? '#ea580c' : config.slayerColor,
      0.78,
      0.04,
      true,
    );
    const mask = new THREE.Mesh(
      new THREE.CylinderGeometry(0.098, 0.084, 0.095, 18),
      slayerMat,
    );
    mask.scale.set(0.92, 1, 1.04);
    mask.position.set(0, 0.145, 0.02);
    const knot = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 8),
      slayerMat,
    );
    knot.position.set(0, 0.145, -0.085);
    head.add(mask, knot);
  } else if (headgear === 'helm_proyek') {
    const helmMat = makeMat(isEnemy ? '#eab308' : '#f59e0b', 0.28, 0.15);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
      helmMat,
    );
    dome.scale.set(0.94, 1.02, 1.0);
    dome.position.set(0, 0.225, 0);
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.148, 0.156, 0.018, 20),
      helmMat,
    );
    brim.scale.set(0.95, 1, 1.05);
    brim.position.set(0, 0.225, 0.015);
    head.add(dome, brim);
  } else {
    // Neat front bangs cluster for rambut_rapih
    const bangs = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.036, 0.075, 6, 8),
      hairMat,
    );
    bangs.rotation.z = Math.PI * 0.44;
    bangs.position.set(0.01, 0.268, 0.08);
    head.add(bangs);
  }

  // Arms (tapered anatomical biceps/forearms + short-sleeve cuff for shirts + sculpted hand w/ thumb)
  const sleeveMat = useJacket ? jacketMat : shirtMat;
  const upperArmGeo = buildTaperedLimbGeo(0.245, 0.056, 0.06, 0.044, 0.42);
  const shortSleeveGeo = buildTaperedLimbGeo(0.145, 0.06, 0.064, 0.06, 0.45);
  const forearmGeo = buildTaperedLimbGeo(0.24, 0.045, 0.049, 0.034, 0.35);

  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.22, 0.415, 0);
    torso.add(shoulder);

    const deltoid = new THREE.Mesh(
      new THREE.SphereGeometry(0.066, 14, 12),
      sleeveMat,
    );
    deltoid.scale.set(0.92, 1.08, 0.94);
    shoulder.add(deltoid);

    if (useJacket) {
      const upperArm = new THREE.Mesh(upperArmGeo, sleeveMat);
      shoulder.add(upperArm);
    } else {
      const bareUpperArm = new THREE.Mesh(upperArmGeo, skinMat);
      const shortSleeve = new THREE.Mesh(shortSleeveGeo, sleeveMat);
      shoulder.add(bareUpperArm, shortSleeve);
    }

    const elbow = new THREE.Group();
    elbow.position.y = -0.245;
    shoulder.add(elbow);

    const elbowJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.043, 10, 10),
      useJacket ? sleeveMat : skinMat,
    );
    elbow.add(elbowJoint);

    const forearm = new THREE.Mesh(
      forearmGeo,
      useJacket ? sleeveMat : skinMat,
    );
    elbow.add(forearm);

    const handGroup = new THREE.Group();
    handGroup.position.y = -0.245;
    elbow.add(handGroup);

    const palm = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 12, 10),
      skinMat,
    );
    palm.scale.set(0.68, 1.12, 0.88);
    palm.position.y = -0.022;
    handGroup.add(palm);

    const fingers = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.022, 0.032, 5, 8),
      skinMat,
    );
    fingers.scale.set(0.75, 1, 1.15);
    fingers.position.set(0, -0.055, 0.01);
    fingers.rotation.x = 0.28;
    handGroup.add(fingers);

    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.011, 0.024, 4, 6),
      skinMat,
    );
    thumb.position.set(-side * 0.02, -0.022, 0.032);
    thumb.rotation.x = 0.55;
    thumb.rotation.z = side * 0.35;
    handGroup.add(thumb);

    return { shoulder, elbow, hand: handGroup };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Weapon mount on right hand angled naturally forward & upward
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.265, 0.022);
  weaponMount.rotation.set(Math.PI * 0.22, 0, -0.18);
  rightArm.elbow.add(weaponMount);

  const weaponId: WeaponId = isEnemy
    ? archetype === 'gir_spinner'
      ? 'gir_sabuk'
      : archetype === 'pentolan'
        ? 'sabit_modif'
        : archetype === 'rusher'
          ? 'kayu_paku'
          : 'penggaris_baja'
    : config.primaryWeapon;

  const weaponGroup = buildWeaponMesh(weaponId);
  weaponMount.add(weaponGroup);

  // Legs (anatomical thighs + knee cap + curved calves + contoured sneakers)
  const thighGeo = buildTaperedLimbGeo(0.415, 0.078, 0.076, 0.056, 0.38);
  const shinGeo = buildTaperedLimbGeo(0.39, 0.056, 0.064, 0.042, 0.34);
  const sneakerUpperGeo = buildSneakerUpperGeo();

  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, -0.035, 0);
    hips.add(hip);

    const hipJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.076, 12, 10),
      pantsMat,
    );
    hip.add(hipJoint);

    const thigh = new THREE.Mesh(thighGeo, pantsMat);
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.415;
    hip.add(knee);

    const kneeJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.054, 10, 10),
      pantsMat,
    );
    knee.add(kneeJoint);

    const shin = new THREE.Mesh(shinGeo, pantsMat);
    knee.add(shin);

    const shoe = new THREE.Mesh(sneakerUpperGeo, shoeMat);
    shoe.position.set(0, -0.405, 0.038);
    knee.add(shoe);

    const sole = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.054, 0.12, 6, 12),
      soleMat,
    );
    sole.rotation.x = Math.PI * 0.5;
    sole.scale.set(1.02, 1, 0.28);
    sole.position.set(0, -0.448, 0.038);
    knee.add(sole);

    return { hip, knee };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Overhead Enemy / Ally Health Bar
  let hpBarGroup: THREE.Group | null = null;
  let hpBarFill: THREE.Mesh | null = null;
  if (isEnemy || isAlly) {
    hpBarGroup = new THREE.Group();
    hpBarGroup.position.y = isPentolan ? 2.25 : 2.02;
    const barW = isAlly ? 0.74 : 0.84;
    const fillW = isAlly ? 0.7 : 0.8;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(barW, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x18181b, side: THREE.DoubleSide }),
    );
    hpBarFill = new THREE.Mesh(
      new THREE.PlaneGeometry(fillW, 0.068),
      new THREE.MeshBasicMaterial({
        color: isAlly ? 0x10b981 : isPentolan ? 0xdc2626 : 0xf59e0b,
        side: THREE.DoubleSide,
      }),
    );
    hpBarFill.position.z = 0.01;
    hpBarGroup.add(bg, hpBarFill);
    root.add(hpBarGroup);
  }

  root.traverse((obj) => {
    if (
      (obj as THREE.Mesh).isMesh &&
      obj !== shadowDisc &&
      obj !== telegraphRing &&
      obj.parent !== hpBarGroup
    ) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return {
    root,
    hips,
    torso,
    head,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    weaponMount,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    shadowDisc,
    telegraphRing,
    hpBarGroup,
    hpBarFill,
    hitFlashMaterials,
    weaponGroup,
    girAnchor: weaponGroup.getObjectByName('gir_anchor') ?? null,
  };
}
