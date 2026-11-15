import type {
  EnemyArchetype,
  ThrowableId,
  ThrowableSpec,
  WeaponId,
  WeaponSpec,
} from './types';

export const ARENA_BOUNDS = {
  minX: -10.5,
  maxX: 10.5,
  minZ: -26,
  maxZ: 26,
} as const;

export interface ObstacleBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const ARENA_OBSTACLES: ObstacleBox[] = [
  // Side flyover concrete piers flanking the curb (never blocking center camera!)
  { id: 'pier_nw', minX: -11.4, maxX: -9.8, minZ: -14.0, maxZ: -12.0 },
  { id: 'pier_ne', minX: 9.8, maxX: 11.4, minZ: -14.0, maxZ: -12.0 },
  { id: 'pier_sw', minX: -11.4, maxX: -9.8, minZ: 12.0, maxZ: 14.0 },
  { id: 'pier_se', minX: 9.8, maxX: 11.4, minZ: 12.0, maxZ: 14.0 },
  // Parked motor & angkot near sidewalks
  { id: 'motor_w', minX: -9.8, maxX: -7.7, minZ: -5.8, maxZ: -3.2 },
  { id: 'angkot_e', minX: 7.4, maxX: 10.2, minZ: 3.5, maxZ: 8.8 },
];

export const WEAPON_ORDER: WeaponId[] = [
  'sabit_modif',
  'gir_sabuk',
  'kayu_paku',
  'penggaris_baja',
];

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  sabit_modif: {
    id: 'sabit_modif',
    name: 'Sabit Modif Panjang',
    shortName: 'Sabit Modif',
    role: 'Jangkauan Jauh · Tebasan Tajam',
    damage: 30,
    reach: 2.85,
    arcDeg: 135,
    windupSec: 0.16,
    activeSec: 0.16,
    recoverySec: 0.24,
    staminaCost: 16,
    knockback: 5.8,
    hitstopSec: 0.055,
    staggerSec: 0.36,
  },
  gir_sabuk: {
    id: 'gir_sabuk',
    name: 'Gir Motor + Sabuk',
    shortName: 'Gir Sabuk',
    role: 'Putaran Luas · Benturan Berat',
    damage: 25,
    reach: 3.25,
    arcDeg: 240,
    windupSec: 0.21,
    activeSec: 0.2,
    recoverySec: 0.28,
    staminaCost: 22,
    knockback: 8.6,
    hitstopSec: 0.07,
    staggerSec: 0.55,
  },
  kayu_paku: {
    id: 'kayu_paku',
    name: 'Balok Kayu Berpaku',
    shortName: 'Kayu Paku',
    role: 'Hantaman Keras · Pecah Pertahanan',
    damage: 36,
    reach: 2.35,
    arcDeg: 110,
    windupSec: 0.24,
    activeSec: 0.16,
    recoverySec: 0.3,
    staminaCost: 24,
    knockback: 7.8,
    hitstopSec: 0.075,
    staggerSec: 0.6,
  },
  penggaris_baja: {
    id: 'penggaris_baja',
    name: 'Mistar Baja 100cm',
    shortName: 'Mistar Baja',
    role: 'Cepat & Lincah · Hemat Stamina',
    damage: 20,
    reach: 2.45,
    arcDeg: 120,
    windupSec: 0.1,
    activeSec: 0.13,
    recoverySec: 0.16,
    staminaCost: 10,
    knockback: 4.2,
    hitstopSec: 0.04,
    staggerSec: 0.24,
  },
};

export const MIN_GIR_LENGTH = 2.0;
export const MAX_GIR_LENGTH = 6.0;
export const DEFAULT_GIR_LENGTH = 3.5;

export function clampGirLength(meters?: number): number {
  if (typeof meters !== 'number' || !Number.isFinite(meters)) {
    return DEFAULT_GIR_LENGTH;
  }
  const clamped = Math.max(MIN_GIR_LENGTH, Math.min(MAX_GIR_LENGTH, meters));
  return Math.round(clamped * 2) / 2;
}

export function getEffectiveWeaponSpec(
  weaponId: WeaponId,
  girLengthMeters = DEFAULT_GIR_LENGTH,
): WeaponSpec {
  const base = WEAPON_SPECS[weaponId];
  if (weaponId !== 'gir_sabuk') return base;

  const len = clampGirLength(girLengthMeters);
  const t = (len - MIN_GIR_LENGTH) / (MAX_GIR_LENGTH - MIN_GIR_LENGTH);

  return {
    ...base,
    role:
      len <= 2.5
        ? 'Sabuk Pendek · Ayunan Kilat'
        : len >= 5.0
          ? 'Sabuk Panjang · Putaran Berat'
          : 'Sabuk Lentur · Putaran Seimbang',
    damage: Math.round(16 + t * 30),
    reach: Number((2.2 + t * 3.8).toFixed(2)),
    arcDeg: Math.round(210 + t * 70),
    windupSec: Number((0.09 + t * 0.29).toFixed(2)),
    activeSec: Number((0.12 + t * 0.30).toFixed(2)),
    recoverySec: Number((0.14 + t * 0.31).toFixed(2)),
    staminaCost: Math.round(11 + t * 23),
    knockback: Number((4.2 + t * 8.3).toFixed(1)),
    hitstopSec: Number((0.035 + t * 0.065).toFixed(3)),
    staggerSec: Number((0.24 + t * 0.56).toFixed(2)),
  };
}

export const THROWABLE_SPECS: Record<ThrowableId, ThrowableSpec> = {
  petasan_banting: {
    id: 'petasan_banting',
    name: 'Petasan Banting Besar',
    shortName: 'Petasan',
    role: 'Ledakan Area · Stun Massal',
    damage: 38,
    blastRadius: 4.2,
    fuseSec: 0.72,
    throwSpeed: 15.5,
    knockback: 10.5,
    burstCount: 1,
    cooldownSec: 1.4,
  },
  petasan_roman: {
    id: 'petasan_roman',
    name: 'Petasan Air Mancur',
    shortName: 'Kembang Api',
    role: '3 Letupan Beruntun · Kacaukan Formasi',
    damage: 20,
    blastRadius: 3.1,
    fuseSec: 0.52,
    throwSpeed: 16.5,
    knockback: 6.5,
    burstCount: 3,
    cooldownSec: 1.7,
  },
};

export interface MeleeHitInput {
  attackerX: number;
  attackerZ: number;
  attackerYaw: number;
  targetX: number;
  targetZ: number;
  weapon: WeaponSpec;
  targetBlocking: boolean;
  targetParryTimer: number;
  comboCount: number;
}

export interface MeleeHitResult {
  hit: boolean;
  parried: boolean;
  blocked: boolean;
  damage: number;
  knockbackX: number;
  knockbackZ: number;
  staggerSec: number;
  nextCombo: number;
}

export function normalizeAngleDiff(a: number, b: number): number {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function computeMeleeHit(input: MeleeHitInput): MeleeHitResult {
  const dx = input.targetX - input.attackerX;
  const dz = input.targetZ - input.attackerZ;
  const dist = Math.hypot(dx, dz);

  if (dist > input.weapon.reach || dist < 0.0001) {
    return {
      hit: false,
      parried: false,
      blocked: false,
      damage: 0,
      knockbackX: 0,
      knockbackZ: 0,
      staggerSec: 0,
      nextCombo: input.comboCount,
    };
  }

  // Forward vector in Three.js for yaw=0 facing +Z: (sin(yaw), cos(yaw))
  const angleToTarget = Math.atan2(dx, dz);
  const angleDiff = Math.abs(normalizeAngleDiff(angleToTarget, input.attackerYaw));
  const halfArcRad = ((input.weapon.arcDeg * 0.5) * Math.PI) / 180;

  if (angleDiff > halfArcRad) {
    return {
      hit: false,
      parried: false,
      blocked: false,
      damage: 0,
      knockbackX: 0,
      knockbackZ: 0,
      staggerSec: 0,
      nextCombo: input.comboCount,
    };
  }

  const nx = dx / dist;
  const nz = dz / dist;

  if (input.targetBlocking && input.targetParryTimer > 0) {
    return {
      hit: true,
      parried: true,
      blocked: true,
      damage: 0,
      knockbackX: -nx * 4.5,
      knockbackZ: -nz * 4.5,
      staggerSec: 0,
      nextCombo: input.comboCount,
    };
  }

  const comboBonus = 1 + Math.min(input.comboCount, 12) * 0.05;
  const rawDamage = Math.round(input.weapon.damage * comboBonus);
  const finalDamage = input.targetBlocking
    ? Math.max(2, Math.round(rawDamage * 0.25))
    : rawDamage;
  const kbScale = input.targetBlocking ? 0.35 : 1;

  return {
    hit: true,
    parried: false,
    blocked: input.targetBlocking,
    damage: finalDamage,
    knockbackX: nx * input.weapon.knockback * kbScale,
    knockbackZ: nz * input.weapon.knockback * kbScale,
    staggerSec: input.targetBlocking
      ? input.weapon.staggerSec * 0.2
      : input.weapon.staggerSec,
    nextCombo: input.comboCount + 1,
  };
}

export interface ExplosionHitResult {
  hit: boolean;
  damage: number;
  knockbackX: number;
  knockbackZ: number;
  staggerSec: number;
}

export function computeExplosionDamage(
  blastX: number,
  blastZ: number,
  targetX: number,
  targetZ: number,
  spec: ThrowableSpec,
): ExplosionHitResult {
  const dx = targetX - blastX;
  const dz = targetZ - blastZ;
  const dist = Math.hypot(dx, dz);

  if (dist > spec.blastRadius) {
    return { hit: false, damage: 0, knockbackX: 0, knockbackZ: 0, staggerSec: 0 };
  }

  const falloff = Math.max(0.35, 1 - (dist / spec.blastRadius) * 0.65);
  const damage = Math.round(spec.damage * falloff);
  const nx = dist > 0.001 ? dx / dist : 0;
  const nz = dist > 0.001 ? dz / dist : 1;

  return {
    hit: true,
    damage,
    knockbackX: nx * spec.knockback * falloff,
    knockbackZ: nz * spec.knockback * falloff,
    staggerSec: 0.7 * falloff,
  };
}

export interface TokenCandidate {
  id: string;
  distSq: number;
  hasToken: boolean;
  alive: boolean;
}

export function evaluateAttackTokenPool(
  candidates: TokenCandidate[],
  maxTokens: number,
): Set<string> {
  const active = new Set<string>();
  const aliveCandidates = candidates.filter((c) => c.alive);

  // Preserve already-winding attackers first up to cap
  for (const c of aliveCandidates) {
    if (c.hasToken && active.size < maxTokens) {
      active.add(c.id);
    }
  }

  // Fill remaining slots with closest eligible enemies
  const sorted = [...aliveCandidates]
    .filter((c) => !active.has(c.id))
    .sort((a, b) => a.distSq - b.distSq);

  for (const c of sorted) {
    if (active.size >= maxTokens) break;
    active.add(c.id);
  }

  return active;
}

export interface WaveEnemyEntry {
  archetype: EnemyArchetype;
  weapon: WeaponId;
  hp: number;
  speed: number;
  spawnX: number;
  spawnZ: number;
}

export interface WaveConfig {
  wave: number;
  maxWaves: number;
  maxConcurrentAttackers: number;
  speedMultiplier: number;
  enemies: WaveEnemyEntry[];
}

export interface AllySquadSpec {
  id: string;
  name: string;
  weapon: WeaponId;
  maxHp: number;
  speed: number;
  flankOffsetX: number;
  outfit: 'jaket_bomber' | 'kemeja_terbuka' | 'putih_abu';
  headgear: 'topi_sekolah' | 'rambut_gondrong' | 'slayer_wajah';
}

export const ALLY_SQUAD_SPECS: AllySquadSpec[] = [
  {
    id: 'ally_bima',
    name: 'Bima',
    weapon: 'kayu_paku',
    maxHp: 115,
    speed: 4.5,
    flankOffsetX: -2.2,
    outfit: 'jaket_bomber',
    headgear: 'topi_sekolah',
  },
  {
    id: 'ally_dika',
    name: 'Dika',
    weapon: 'sabit_modif',
    maxHp: 110,
    speed: 4.7,
    flankOffsetX: 2.2,
    outfit: 'kemeja_terbuka',
    headgear: 'rambut_gondrong',
  },
];

export function computeWaveConfig(wave: number): WaveConfig {
  const clampedWave = Math.max(1, Math.min(3, Math.floor(wave)));
  const maxWaves = 3;

  if (clampedWave === 1) {
    return {
      wave: 1,
      maxWaves,
      maxConcurrentAttackers: 3,
      speedMultiplier: 1.0,
      enemies: [
        { archetype: 'rusher', weapon: 'penggaris_baja', hp: 75, speed: 4.1, spawnX: -3.8, spawnZ: -6.5 },
        { archetype: 'rusher', weapon: 'kayu_paku', hp: 85, speed: 3.9, spawnX: 3.8, spawnZ: -7.5 },
        { archetype: 'petasan_kiter', weapon: 'penggaris_baja', hp: 70, speed: 4.2, spawnX: 0, spawnZ: -12.0 },
        { archetype: 'gir_spinner', weapon: 'gir_sabuk', hp: 95, speed: 3.7, spawnX: -5.0, spawnZ: -13.5 },
        { archetype: 'rusher', weapon: 'sabit_modif', hp: 80, speed: 4.2, spawnX: 4.8, spawnZ: -13.0 },
      ],
    };
  }

  if (clampedWave === 2) {
    return {
      wave: 2,
      maxWaves,
      maxConcurrentAttackers: 3,
      speedMultiplier: 1.08,
      enemies: [
        { archetype: 'rusher', weapon: 'sabit_modif', hp: 95, speed: 4.3, spawnX: -5.5, spawnZ: -17 },
        { archetype: 'rusher', weapon: 'kayu_paku', hp: 100, speed: 4.2, spawnX: 5.5, spawnZ: -17 },
        { archetype: 'gir_spinner', weapon: 'gir_sabuk', hp: 115, speed: 3.9, spawnX: -3.5, spawnZ: -21 },
        { archetype: 'petasan_kiter', weapon: 'penggaris_baja', hp: 80, speed: 4.4, spawnX: 4.5, spawnZ: -22 },
        { archetype: 'petasan_kiter', weapon: 'penggaris_baja', hp: 80, speed: 4.4, spawnX: -6.0, spawnZ: -23 },
        { archetype: 'gir_spinner', weapon: 'gir_sabuk', hp: 105, speed: 4.0, spawnX: 0.5, spawnZ: -19 },
      ],
    };
  }

  return {
    wave: 3,
    maxWaves,
    maxConcurrentAttackers: 4,
    speedMultiplier: 1.15,
    enemies: [
      { archetype: 'pentolan', weapon: 'sabit_modif', hp: 195, speed: 4.2, spawnX: 0, spawnZ: -21 },
      { archetype: 'gir_spinner', weapon: 'gir_sabuk', hp: 120, speed: 4.1, spawnX: -5.8, spawnZ: -18 },
      { archetype: 'gir_spinner', weapon: 'gir_sabuk', hp: 120, speed: 4.1, spawnX: 5.8, spawnZ: -18 },
      { archetype: 'rusher', weapon: 'kayu_paku', hp: 100, speed: 4.4, spawnX: -4.0, spawnZ: -23 },
      { archetype: 'petasan_kiter', weapon: 'penggaris_baja', hp: 85, speed: 4.5, spawnX: 4.5, spawnZ: -24 },
      { archetype: 'rusher', weapon: 'sabit_modif', hp: 100, speed: 4.5, spawnX: -1.5, spawnZ: -16 },
      { archetype: 'rusher', weapon: 'kayu_paku', hp: 100, speed: 4.4, spawnX: 2.2, spawnZ: -16.5 },
    ],
  };
}

export function resolveActorPosition(
  x: number,
  z: number,
  radius = 0.55,
  obstacles: ObstacleBox[] = ARENA_OBSTACLES,
): { x: number; z: number } {
  let rx = Math.max(ARENA_BOUNDS.minX + radius, Math.min(ARENA_BOUNDS.maxX - radius, x));
  let rz = Math.max(ARENA_BOUNDS.minZ + radius, Math.min(ARENA_BOUNDS.maxZ - radius, z));

  for (const box of obstacles) {
    const closestX = Math.max(box.minX, Math.min(rx, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(rz, box.maxZ));
    const dx = rx - closestX;
    const dz = rz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const push = radius - dist;
        rx += (dx / dist) * push;
        rz += (dz / dist) * push;
      } else {
        // Inside AABB: push out along shallowest axis
        const penLeft = Math.abs(rx - box.minX);
        const penRight = Math.abs(box.maxX - rx);
        const penTop = Math.abs(rz - box.minZ);
        const penBottom = Math.abs(box.maxZ - rz);
        const minPen = Math.min(penLeft, penRight, penTop, penBottom);
        if (minPen === penLeft) rx = box.minX - radius;
        else if (minPen === penRight) rx = box.maxX + radius;
        else if (minPen === penTop) rz = box.minZ - radius;
        else rz = box.maxZ + radius;
      }
    }
  }

  rx = Math.max(ARENA_BOUNDS.minX + radius, Math.min(ARENA_BOUNDS.maxX - radius, rx));
  rz = Math.max(ARENA_BOUNDS.minZ + radius, Math.min(ARENA_BOUNDS.maxZ - radius, rz));
  return { x: rx, z: rz };
}
