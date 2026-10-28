import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EDRAS_ID, EDRAS_TECHNIQUES, edrasMaximum, makeEdrasState,
  normalizeEdrasState, applyEdrasAction } from '../js/rules/edras.mjs';
import { getClassLevelSummary, normalizeResourceTracker, restResourceTracker } from '../js/rules/dnd55.mjs';
import { loadCategory } from '../js/rules/catalog.mjs';

const context = { level: 8, constitution: 14 };
const start = (potential = 3, techniqueId = 'R') => makeEdrasState({ ...context, potential, techniqueId });
const act = (state, action, options) => applyEdrasAction(context, state, action, options);

globalThis.fetch = async url => ({
  ok: true, json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')),
});

test('Edras bleibt ein separates, versioniertes 5.5e-Weltmodul mit acht Techniken', () => {
  assert.equal(EDRAS_ID, 'edras-5.5-v0.1');
  assert.equal(EDRAS_TECHNIQUES.length, 8);
  assert.equal(new Set(EDRAS_TECHNIQUES.map(technique => technique.id)).size, 8);
  assert.ok(EDRAS_TECHNIQUES.every(technique => technique.action && technique.effect));
  assert.throws(() => makeEdrasState({ ...context, potential: 3, techniqueId: 'X' }), /unbekannte/);
});

test('LE: Grenzwerte, Übungsbonus, KON und Potenzial über alle Stufen', () => {
  for (let level = 1; level <= 20; level++) {
    for (const con of [3, 8, 10, 12, 14, 18, 20]) {
      for (let potential = 1; potential <= 5; potential++) {
        const actual = edrasMaximum(level, con, potential);
        const pb = 2 + Math.floor((level - 1) / 4);
        const expected = Math.max(3, 2 + pb + Math.floor((con - 10) / 2) + (potential >= 4 ? 1 : 0));
        assert.equal(actual, expected, `Stufe ${level} / KON ${con} / Potenzial ${potential}`);
      }
    }
  }
  assert.equal(edrasMaximum(8, 14, 3), 7);
  assert.equal(edrasMaximum(8, 14, 4), 8);
  assert.throws(() => edrasMaximum(21, 14, 3));
  assert.throws(() => edrasMaximum(8, 14, 0));
});

test('Techniken: 1 LE je Runde, keine zweite Nutzung und keine negative Energie', () => {
  const initial = start();
  const once = act(initial, 'spend');
  assert.equal(once.lifeEnergy, initial.lifeEnergy - 1);
  assert.equal(initial.lifeEnergy, 7, 'Kein Mutieren des Originals');
  assert.throws(() => act(once, 'spend'), /Höchstens/);
  assert.equal(act(act(once, 'nextRound'), 'spend').lifeEnergy, 5);
  let state = once;
  for (let i = 0; i < 6; i++) state = act(act(state, 'nextRound'), 'spend');
  assert.equal(state.lifeEnergy, 0);
  assert.throws(() => act(act(state, 'nextRound'), 'spend'), /Keine Lebensenergie/);
  assert.ok(!('slots' in state), 'Zauberplätze werden niemals als LE gespeichert');
});

test('Kurze Rast: einmalig 1+Übungsbonus, auch nach mehreren kurzen Rasten nicht erneut', () => {
  let state = start();
  for (let i = 0; i < 6; i++) state = act(act(state, 'nextRound'), 'spend');
  assert.equal(state.lifeEnergy, 1);
  state = act(state, 'shortRest');
  assert.equal(state.lifeEnergy, 5); // 1 + (1+PB 3)
  assert.equal(state.shortRecoveryUsed, true);
  state = act(act(state, 'nextRound'), 'spend');
  assert.equal(act(state, 'shortRest').lifeEnergy, 4);
  assert.equal(act(start(), 'shortRest').shortRecoveryUsed, false, 'Ohne LE-Verlust keine Nutzung verbrauchen');
});

test('Überzug: genau 1 fehlende LE, einmal pro langer Rast, SG 12 ist keine automatische Würfelentscheidung', () => {
  let state = { ...start(), lifeEnergy: 0 };
  state = act(state, 'spend', { overdraw: true });
  assert.equal(state.lifeEnergy, 0);
  assert.equal(state.stress, 2);
  assert.equal(state.overdrawUsed, true);
  assert.throws(() => act(act(state, 'nextRound'), 'spend', { overdraw: true }), /nicht erlaubt/);
  const unsafe = { ...start(), lifeEnergy: 0, stress: 3 };
  assert.throws(() => act(unsafe, 'spend', { overdraw: true }), /nicht erlaubt/);
  assert.equal('exhaustion' in state, false, 'CON-Save und Erschöpfung bleiben Spielentscheidung');
});

test('Potenzial 5: letzte reguläre LE löst einmalig Belastung aus, nicht zusätzlich bei Überzug', () => {
  const start5 = makeEdrasState({ ...context, potential: 5, techniqueId: 'E' });
  const last = act({ ...start5, lifeEnergy: 1 }, 'spend');
  assert.equal(last.stress, 1);
  assert.equal(last.lastEnergyStressUsed, true);
  const next = act(act(last, 'nextRound'), 'spend', { overdraw: true });
  assert.equal(next.stress, 3);
  assert.equal(next.lastEnergyStressUsed, true);
  const recovered = act({ ...next, lifeEnergy: 1 }, 'nextRound');
  assert.equal(act(recovered, 'spend').stress, 3, 'Nur einmal pro langer Rast');
});

test('Belastung 0–5: manuelle Anpassung, Sperre bei 5 und Erholung nach Bedingungen', () => {
  const full = { ...start(), stress: 5 };
  assert.throws(() => act(full, 'spend'), /gesperrt/);
  const lower = act(full, 'stress', { change: -1 });
  assert.equal(lower.stress, 4);
  assert.equal(act({ ...start(), stress: 5 }, 'stress', { change: 1 }).stress, 5);
  assert.equal(act({ ...start(), stress: 0 }, 'stress', { change: -1 }).stress, 0);
  assert.throws(() => act(full, 'stress', { change: 100 }));
  assert.equal(act(full, 'longRest').stress, 5, 'Ohne bestätigte Sicherheit keine automatische Entlastung');
  assert.equal(act(full, 'longRest', { recovery: 'safe' }).stress, 4);
  assert.equal(act(full, 'longRest', { recovery: '24h' }).stress, 3);
});

test('Lange Rast: LE, Kurzerholung, Überzug und Rundenlimit werden zurückgesetzt', () => {
  let spent = act({ ...start(), lifeEnergy: 0 }, 'spend', { overdraw: true });
  spent = act(spent, 'shortRest');
  assert.equal(spent.shortRecoveryUsed, true);
  const reset = act(spent, 'longRest', { recovery: 'safe' });
  assert.equal(reset.lifeEnergy, 7);
  assert.equal(reset.stress, 1);
  assert.equal(reset.overdrawUsed, false);
  assert.equal(reset.shortRecoveryUsed, false);
  assert.equal(reset.usedThisRound, false);
});

test('Beschädigter Speicher: Zahlen begrenzen, unbekannte Technik oder Version ablehnen', () => {
  const corrupted = normalizeEdrasState(context, {
    ...start(), lifeEnergy: 900, stress: 800, shortRecoveryUsed: 'ja', usedThisRound: 'true',
  });
  assert.equal(corrupted.lifeEnergy, 7);
  assert.equal(corrupted.stress, 5);
  assert.equal(corrupted.shortRecoveryUsed, false);
  assert.equal(corrupted.usedThisRound, false);
  assert.throws(() => normalizeEdrasState(context, { ...start(), potential: 19 }));
  assert.throws(() => normalizeEdrasState(context, { ...start(), version: '2020' }));
});

test('SRD-Zauberplätze erholen unabhängig von LE (kombinierte lange/kurze Rast)', async () => {
  const [classes, levels] = await Promise.all([loadCategory('classes'), loadCategory('levels')]);
  const wizard = classes.find(entry => entry.index === 'wizard');
  const summary = getClassLevelSummary(levels, wizard, 8, { int: 18, con: 14 });
  const slots = normalizeResourceTracker(summary);
  const depleted = { ...slots, slots: Object.fromEntries(Object.keys(slots.slots).map(key => [key, 0])) };
  let energy = { ...start(), lifeEnergy: 1 };
  assert.deepEqual(restResourceTracker(summary, depleted, 'short').slots, depleted.slots);
  energy = act(energy, 'shortRest');
  assert.equal(energy.lifeEnergy, 5);
  assert.deepEqual(restResourceTracker(summary, depleted, 'long').slots, slots.slots);
  assert.equal(act(energy, 'longRest').lifeEnergy, 7);
});

test('Weltmodul ist opt-in im öffentlichen Charakterlabor; keine Geheimdaten', () => {
  const html = readFileSync(new URL('../studio.html', import.meta.url), 'utf8');
  assert.match(html, /value="edras-5\.5-v0\.1"/);
  assert.match(html, /id="tracker-edras"/);
  assert.match(html, /Edras-Fragebogen ermittelt ausschließlich weltbezogene Eigenschaften/);
  assert.match(html, /niemals deine D&amp;D-Klasse/);
  const source = readFileSync(new URL('../js/rules/edras.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /actualResonance|gmSeed|secretNodes|hiddenBonds/);
});
