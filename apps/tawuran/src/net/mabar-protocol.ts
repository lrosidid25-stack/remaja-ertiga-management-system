/**
 * Protokol Mabar Online (duel 1 lawan 1).
 *
 * Semua fungsi di file ini murni (tanpa jaringan / DOM) supaya bisa diuji.
 * Pesan sengaja dibuat pendek karena dikirim ~10x per detik lewat Realtime.
 */

import type { WeaponId } from '../game/types';

export const MABAR_ROOM_LENGTH = 4;

/** Alfabet kode room: tanpa huruf/angka yang mirip (0/O, 1/I/L). */
export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const MABAR_STATE_HZ = 10;
export const MABAR_STATE_INTERVAL = 1 / MABAR_STATE_HZ;
export const MABAR_PING_INTERVAL = 2;
export const MABAR_PEER_TIMEOUT = 8;

export const WEAPON_IDS: WeaponId[] = ['sabit_modif', 'gir_sabuk', 'kayu_paku', 'penggaris_baja'];

export type AttackPhaseTag = 'idle' | 'windup' | 'active' | 'recovery';

const PHASE_TAGS: AttackPhaseTag[] = ['idle', 'windup', 'active', 'recovery'];

export interface MabarProfile {
  name: string;
  level: number;
  weapon: WeaponId;
  girLength: number;
  hue: number;
}

export type MabarMessage =
  | { t: 'hi'; p: MabarProfile }
  | { t: 'we'; p: MabarProfile }
  | {
      t: 's';
      x: number;
      z: number;
      y: number;
      hp: number;
      b: 0 | 1;
      ph: AttackPhaseTag;
      sp: number;
    }
  | { t: 'a'; w: WeaponId; g: number; x: number; z: number; y: number }
  | { t: 'h'; d: number; b: 0 | 1 }
  | { t: 'ko' }
  | { t: 'bye' }
  | { t: 'ping' }
  | { t: 'pong' };

/** Buat kode room acak 4 karakter. */
export function makeRoomCode(
  randomInt: (maxExclusive: number) => number = defaultRandomInt,
): string {
  let out = '';
  for (let i = 0; i < MABAR_ROOM_LENGTH; i += 1) {
    out += ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)];
  }
  return out;
}

function defaultRandomInt(maxExclusive: number): number {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(1);
    cryptoObj.getRandomValues(buf);
    return buf[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

/** Rapikan kode yang diketik pemain ("ab c2" -> "ABC2"), null kalau tidak valid. */
export function normalizeRoomCode(raw: string): string | null {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== MABAR_ROOM_LENGTH) return null;
  for (const ch of cleaned) {
    if (!ROOM_ALPHABET.includes(ch)) return null;
  }
  return cleaned;
}

/** Nama channel Realtime untuk sebuah kode room. */
export function channelNameFor(code: string): string {
  return `tawuran-mabar-${code.toUpperCase()}`;
}

function num(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function sanitizeName(value: unknown): string {
  if (typeof value !== 'string') return 'Pemain';
  const trimmed = value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 18);
  return trimmed.length > 0 ? trimmed : 'Pemain';
}

function parseProfile(raw: unknown): MabarProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const weapon = WEAPON_IDS.includes(p.w as WeaponId) ? (p.w as WeaponId) : null;
  const level = num(p.lv, 1, 10);
  const gir = num(p.g, 2, 6);
  const hue = num(p.hue, 0, 359);
  if (!weapon || level === null || gir === null || hue === null) return null;
  return { name: sanitizeName(p.n), level, weapon, girLength: gir, hue };
}

/**
 * Ubah pesan ke bentuk ringkas untuk dikirim (kunci pendek, profil dipadatkan).
 * Dipakai sebelum pesan masuk ke kanal Realtime.
 */
export function toWireMessage(msg: MabarMessage): Record<string, unknown> {
  if (msg.t === 'hi' || msg.t === 'we') {
    const p = msg.p;
    return { t: msg.t, p: { n: p.name, lv: p.level, w: p.weapon, g: p.girLength, hue: p.hue } };
  }
  return msg as unknown as Record<string, unknown>;
}

export function serializeMabarMessage(msg: MabarMessage): string {
  return JSON.stringify(toWireMessage(msg));
}

/**
 * Validasi + normalisasi pesan masuk.
 * Mengembalikan null untuk pesan rusak / di luar batas (supaya nilai aneh dari
 * pemain lain tidak bisa merusak simulasi lokal).
 */
export function parseMabarMessage(raw: unknown): MabarMessage | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > 512) return null;
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const m = value as Record<string, unknown>;

  switch (m.t) {
    case 'hi':
    case 'we': {
      const p = parseProfile(m.p);
      if (!p) return null;
      return m.t === 'hi' ? { t: 'hi', p } : { t: 'we', p };
    }
    case 's': {
      const x = num(m.x, -60, 60);
      const z = num(m.z, -60, 60);
      const y = num(m.y, -12, 12);
      const hp = num(m.hp, 0, 999);
      const sp = num(m.sp, 0, 30);
      const ph = PHASE_TAGS.includes(m.ph as AttackPhaseTag)
        ? (m.ph as AttackPhaseTag)
        : 'idle';
      if (x === null || z === null || y === null || hp === null || sp === null) return null;
      return { t: 's', x, z, y, hp, b: m.b ? 1 : 0, ph, sp };
    }
    case 'a': {
      const weapon = WEAPON_IDS.includes(m.w as WeaponId) ? (m.w as WeaponId) : null;
      const g = num(m.g, 2, 6);
      const x = num(m.x, -60, 60);
      const z = num(m.z, -60, 60);
      const y = num(m.y, -12, 12);
      if (!weapon || g === null || x === null || z === null || y === null) return null;
      return { t: 'a', w: weapon, g, x, z, y };
    }
    case 'h': {
      const d = num(m.d, 0, 200);
      if (d === null) return null;
      return { t: 'h', d, b: m.b ? 1 : 0 };
    }
    case 'ko':
      return { t: 'ko' };
    case 'bye':
      return { t: 'bye' };
    case 'ping':
      return { t: 'ping' };
    case 'pong':
      return { t: 'pong' };
    default:
      return null;
  }
}

/** Jarak maksimum antar posisi sebelum dianggap "teleport" (anti-cheat ringan). */
export const MABAR_MAX_POSITION_JUMP = 14;

/**
 * Putuskan apakah posisi lawan masih wajar dibanding posisi sebelumnya.
 * Lompatan besar (mis. karena pesan dipalsukan) akan diabaikan.
 */
export function isPlausiblePosition(
  prev: { x: number; z: number } | null,
  next: { x: number; z: number },
  dt: number,
): boolean {
  if (!prev) return true;
  const dist = Math.hypot(next.x - prev.x, next.z - prev.z);
  const allowed = MABAR_MAX_POSITION_JUMP + Math.max(0, dt) * 18;
  return dist <= allowed;
}

/** Interpolasi sudut terpendek (radian). */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/** Warna jaket lawan diturunkan dari hue supaya kedua pemain mudah dibedakan. */
export function jacketColorForHue(hue: number): string {
  const h = ((Math.round(hue) % 360) + 360) % 360;
  // HSL -> hex (saturasi & lightness tetap supaya tetap terlihat "jaket sekolah")
  const s = 0.42;
  const l = 0.34;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const toHex = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v + m)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
