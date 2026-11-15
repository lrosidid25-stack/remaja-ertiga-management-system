import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVELS,
  MAX_LEVEL,
  buildWaveConfig,
  clampLevelId,
  getLevel,
  unlockNextLevel,
} from './maps';
import { ARENA_BOUNDS } from './rules';

test('ada 10 map jalanan dengan id 1–10 dan urutan kesulitan naik', () => {
  assert.equal(LEVELS.length, 10);
  assert.equal(MAX_LEVEL, 10);

  LEVELS.forEach((level, index) => {
    assert.equal(level.id, index + 1, `id level ke-${index + 1} harus ${index + 1}`);
    assert.ok(level.nama.trim().length > 0, 'nama map wajib ada');
    assert.ok(level.lokasi.trim().length > 0, 'lokasi map wajib ada');
    assert.ok(level.difficulty >= 1 && level.difficulty <= 10);
    if (index > 0) {
      assert.ok(
        level.difficulty >= LEVELS[index - 1].difficulty,
        'kesulitan harus naik atau sama seiring level',
      );
    }
  });
});

test('setiap map punya tema & tata letak yang masuk akal', () => {
  for (const level of LEVELS) {
    const { theme, layout } = level;

    for (const [key, value] of Object.entries(theme)) {
      if (key === 'horizonGlowOpacity' || key === 'fogDensity') continue;
      if (key === 'sunPosition') continue;
      assert.equal(typeof value, 'number', `theme.${key} harus angka`);
      assert.ok(Number.isFinite(value as number), `theme.${key} harus finite`);
    }
    assert.ok(theme.fogDensity > 0);
    assert.ok(theme.sunPosition.length === 3);

    assert.ok(layout.roadWidth >= 18 && layout.roadWidth <= 32, 'lebar jalan 18–32 m');
    assert.ok(layout.buildingCount >= 0 && layout.buildingCount <= 6);
    assert.ok(layout.lamps >= 0 && layout.lamps <= 4);
    assert.ok(['dashed', 'double', 'none'].includes(layout.markings));
  }
});

test('jumlah gelombang 2–4 dan lawan tetap berada di dalam arena', () => {
  for (const level of LEVELS) {
    assert.ok(level.waveCount >= 2 && level.waveCount <= 4);

    for (let wave = 1; wave <= level.waveCount; wave++) {
      const cfg = buildWaveConfig(level, wave);

      assert.equal(cfg.wave, wave);
      assert.equal(cfg.maxWaves, level.waveCount);
      assert.ok(cfg.enemies.length > 0, 'setiap gelombang punya lawan');
      assert.ok(cfg.enemies.length <= 8, 'maksimal 8 lawan per gelombang');
      assert.ok(cfg.speedMultiplier > 0);

      for (const enemy of cfg.enemies) {
        assert.ok(
          enemy.spawnX >= ARENA_BOUNDS.minX && enemy.spawnX <= ARENA_BOUNDS.maxX,
          `spawnX ${enemy.spawnX} di luar arena (level ${level.id})`,
        );
        assert.ok(
          enemy.spawnZ >= ARENA_BOUNDS.minZ && enemy.spawnZ <= ARENA_BOUNDS.maxZ,
          `spawnZ ${enemy.spawnZ} di luar arena (level ${level.id})`,
        );
        assert.ok(enemy.hp > 0 && enemy.speed > 0);
      }
    }
  }
});

test('gelombang terakhir level sulit memunculkan pentolan', () => {
  for (const level of LEVELS) {
    const cfg = buildWaveConfig(level, level.waveCount);
    const hasBoss = cfg.enemies.some((e) => e.archetype === 'pentolan');
    if (level.difficulty >= 5) {
      assert.ok(hasBoss, `level ${level.id} harus punya pentolan di gelombang akhir`);
    }
  }
});

test('level lebih tinggi memberi lawan lebih banyak / lebih kuat', () => {
  const easy = buildWaveConfig(LEVELS[0], 1);
  const hard = buildWaveConfig(LEVELS[MAX_LEVEL - 1], 1);

  assert.ok(hard.enemies.length >= easy.enemies.length);
  const easyHp = easy.enemies.reduce((sum, e) => sum + e.hp, 0);
  const hardHp = hard.enemies.reduce((sum, e) => sum + e.hp, 0);
  assert.ok(hardHp > easyHp, 'total HP lawan level 10 harus lebih besar');
});

test('clampLevelId & getLevel aman untuk input aneh', () => {
  assert.equal(clampLevelId(0), 1);
  assert.equal(clampLevelId(-5), 1);
  assert.equal(clampLevelId(99), MAX_LEVEL);
  assert.equal(clampLevelId(Number.NaN), 1);
  assert.equal(clampLevelId(3.7), 3);

  assert.equal(getLevel(4).id, 4);
  assert.equal(getLevel(999).id, 1, 'id tak dikenal jatuh ke level 1');
});

test('progres level terbuka bertambah dan berhenti di level terakhir', () => {
  assert.equal(unlockNextLevel(1), 2);
  assert.equal(unlockNextLevel(MAX_LEVEL), MAX_LEVEL);
});

test('menang di map terakhir tidak menambah level di luar batas', () => {
  assert.equal(unlockNextLevel(1), 2, 'menang map 1 membuka map 2');
  assert.equal(unlockNextLevel(9), 10, 'menang map 9 membuka map 10');
  assert.equal(unlockNextLevel(10), MAX_LEVEL, 'map 10 tetap 10 (tidak ada map 11)');
});
