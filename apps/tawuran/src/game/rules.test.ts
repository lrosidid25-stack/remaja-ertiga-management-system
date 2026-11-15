import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_BOUNDS,
  THROWABLE_SPECS,
  WEAPON_SPECS,
  clampGirLength,
  computeExplosionDamage,
  computeMeleeHit,
  computeWaveConfig,
  evaluateAttackTokenPool,
  getEffectiveWeaponSpec,
  resolveActorPosition,
} from './rules';

test('computeMeleeHit hits target inside reach and frontal arc', () => {
  const result = computeMeleeHit({
    attackerX: 0,
    attackerZ: 0,
    attackerYaw: 0, // facing +Z
    targetX: 0.4,
    targetZ: 2.1,
    weapon: WEAPON_SPECS.sabit_modif,
    targetBlocking: false,
    targetParryTimer: 0,
    comboCount: 2,
  });

  assert.equal(result.hit, true);
  assert.equal(result.parried, false);
  assert.equal(result.blocked, false);
  assert.ok(result.damage >= WEAPON_SPECS.sabit_modif.damage);
  assert.equal(result.nextCombo, 3);
  assert.ok(result.knockbackZ > 0);
});

test('computeMeleeHit misses targets out of reach or behind attacker', () => {
  const tooFar = computeMeleeHit({
    attackerX: 0,
    attackerZ: 0,
    attackerYaw: 0,
    targetX: 0,
    targetZ: 5.5,
    weapon: WEAPON_SPECS.kayu_paku,
    targetBlocking: false,
    targetParryTimer: 0,
    comboCount: 0,
  });
  assert.equal(tooFar.hit, false);

  const behind = computeMeleeHit({
    attackerX: 0,
    attackerZ: 0,
    attackerYaw: 0, // facing +Z
    targetX: 0,
    targetZ: -1.5, // behind attacker
    weapon: WEAPON_SPECS.kayu_paku,
    targetBlocking: false,
    targetParryTimer: 0,
    comboCount: 0,
  });
  assert.equal(behind.hit, false);
});

test('computeMeleeHit handles block mitigation and perfect parry', () => {
  const blocked = computeMeleeHit({
    attackerX: 0,
    attackerZ: 0,
    attackerYaw: 0,
    targetX: 0,
    targetZ: 1.8,
    weapon: WEAPON_SPECS.kayu_paku,
    targetBlocking: true,
    targetParryTimer: 0,
    comboCount: 0,
  });
  assert.equal(blocked.hit, true);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.parried, false);
  assert.ok(blocked.damage < WEAPON_SPECS.kayu_paku.damage * 0.4);

  const parried = computeMeleeHit({
    attackerX: 0,
    attackerZ: 0,
    attackerYaw: 0,
    targetX: 0,
    targetZ: 1.8,
    weapon: WEAPON_SPECS.kayu_paku,
    targetBlocking: true,
    targetParryTimer: 0.15,
    comboCount: 4,
  });
  assert.equal(parried.hit, true);
  assert.equal(parried.parried, true);
  assert.equal(parried.damage, 0);
});

test('computeExplosionDamage scales by blast radius and misses outside radius', () => {
  const spec = THROWABLE_SPECS.petasan_banting;
  const centerHit = computeExplosionDamage(0, 0, 0.5, 0.5, spec);
  const edgeHit = computeExplosionDamage(0, 0, spec.blastRadius - 0.2, 0, spec);
  const miss = computeExplosionDamage(0, 0, spec.blastRadius + 0.5, 0, spec);

  assert.equal(centerHit.hit, true);
  assert.equal(edgeHit.hit, true);
  assert.ok(centerHit.damage > edgeHit.damage);
  assert.equal(miss.hit, false);
  assert.equal(miss.damage, 0);
});

test('evaluateAttackTokenPool limits concurrent attackers and keeps active holders', () => {
  const tokens = evaluateAttackTokenPool(
    [
      { id: 'e1', distSq: 25, hasToken: true, alive: true },
      { id: 'e2', distSq: 4, hasToken: false, alive: true },
      { id: 'e3', distSq: 9, hasToken: false, alive: true },
      { id: 'e4', distSq: 1, hasToken: false, alive: false },
    ],
    2,
  );

  assert.equal(tokens.size, 2);
  assert.equal(tokens.has('e1'), true);
  assert.equal(tokens.has('e2'), true);
  assert.equal(tokens.has('e4'), false);
});

test('computeWaveConfig ramps enemy count, HP, and max concurrent attackers', () => {
  const w1 = computeWaveConfig(1);
  const w2 = computeWaveConfig(2);
  const w3 = computeWaveConfig(3);

  assert.ok(w1.enemies.length < w2.enemies.length);
  assert.ok(w2.enemies.length < w3.enemies.length);
  assert.ok(w3.speedMultiplier > w1.speedMultiplier);
  assert.ok(w3.enemies.some((e) => e.archetype === 'pentolan'));
});

test('resolveActorPosition clamps to arena bounds and pushes out of obstacles', () => {
  const clamped = resolveActorPosition(99, -99, 0.5);
  assert.equal(clamped.x, ARENA_BOUNDS.maxX - 0.5);
  assert.equal(clamped.z, ARENA_BOUNDS.minZ + 0.5);

  const pushed = resolveActorPosition(-10.5, -13, 0.55); // Inside pier_nw (-11.4..-9.8, -14..-12)
  const insidePier =
    pushed.x > -11.4 && pushed.x < -9.8 && pushed.z > -14.0 && pushed.z < -12.0;
  assert.equal(insidePier, false);
});

test('getEffectiveWeaponSpec scales gir_sabuk speed vs damage across 2m-6m', () => {
  assert.equal(clampGirLength(0.5), 2.0);
  assert.equal(clampGirLength(9.0), 6.0);

  const shortGir = getEffectiveWeaponSpec('gir_sabuk', 2.0);
  const midGir = getEffectiveWeaponSpec('gir_sabuk', 4.0);
  const longGir = getEffectiveWeaponSpec('gir_sabuk', 6.0);

  const shortCycle = shortGir.windupSec + shortGir.activeSec + shortGir.recoverySec;
  const midCycle = midGir.windupSec + midGir.activeSec + midGir.recoverySec;
  const longCycle = longGir.windupSec + longGir.activeSec + longGir.recoverySec;

  // Short belt = fast swing, small damage & shorter reach
  // Long belt = slower spin, high damage & huge reach
  assert.ok(shortCycle < midCycle && midCycle < longCycle);
  assert.ok(shortGir.damage < midGir.damage && midGir.damage < longGir.damage);
  assert.ok(shortGir.reach < midGir.reach && midGir.reach < longGir.reach);
  assert.ok(shortGir.knockback < longGir.knockback);
});

import { ALLY_SQUAD_SPECS } from './rules';

test('ALLY_SQUAD_SPECS provides distinct schoolmate allies flanking the player', () => {
  assert.ok(ALLY_SQUAD_SPECS.length >= 2);
  const flanks = new Set(ALLY_SQUAD_SPECS.map((a) => Math.sign(a.flankOffsetX)));
  assert.equal(flanks.has(-1) && flanks.has(1), true);
  for (const ally of ALLY_SQUAD_SPECS) {
    assert.ok(ally.maxHp >= 100);
    assert.ok(ally.speed > 4);
  }
});
