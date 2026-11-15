import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  CHARACTER_SOCKETS,
  REQUIRED_BONES,
  buildGlbFighterRig,
  listCharacterSockets,
} from './glbCharacter';

const GLB_PATH = new URL('../../public/characters/base_humanoid.glb', import.meta.url);

/** Senjata tiruan: cukup Group + child `gir_anchor`, tanpa canvas/DOM. */
function makeStubWeapon(weapon: string): THREE.Group {
  const group = new THREE.Group();
  group.name = `weapon_${weapon}`;
  const anchor = new THREE.Object3D();
  anchor.name = 'gir_anchor';
  group.add(anchor);
  return group;
}

function readGlb(): ArrayBuffer {
  const buf = readFileSync(GLB_PATH);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function readJsonChunk(buffer: ArrayBuffer): Record<string, unknown> {
  const view = new DataView(buffer);
  assert.equal(view.getUint32(0, true), 0x46546c67, 'magic glTF');
  assert.equal(view.getUint32(4, true), 2, 'versi glTF 2');
  const total = view.getUint32(8, true);
  assert.equal(total, buffer.byteLength, 'panjang header harus sama dengan file');
  const jsonLength = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  assert.equal(jsonType, 0x4e4f534a, 'chunk pertama harus JSON');
  const jsonText = new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength));
  return JSON.parse(jsonText) as Record<string, unknown>;
}

test('aset GLB karakter ada dan strukturnya valid', () => {
  const buffer = readGlb();
  assert.ok(buffer.byteLength > 1000, 'file GLB tidak boleh kosong');

  const gltf = readJsonChunk(buffer) as {
    nodes: Array<{ name: string }>;
    skins: Array<{ joints: number[] }>;
    meshes: Array<{ primitives: Array<{ attributes: Record<string, number> }> }>;
  };

  const nodeNames = gltf.nodes.map((n) => n.name);
  for (const bone of REQUIRED_BONES) {
    assert.ok(nodeNames.includes(bone), `tulang ${bone} wajib ada`);
  }
  for (const socket of CHARACTER_SOCKETS) {
    assert.ok(nodeNames.includes(socket), `socket ${socket} wajib ada`);
  }

  assert.equal(gltf.skins.length, 1, 'harus punya satu skin');
  assert.equal(gltf.skins[0].joints.length, 21, 'skin berisi 21 tulang');
  assert.equal(gltf.meshes.length, 1, 'satu mesh badan');

  const attrs = gltf.meshes[0].primitives[0].attributes;
  for (const key of ['POSITION', 'NORMAL', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0']) {
    assert.ok(key in attrs, `atribut ${key} wajib ada`);
  }
});

test('GLTFLoader bisa memuat aset dan menemukan tulang + socket', async () => {
  const gltf = await new GLTFLoader().parseAsync(readGlb(), '');
  const names: string[] = [];
  gltf.scene.traverse((obj) => names.push(obj.name));

  for (const bone of REQUIRED_BONES) {
    assert.ok(names.includes(bone), `tulang ${bone} harus terpasang di scene`);
  }
  assert.deepEqual(
    listCharacterSockets(gltf.scene).sort(),
    [...CHARACTER_SOCKETS].sort(),
    'socket aksesori harus lengkap',
  );

  const mesh = gltf.scene.getObjectByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh | undefined;
  assert.ok(mesh, 'harus ada skinned mesh');
  assert.ok(mesh.geometry.attributes.position.count > 0, 'mesh harus punya vertex');
  assert.equal(mesh.skeleton.bones.length, 21, 'skeleton berisi 21 tulang');
  const material = mesh.material as THREE.MeshStandardMaterial;
  assert.equal(material.vertexColors, true, 'warna badan memakai vertex color');
});

test('rig GLB dipetakan ke FighterRig dengan nama tulang yang benar', async () => {
  const gltf = await new GLTFLoader().parseAsync(readGlb(), '');
  const rig = buildGlbFighterRig(gltf.scene, 'gir_sabuk', { weaponFactory: makeStubWeapon });

  assert.ok(rig, 'rig harus terbentuk');
  // Tiap sendi animasi dibungkus pivot (nama `<tulang>_pivot`) yang rotasinya
  // nol, supaya pose istirahat tulang dari GLB tidak hilang.
  const expectPivot = (joint: THREE.Object3D, bone: string) => {
    assert.equal(joint.name, `${bone}_pivot`);
    assert.equal(joint.children[0]?.name, bone);
    assert.equal(joint.quaternion.x, 0);
    assert.equal(joint.quaternion.y, 0);
    assert.equal(joint.quaternion.z, 0);
    assert.equal(joint.quaternion.w, 1);
  };
  expectPivot(rig.leftShoulder, 'upperarm_l');
  expectPivot(rig.leftElbow, 'lowerarm_l');
  expectPivot(rig.rightShoulder, 'upperarm_r');
  expectPivot(rig.rightElbow, 'lowerarm_r');
  expectPivot(rig.leftHip, 'thigh_l');
  expectPivot(rig.leftKnee, 'calf_l');
  expectPivot(rig.head, 'head');
  expectPivot(rig.torso, 'spine_02');
  expectPivot(rig.hips, 'pelvis');

  assert.ok(rig.hitFlashMaterials.length > 0, 'material harus bisa dikilapkan');
  assert.ok(rig.girAnchor, 'gir_sabuk harus punya anchor sabuk');
  assert.equal(rig.weaponMount.parent?.name, 'hand_r', 'senjata menempel di tangan kanan');
  assert.equal(rig.hpBarGroup, null, 'bar HP global dipakai HUD, bukan di rig');
  assert.ok(rig.shadowDisc, 'bayangan kontak harus ada');
});

test('clone rig tidak berbagi material dengan sumber (kilatan tidak menular)', async () => {
  const gltf = await new GLTFLoader().parseAsync(readGlb(), '');
  const first = buildGlbFighterRig(gltf.scene, 'kayu_paku', { weaponFactory: makeStubWeapon });
  const second = buildGlbFighterRig(gltf.scene, 'kayu_paku', { weaponFactory: makeStubWeapon });
  assert.ok(first && second);
  assert.notEqual(first.hitFlashMaterials[0], second.hitFlashMaterials[0]);
  assert.notEqual(first.root, second.root);
});

test('scene tanpa tulang ditolak (fallback ke prosedural)', () => {
  assert.equal(
    buildGlbFighterRig(new THREE.Group(), 'kayu_paku', { weaponFactory: makeStubWeapon }),
    null,
  );
});
