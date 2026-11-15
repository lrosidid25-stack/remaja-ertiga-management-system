/**
 * rules.ts — ATURAN & STATISTIK SENJATA
 *
 * ⚠️ REKONSTRUKSI SEMENTARA.
 * Disusun ulang dari pemakaian di `CustomizerDrawer.tsx`, `GameHud.tsx`, dan
 * `TitleOverlay.tsx` karena `src/game/rules.ts` asli belum diunggah.
 *
 * Ekspor & bentuk data sudah sesuai kebutuhan komponen. Angka-angka di bawah
 * adalah nilai sementara — ganti dengan file asli agar balancing-nya benar.
 */

import type { ThrowableId, WeaponId } from './types';

/** Panjang sabuk gir minimum (meter). */
export const MIN_GIR_LENGTH = 2;

/** Panjang sabuk gir maksimum (meter). */
export const MAX_GIR_LENGTH = 6;

export function clampGirLength(meters: number): number {
  if (!Number.isFinite(meters)) return MIN_GIR_LENGTH;
  return Math.min(MAX_GIR_LENGTH, Math.max(MIN_GIR_LENGTH, meters));
}

export interface WeaponSpec {
  id: WeaponId;
  /** Nama lengkap untuk panel kustomisasi & aria-label. */
  name: string;
  /** Label pendek untuk chip/tombol HUD. */
  shortName: string;
  /** Peran singkat, mis. "Jangkauan menengah". */
  role: string;
  damage: number;
  /** Jangkauan dalam meter. */
  reach: number;
  /** Durasi ancang-ancang (detik). */
  windupSec: number;
  /** Durasi ayunan aktif (detik). */
  activeSec: number;
  /** Masa pemulihan setelah ayunan (detik). */
  recoverySec: number;
}

export interface ThrowableSpec {
  id: ThrowableId;
  name: string;
  shortName: string;
  damage: number;
  /** Radius ledakan (meter). */
  blastRadius: number;
  /** Waktu sumbu sebelum meledak (detik). */
  fuseSec: number;
}

export const WEAPON_ORDER: WeaponId[] = [
  'sabit_modif',
  'gir_sabuk',
  'kayu_paku',
  'penggaris_baja',
];

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  sabit_modif: {
    id: 'sabit_modif',
    name: 'Sabit Modif',
    shortName: 'Sabit',
    role: 'Jangkauan menengah, ayunan cepat',
    damage: 22,
    reach: 1.9,
    windupSec: 0.16,
    activeSec: 0.2,
    recoverySec: 0.26,
  },
  gir_sabuk: {
    id: 'gir_sabuk',
    name: 'Gir Sabuk Motor',
    shortName: 'Gir',
    role: 'Jangkauan mengikuti panjang sabuk',
    damage: 18,
    reach: 3.5,
    windupSec: 0.3,
    activeSec: 0.28,
    recoverySec: 0.34,
  },
  kayu_paku: {
    id: 'kayu_paku',
    name: 'Balok Paku',
    shortName: 'Balok',
    role: 'Berat, hantaman kuat',
    damage: 30,
    reach: 1.6,
    windupSec: 0.34,
    activeSec: 0.24,
    recoverySec: 0.42,
  },
  penggaris_baja: {
    id: 'penggaris_baja',
    name: 'Penggaris Baja',
    shortName: 'Penggaris',
    role: 'Ringan, paling gesit',
    damage: 14,
    reach: 2.1,
    windupSec: 0.12,
    activeSec: 0.16,
    recoverySec: 0.2,
  },
};

export const THROWABLE_SPECS: Record<ThrowableId, ThrowableSpec> = {
  petasan_banting: {
    id: 'petasan_banting',
    name: 'Petasan Banting',
    shortName: 'Banting',
    damage: 26,
    blastRadius: 2.4,
    fuseSec: 1.6,
  },
  petasan_roman: {
    id: 'petasan_roman',
    name: 'Petasan Roman',
    shortName: 'Roman',
    damage: 34,
    blastRadius: 3.2,
    fuseSec: 2.4,
  },
};

/**
 * Statistik senjata setelah memperhitungkan panjang sabuk gir.
 * Sabuk lebih panjang → jangkauan & daya naik, tapi ancang-ancang lebih lambat.
 */
export function getEffectiveWeaponSpec(weapon: WeaponId, girLengthMeters: number): WeaponSpec {
  const base = WEAPON_SPECS[weapon];
  if (weapon !== 'gir_sabuk') return base;

  const length = clampGirLength(girLengthMeters);
  const extra = length - MIN_GIR_LENGTH; // 0 … 4
  const factor = extra / (MAX_GIR_LENGTH - MIN_GIR_LENGTH); // 0 … 1

  return {
    ...base,
    reach: Number(length.toFixed(2)),
    damage: Math.round(base.damage * (0.8 + factor * 0.9)),
    windupSec: Number((base.windupSec * (0.75 + factor * 0.9)).toFixed(2)),
    activeSec: Number((base.activeSec * (0.8 + factor * 0.8)).toFixed(2)),
    recoverySec: Number((base.recoverySec * (0.8 + factor * 0.7)).toFixed(2)),
  };
}
