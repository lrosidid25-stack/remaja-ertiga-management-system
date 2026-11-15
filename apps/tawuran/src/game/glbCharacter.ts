/**
 * Karakter modular berbasis GLB (hasil pipeline Blender / `scripts/build-base-glb.mjs`).
 *
 * Alur: `public/characters/base_humanoid.glb` di-parse sekali (di-cache), lalu
 * setiap kali pemain ganti kostum kita kloning scene-nya (SkeletonUtils) dan
 * petakan tulangnya ke struktur `FighterRig` yang dipakai engine.
 *
 * Kalau aset tidak ada / rusak, fungsi mengembalikan null dan engine otomatis
 * memakai rig prosedural — game tidak pernah gagal hanya karena model.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { buildWeaponMesh, type FighterRig } from './models';
import type { WeaponId } from './types';

/** Path relatif supaya tetap jalan di WebView Android (`base: './'`). */
export const BASE_CHARACTER_GLB_URL = './characters/base_humanoid.glb';

/** Nama tulang yang wajib ada di GLB (sama dengan template Blender). */
export const REQUIRED_BONES = [
  'pelvis',
  'spine_02',
  'head',
  'upperarm_l',
  'lowerarm_l',
  'upperarm_r',
  'lowerarm_r',
  'thigh_l',
  'calf_l',
  'thigh_r',
  'calf_r',
  'hand_r',
] as const;

/** Tulang yang diputar oleh animasi prosedural engine (butuh pivot sendiri). */
export const ANIMATED_BONES = [
  'pelvis',
  'spine_02',
  'head',
  'upperarm_l',
  'lowerarm_l',
  'upperarm_r',
  'lowerarm_r',
  'thigh_l',
  'calf_l',
  'thigh_r',
  'calf_r',
] as const;

export const CHARACTER_SOCKETS = [
  'SOCKET_Hair',
  'SOCKET_Hat',
  'SOCKET_Glasses',
  'SOCKET_FaceMask',
  'SOCKET_Backpack',
  'SOCKET_Jacket',
] as const;

let scenePromise: Promise<THREE.Object3D | null> | null = null;

/** Muat (dan cache) scene karakter GLB. Mengembalikan null kalau gagal. */
export function loadBaseCharacterScene(
  url: string = BASE_CHARACTER_GLB_URL,
): Promise<THREE.Object3D | null> {
  if (!scenePromise) {
    scenePromise = new GLTFLoader()
      .loadAsync(url)
      .then((gltf) => gltf.scene)
      .catch(() => null);
  }
  return scenePromise;
}

/** Lupakan cache (dipakai kalau pemain mau coba muat ulang). */
export function resetBaseCharacterSceneCache(): void {
  scenePromise = null;
}

function buildShadowDisc(): THREE.Mesh {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.44, 20),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    }),
  );
  disc.rotation.x = -Math.PI * 0.5;
  disc.position.y = 0.02;
  disc.name = 'shadow_disc';
  return disc;
}

function buildTelegraphRing(): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 24),
    new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI * 0.5;
  ring.position.y = 0.03;
  ring.name = 'telegraph_ring';
  ring.visible = false;
  return ring;
}

/**
 * Bangun `FighterRig` dari scene GLB.
 * Setiap kelompok sendi dipetakan ke tulang yang sesuai supaya animasi
 * prosedural engine (`animateFighterPose`) tetap bekerja tanpa perubahan.
 */
export function buildGlbFighterRig(
  source: THREE.Object3D,
  weapon: WeaponId,
  options: {
    castShadow?: boolean;
    /** Pengganti `buildWeaponMesh` (dipakai tes supaya tidak butuh canvas/DOM). */
    weaponFactory?: (id: WeaponId) => THREE.Object3D;
  } = {},
): FighterRig | null {
  let root: THREE.Object3D;
  try {
    root = cloneSkeleton(source);
  } catch {
    return null;
  }

  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);

  const bones = new Map<string, THREE.Bone>();
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      bones.set(obj.name, obj as THREE.Bone);
    }
  });

  for (const name of REQUIRED_BONES) {
    if (!bones.has(name)) return null;
  }

  // Material dikloning per karakter supaya kilatan kena pukul tidak menular
  // ke karakter lain yang memakai aset GLB yang sama.
  const hitFlashMaterials: THREE.MeshStandardMaterial[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    mesh.castShadow = options.castShadow ?? false;
    const material = mesh.material as THREE.Material | THREE.Material[];
    const list = Array.isArray(material) ? material : [material];
    const cloned = list.map((m) => {
      const copy = m.clone();
      if ((copy as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        hitFlashMaterials.push(copy as THREE.MeshStandardMaterial);
      }
      return copy;
    });
    mesh.material = Array.isArray(material) ? cloned : cloned[0];
  });

  /**
   * Engine menghapus rotasi sendi saat animasi (`rotation.set(...)`), jadi kalau
   * tulang punya rotasi istirahat (mis. lengan A-pose 45° dari Blender), pose
   * aslinya hilang. Solusinya: sisipkan pivot berotasi nol di atas tulang —
   * engine memutar pivot (sejajar sumbu induk), rotasi istirahat tulang tetap.
   */
  const pivots = new Map<string, THREE.Object3D>();
  for (const name of ANIMATED_BONES) {
    const bone = bones.get(name);
    if (!bone) continue;
    const parent = bone.parent;
    if (!parent) continue;
    const pivot = new THREE.Object3D();
    pivot.name = `${name}_pivot`;
    pivot.position.copy(bone.position);
    pivot.quaternion.identity();
    pivot.scale.set(1, 1, 1);
    parent.remove(bone);
    parent.add(pivot);
    bone.position.set(0, 0, 0);
    pivot.add(bone);
    pivots.set(name, pivot);
  }

  const joint = (name: string): THREE.Object3D => pivots.get(name) ?? bones.get(name)!;

  const handBone = bones.get('hand_r')!;
  const weaponMount = new THREE.Group();
  weaponMount.name = 'weapon_mount';
  weaponMount.position.set(0, -0.16, 0.02);
  weaponMount.rotation.set(Math.PI * 0.22, 0, -0.18);
  handBone.add(weaponMount);

  const weaponGroup = (options.weaponFactory ?? buildWeaponMesh)(weapon);
  weaponMount.add(weaponGroup);

  const shadowDisc = buildShadowDisc();
  const telegraphRing = buildTelegraphRing();
  root.add(shadowDisc);
  root.add(telegraphRing);

  return {
    root,
    hips: joint('pelvis'),
    torso: joint('spine_02'),
    head: joint('head'),
    leftShoulder: joint('upperarm_l'),
    leftElbow: joint('lowerarm_l'),
    rightShoulder: joint('upperarm_r'),
    rightElbow: joint('lowerarm_r'),
    weaponMount,
    leftHip: joint('thigh_l'),
    leftKnee: joint('calf_l'),
    rightHip: joint('thigh_r'),
    rightKnee: joint('calf_r'),
    shadowDisc,
    telegraphRing,
    hpBarGroup: null,
    hpBarFill: null,
    hitFlashMaterials,
    weaponGroup: weaponGroup as THREE.Group,
    girAnchor: weaponGroup.getObjectByName('gir_anchor') ?? handBone,
  };
}

/** Daftar socket aksesori yang tersedia di GLB (untuk modul rambut/topi/dll). */
export function listCharacterSockets(root: THREE.Object3D): string[] {
  const found: string[] = [];
  root.traverse((obj) => {
    if (CHARACTER_SOCKETS.includes(obj.name as (typeof CHARACTER_SOCKETS)[number])) {
      found.push(obj.name);
    }
  });
  return found;
}
