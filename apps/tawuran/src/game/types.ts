/**
 * types.ts — TIPE DATA GAME
 *
 * ⚠️ REKONSTRUKSI SEMENTARA.
 * File ini disusun ulang dari pemakaian di `App.tsx` + `components/*.tsx`
 * karena `src/game/types.ts` dari proyek AI Studio belum diunggah.
 * Bentuknya sudah cocok dengan seluruh komponen, tapi nilai bawaan
 * (`DEFAULT_CHARACTER`) masih tebakan — ganti dengan file asli kalau sudah ada.
 */

export type ThemeMode = 'dark' | 'light';

export type GameState = 'title' | 'intro' | 'playing' | 'paused' | 'gameover';

export type WeaponId = 'sabit_modif' | 'gir_sabuk' | 'kayu_paku' | 'penggaris_baja';

export type ThrowableId = 'petasan_banting' | 'petasan_roman';

export type OutfitStyle = 'jaket_bomber' | 'putih_abu' | 'pramuka' | 'kemeja_terbuka';

export type PantsStyle = 'abu_sekolah' | 'hitam_bahan' | 'jeans_sobek';

export type HeadgearStyle =
  | 'slayer_wajah'
  | 'topi_sekolah'
  | 'helm_proyek'
  | 'rambut_gondrong'
  | 'rambut_rapih';

export interface CharacterConfig {
  name: string;
  /** Kode/NIR sekolah yang tampil di kartu karakter. */
  schoolCode: string;
  /** Warna kulit dalam hex, mis. '#c68b59'. */
  skinTone: string;
  /** Warna jaket/kemeja dalam hex. */
  jacketColor: string;
  /** Warna slayer dalam hex. */
  slayerColor: string;
  outfit: OutfitStyle;
  pants: PantsStyle;
  headgear: HeadgearStyle;
  primaryWeapon: WeaponId;
  throwable: ThrowableId;
  girLengthMeters: number;
}

export interface HudSnapshot {
  state: GameState;

  introBeat: number;
  introTotalBeats: number;

  hp: number;
  maxHp: number;
  ghostHp: number;
  stamina: number;
  maxStamina: number;

  ammoPetasan: number;
  maxPetasan: number;
  petasanCooldown: number;

  activeWeapon: WeaponId;
  activeThrowable: ThrowableId;
  girLengthMeters: number;

  wave: number;
  maxWaves: number;
  alliesAlive: number;
  alliesTotal: number;

  score: number;
  bestScore: number;
  combo: number;
  comboTimer: number;

  enemiesAlive: number;
  enemiesTotalInWave: number;

  defeatedCount: number;
  maxCombo: number;
  damageTaken: number;
  isVictory: boolean;

  hitFeedbackLabel: string;
  isBlocking: boolean;
  parryFlashTimer: number;
  waveBannerText: string;
}

export const DEFAULT_CHARACTER: CharacterConfig = {
  name: 'Jagoan Sore',
  schoolCode: 'NIR-000000000000',
  skinTone: '#c68b59',
  jacketColor: '#27303f',
  slayerColor: '#b91c1c',
  outfit: 'jaket_bomber',
  pants: 'abu_sekolah',
  headgear: 'rambut_rapih',
  primaryWeapon: 'sabit_modif',
  throwable: 'petasan_banting',
  girLengthMeters: 3.5,
};
