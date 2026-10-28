import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { basicDndCharacter, calculateHitPoints } from '../js/rules/dnd55.mjs';
import { emptyGame, readGame, SAVE_KEY, upsertCharacter } from '../js/rules/characters.mjs';
import { normalizeVitals } from '../js/rules/vitals.mjs';

const classes = JSON.parse(await readFile(new URL('../data/srd-5.2.1/en/5e-SRD-Classes.json', import.meta.url)));

test('alle zwölf SRD-Klassen: Trefferpunkte fest und gewürfelt auf Stufen 1–20', () => {
  assert.equal(classes.length, 12);
  for (const klass of classes) {
    for (let level = 1; level <= 20; level++) {
      const die = klass.hit_die;
      const fixed = calculateHitPoints({ level, hitDie: die, attributes: { con: 14 } });
      assert.equal(fixed.maxHp, die + 2 + (level - 1) * (Math.floor(die / 2) + 3), `${klass.index}/${level} fest`);
      assert.deepEqual(fixed.missing, []);
      const rolls = Array.from({ length: level - 1 }, (_, i) => (i % die) + 1);
      const rolled = calculateHitPoints({ level, hitDie: die, attributes: { con: 14 }, hitPoints: { method: 'rolled', rolls } });
      assert.equal(rolled.maxHp, die + 2 + rolls.reduce((sum, roll) => sum + roll + 2, 0), `${klass.index}/${level} gewürfelt`);
      assert.equal(basicDndCharacter({ level, hitDie: die, attributes: { con: 14 }, hitPoints: { method: 'rolled', rolls } }).max_hp, rolled.maxHp);
    }
  }
});

test('fehlende oder ungültige Einzelwürfe werden niemals still ersetzt', () => {
  const base = { level: 5, hitDie: 8, attributes: { con: 12 } };
  const incomplete = calculateHitPoints({ ...base, hitPoints: { method: 'rolled', rolls: [7, 0, 9] } });
  assert.equal(incomplete.maxHp, null);
  assert.deepEqual(incomplete.missing, [3, 4, 5]);
  assert.throws(() => calculateHitPoints({ ...base, hitPoints: { method: 'random' } }), /Trefferpunktmethode/);
  assert.throws(() => calculateHitPoints({ ...base, hitPoints: { method: 'rolled', rolls: '7,7,7' } }), /Liste/);
});

test('KON wirkt rückwirkend auf die gesamte Stufe; Rollwerte bleiben erhalten', () => {
  const options = { level: 12, hitDie: 10, hitPoints: { method: 'rolled', rolls: Array(11).fill(6) } };
  const before = calculateHitPoints({ ...options, attributes: { con: 13 } });
  const after = calculateHitPoints({ ...options, attributes: { con: 14 } });
  assert.equal(after.maxHp - before.maxHp, 12);
  assert.deepEqual(options.hitPoints.rolls, Array(11).fill(6));
  assert.equal(calculateHitPoints({ ...options, level: 8, attributes: { con: 14 } }).maxHp, 10 + 2 + 7 * 8);
});

test('Stufe 1 nutzt maximalen Trefferwürfel, spätere Zuwächse mindestens 1', () => {
  const first = calculateHitPoints({ level: 1, hitDie: 6, attributes: { con: 1 }, hitPoints: { method: 'rolled', rolls: [] } });
  assert.equal(first.maxHp, 1);
  assert.equal(calculateHitPoints({ level: 8, hitDie: 6, attributes: { con: 1 },
    hitPoints: { method: 'rolled', rolls: Array(7).fill(1) } }).maxHp, 8);
  assert.equal(basicDndCharacter({ level: 8, hitDie: 6, attributes: { con: 3 } }).max_hp, 9, 'Alte feste Figuren unverändert');
});

test('Einzelwürfe überleben Speichern, Neuladen, Bearbeiten und Ressourcen-Normalisierung', () => {
  const initial = { method: 'rolled', rolls: [9, 1, 10, 6, 4, 7, 5] };
  const char = { id: 'eins', name: 'Prüffigur', level: 8,
    profile: { ruleset: 'srd-5.2.1', classId: 'fighter', attributes: { con: 14 }, hitPoints: initial } };
  const storage = { data: new Map(), getItem(k) { return this.data.get(k); }, setItem(k, v) { this.data.set(k, v); } };
  storage.setItem(SAVE_KEY, JSON.stringify(upsertCharacter(emptyGame(), char)));
  const loaded = readGame(storage);
  assert.deepEqual(loaded.characters[0].profile.hitPoints, initial);
  const hp = calculateHitPoints({ level: 8, hitDie: 10, attributes: { con: 14 }, hitPoints: initial }).maxHp;
  const worn = normalizeVitals({ level: 8, maxHp: hp }, { hp: hp - 11, hitDiceSpent: 3 });
  const upgraded = { ...char, level: 10, profile: { ...char.profile,
    hitPoints: { method: 'rolled', rolls: [...initial.rolls, 8, 6] } } };
  const changed = upsertCharacter(loaded, upgraded, char.id);
  const newMax = calculateHitPoints({ level: 10, hitDie: 10, attributes: { con: 14 },
    hitPoints: upgraded.profile.hitPoints }).maxHp;
  assert.ok(newMax > hp);
  assert.equal(normalizeVitals({ level: 10, maxHp: newMax }, worn).hp, hp - 11);
  assert.deepEqual(changed.characters[0].profile.hitPoints.rolls.slice(0, 7), initial.rolls);
  assert.deepEqual(loaded.characters[0].profile.hitPoints, initial, 'Altstand bleibt unverändert');
});
