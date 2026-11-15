/**
 * maps.ts — 10 MAP JALANAN & SISTEM LEVEL
 *
 * Setiap level = satu map jalanan dengan identitas visual sendiri (langit, kabut,
 * lampu, lebar jalan, ada/tidaknya flyover, jumlah bangunan) plus kurva
 * kesulitannya sendiri (jumlah gelombang, HP & kecepatan lawan, jumlah rekan).
 *
 * Arena (ARENA_BOUNDS / ARENA_OBSTACLES di rules.ts) sengaja TIDAK diubah supaya
 * tabrakan & jalur kamera tetap valid di semua map — yang berubah adalah
 * tampilan dan susunan gelombang.
 */

import { computeWaveConfig, type WaveConfig, type WaveEnemyEntry } from './rules';
import type { EnemyArchetype, WeaponId } from './types';

export interface MapTheme {
  /** Warna langit / background WebGL. */
  sky: number;
  /** Kepadatan kabut (FogExp2). */
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  rimColor: number;
  rimIntensity: number;
  /** Warna dasar aspal (dikali tekstur). */
  roadTint: number;
  /** Warna bangunan/plester. */
  wallTint: number;
  awningColor: number;
  lampColor: number;
  lampIntensity: number;
  /** Pendar horizon di ujung jalan. */
  horizonGlow: number;
  horizonGlowOpacity: number;
  windowGlow: number;
}

export interface MapLayout {
  /** Lebar jalan (meter). Arena tetap ±10,5 m, ini hanya tampilan. */
  roadWidth: number;
  /** Ada flyover + tiang beton di tengah jalan atau tidak. */
  flyover: boolean;
  /** Jumlah pasang bangunan pinggir jalan (0–6). */
  buildingCount: number;
  /** Tampilkan skyline kota di kejauhan. */
  skyline: boolean;
  markings: 'dashed' | 'double' | 'none';
  /** Jumlah tiang lampu (0–4). */
  lamps: number;
  cones: number;
  drums: number;
  banners: number;
}

export interface LevelConfig {
  id: number;
  nama: string;
  lokasi: string;
  deskripsi: string;
  /** 1–10, menentukan jumlah lawan & agresivitas. */
  difficulty: number;
  /** 2–4 gelombang. */
  waveCount: number;
  enemyHpScale: number;
  enemySpeedScale: number;
  /** 0–2 rekan sekolah yang ikut bertarung. */
  allyCount: number;
  theme: MapTheme;
  layout: MapLayout;
}

const baseTheme: MapTheme = {
  sky: 0x281c24,
  fogDensity: 0.019,
  sunColor: 0xffb36b,
  sunIntensity: 2.2,
  sunPosition: [-18, 22, 14],
  hemiSky: 0x8fa8d6,
  hemiGround: 0x3b2c22,
  hemiIntensity: 0.85,
  rimColor: 0x93c5fd,
  rimIntensity: 0.65,
  roadTint: 0xffffff,
  wallTint: 0xc2b29b,
  awningColor: 0x1d4ed8,
  lampColor: 0xffb454,
  lampIntensity: 18,
  horizonGlow: 0xc2410c,
  horizonGlowOpacity: 0.35,
  windowGlow: 0xfde68a,
};

const baseLayout: MapLayout = {
  roadWidth: 24,
  flyover: true,
  buildingCount: 6,
  skyline: true,
  markings: 'dashed',
  lamps: 4,
  cones: 0,
  drums: 0,
  banners: 0,
};

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    nama: 'Jalanan Sore',
    lokasi: 'Jl. Melati — depan warung pinggir jalan',
    deskripsi: 'Jalanan lebar, senja hangat, dua rekan sekolah ikut menjaga flank.',
    difficulty: 1,
    waveCount: 2,
    enemyHpScale: 1,
    enemySpeedScale: 1,
    allyCount: 2,
    theme: { ...baseTheme },
    layout: { ...baseLayout },
  },
  {
    id: 2,
    nama: 'Gang Sempit',
    lokasi: 'Gang Mawar RT 04 / RW 07',
    deskripsi: 'Jalan menyempit, tembok rapat kanan-kiri. Manuver terbatas.',
    difficulty: 2,
    waveCount: 2,
    enemyHpScale: 1.08,
    enemySpeedScale: 1.02,
    allyCount: 2,
    theme: {
      ...baseTheme,
      sky: 0x241c1a,
      fogDensity: 0.025,
      sunColor: 0xffa860,
      sunIntensity: 2.0,
      roadTint: 0xe8e2d8,
      wallTint: 0xa89b86,
      horizonGlow: 0xb45309,
      horizonGlowOpacity: 0.22,
    },
    layout: {
      ...baseLayout,
      roadWidth: 19,
      flyover: false,
      buildingCount: 6,
      skyline: false,
      lamps: 3,
    },
  },
  {
    id: 3,
    nama: 'Pasar Malam',
    lokasi: 'Pasar kaget — deretan tenda biru',
    deskripsi: 'Banyak tenda & gerobak, jalan tetap lebar tapi penuh sudut buta.',
    difficulty: 3,
    waveCount: 3,
    enemyHpScale: 1.15,
    enemySpeedScale: 1.04,
    allyCount: 2,
    theme: {
      ...baseTheme,
      sunColor: 0xffc177,
      sunIntensity: 2.3,
      awningColor: 0x1e40af,
      lampIntensity: 22,
      horizonGlow: 0xd97706,
      horizonGlowOpacity: 0.4,
    },
    layout: {
      ...baseLayout,
      roadWidth: 26,
      buildingCount: 6,
      cones: 6,
      banners: 3,
    },
  },
  {
    id: 4,
    nama: 'Kolong Flyover',
    lokasi: 'Kolong flyover — beton dan bayangan',
    deskripsi: 'Gelap di bawah beton, lampu jalan satu-satunya sumber cahaya.',
    difficulty: 4,
    waveCount: 3,
    enemyHpScale: 1.22,
    enemySpeedScale: 1.06,
    allyCount: 2,
    theme: {
      ...baseTheme,
      sky: 0x15161c,
      fogDensity: 0.032,
      sunColor: 0x9fb4d8,
      sunIntensity: 1.1,
      hemiSky: 0x5b6b8a,
      hemiGround: 0x1a1a20,
      hemiIntensity: 0.7,
      rimColor: 0x60a5fa,
      rimIntensity: 0.45,
      wallTint: 0x9a9a96,
      lampColor: 0xffd9a0,
      lampIntensity: 26,
      horizonGlow: 0x475569,
      horizonGlowOpacity: 0.18,
      windowGlow: 0xfbbf24,
    },
    layout: { ...baseLayout, roadWidth: 22, flyover: true, lamps: 4, drums: 3 },
  },
  {
    id: 5,
    nama: 'Terminal Angkot',
    lokasi: 'Terminal angkot — angkot berbaris',
    deskripsi: 'Angkot & motor parkir memenuhi bahu jalan, ruang gerak menyempit.',
    difficulty: 5,
    waveCount: 3,
    enemyHpScale: 1.3,
    enemySpeedScale: 1.08,
    allyCount: 2,
    theme: {
      ...baseTheme,
      sunColor: 0xffcf8a,
      sunIntensity: 2.4,
      roadTint: 0xe6e6e6,
      horizonGlow: 0xb45309,
      horizonGlowOpacity: 0.3,
    },
    layout: {
      ...baseLayout,
      roadWidth: 28,
      flyover: false,
      buildingCount: 4,
      skyline: true,
      cones: 8,
      banners: 4,
      lamps: 3,
    },
  },
  {
    id: 6,
    nama: 'Bantaran Sungai',
    lokasi: 'Bantaran kali — jalan tanah basah',
    deskripsi: 'Tanpa bangunan tinggi, kabut tipis naik dari air. Licin dan terbuka.',
    difficulty: 6,
    waveCount: 3,
    enemyHpScale: 1.38,
    enemySpeedScale: 1.1,
    allyCount: 2,
    theme: {
      ...baseTheme,
      sky: 0x1e2a2f,
      fogDensity: 0.028,
      sunColor: 0xfcd9a8,
      sunIntensity: 1.9,
      hemiSky: 0x9dc0c8,
      hemiGround: 0x2b2b22,
      roadTint: 0xd8cfc2,
      wallTint: 0x8d8574,
      lampColor: 0xffe0b0,
      horizonGlow: 0x0e7490,
      horizonGlowOpacity: 0.25,
    },
    layout: {
      ...baseLayout,
      roadWidth: 30,
      flyover: false,
      buildingCount: 2,
      skyline: false,
      markings: 'none',
      drums: 4,
      cones: 5,
      lamps: 2,
    },
  },
  {
    id: 7,
    nama: 'Perumahan Kosong',
    lokasi: 'Kompleks Griya Asri — blok C',
    deskripsi: 'Rumah-rumah kosong, jalan blok lurus. Lawan datang bergelombang.',
    difficulty: 7,
    waveCount: 3,
    enemyHpScale: 1.46,
    enemySpeedScale: 1.12,
    allyCount: 2,
    theme: {
      ...baseTheme,
      sky: 0x2a2230,
      fogDensity: 0.021,
      sunColor: 0xffb98a,
      sunIntensity: 2.0,
      wallTint: 0xb9b0a0,
      horizonGlow: 0x7c2d12,
      horizonGlowOpacity: 0.28,
    },
    layout: {
      ...baseLayout,
      roadWidth: 24,
      flyover: false,
      buildingCount: 6,
      markings: 'double',
      banners: 2,
      lamps: 4,
    },
  },
  {
    id: 8,
    nama: 'Underpass Layang',
    lokasi: 'Underpass jembatan layang',
    deskripsi: 'Tiang beton di tengah, cahaya remang, langit nyaris tak terlihat.',
    difficulty: 8,
    waveCount: 4,
    enemyHpScale: 1.55,
    enemySpeedScale: 1.15,
    allyCount: 2,
    theme: {
      ...baseTheme,
      sky: 0x11131a,
      fogDensity: 0.036,
      sunColor: 0x8ea6cc,
      sunIntensity: 0.95,
      hemiSky: 0x4c5a75,
      hemiGround: 0x14141a,
      hemiIntensity: 0.6,
      rimColor: 0x38bdf8,
      rimIntensity: 0.4,
      wallTint: 0x8a8a88,
      lampColor: 0xcfe4ff,
      lampIntensity: 24,
      horizonGlow: 0x1e293b,
      horizonGlowOpacity: 0.15,
    },
    layout: {
      ...baseLayout,
      roadWidth: 20,
      flyover: true,
      buildingCount: 4,
      skyline: false,
      lamps: 3,
      drums: 2,
    },
  },
  {
    id: 9,
    nama: 'Alun-alun Malam',
    lokasi: 'Alun-alun kota — lampu taman menyala',
    deskripsi: 'Malam terang oleh lampu taman. Lawan paling cepat di sini.',
    difficulty: 9,
    waveCount: 4,
    enemyHpScale: 1.65,
    enemySpeedScale: 1.2,
    allyCount: 2,
    theme: {
      ...baseTheme,
      sky: 0x0f172a,
      fogDensity: 0.018,
      sunColor: 0xc7d2fe,
      sunIntensity: 0.9,
      hemiSky: 0x64748b,
      hemiGround: 0x1e293b,
      hemiIntensity: 0.75,
      rimColor: 0x818cf8,
      rimIntensity: 0.7,
      roadTint: 0xd7dce6,
      wallTint: 0xa9a294,
      lampColor: 0xfff2cc,
      lampIntensity: 30,
      horizonGlow: 0x312e81,
      horizonGlowOpacity: 0.35,
      windowGlow: 0xfde68a,
    },
    layout: {
      ...baseLayout,
      roadWidth: 28,
      flyover: false,
      buildingCount: 5,
      markings: 'double',
      lamps: 4,
      banners: 5,
      cones: 4,
    },
  },
  {
    id: 10,
    nama: 'Markas Lawan',
    lokasi: 'Markas pentolan — halaman belakang',
    deskripsi: 'Level terakhir. Empat gelombang, pentolan dengan sabit modif menunggu.',
    difficulty: 10,
    waveCount: 4,
    enemyHpScale: 1.8,
    enemySpeedScale: 1.24,
    allyCount: 2,
    theme: {
      ...baseTheme,
      sky: 0x1a0f12,
      fogDensity: 0.03,
      sunColor: 0xff8a5c,
      sunIntensity: 1.7,
      hemiSky: 0x7f4a3a,
      hemiGround: 0x1b1210,
      hemiIntensity: 0.7,
      rimColor: 0xef4444,
      rimIntensity: 0.5,
      roadTint: 0xd6cdc2,
      wallTint: 0x9c8b7a,
      awningColor: 0x991b1b,
      lampColor: 0xff9a5c,
      lampIntensity: 22,
      horizonGlow: 0x7f1d1d,
      horizonGlowOpacity: 0.45,
      windowGlow: 0xfb923c,
    },
    layout: {
      ...baseLayout,
      roadWidth: 26,
      flyover: true,
      buildingCount: 6,
      cones: 3,
      drums: 5,
      banners: 6,
      lamps: 4,
    },
  },
];

export const MAX_LEVEL = LEVELS.length;

export function getLevel(id: number): LevelConfig {
  const found = LEVELS.find((l) => l.id === Math.floor(id));
  return found ?? LEVELS[0];
}

export function clampLevelId(id: number): number {
  if (!Number.isFinite(id)) return 1;
  return Math.max(1, Math.min(MAX_LEVEL, Math.floor(id)));
}

// ============================================================
// PROGRES LEVEL (disimpan di HP)
// ============================================================

const PROGRESS_KEY = 'tawuran_level_unlocked_v1';

/** Level tertinggi yang terbuka (1 = hanya level 1). */
export function loadUnlockedLevel(): number {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const n = raw ? parseInt(raw, 10) : 1;
    return clampLevelId(Number.isFinite(n) ? n : 1);
  } catch {
    return 1;
  }
}

export function saveUnlockedLevel(id: number): void {
  try {
    localStorage.setItem(PROGRESS_KEY, String(clampLevelId(id)));
  } catch {
    // Abaikan (mode privat / storage penuh)
  }
}

/** Membuka level berikutnya setelah menang; mengembalikan level terbuka baru. */
export function unlockNextLevel(currentId: number): number {
  const next = Math.min(MAX_LEVEL, clampLevelId(currentId) + 1);
  const unlocked = Math.max(loadUnlockedLevel(), next);
  saveUnlockedLevel(unlocked);
  return unlocked;
}

// ============================================================
// GELOMBANG PER LEVEL
// ============================================================

const EXTRA_WEAPONS: WeaponId[] = ['penggaris_baja', 'kayu_paku', 'sabit_modif', 'gir_sabuk'];
const EXTRA_ARCHETYPES: EnemyArchetype[] = ['rusher', 'gir_spinner', 'petasan_kiter', 'rusher'];
const MAX_ENEMIES_PER_WAVE = 8;

function extraEnemy(level: LevelConfig, index: number): WaveEnemyEntry {
  const seed = level.id * 31 + index * 7;
  const spread = ((seed % 9) - 4) * 1.35; // -5.4 … 5.4
  return {
    archetype: EXTRA_ARCHETYPES[index % EXTRA_ARCHETYPES.length],
    weapon: EXTRA_WEAPONS[(index + level.id) % EXTRA_WEAPONS.length],
    hp: Math.round(72 * level.enemyHpScale),
    speed: Number((3.8 + (level.difficulty % 3) * 0.15).toFixed(2)),
    spawnX: Number(spread.toFixed(2)),
    spawnZ: -(14 + (index % 4) * 3.5),
  };
}

/**
 * Susunan lawan untuk satu gelombang pada level tertentu.
 * Basis tetap memakai kurva dari `computeWaveConfig` (agar balancing asli
 * dipertahankan), lalu diskalakan sesuai kesulitan level.
 */
export function buildWaveConfig(level: LevelConfig, waveNum: number): WaveConfig {
  const maxWaves = Math.max(1, level.waveCount);
  const wave = Math.max(1, Math.min(maxWaves, Math.floor(waveNum)));
  const base = computeWaveConfig(Math.min(3, wave));
  const isFinal = wave === maxWaves;

  const enemies: WaveEnemyEntry[] = base.enemies.map((entry) => ({
    ...entry,
    hp: Math.round(entry.hp * level.enemyHpScale),
  }));

  const extraCount =
    Math.round((level.difficulty - 1) * 0.55) + (isFinal ? 1 : 0);

  for (let i = 0; i < extraCount; i++) {
    enemies.push(extraEnemy(level, i + wave * 5));
  }

  if (isFinal) {
    enemies.unshift({
      archetype: 'pentolan',
      weapon: 'sabit_modif',
      hp: Math.round(185 * level.enemyHpScale),
      speed: 4.2,
      spawnX: 0,
      spawnZ: -22,
    });
  }

  return {
    wave,
    maxWaves,
    maxConcurrentAttackers: Math.min(6, 3 + Math.floor(level.difficulty / 3)),
    speedMultiplier: base.speedMultiplier * level.enemySpeedScale,
    enemies: enemies.slice(0, MAX_ENEMIES_PER_WAVE),
  };
}
