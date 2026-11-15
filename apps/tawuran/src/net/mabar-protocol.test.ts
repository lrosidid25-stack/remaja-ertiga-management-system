import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MABAR_MAX_POSITION_JUMP,
  MABAR_ROOM_LENGTH,
  ROOM_ALPHABET,
  channelNameFor,
  isPlausiblePosition,
  jacketColorForHue,
  lerpAngle,
  makeRoomCode,
  normalizeRoomCode,
  parseMabarMessage,
  serializeMabarMessage,
  toWireMessage,
} from './mabar-protocol';

test('kode room selalu 4 karakter dari alfabet aman', () => {
  for (let i = 0; i < 200; i += 1) {
    const code = makeRoomCode();
    assert.equal(code.length, MABAR_ROOM_LENGTH);
    for (const ch of code) {
      assert.ok(ROOM_ALPHABET.includes(ch), `karakter ${ch} harus dari alfabet room`);
    }
  }
});

test('kode room memakai sumber acak yang diberikan', () => {
  const zero = makeRoomCode(() => 0);
  assert.equal(zero, ROOM_ALPHABET[0].repeat(MABAR_ROOM_LENGTH));
  const last = makeRoomCode((max) => max - 1);
  assert.equal(last, ROOM_ALPHABET[ROOM_ALPHABET.length - 1].repeat(MABAR_ROOM_LENGTH));
});

test('normalizeRoomCode merapikan input pemain', () => {
  assert.equal(normalizeRoomCode('ab3d'), 'AB3D');
  assert.equal(normalizeRoomCode(' a b 3 d '), 'AB3D');
  assert.equal(normalizeRoomCode('AB-3D'), 'AB3D');
  assert.equal(normalizeRoomCode('AB'), null);
  assert.equal(normalizeRoomCode('ABCDE'), null);
  // huruf/angka yang mirip (0, 1, I, L, O) tidak dipakai di kode room
  assert.equal(normalizeRoomCode('0O1I'), null);
  assert.equal(normalizeRoomCode('ABCD'), 'ABCD');
  assert.equal(normalizeRoomCode('ABOD'), null);
  assert.equal(normalizeRoomCode('A1CD'), null);
});

test('nama channel unik per room dan huruf besar', () => {
  assert.equal(channelNameFor('ab3d'), 'tawuran-mabar-AB3D');
  assert.notEqual(channelNameFor('AB3D'), channelNameFor('AB3E'));
});

test('pesan valid bisa di-parse bolak-balik', () => {
  const msgs = [
    { t: 'hi', p: { name: 'Raka', level: 3, weapon: 'gir_sabuk', girLength: 4, hue: 20 } },
    { t: 'we', p: { name: 'Budi', level: 1, weapon: 'kayu_paku', girLength: 2, hue: 300 } },
    { t: 's', x: 1.5, z: -2, y: 3, hp: 88, b: 1, ph: 'active', sp: 4.2 },
    { t: 'a', w: 'sabit_modif', g: 3.5, x: 0, z: 0, y: 0 },
    { t: 'h', d: 12, b: 0 },
    { t: 'ko' },
    { t: 'bye' },
  ] as const;

  for (const msg of msgs) {
    const parsed = parseMabarMessage(serializeMabarMessage(msg as never));
    assert.ok(parsed, `pesan ${JSON.stringify(msg)} harus valid`);
    assert.equal(parsed?.t, msg.t);
  }
});

test('pesan rusak atau di luar batas ditolak', () => {
  assert.equal(parseMabarMessage('bukan json'), null);
  assert.equal(parseMabarMessage('{}'), null);
  assert.equal(parseMabarMessage(serializeMabarMessage({ t: 's', x: 999, z: 0, y: 0, hp: 10, b: 0, ph: 'idle', sp: 1 } as never)), null);
  assert.equal(parseMabarMessage(serializeMabarMessage({ t: 'a', w: 'bukan_senjata', g: 3, x: 0, z: 0, y: 0 } as never)), null);
  assert.equal(parseMabarMessage(serializeMabarMessage({ t: 'h', d: -5, b: 0 } as never)), null);
  assert.equal(parseMabarMessage('{"t":"s"}'), null);
});

test('fase serangan tak dikenal jatuh ke idle, bukan error', () => {
  const parsed = parseMabarMessage(
    serializeMabarMessage({ t: 's', x: 0, z: 0, y: 0, hp: 100, b: 0, ph: 'nuklir', sp: 0 } as never),
  );
  assert.ok(parsed && parsed.t === 's');
  assert.equal(parsed.t === 's' ? parsed.ph : '', 'idle');
});

test('nama pemain dipotong dan dibersihkan', () => {
  const parsed = parseMabarMessage(
    toWireMessage({
      t: 'hi',
      p: { name: '   ' + 'x'.repeat(40) + '\u0000y', level: 1, weapon: 'kayu_paku', girLength: 2, hue: 0 },
    }),
  );
  assert.ok(parsed && parsed.t === 'hi');
  const name = parsed.t === 'hi' ? parsed.p.name : '';
  assert.ok(name.length <= 18);
  assert.ok(!name.includes('\u0000'));
});

test('lompatan posisi tidak wajar ditolak', () => {
  assert.ok(isPlausiblePosition(null, { x: 50, z: 50 }, 0.1));
  assert.ok(isPlausiblePosition({ x: 0, z: 0 }, { x: 1, z: 1 }, 0.1));
  assert.ok(!isPlausiblePosition({ x: 0, z: 0 }, { x: 0, z: 40 }, 0.1));
  assert.ok(
    !isPlausiblePosition({ x: 0, z: 0 }, { x: 0, z: MABAR_MAX_POSITION_JUMP + 20 }, 0.1),
  );
});

test('lerpAngle memakai jalur terpendek melewati -pi/pi', () => {
  const mid = lerpAngle(Math.PI - 0.2, -Math.PI + 0.2, 0.5);
  const normalized = Math.atan2(Math.sin(mid), Math.cos(mid));
  assert.ok(Math.abs(Math.abs(normalized) - Math.PI) < 0.05);
  assert.ok(Math.abs(lerpAngle(0, Math.PI / 2, 0.5) - Math.PI / 4) < 1e-9);
});

test('warna jaket lawan valid dan berbeda per hue', () => {
  const hex = /^#[0-9a-f]{6}$/;
  assert.match(jacketColorForHue(0), hex);
  assert.match(jacketColorForHue(-30), hex);
  assert.match(jacketColorForHue(370), hex);
  assert.notEqual(jacketColorForHue(10), jacketColorForHue(200));
});
