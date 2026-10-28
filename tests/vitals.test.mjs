import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CONDITIONS, normalizeVitals, applyVitals } from '../js/rules/vitals.mjs';
import { basicDndCharacter, abilityModifier } from '../js/rules/dnd55.mjs';
import { makeEdrasState, applyEdrasAction } from '../js/rules/edras.mjs';

const context = { maxHp: 50, level: 8, hitDie: 10, conModifier: 2 };
const act = (state, action, options) => applyVitals(context, state, action, options);

test('Neue 2024-Figur startet mit vollen TP, Trefferwürfeln und ohne Zustände', () => {
  const fresh = normalizeVitals(context);
  assert.equal(fresh.hp, 50);
  assert.equal(fresh.hitDiceSpent, 0);
  assert.equal(fresh.tempHp, 0);
  assert.deepEqual(fresh.deathSaves, { successes: 0, failures: 0 });
  assert.deepEqual(fresh.conditions, []);
});

test('Temporäre TP puffern Schaden ab; neuer Bonus wird nicht aufaddiert', () => {
  let state = act(undefined, 'temporaryHp', { amount: 10 });
  state = act(state, 'temporaryHp', { amount: 7 });
  assert.equal(state.tempHp, 10);
  state = act(state, 'temporaryHp', { amount: 12 });
  assert.equal(state.tempHp, 12);
  state = act(state, 'damage', { amount: 15 });
  assert.equal(state.tempHp, 0);
  assert.equal(state.hp, 47);
  assert.equal(act(state, 'heal', { amount: 100 }).hp, 50);
});

test('Schaden auf 0 TP beginnt Todesrettungen; Heilung löscht diese', () => {
  let state = act(undefined, 'damage', { amount: 50 });
  assert.equal(state.hp, 0);
  assert.equal(state.dead, false);
  state = act(state, 'damage', { amount: 2 });
  assert.equal(state.deathSaves.failures, 1);
  state = act(state, 'heal', { amount: 3 });
  assert.equal(state.hp, 3);
  assert.deepEqual(state.deathSaves, { successes: 0, failures: 0 });
});

test('Massiver Schaden tötet nur bei ausreichendem überschüssigem Schaden', () => {
  assert.equal(act(undefined, 'damage', { amount: 99 }).dead, false);
  assert.equal(act(undefined, 'damage', { amount: 100 }).dead, true);
  assert.throws(() => act({ hp: 0, dead: true }, 'heal', { amount: 20 }), /Verstorbene/);
  const atZero = act(undefined, 'damage', { amount: 50 });
  assert.equal(act(atZero, 'damage', { amount: 50 }).dead, true);
});

test('Todesrettung: natürliche 1 zählt doppelt, 20 bringt 1 TP zurück', () => {
  const zero = act(undefined, 'damage', { amount: 50 });
  assert.equal(act(zero, 'deathSave', { roll: 1 }).deathSaves.failures, 2);
  const revived = act(zero, 'deathSave', { roll: 20 });
  assert.equal(revived.hp, 1);
  assert.deepEqual(revived.deathSaves, { successes: 0, failures: 0 });
});

test('Drei Todesrettungen stabilisieren; drei Fehlschläge töten', () => {
  let stable = act(undefined, 'damage', { amount: 50 });
  for (let i = 0; i < 3; i++) stable = act(stable, 'deathSave', { roll: 10 });
  assert.equal(stable.stable, true);
  assert.throws(() => act(stable, 'deathSave', { roll: 10 }), /kein Todesrettungswurf nötig/);
  let failing = act(undefined, 'damage', { amount: 50 });
  failing = act(failing, 'deathSave', { roll: 1 });
  failing = act(failing, 'deathSave', { roll: 5 });
  assert.equal(failing.dead, true);
  assert.throws(() => act(failing, 'longRest'), /mindestens 1 TP/);
});

test('Kritischer Treffer bei 0 TP verursacht zwei Todesrettungsfehlschläge', () => {
  const zero = act(undefined, 'damage', { amount: 50 });
  assert.equal(act(zero, 'damage', { amount: 1, critical: true }).deathSaves.failures, 2);
  assert.equal(act(zero, 'stabilize').stable, true);
  assert.equal(act(act(zero, 'stabilize'), 'damage', { amount: 1 }).stable, false);
});

test('Trefferwürfel: ein Wurf plus KON, Mindestheilung 1, maximal Klassenstufe', () => {
  let state = act({ hp: 10 }, 'hitDie', { roll: 6 });
  assert.equal(state.hp, 18);
  assert.equal(state.hitDiceSpent, 1);
  for (let i = 0; i < 7; i++) state = act(state, 'hitDie', { roll: 1 });
  assert.equal(state.hitDiceSpent, 8);
  assert.throws(() => act(state, 'hitDie', { roll: 10 }), /nicht ausgegeben/);
  const weak = applyVitals({ ...context, conModifier: -5 }, { hp: 1 }, 'hitDie', { roll: 1 });
  assert.equal(weak.hp, 2);
  assert.throws(() => act(state, 'hitDie', { roll: 11 }), /Ungültiger Trefferwürfel/);
});

test('Lange Rast heilt voll, setzt Trefferwürfel und temporäre TP zurück, senkt Erschöpfung um 1', () => {
  let state = act(undefined, 'damage', { amount: 20 });
  state = act(state, 'hitDie', { roll: 5 });
  state = act(state, 'temporaryHp', { amount: 8 });
  state = act(state, 'exhaustion', { change: 1 });
  state = act(state, 'concentration', { active: true });
  const short = act(state, 'shortRest');
  assert.deepEqual(short, state, 'Kurze Rast heilt nicht automatisch');
  const rested = act(state, 'longRest');
  assert.equal(rested.hp, 50);
  assert.equal(rested.tempHp, 0);
  assert.equal(rested.hitDiceSpent, 0);
  assert.equal(rested.exhaustion, 0);
  assert.equal(rested.concentrating, false);
});

test('2024-Erschöpfung ist kumulativ; Stufe 6 bedeutet Tod', () => {
  let state = normalizeVitals(context);
  for (let i = 0; i < 6; i++) state = act(state, 'exhaustion', { change: 1 });
  assert.equal(state.exhaustion, 6);
  assert.equal(state.dead, true);
  assert.throws(() => act(state, 'exhaustion', { change: -1 }), /verstorben/);
});

test('Zustände sind einzigartig, brechen Konzentration bei Handlungsunfähigkeit', () => {
  let state = act(undefined, 'concentration', { active: true });
  state = act(state, 'condition', { id: 'poisoned' });
  assert.equal(state.concentrating, true);
  state = act(state, 'condition', { id: 'incapacitated' });
  assert.equal(state.concentrating, false);
  assert.deepEqual(state.conditions, ['poisoned', 'incapacitated']);
  assert.throws(() => act(state, 'concentration', { active: true }), /nicht möglich/);
  state = act(state, 'condition', { id: 'poisoned' });
  assert.deepEqual(state.conditions, ['incapacitated']);
});

test('Heroische Inspiration wird als einzelner Zustand erhalten', () => {
  const inspired = act(undefined, 'inspiration', { active: true });
  assert.equal(act(inspired, 'inspiration', { active: false }).heroicInspiration, false);
  assert.equal(act(inspired, 'longRest').heroicInspiration, true);
});

test('Stufenwechsel bewahrt verbrauchte Trefferwürfel statt deren Restzahl einzufrieren', () => {
  const spent = act(undefined, 'hitDie', { roll: 6 });
  const higher = normalizeVitals({ maxHp: 85, level: 12 }, spent);
  assert.equal(higher.hitDiceSpent, 1);
  assert.equal(12 - higher.hitDiceSpent, 11);
  assert.equal(higher.hp, spent.hp);
  assert.equal(normalizeVitals({ maxHp: 3, level: 1 }, { hp: 900, hitDiceSpent: 900 }).hp, 3);
});

test('Beschädigter lokaler Status wird begrenzt und unbekannte Zustände entfernt', () => {
  const repaired = normalizeVitals(context, { hp: -12, tempHp: 100000,
    hitDiceSpent: 999, deathSaves: { successes: 3, failures: 0 },
    exhaustion: 99, conditions: ['prone', 'prone', '__proto__', 'admin'] });
  assert.equal(repaired.hp, 0);
  assert.equal(repaired.tempHp, 0);
  assert.equal(repaired.hitDiceSpent, 8);
  assert.deepEqual(repaired.conditions, ['prone']);
  assert.equal(repaired.exhaustion, 0);
  assert.equal(repaired.dead, false, 'Beschädigte Erschöpfung darf nicht versehentlich töten');
  for (const value of [0, -1, 1.2, NaN]) assert.throws(() => act(undefined, 'damage', { amount: value }), /Betrag/);
  assert.throws(() => act(undefined, 'condition', { id: 'admin' }), /Unbekannter/);
});

test('Alle 2024-Bedingungen außer separat behandelter Erschöpfung im Zustandssystem', async () => {
  const data = JSON.parse(await readFile(fileURLToPath(new URL('../data/srd-5.2.1/en/5e-SRD-Conditions.json', import.meta.url)), 'utf8'));
  assert.deepEqual(new Set(CONDITIONS), new Set(data.map(row => row.index).filter(id => id !== 'exhaustion')));
});

test('Alle 12 Klassen/20 Stufen besitzen gültige TP-/Trefferwürfel-Ausgangswerte', async () => {
  const classes = JSON.parse(await readFile(fileURLToPath(new URL('../data/srd-5.2.1/en/5e-SRD-Classes.json', import.meta.url)), 'utf8'));
  let combinations = 0;
  for (const entry of classes) for (let level = 1; level <= 20; level++) {
    const attributes = { con: 16 };
    const summary = basicDndCharacter({ level, hitDie: entry.hit_die, attributes });
    const c = { level, maxHp: summary.max_hp, hitDie: entry.hit_die, conModifier: abilityModifier(16) };
    const damage = applyVitals(c, {}, 'damage', { amount: 1 });
    assert.equal(damage.hp, c.maxHp - 1);
    assert.equal(applyVitals(c, damage, 'longRest').hp, c.maxHp);
    combinations++;
  }
  assert.equal(combinations, 240);
});

test('Die Edras-LE bleibt unabhängig von Trefferpunkten und Klassenressourcen', () => {
  const edras = makeEdrasState({ level: 8, constitution: 14, potential: 3, techniqueId: 'W' });
  const used = applyEdrasAction({ level: 8, constitution: 14 }, edras, 'spend');
  const injured = act(undefined, 'damage', { amount: 7 });
  assert.equal(injured.hp, 43);
  assert.equal(used.lifeEnergy, edras.lifeEnergy - 1);
  assert.equal(act(injured, 'longRest').hp, 50);
  assert.equal(used.lifeEnergy, edras.lifeEnergy - 1, 'Eine D&D-Rast ändert Weltzustände nur über den Edras-Aufsatz');
});

test('Bestehendes Studio nutzt den Charakterzustand ohne weiteren Speicher oder Framework', async () => {
  const html = await readFile(new URL('../studio.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  assert.match(html, /id="tracker-vitals"/);
  assert.match(script, /renderVitals\(profile, sheet\)/);
  assert.match(script, /vitals: normalizeVitals\(vitalContext, previous\?\.profile\.vitals\)/);
  assert.match(script, /applyVitals\(getVitalContext\(profile\), profile\.vitals/);
  assert.doesNotMatch(script, /import .* from ['"](?:react|vue|angular)/);
});
