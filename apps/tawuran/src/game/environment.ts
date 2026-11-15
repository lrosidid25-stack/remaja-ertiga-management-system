import * as THREE from 'three';
import asphaltImgUrl from '../assets/images/tex_asphalt_street_1794731085204.jpg';
import concreteImgUrl from '../assets/images/tex_concrete_wall_1794731086713.jpg';
import { LEVELS, type LevelConfig } from './maps';

export interface StreetEnvironment {
  group: THREE.Group;
  lampLights: THREE.PointLight[];
  disposables: Array<{ dispose: () => void }>;
}

function makeAsphaltBumpCanvas(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 100 + Math.floor(Math.random() * 55);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 24);
  return tex;
}

function makeCorrugatedBump(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  for (let x = 0; x < 64; x++) {
    const v = Math.round(128 + Math.sin((x / 64) * Math.PI * 12) * 90);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

function buildParkedMotor(
  disposables: Array<{ dispose: () => void }>,
): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.24,
    metalness: 0.65,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
    metalness: 0.04,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    roughness: 0.18,
    metalness: 0.92,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111113,
    roughness: 0.9,
    metalness: 0.05,
  });
  disposables.push(bodyMat, seatMat, chromeMat, tireMat);

  // Wheels
  const wheelGeo = new THREE.TorusGeometry(0.28, 0.075, 10, 20);
  const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12);
  disposables.push(wheelGeo, rimGeo);

  for (const zOff of [-0.62, 0.62]) {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.rotation.y = Math.PI * 0.5;
    wheel.position.set(0, 0.34, zOff);
    const rim = new THREE.Mesh(rimGeo, chromeMat);
    rim.rotation.z = Math.PI * 0.5;
    rim.position.set(0, 0.34, zOff);
    g.add(wheel, rim);
  }

  // Chassis & fairing
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 1.1), bodyMat);
  frame.position.set(0, 0.62, 0);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.72), seatMat);
  seat.position.set(0, 0.86, -0.1);
  const frontShield = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.24), bodyMat);
  frontShield.position.set(0, 0.76, 0.48);
  frontShield.rotation.x = -0.2;
  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.64, 8), chromeMat);
  handlebar.rotation.z = Math.PI * 0.5;
  handlebar.position.set(0, 1.08, 0.42);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.72, 10), chromeMat);
  exhaust.rotation.x = Math.PI * 0.46;
  exhaust.position.set(0.2, 0.38, -0.35);

  g.add(frame, seat, frontShield, handlebar, exhaust);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

function buildParkedAngkot(
  disposables: Array<{ dispose: () => void }>,
): THREE.Group {
  const g = new THREE.Group();
  const tealMat = new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    roughness: 0.32,
    metalness: 0.45,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xe4e4e7,
    roughness: 0.45,
    metalness: 0.2,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.85,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111113,
    roughness: 0.9,
    metalness: 0.04,
  });
  const bumperMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.68,
    metalness: 0.3,
  });
  disposables.push(tealMat, roofMat, glassMat, tireMat, bumperMat);

  // Lower body
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.86, 3.9), tealMat);
  hull.position.set(0, 0.74, 0);
  // Cabin glass band
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.56, 3.62), glassMat);
  cabin.position.set(0, 1.42, -0.05);
  // Roof cap
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.14, 3.68), roofMat);
  roof.position.set(0, 1.76, -0.05);
  // Bumpers
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.22, 0.18), bumperMat);
  frontBumper.position.set(0, 0.4, 1.96);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.22, 0.18), bumperMat);
  rearBumper.position.set(0, 0.4, -1.96);

  // Headlights
  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.6,
    roughness: 0.2,
  });
  disposables.push(headLightMat);
  for (const sx of [-0.58, 0.58]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.06), headLightMat);
    hl.position.set(sx, 0.72, 1.96);
    g.add(hl);
  }

  // 4 Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
  disposables.push(wheelGeo);
  for (const wx of [-0.78, 0.78]) {
    for (const wz of [-1.25, 1.25]) {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.rotation.z = Math.PI * 0.5;
      w.position.set(wx, 0.32, wz);
      g.add(w);
    }
  }

  g.add(hull, cabin, roof, frontBumper, rearBumper);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export function buildStreetEnvironment(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
  level: LevelConfig = LEVELS[0],
): StreetEnvironment {
  const map = level;
  const theme = map.theme;
  const layout = map.layout;
  /** Setengah lebar jalan — dipakai untuk menaruh trotoar, tiang, & bangunan. */
  const halfRoad = layout.roadWidth / 2;
  const roadLength = 160;

  const group = new THREE.Group();
  const lampLights: THREE.PointLight[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const texLoader = new THREE.TextureLoader();

  const asphaltMap = texLoader.load(asphaltImgUrl);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = THREE.RepeatWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.repeat.set(Math.max(3, Math.round(layout.roadWidth / 4.8)), 18);
  asphaltMap.anisotropy = maxAniso;

  const concreteMap = texLoader.load(concreteImgUrl);
  concreteMap.colorSpace = THREE.SRGBColorSpace;
  concreteMap.wrapS = THREE.RepeatWrapping;
  concreteMap.wrapT = THREE.RepeatWrapping;
  concreteMap.repeat.set(2, 2);
  concreteMap.anisotropy = maxAniso;

  const asphaltBump = makeAsphaltBumpCanvas();
  const tinBump = makeCorrugatedBump();
  disposables.push(asphaltMap, concreteMap, asphaltBump, tinBump);

  // 1. Extended Asphalt Roadway (no floating box void - extends far along Z)
  const roadMat = new THREE.MeshStandardMaterial({
    color: theme.roadTint,
    map: asphaltMap,
    bumpMap: asphaltBump,
    bumpScale: 0.025,
    roughness: 0.86,
    metalness: 0.04,
  });
  const roadGeo = new THREE.PlaneGeometry(layout.roadWidth, roadLength);
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI * 0.5;
  road.receiveShadow = true;
  group.add(road);
  disposables.push(roadMat, roadGeo);

  // Outer ground shoulders extending to horizon
  const shoulderMat = new THREE.MeshStandardMaterial({
    color: 0x2a2623,
    roughness: 0.95,
    metalness: 0.02,
  });
  const shoulderGeo = new THREE.PlaneGeometry(180, 180);
  const outerGround = new THREE.Mesh(shoulderGeo, shoulderMat);
  outerGround.rotation.x = -Math.PI * 0.5;
  outerGround.position.y = -0.04;
  group.add(outerGround);
  disposables.push(shoulderMat, shoulderGeo);

  // Dashed lane markings with polygonOffset to avoid Z-fighting
  const paintMat = new THREE.MeshStandardMaterial({
    color: 0xe5e7eb,
    roughness: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const dashGeo = new THREE.PlaneGeometry(layout.markings === 'double' ? 0.18 : 0.24, 2.4);
  const dashCount = layout.markings === 'none' ? 0 : 24 * (layout.markings === 'double' ? 2 : 1);
  const dashMesh = new THREE.InstancedMesh(dashGeo, paintMat, Math.max(1, dashCount));
  const dummy = new THREE.Object3D();
  let dashIdx = 0;
  if (dashCount > 0) {
    const lanes = layout.markings === 'double' ? [-0.35, 0.35] : [0];
    for (const laneX of lanes) {
      for (let i = 0; i < 24; i++) {
        dummy.position.set(laneX, 0.02, -55 + i * 5);
        dummy.rotation.set(-Math.PI * 0.5, 0, 0);
        dummy.updateMatrix();
        dashMesh.setMatrixAt(dashIdx++, dummy.matrix);
      }
    }
  }
  dashMesh.count = dashCount;
  dashMesh.instanceMatrix.needsUpdate = true;
  dashMesh.computeBoundingSphere();
  dashMesh.receiveShadow = true;
  group.add(dashMesh);
  disposables.push(paintMat, dashGeo);

  // Sidewalks & yellow-black Indonesian curb blocks
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: concreteMap,
    roughness: 0.9,
    metalness: 0.04,
  });
  const sidewalkGeo = new THREE.BoxGeometry(5.5, 0.22, roadLength - 20);
  disposables.push(sidewalkMat, sidewalkGeo);
  for (const sx of [-(halfRoad + 1.4), halfRoad + 1.4]) {
    const sw = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    sw.position.set(sx, 0.11, 0);
    sw.receiveShadow = true;
    group.add(sw);
  }

  // Curb blocks (InstancedMesh alternating black & yellow)
  const curbGeo = new THREE.BoxGeometry(0.32, 0.24, 1.4);
  const curbMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.05 });
  const curbCount = 80;
  const curbInst = new THREE.InstancedMesh(curbGeo, curbMat, curbCount);
  const yellowC = new THREE.Color(theme.lampColor);
  const darkC = new THREE.Color(0x1f2937);
  let ci = 0;
  for (const sx of [-(halfRoad - 1.35), halfRoad - 1.35]) {
    for (let k = 0; k < 40; k++) {
      dummy.position.set(sx, 0.12, -30 + k * 1.5);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      curbInst.setMatrixAt(ci, dummy.matrix);
      curbInst.setColorAt(ci, k % 2 === 0 ? yellowC : darkC);
      ci++;
    }
  }
  curbInst.instanceMatrix.needsUpdate = true;
  if (curbInst.instanceColor) curbInst.instanceColor.needsUpdate = true;
  curbInst.computeBoundingSphere();
  group.add(curbInst);
  disposables.push(curbGeo, curbMat);

  // 2. Concrete Flyover Overpass & Side Curb Piers (clear avenue center!)
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: concreteMap,
    roughness: 0.88,
    metalness: 0.05,
  });
  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.55,
    metalness: 0.65,
  });
  disposables.push(pillarMat, darkSteelMat);

  if (layout.flyover) {
  for (const pz of [-13, 13]) {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(0, 0, pz);

    for (const sx of [-(halfRoad - 1.4), halfRoad - 1.4]) {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.1), darkSteelMat);
      plinth.position.set(sx, 0.275, 0);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 6.8, 12), pillarMat);
      shaft.position.set(sx, 3.7, 0);
      bridgeGroup.add(plinth, shaft);
    }

    const capBeam = new THREE.Mesh(new THREE.BoxGeometry(layout.roadWidth + 2, 1.0, 2.4), pillarMat);
    capBeam.position.y = 7.4;
    bridgeGroup.add(capBeam);

    bridgeGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    group.add(bridgeGroup);
  }

  // Overhead flyover deck spanning high above the street (high enough for camera clearance)
  const deckGeo = new THREE.BoxGeometry(layout.roadWidth + 4, 1.1, 58);
  const deck = new THREE.Mesh(deckGeo, pillarMat);
  deck.position.set(0, 8.5, 0);
  group.add(deck);
  disposables.push(deckGeo);
  }

  // 3. Roadside Warung Kiosks, Shophouse Facades & Corrugated Awnings
  const wallBrickMat = new THREE.MeshStandardMaterial({
    color: theme.wallTint,
    map: concreteMap,
    roughness: 0.92,
  });
  const tinMat = new THREE.MeshStandardMaterial({
    color: 0x52525b,
    bumpMap: tinBump,
    bumpScale: 0.03,
    roughness: 0.52,
    metalness: 0.65,
  });
  const awningBlueMat = new THREE.MeshStandardMaterial({
    color: theme.awningColor,
    roughness: 0.78,
    metalness: 0.04,
  });
  const woodBenchMat = new THREE.MeshStandardMaterial({
    color: 0x6b4423,
    roughness: 0.88,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: theme.lampColor,
    emissiveIntensity: 2.0,
  });
  const neonSignMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: theme.windowGlow,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  });
  disposables.push(wallBrickMat, tinMat, awningBlueMat, woodBenchMat, bulbMat, neonSignMat);

  const buildingSpecs = [
    { x: -16.2, z: -18, w: 6, h: 6.8, d: 11, rotY: 0 },
    { x: -16.4, z: -2, w: 6.2, h: 4.5, d: 9, rotY: 0 },
    { x: -16.0, z: 14, w: 5.8, h: 7.4, d: 12, rotY: 0 },
    { x: 16.2, z: -16, w: 6, h: 7.2, d: 12, rotY: Math.PI },
    { x: 16.4, z: 1, w: 6.2, h: 5.2, d: 10, rotY: Math.PI },
    { x: 16.0, z: 16, w: 5.8, h: 6.4, d: 11, rotY: Math.PI },
  ];

  const buildingOffset = halfRoad + 4.2;
  buildingSpecs
    .slice(0, Math.max(0, Math.min(buildingSpecs.length, layout.buildingCount)))
    .map((b) => ({ ...b, x: b.x < 0 ? -buildingOffset : buildingOffset }))
    .forEach((b, idx) => {
    const bg = new THREE.Group();
    bg.position.set(b.x, 0, b.z);
    bg.rotation.y = b.rotY;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, b.d),
      wallBrickMat,
    );
    body.position.y = b.h * 0.5;
    bg.add(body);

    // Corrugated tin awning facing the street
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.1, b.d * 0.78),
      idx % 2 === 0 ? tinMat : awningBlueMat,
    );
    awning.position.set(b.w * 0.5 + 1.1, 2.7, 0);
    awning.rotation.z = -0.18;
    bg.add(awning);

    // Warm lit shop sign / glass etalase box
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.55, 2.2),
      neonSignMat,
    );
    sign.position.set(b.w * 0.5 + 0.12, 3.35, 0);
    bg.add(sign);

    // Support poles + wooden warung bench & crate
    for (const pz of [-b.d * 0.34, b.d * 0.34]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8),
        darkSteelMat,
      );
      post.position.set(b.w * 0.5 + 2.1, 1.25, pz);
      bg.add(post);
    }
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.48, 2.4),
      woodBenchMat,
    );
    bench.position.set(b.w * 0.5 + 1.1, 0.24, 0);
    bg.add(bench);

    // Hanging warm bulb under awning
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), bulbMat);
    bulb.position.set(b.w * 0.5 + 1.2, 2.38, 0);
    bg.add(bulb);

    group.add(bg);
  });

  // 4. Parked Composite Motorcycle & Angkot (aligned with ARENA_OBSTACLES!)
  const motor = buildParkedMotor(disposables);
  motor.position.set(-8.75, 0, -4.5);
  motor.rotation.y = 0.22;
  group.add(motor);

  const angkot = buildParkedAngkot(disposables);
  angkot.position.set(8.8, 0, 6.1);
  angkot.rotation.y = Math.PI + 0.04;
  group.add(angkot);

  // 5. Streetlamps along the sidewalk (warm sodium-vapor light pools, capped at 4 PointLights)
  const lampX = halfRoad - 0.8;
  const allLampPositions: Array<[number, number]> = [
    [-lampX, -16],
    [lampX, -6],
    [-lampX, 8],
    [lampX, 18],
  ];
  allLampPositions.slice(0, Math.max(0, Math.min(4, layout.lamps))).forEach(([lx, lz], i) => {
    const poleGroup = new THREE.Group();
    poleGroup.position.set(lx, 0, lz);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.13, 6.2, 10),
      darkSteelMat,
    );
    pole.position.y = 3.1;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(lx < 0 ? 1.6 : -1.6, 0.1, 0.1),
      darkSteelMat,
    );
    arm.position.set(lx < 0 ? 0.7 : -0.7, 6.1, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), bulbMat);
    head.position.set(lx < 0 ? 1.35 : -1.35, 6.0, 0);
    poleGroup.add(pole, arm, head);
    group.add(poleGroup);

    if (!isSoftwareGl || i < 3) {
      const pl = new THREE.PointLight(theme.lampColor, theme.lampIntensity, 26, 1.5);
      pl.position.set(lx + (lx < 0 ? 1.35 : -1.35), 5.6, lz);
      group.add(pl);
      lampLights.push(pl);
    }
  });

  // 6. Warm Late-Afternoon Sunset Sky Horizon Glow & Distant City Skyline
  const sunsetBackdropMat = new THREE.MeshBasicMaterial({
    color: theme.horizonGlow,
    transparent: true,
    opacity: theme.horizonGlowOpacity,
    fog: false,
  });
  const sunsetDisc = new THREE.Mesh(new THREE.PlaneGeometry(140, 36), sunsetBackdropMat);
  sunsetDisc.position.set(0, 12, -72);
  group.add(sunsetDisc);
  disposables.push(sunsetBackdropMat);

  const skylineMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.95,
  });
  const windowLightMat = new THREE.MeshBasicMaterial({
    color: theme.windowGlow,
  });
  disposables.push(skylineMat, windowLightMat);
  const skylineCount = layout.skyline ? 12 : 0;
  for (let i = 0; i < skylineCount; i++) {
    const h = 14 + ((i * 7) % 18);
    const w = 6 + (i % 4) * 2;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), skylineMat);
    const side = i % 2 === 0 ? -1 : 1;
    const zPos = i < 6 ? -48 - (i % 3) * 12 : 48 + (i % 3) * 12;
    tower.position.set(side * (16 + (i % 3) * 7), h * 0.5, zPos);
    group.add(tower);

    if (i < 6) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.8, 0.2), windowLightMat);
      win.position.set(tower.position.x, h * 0.62, tower.position.z + 4.1);
      group.add(win);
    }
  }

  // 7. Perabot jalan tambahan sesuai map (cone, drum, spanduk)
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.75 });
  const coneBandMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.8, metalness: 0.35 });
  const bannerMat = new THREE.MeshStandardMaterial({
    color: theme.windowGlow,
    emissive: theme.horizonGlow,
    emissiveIntensity: 0.5,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  disposables.push(coneMat, coneBandMat, drumMat, bannerMat);

  const coneGeo = new THREE.ConeGeometry(0.26, 0.72, 10);
  const coneBandGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.12, 10);
  disposables.push(coneGeo, coneBandGeo);
  for (let i = 0; i < layout.cones; i++) {
    const cone = new THREE.Group();
    const body = new THREE.Mesh(coneGeo, coneMat);
    body.position.y = 0.36;
    const band = new THREE.Mesh(coneBandGeo, coneBandMat);
    band.position.y = 0.44;
    cone.add(body, band);
    const side = i % 2 === 0 ? -1 : 1;
    cone.position.set(side * (halfRoad - 0.9 - (i % 3) * 0.7), 0, -14 + i * 4.6);
    group.add(cone);
  }

  const drumGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.9, 14);
  disposables.push(drumGeo);
  for (let i = 0; i < layout.drums; i++) {
    const drum = new THREE.Mesh(drumGeo, drumMat);
    const side = i % 2 === 0 ? 1 : -1;
    drum.position.set(side * (halfRoad - 1.7 - (i % 2) * 0.9), 0.45, 10 - i * 6);
    drum.rotation.y = i * 0.7;
    drum.castShadow = true;
    group.add(drum);
  }

  const bannerGeo = new THREE.PlaneGeometry(Math.max(4, layout.roadWidth * 0.55), 1.1);
  disposables.push(bannerGeo);
  for (let i = 0; i < layout.banners; i++) {
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, 4.6 + (i % 2) * 0.4, -20 + i * 9);
    banner.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.08;
    group.add(banner);
  }

  return { group, lampLights, disposables };
}
