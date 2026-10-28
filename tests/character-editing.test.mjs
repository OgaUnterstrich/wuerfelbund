import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { emptyGame, upsertCharacter, readGame, SAVE_KEY } from '../js/rules/characters.mjs';
import { loadCategory } from '../js/rules/catalog.mjs';
import { getClassLevelSummary, normalizeResourceTracker, changeResourceTracker } from '../js/rules/dnd55.mjs';
import { makeEdrasState, applyEdrasAction, normalizeEdrasState } from '../js/rules/edras.mjs';

globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')) });

const profile = (classId = 'fighter') => ({ ruleset: 'srd-5.2.1', classId, tracker: { slots: {}, resources: {} }, createdAt: '2026-01-01' });
const character = (id, classId = 'fighter') => ({ id, name: id, level: 8, profile: profile(classId) });

test('Neuer Charakter wird einmal angelegt; ältere Entwürfe ändern sich nicht', () => {
  const game = { ...emptyGame(), campaign: 'Kampagne', characters: [character('alt')], notes: ['Behalten'] };
  const added = upsertCharacter(game, character('neu'));
  assert.deepEqual(added.characters.map(entry => entry.id), ['alt', 'neu']);
  assert.deepEqual(game.characters.map(entry => entry.id), ['alt']);
  assert.deepEqual(added.notes, ['Behalten']);
  assert.throws(() => upsertCharacter(added, character('neu')), /existiert bereits/);
});

test('Bearbeitung ersetzt exakt eine ID ohne Duplikate, inklusive Stufenwechsel und Zeitstempel', () => {
  const first = character('a');
  const other = character('b', 'wizard');
  const game = { ...emptyGame(), characters: [first, other] };
  const edited = { ...first, name: 'Neuer Name', level: 12,
    profile: { ...first.profile, createdAt: first.profile.createdAt, updatedAt: '2026-10-26' } };
  const updated = upsertCharacter(game, edited, 'a');
  assert.equal(updated.characters.length, 2);
  assert.deepEqual(updated.characters[0], edited);
  assert.equal(updated.characters[1], other);
  assert.equal(game.characters[0], first, 'Ursprünglicher Spielstand bleibt unverändert');
  assert.equal(updated.characters[0].profile.createdAt, '2026-01-01');
  const storage = { data: new Map(), getItem(key) { return this.data.get(key); }, setItem(key, value) { this.data.set(key, value); } };
  storage.setItem(SAVE_KEY, JSON.stringify(updated));
  assert.deepEqual(readGame(storage), updated);
});

test('Keine Übernahme einer fremden ID, gelöschten Figur oder anderen Regelversion', () => {
  const game = { ...emptyGame(), characters: [character('a')] };
  assert.throws(() => upsertCharacter(game, character('neu'), 'a'), /verändert/);
  assert.throws(() => upsertCharacter(game, character('neu'), 'fehlt'), /verändert/);
  assert.equal(upsertCharacter(game, { ...character('a'), profile: profile('wizard') }, 'a')
    .characters[0].profile.classId, 'wizard', 'Klassenwechsel ist innerhalb desselben Regelsystems erlaubt');
});

test('Fremdes Regelsystem und 200er-Grenze bleiben geschützt', () => {
  const game = { ...emptyGame(), characters: [character('a')] };
  assert.throws(() => upsertCharacter(game, { ...character('a'), profile: { ...profile(), ruleset: 'other' } }, 'a'), /verändert/);
  const full = { ...emptyGame(), characters: Array.from({ length: 200 }, (_, i) => character(String(i))) };
  assert.throws(() => upsertCharacter(full, character('neu')), /voll/);
  const renamed = { ...full.characters[0], name: 'Aktualisiert' };
  assert.equal(upsertCharacter(full, renamed, '0').characters.length, 200, 'Bestehende Figuren dürfen weiterhin bearbeitet werden');
  assert.throws(() => upsertCharacter(emptyGame(), {}), /Ungültiger/);
});

test('Stufenanstieg bewahrt verbrauchte Plätze und Klassenressourcen; neue Werte werden begrenzt', async () => {
  const [classes, levels] = await Promise.all([loadCategory('classes'), loadCategory('levels')]);
  let checked = 0;
  for (const classEntry of classes) {
    const before = getClassLevelSummary(levels, classEntry, 8, { str: 16, dex: 14, con: 14, int: 16, wis: 16, cha: 16 });
    const after = getClassLevelSummary(levels, classEntry, 12, { str: 16, dex: 14, con: 14, int: 16, wis: 16, cha: 16 });
    let tracker = normalizeResourceTracker(before);
    if (before.spellcasting?.slots?.length) tracker = changeResourceTracker(before, tracker, 'slots', String(before.spellcasting.slots[0].level), -1);
    if (before.resources.length) tracker = changeResourceTracker(before, tracker, 'resources', before.resources[0].id, -1);
    const upgraded = normalizeResourceTracker(after, tracker);
    for (const slot of after.spellcasting?.slots || []) {
      const remaining = upgraded.slots[slot.level];
      assert.ok(remaining >= 0 && remaining <= slot.max);
      if (before.spellcasting?.slots.some(old => old.level === slot.level)) {
        assert.equal(remaining, Math.min(slot.max, tracker.slots[slot.level]));
      }
    }
    for (const resource of after.resources) {
      assert.ok(upgraded.resources[resource.id] >= 0 && upgraded.resources[resource.id] <= resource.max);
      if (before.resources.some(old => old.id === resource.id)) {
        assert.equal(upgraded.resources[resource.id], Math.min(resource.max, tracker.resources[resource.id]));
      }
    }
    checked++;
  }
  assert.equal(checked, 12);
});

test('Edras-LE und Belastung bleiben bei einem Stufenanstieg erhalten und gedeckelt', () => {
  let state = makeEdrasState({ level: 8, constitution: 14, potential: 3, techniqueId: 'W' });
  state = applyEdrasAction({ level: 8, constitution: 14 }, state, 'spend');
  state = applyEdrasAction({ level: 8, constitution: 14 }, state, 'stress', { change: 1 });
  const upgraded = normalizeEdrasState({ level: 15, constitution: 16 }, state);
  assert.equal(upgraded.lifeEnergy, state.lifeEnergy);
  assert.equal(upgraded.stress, 1);
  assert.equal(upgraded.usedThisRound, true);
  assert.equal(upgraded.techniqueId, 'W');
});

test('Studio hat einen Bearbeiten-/Abbrechen-Weg ohne zusätzliche Frameworks', async () => {
  const html = await readFile(new URL('../studio.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  for (const id of ['tracker-edit', 'character-cancel-edit', 'character-save', 'character-edit-state']) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(script, new RegExp(id));
  }
  assert.match(script, /assertCharacterRestored\(profile\)/);
  assert.match(script, /upsertCharacter\(saved, next, editingCharacterId\)/);
  assert.match(script, /normalizeResourceTracker\(getCharacterTrackerSummary\(next, characterData\)/);
  assert.match(script, /previous && !classTrackChanged \? previous\.profile\.tracker : \{\}/);
  assert.doesNotMatch(html, /<script[^>]*src="https:\/\//);
});
