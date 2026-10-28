/** B15: ein durchgehender lokaler Spielweg über vorhandene Modulgrenzen. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { emptyGame, readGame, saveGame, saveImportedGame, restoreImportedGame,
  upsertCharacter, inspectGameStorage, validateGameImport } from '../js/rules/characters.mjs';
import { getCharacterCounters, applyCharacterAction } from '../js/rules/character-actions.mjs';
import { buildCharacterSheet } from '../js/rules/character-sheet.mjs';
import { prepareCloudCharacter, mergeCloudCharacter } from '../js/rules/cloud-characters.mjs';
import { makeEdrasState } from '../js/rules/edras.mjs';
import { storedDateLabel } from '../js/rules/ux.mjs';

const categories = { classes: 'Classes', levels: 'Levels', equipment: 'Equipment',
  species: 'Species', backgrounds: 'Backgrounds', subspecies: 'Subspecies',
  traits: 'Traits', feats: 'Feats', skills: 'Skills', languages: 'Languages',
  proficiencies: 'Proficiencies', subclasses: 'Subclasses', features: 'Features',
  spells: 'Spells' };
const catalog = Object.fromEntries(Object.entries(categories).map(([name, suffix]) =>
  [name, JSON.parse(readFileSync(new URL(`../data/srd-5.2.1/en/5e-SRD-${suffix}.json`, import.meta.url), 'utf8'))]));

function storage() {
  const entries = new Map();
  return { getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, String(value)); },
    removeItem(key) { entries.delete(key); } };
}

function fighter() {
  return { id: 'b15-test-fighter', name: 'Tarin', className: 'Fighter', race: 'Dwarf', level: 8,
    profile: { ruleset: 'srd-5.2.1', classId: 'fighter', level: 8,
      speciesId: 'dwarf', backgroundId: 'acolyte',
      attributes: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      originChoices: { languages: ['elvish', 'dwarvish'] },
      inventory: { items: { longsword: 1 } },
      tracker: { resources: { second_wind_uses: 1 } },
    } };
}

test('B15: Spielablauf Erstellung → Kampf → Rast → Aufstieg → Reload → Export/Restore → Cloud', () => {
  const store = storage();
  const start = upsertCharacter({ ...emptyGame(), campaign: 'B15-Testrunde' }, fighter());
  saveGame(start, store);
  let hero = readGame(store).characters[0];
  const maxHp = getCharacterCounters(hero, catalog).vitals.maxHp;
  assert.ok(maxHp > 25);

  hero = applyCharacterAction(hero, catalog, { type: 'vitals', name: 'damage', amount: 12 });
  assert.equal(buildCharacterSheet(hero, catalog).hp, maxHp - 12);
  hero = applyCharacterAction(hero, catalog, { type: 'resource', group: 'resources',
    id: 'second_wind_uses', delta: -1 });
  assert.equal(hero.profile.tracker.resources.second_wind_uses, 0);
  assert.throws(() => applyCharacterAction(hero, catalog, { type: 'resource',
    group: 'resources', id: 'second_wind_uses', delta: -1 }), /bereits verbraucht/);
  hero = applyCharacterAction(hero, catalog, { type: 'rest', name: 'short' });
  assert.ok(hero.profile.tracker.resources.second_wind_uses > 0);
  hero = applyCharacterAction(hero, catalog, { type: 'rest', name: 'long' });
  assert.equal(buildCharacterSheet(hero, catalog).hp, maxHp);

  hero = { ...hero, level: 9, profile: { ...hero.profile, level: 9 } };
  assert.equal(buildCharacterSheet(hero, catalog).classNames[0].level, 9);
  saveGame(upsertCharacter(readGame(store), hero, hero.id), store);
  const beforeImport = structuredClone(readGame(store));
  assert.equal(beforeImport.characters[0].level, 9);
  assert.equal(inspectGameStorage(store).status, 'ready');

  saveImportedGame({ ...emptyGame(), campaign: 'Temporärer Import' }, store);
  assert.equal(readGame(store).characters.length, 0);
  assert.deepEqual(restoreImportedGame(store), beforeImport);
  assert.deepEqual(readGame(store), beforeImport);

  const forCloud = prepareCloudCharacter(readGame(store).characters[0]);
  const remote = { schemaVersion: 1, ownerId: 'player-b15', character: forCloud };
  assert.throws(() => mergeCloudCharacter(readGame(store), remote), /existiert bereits/);
  assert.deepEqual(mergeCloudCharacter(emptyGame(), remote).characters[0], forCloud);
  assert.deepEqual(mergeCloudCharacter(readGame(store), remote, { replace: true }), readGame(store));
});

test('B15: Optionaler Edras-Zustand ändert keine SRD-Attribute oder Spielbogen-TP', () => {
  const original = fighter();
  const standard = buildCharacterSheet(original, catalog);
  const edrasState = makeEdrasState({ level: 8, constitution: 14, potential: 2, techniqueId: 'W' });
  const withWorld = { ...original, profile: { ...original.profile, edras: edrasState } };
  assert.deepEqual(withWorld.profile.attributes, original.profile.attributes);
  assert.equal(buildCharacterSheet(withWorld, catalog).maxHp, standard.maxHp);
  assert.deepEqual(buildCharacterSheet(withWorld, catalog).savingThrows, standard.savingThrows);
  const spent = applyCharacterAction(withWorld, catalog, { type: 'edras', name: 'spend' });
  assert.ok(spent.profile.edras.lifeEnergy < edrasState.lifeEnergy);
  assert.equal(buildCharacterSheet(spent, catalog).maxHp, standard.maxHp);
  const restored = applyCharacterAction(spent, catalog, { type: 'rest', name: 'long' });
  assert.equal(restored.profile.edras.stress, 0);
  assert.equal(restored.profile.edras.lifeEnergy, edrasState.lifeEnergy);
});

test('B15-Fix: importierte Alt-Chronik und Würfe ohne Datum blockieren die Ansicht nicht', () => {
  const legacy = { ...emptyGame(), notes: [{ id: 'old-note', title: 'Alte Chronik' }],
    rolls: [{ id: 'old-roll', sides: 20, count: 1, mod: 0, total: 12, values: [12] }] };
  assert.doesNotThrow(() => validateGameImport(legacy));
  const store = storage();
  saveGame(legacy, store);
  assert.deepEqual(readGame(store), legacy);
  assert.equal(storedDateLabel(undefined), 'Datum unbekannt');
  assert.equal(storedDateLabel(''), 'Datum unbekannt');
  assert.equal(storedDateLabel('ungültig', { time: true }), 'Datum unbekannt');
  assert.notEqual(storedDateLabel('2026-10-27T12:00:00Z'), 'Datum unbekannt');
  assert.notEqual(storedDateLabel('2026-10-27T12:00:00Z', { time: true }), 'Datum unbekannt');
  const homepage = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(homepage, /shortDate\(iso\)\{return storedDateLabel\(iso\)\}/);
  assert.match(homepage, /storedDateLabel\(r\.created,\{time:true\}\)/);
});
