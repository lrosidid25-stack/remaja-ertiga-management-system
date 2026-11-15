#!/usr/bin/env node
/**
 * Generator karakter modular untuk game Tawuran.
 *
 * Menghasilkan `public/characters/base_humanoid.glb` — glTF 2.0 biner berisi:
 *   - skeleton humanoid (nama tulang sama dengan template Blender di `blender/`)
 *   - 1 skinned mesh "SKM_Base_Body" (kubus low-poly, bobot kaku per tulang)
 *   - socket aksesori kosong: SOCKET_Hair, SOCKET_Hat, SOCKET_Glasses,
 *     SOCKET_FaceMask, SOCKET_Backpack, SOCKET_Jacket
 *
 * Skrip ini tidak butuh dependensi apa pun (jalan di CI sebelum `vite build`),
 * sehingga aset selalu bisa dibuat ulang: `npm run build:glb`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const OUT_PATH = resolve(process.cwd(), 'public/characters/base_humanoid.glb');

/* ---------------------------------------------------------------- skeleton */

// Posisi sendi dalam ruang three.js (Y ke atas, +Z arah hadap karakter).
// Semua tulang memakai rotasi identitas supaya rotasi lokalnya sejajar sumbu
// dunia — sama seperti grup rig prosedural di engine.
const BONES = [
  ['root', null, 0, 0, 0],
  ['pelvis', 'root', 0, 0.95, 0],
  ['spine_01', 'pelvis', 0, 1.05, 0],
  ['spine_02', 'spine_01', 0, 1.2, 0],
  ['spine_03', 'spine_02', 0, 1.35, 0],
  ['neck_01', 'spine_03', 0, 1.5, 0],
  ['head', 'neck_01', 0, 1.58, 0],

  ['clavicle_l', 'spine_03', 0.03, 1.47, 0],
  ['upperarm_l', 'clavicle_l', 0.15, 1.47, 0],
  ['lowerarm_l', 'upperarm_l', 0.35, 1.27, 0],
  ['hand_l', 'lowerarm_l', 0.55, 1.07, 0],

  ['clavicle_r', 'spine_03', -0.03, 1.47, 0],
  ['upperarm_r', 'clavicle_r', -0.15, 1.47, 0],
  ['lowerarm_r', 'upperarm_r', -0.35, 1.27, 0],
  ['hand_r', 'lowerarm_r', -0.55, 1.07, 0],

  ['thigh_l', 'pelvis', 0.1, 0.95, 0],
  ['calf_l', 'thigh_l', 0.1, 0.5, 0],
  ['foot_l', 'calf_l', 0.1, 0.08, 0],

  ['thigh_r', 'pelvis', -0.1, 0.95, 0],
  ['calf_r', 'thigh_r', -0.1, 0.5, 0],
  ['foot_r', 'calf_r', -0.1, 0.08, 0],
];

// Socket aksesori: titik tempel untuk modul (rambut, topi, kacamata, masker,
// tas punggung, jaket) supaya modul bisa dipasang tanpa mengubah mesh badan.
const SOCKETS = [
  ['SOCKET_Hair', 'head', 0, 1.75, 0],
  ['SOCKET_Hat', 'head', 0, 1.73, 0],
  ['SOCKET_Glasses', 'head', 0, 1.66, 0.09],
  ['SOCKET_FaceMask', 'head', 0, 1.6, 0.1],
  ['SOCKET_Backpack', 'spine_03', 0, 1.35, -0.12],
  ['SOCKET_Jacket', 'spine_03', 0, 1.35, 0],
];

/* ------------------------------------------------------------------- mesh */

const SKIN = [0.776, 0.545, 0.349];
const SHIRT = [0.16, 0.2, 0.28];
const PANTS = [0.24, 0.26, 0.31];
const SHOES = [0.12, 0.12, 0.14];

// [bone, centerX, centerY, centerZ, sizeX, sizeY, sizeZ, rotZdeg, warna]
const PARTS = [
  ['pelvis', 0, 1.0, 0, 0.34, 0.22, 0.22, 0, PANTS],
  ['spine_02', 0, 1.3, 0, 0.42, 0.36, 0.24, 0, SHIRT],
  ['head', 0, 1.7, 0, 0.24, 0.26, 0.24, 0, SKIN],
  ['clavicle_l', 0.07, 1.47, 0, 0.14, 0.1, 0.16, 0, SHIRT],
  ['upperarm_l', 0.25, 1.37, 0, 0.13, 0.32, 0.13, -45, SHIRT],
  ['lowerarm_l', 0.45, 1.17, 0, 0.11, 0.3, 0.11, -45, SKIN],
  ['hand_l', 0.58, 1.03, 0, 0.1, 0.12, 0.1, 0, SKIN],
  ['clavicle_r', -0.07, 1.47, 0, 0.14, 0.1, 0.16, 0, SHIRT],
  ['upperarm_r', -0.25, 1.37, 0, 0.13, 0.32, 0.13, 45, SHIRT],
  ['lowerarm_r', -0.45, 1.17, 0, 0.11, 0.3, 0.11, 45, SKIN],
  ['hand_r', -0.58, 1.03, 0, 0.1, 0.12, 0.1, 0, SKIN],
  ['thigh_l', 0.1, 0.73, 0, 0.16, 0.46, 0.17, 0, PANTS],
  ['calf_l', 0.1, 0.29, 0, 0.14, 0.44, 0.15, 0, PANTS],
  ['foot_l', 0.1, 0.05, 0.04, 0.14, 0.1, 0.26, 0, SHOES],
  ['thigh_r', -0.1, 0.73, 0, 0.16, 0.46, 0.17, 0, PANTS],
  ['calf_r', -0.1, 0.29, 0, 0.14, 0.44, 0.15, 0, PANTS],
  ['foot_r', -0.1, 0.05, 0.04, 0.14, 0.1, 0.26, 0, SHOES],
];

// 24 vertex per kubus (4 per sisi) supaya normal tiap sisi tajam.
const BOX_FACES = [
  // [normal, 4 corner sign]
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
  [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
  [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]],
  [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
  [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
  [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
];

const positions = [];
const normals = [];
const colors = [];
const joints = [];
const weights = [];
const indices = [];
const boneIndexByName = new Map(BONES.map(([name], i) => [name, i]));

// Posisi di tabel BONES/SOCKETS adalah posisi dunia (sendi), sedangkan glTF
// memakai transform relatif terhadap induk → hitung selisihnya di sini.
const absPos = new Map();
for (const [name, , x, y, z] of [...BONES, ...SOCKETS]) absPos.set(name, [x, y, z]);

function relativeTranslation(name, parent) {
  const p = absPos.get(name);
  const base = parent ? absPos.get(parent) : [0, 0, 0];
  return [p[0] - base[0], p[1] - base[1], p[2] - base[2]];
}

let vertexBase = 0;
for (const [bone, cx, cy, cz, sx, sy, sz, rotZ, color] of PARTS) {
  const joint = boneIndexByName.get(bone);
  if (joint === undefined) throw new Error(`Tulang tidak dikenal: ${bone}`);
  const rad = (rotZ * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  for (const [normal, corners] of BOX_FACES) {
    const nx = normal[0] * cos - normal[1] * sin;
    const ny = normal[0] * sin + normal[1] * cos;
    for (const corner of corners) {
      const lx = corner[0] * 0.5 * sx;
      const ly = corner[1] * 0.5 * sy;
      const lz = corner[2] * 0.5 * sz;
      positions.push(cx + lx * cos - ly * sin, cy + lx * sin + ly * cos, cz + lz);
      normals.push(nx, ny, normal[2]);
      colors.push(color[0], color[1], color[2]);
      joints.push(joint, 0, 0, 0);
      weights.push(1, 0, 0, 0);
    }
  }

  const start = vertexBase;
  for (let f = 0; f < BOX_FACES.length; f += 1) {
    const o = start + f * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  vertexBase += 24;
}

/* ------------------------------------------------------- binary glTF build */

const chunks = [];
let byteOffset = 0;

function pushBufferView(typedArray, target) {
  const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  const pad = (4 - (byteOffset % 4)) % 4;
  if (pad > 0) {
    chunks.push(Buffer.alloc(pad));
    byteOffset += pad;
  }
  const view = { buffer: 0, byteOffset, byteLength: bytes.length };
  if (target) view.target = target;
  chunks.push(bytes);
  byteOffset += bytes.length;
  return view;
}

const bufferViews = [];
const accessors = [];
let accessorIndex = 0;

function addAccessor(data, { componentType, type, count, target, min, max, normalized }) {
  bufferViews.push(pushBufferView(data, target));
  const accessor = {
    bufferView: bufferViews.length - 1,
    componentType,
    count,
    type,
  };
  if (normalized) accessor.normalized = true;
  if (min) accessor.min = min;
  if (max) accessor.max = max;
  accessors.push(accessor);
  accessorIndex += 1;
  return accessorIndex - 1;
}

const FLOAT = 5126;
const USHORT = 5123;
const UBYTE = 5121;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

const posMin = [Infinity, Infinity, Infinity];
const posMax = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < positions.length; i += 3) {
  for (let a = 0; a < 3; a += 1) {
    posMin[a] = Math.min(posMin[a], positions[i + a]);
    posMax[a] = Math.max(posMax[a], positions[i + a]);
  }
}

const vertexCount = positions.length / 3;

const posAccessor = addAccessor(new Float32Array(positions), {
  componentType: FLOAT,
  type: 'VEC3',
  count: vertexCount,
  target: ARRAY_BUFFER,
  min: posMin,
  max: posMax,
});
const normalAccessor = addAccessor(new Float32Array(normals), {
  componentType: FLOAT,
  type: 'VEC3',
  count: vertexCount,
  target: ARRAY_BUFFER,
});
const colorAccessor = addAccessor(new Float32Array(colors), {
  componentType: FLOAT,
  type: 'VEC3',
  count: vertexCount,
  target: ARRAY_BUFFER,
});
const jointsAccessor = addAccessor(new Uint16Array(joints), {
  componentType: USHORT,
  type: 'VEC4',
  count: vertexCount,
  target: ARRAY_BUFFER,
});
const weightsAccessor = addAccessor(new Float32Array(weights), {
  componentType: FLOAT,
  type: 'VEC4',
  count: vertexCount,
  target: ARRAY_BUFFER,
});
const indexArray = new Uint32Array(indices);
const indexAccessor = addAccessor(
  indexArray,
  {
    componentType: 5125,
    type: 'SCALAR',
    count: indices.length,
    target: ELEMENT_ARRAY_BUFFER,
  },
);
const UINT = 5125;
// componentType sebenarnya ditentukan di atas (5125 = UNSIGNED_INT)
accessors[indexAccessor].componentType = UINT;

// inverse bind matrix per tulang (rotasi identitas → invers = translasi negatif)
const inverseBind = new Float32Array(BONES.length * 16);
BONES.forEach(([name], i) => {
  const [x, y, z] = absPos.get(name);
  // column-major mat4: identitas dengan translasi -pos
  inverseBind.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1], i * 16);
});
const inverseBindAccessor = addAccessor(inverseBind, {
  componentType: FLOAT,
  type: 'MAT4',
  count: BONES.length,
});

/* --------------------------------------------------------------- glTF JSON */

const nodes = [];
const nodeIndexByName = new Map();
const childrenOf = new Map();

for (const [name, parent] of BONES) {
  if (parent) {
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(name);
  }
}
for (const [name, parent] of SOCKETS) {
  if (!childrenOf.has(parent)) childrenOf.set(parent, []);
  childrenOf.get(parent).push(name);
}

function nodeFor(name, parent, translation) {
  const node = { name };
  if (translation) node.translation = translation;
  if (parent) node.parent = parent;
  nodeIndexByName.set(name, nodes.length);
  nodes.push(node);
  return nodes.length - 1;
}

// Tulang dibuat lebih dulu supaya `skin.joints` bisa mereferensikan indeksnya.
for (const [name, parent] of BONES) {
  nodeFor(name, parent, relativeTranslation(name, parent));
}
for (const [name, parent] of SOCKETS) {
  const idx = nodeFor(name, parent, relativeTranslation(name, parent));
  nodes[idx].extras = { socket: true };
}

// Sambungkan children (pakai nama → indeks).
for (const node of nodes) {
  const kids = childrenOf.get(node.name);
  if (!kids || kids.length === 0) continue;
  node.children = kids.map((childName) => {
    const childIndex = nodeIndexByName.get(childName);
    if (childIndex === undefined) throw new Error(`Node anak hilang: ${childName}`);
    return childIndex;
  });
}

const meshNode = {
  name: 'SKM_Base_Body',
  mesh: 0,
  skin: 0,
};
const meshNodeIndex = nodes.length;
nodes.push(meshNode);

const gltf = {
  asset: { version: '2.0', generator: 'tawuran build-base-glb.mjs' },
  scene: 0,
  scenes: [{ name: 'Character_Export_Root', nodes: [nodeIndexByName.get('root'), meshNodeIndex] }],
  nodes,
  meshes: [
    {
      name: 'SKM_Base_Body',
      primitives: [
        {
          attributes: {
            POSITION: posAccessor,
            NORMAL: normalAccessor,
            COLOR_0: colorAccessor,
            JOINTS_0: jointsAccessor,
            WEIGHTS_0: weightsAccessor,
          },
          indices: indexAccessor,
          material: 0,
        },
      ],
    },
  ],
  materials: [
    {
      name: 'M_Body',
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0.05,
        roughnessFactor: 0.78,
      },
    },
  ],
  skins: [
    {
      name: 'Humanoid_Rig',
      joints: BONES.map(([name]) => nodeIndexByName.get(name)),
      inverseBindMatrices: inverseBindAccessor,
      skeleton: nodeIndexByName.get('root'),
    },
  ],
  accessors,
  bufferViews,
  buffers: [{ byteLength: byteOffset }],
};

/* -------------------------------------------------------------- GLB writer */

const jsonText = Buffer.from(JSON.stringify(gltf), 'utf8');
const jsonPad = (4 - (jsonText.length % 4)) % 4;
const jsonChunk = Buffer.concat([jsonText, Buffer.alloc(jsonPad, 0x20)]);
const bin = Buffer.concat(chunks);
const binPad = (4 - (bin.length % 4)) % 4;
const binChunk = Buffer.concat([bin, Buffer.alloc(binPad, 0)]);

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // 'glTF'
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonChunk.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binChunk.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

const glb = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, glb);

console.log(
  `✔ ${OUT_PATH}\n  ${glb.length} byte · ${BONES.length} tulang · ${SOCKETS.length} socket · ${vertexCount} vertex · ${indices.length / 3} segitiga`,
);
