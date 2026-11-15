export type WeaponId =
  | 'sabit_modif'
  | 'gir_sabuk'
  | 'kayu_paku'
  | 'penggaris_baja';

export type ThrowableId = 'petasan_banting' | 'petasan_roman';

export type OutfitStyle =
  | 'putih_abu'
  | 'pramuka'
  | 'jaket_bomber'
  | 'kemeja_terbuka';

export type PantsStyle = 'abu_sekolah' | 'hitam_bahan' | 'jeans_sobek';

export type HeadgearStyle =
  | 'rambut_rapih'
  | 'rambut_gondrong'
  | 'topi_sekolah'
  | 'slayer_wajah'
  | 'helm_proyek';

export type EnemyArchetype =
  | 'rusher'
  | 'gir_spinner'
  | 'petasan_kiter'
  | 'pentolan';

export type GameState = 'title' | 'intro' | 'playing' | 'paused' | 'gameover';

export type ThemeMode = 'dark' | 'light';

export interface CharacterConfig {
  name: string;
  outfit: OutfitStyle;
  pants: PantsStyle;
  headgear: HeadgearStyle;
  skinTone: string;
  hairColor: string;
  jacketColor: string;
  slayerColor: string;
  primaryWeapon: WeaponId;
  throwable: ThrowableId;
  girLengthMeters: number;
  schoolCode: string;
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  shortName: string;
  role: string;
  damage: number;
  reach: number;
  arcDeg: number;
  windupSec: number;
  activeSec: number;
  recoverySec: number;
  staminaCost: number;
  knockback: number;
  hitstopSec: number;
  staggerSec: number;
}

export interface ThrowableSpec {
  id: ThrowableId;
  name: string;
  shortName: string;
  role: string;
  damage: number;
  blastRadius: number;
  fuseSec: number;
  throwSpeed: number;
  knockback: number;
  burstCount: number;
  cooldownSec: number;
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

  /** Level/map yang sedang dimainkan (1–10). */
  level: number;
  mapName: string;
  maxLevel: number;
  /** Level tertinggi yang sudah terbuka (progres disimpan di HP). */
  unlockedLevel: number;
}

export const DEFAULT_CHARACTER: CharacterConfig = {
  name: 'Raka STM 09',
  outfit: 'jaket_bomber',
  pants: 'abu_sekolah',
  headgear: 'slayer_wajah',
  skinTone: '#c68b59',
  hairColor: '#1b1a1e',
  jacketColor: '#27303f',
  slayerColor: '#b91c1c',
  primaryWeapon: 'sabit_modif',
  throwable: 'petasan_banting',
  girLengthMeters: 3.5,
  schoolCode: 'STM 09',
};
