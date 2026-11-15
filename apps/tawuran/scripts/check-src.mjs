#!/usr/bin/env node
/**
 * check-src.mjs — memastikan seluruh modul di src/ tersedia sebelum build.
 *
 * Memindai import relatif mulai dari src/main.tsx dan melaporkan file yang
 * belum ada. Dipakai di CI: kalau ada yang kurang, APK tidak dibangun
 * (rilis terakhir yang sudah ada tetap utuh) dan daftar file yang hilang
 * ditulis di log supaya jelas apa yang harus diunggah.
 *
 *   node scripts/check-src.mjs          # lapor + exit 1 kalau kurang
 *   node scripts/check-src.mjs --list   # daftar file yang hilang saja
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');
const ENTRY = resolve(SRC, 'main.tsx');

const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.css'];
const IMPORT_RE =
  /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const seen = new Set();
const missing = new Map(); // resolved target -> [imported by...]
const external = new Set();

function tryResolve(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTS) {
    const idx = resolve(base, 'index' + ext);
    if (existsSync(idx)) return idx;
  }
  return null;
}

function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  if (!/\.(tsx?|jsx?|mjs)$/.test(file)) return;

  const code = readFileSync(file, 'utf8');
  for (const match of code.matchAll(IMPORT_RE)) {
    const spec = match[1] || match[2];
    if (!spec) continue;

    if (!spec.startsWith('.')) {
      // Modul npm / alias — dicatat untuk informasi, bukan error
      if (!spec.startsWith('@/')) external.add(spec);
      continue;
    }

    const base = resolve(dirname(file), spec);
    const hit = tryResolve(base);
    if (hit) {
      walk(hit);
    } else {
      const key = relative(ROOT, base);
      const by = relative(ROOT, file);
      if (!missing.has(key)) missing.set(key, []);
      if (!missing.get(key).includes(by)) missing.get(key).push(by);
    }
  }
}

if (!existsSync(ENTRY)) {
  console.error('✖ src/main.tsx tidak ditemukan — proyek web kosong.');
  process.exit(1);
}

walk(ENTRY);

const onlyList = process.argv.includes('--list');

if (missing.size === 0) {
  if (!onlyList) {
    console.log(`✔ src/ lengkap — ${seen.size} modul diperiksa, tidak ada import yang hilang.`);
    if (external.size) {
      console.log(`  modul npm: ${[...external].sort().join(', ')}`);
    }
  }
  process.exit(0);
}

if (onlyList) {
  for (const key of [...missing.keys()].sort()) console.log(key);
  process.exit(1);
}

console.error('');
console.error('✖ SUMBER GAME BELUM LENGKAP');
console.error('  Modul berikut di-import tapi filenya tidak ada:');
console.error('');
for (const key of [...missing.keys()].sort()) {
  console.error(`    • ${key}`);
  for (const by of missing.get(key)) console.error(`        di-import oleh ${by}`);
}
console.error('');
console.error(`  Total: ${missing.size} file hilang dari ${seen.size} modul yang terbaca.`);
console.error('  Unggah folder src/ lengkap (game/, components/, dan lainnya),');
console.error('  lalu jalankan ulang: npm run check:src');
console.error('');
process.exit(1);
