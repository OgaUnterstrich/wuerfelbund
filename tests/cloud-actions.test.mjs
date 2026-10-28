import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { getCharacterCounters, applyCharacterAction } from '../js/rules/character-actions.mjs';
import { makeEdrasState } from '../js/rules/edras.mjs';

const files = { classes: 'Classes', levels: 'Levels', equipment: 'Equipment',
  species: 'Species', backgrounds: 'Backgrounds', subspecies: 'Subspecies',
  traits: 'Traits', feats: 'Feats', skills: 'Skills', languages: 'Languages',
  proficiencies: 'Proficiencies' };
const catalog = Object.fromEntries(Object.entries(files).map(([key, file]) => [key,
  JSON.parse(readFileSync(new URL(`../data/srd-5.2.1/en/5e-SRD-${file}.json`, import.meta.url), 'utf8'))]));
const fixture = () => ({ id: 'char-b04', name: 'Balor', level: 8, className: 'Fighter', race: 'Dwarf',
  profile: { ruleset: 'srd-5.2.1', classId: 'fighter', level: 8,
    speciesId: 'dwarf', backgroundId: 'acolyte',
    attributes: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    originChoices: { languages: ['elvish', 'dwarvish'] },
    inventory: { items: { longsword: 2 } },
    edras: makeEdrasState({ level: 8, constitution: 14, potential: 2, techniqueId: 'W' }),
  } });

test('B04: gemeinsame Studio-/Cloud-Kontexte nutzen die 2024-SRD-Tabellen', () => {
  const character = fixture();
  const counters = getCharacterCounters(character, catalog);
  assert.ok(counters.vitals.maxHp > 30);
  assert.equal(counters.condition.hp, counters.vitals.maxHp);
  assert.equal(counters.summary.resources.find(x => x.id === 'second_wind_uses')?.max > 0, true);
});

test('B04: HP, Konzentration, Heilung und Trefferwürfel durch bestehende Engine', () => {
  const initial = fixture();
  const max = getCharacterCounters(initial, catalog).vitals.maxHp;
  const damage = applyCharacterAction(initial, catalog, { type: 'vitals', name: 'damage', amount: 9 });
  assert.equal(damage.profile.vitals.hp, max - 9);
  assert.equal(initial.profile.vitals, undefined);
  const used = applyCharacterAction(damage, catalog, { type: 'vitals', name: 'hitDie', roll: 5 });
  assert.equal(used.profile.vitals.hitDiceSpent, 1);
  assert.ok(used.profile.vitals.hp >= damage.profile.vitals.hp);
  const healed = applyCharacterAction(used, catalog, { type: 'vitals', name: 'heal', amount: 9999 });
  assert.equal(healed.profile.vitals.hp, max);
  const temporary = applyCharacterAction(healed, catalog, { type: 'vitals', name: 'temporaryHp', amount: 6 });
  assert.equal(temporary.profile.vitals.tempHp, 6);
  assert.throws(() => applyCharacterAction(healed, catalog, { type: 'vitals', name: 'hitDie', roll: 20 }), /Ungültiger Trefferwürfel/);
});

test('B04: Todesrettungswürfe und Stabilisierung verwenden vorhandene TP-Regeln', () => {
  const down = applyCharacterAction(fixture(), catalog, { type: 'vitals', name: 'damage', amount: 99 });
  assert.equal(down.profile.vitals.hp, 0);
  assert.equal(down.profile.vitals.dead, false);
  const saved = applyCharacterAction(down, catalog, { type: 'vitals', name: 'deathSave', roll: 15 });
  assert.equal(saved.profile.vitals.deathSaves.successes, 1);
  const stable = applyCharacterAction(saved, catalog, { type: 'vitals', name: 'stabilize' });
  assert.equal(stable.profile.vitals.stable, true);
  assert.throws(() => applyCharacterAction(stable, catalog, { type: 'vitals', name: 'deathSave', roll: 10 }), /kein Todesrettungswurf/);
});

test('B04: Ressourcen nie unter Null oder über Max; keine stillen Doppel-Verbräuche', () => {
  let hero = fixture();
  const resource = getCharacterCounters(hero, catalog).summary.resources.find(x => x.id === 'second_wind_uses');
  assert.ok(resource?.max);
  const spent = { type: 'resource', group: 'resources', id: resource.id, delta: -1 };
  for (let i = 0; i < resource.max; i++) hero = applyCharacterAction(hero, catalog, spent);
  assert.equal(hero.profile.tracker.resources[resource.id], 0);
  assert.throws(() => applyCharacterAction(hero, catalog, spent), /bereits verbraucht/);
  const recovered = applyCharacterAction(hero, catalog, { ...spent, delta: 1 });
  assert.equal(recovered.profile.tracker.resources[resource.id], 1);
  assert.throws(() => applyCharacterAction(hero, catalog, { type: 'resource', group: 'slots', id: '9', delta: -1 }), /unbekannte Ressource/);
});

test('B04: Inventar-Abgang und neuer Zugang verwenden vorhandenen SRD-Katalog', () => {
  const first = applyCharacterAction(fixture(), catalog, { type: 'inventory', id: 'longsword', delta: -1 });
  assert.equal(first.profile.inventory.items.longsword, 1);
  const second = applyCharacterAction(first, catalog, { type: 'inventory', id: 'longsword', delta: -1 });
  assert.equal(second.profile.inventory.items.longsword, undefined);
  assert.throws(() => applyCharacterAction(second, catalog, { type: 'inventory', id: 'longsword', delta: -1 }), /Nicht genug/);
  assert.throws(() => applyCharacterAction(first, catalog, { type: 'inventory', id: 'invalid', delta: 1 }), /Ungültige/);
});

test('B04: Kurze/lange Rast verbinden TP, Klassenressourcen und optionale Edras-LE', () => {
  let hero = fixture();
  hero = applyCharacterAction(hero, catalog, { type: 'vitals', name: 'damage', amount: 7 });
  hero = applyCharacterAction(hero, catalog, { type: 'resource', group: 'resources', id: 'second_wind_uses', delta: -1 });
  hero = applyCharacterAction(hero, catalog, { type: 'edras', name: 'spend' });
  const restedShort = applyCharacterAction(hero, catalog, { type: 'rest', name: 'short' });
  assert.equal(restedShort.profile.vitals.hp, hero.profile.vitals.hp);
  assert.ok(restedShort.profile.tracker.resources.second_wind_uses >= hero.profile.tracker.resources.second_wind_uses);
  assert.ok(restedShort.profile.edras.lifeEnergy >= hero.profile.edras.lifeEnergy);
  const restedLong = applyCharacterAction(restedShort, catalog, { type: 'rest', name: 'long' });
  assert.equal(restedLong.profile.vitals.hp, getCharacterCounters(hero, catalog).vitals.maxHp);
  assert.equal(restedLong.profile.edras.stress, 0);
  assert.throws(() => applyCharacterAction(hero, catalog, { type: 'edras', name: 'spend' }), /eine LE-Technik pro Kampfrunde/);
});

test('B04: unbekannte Aktionen und manipulative Werte bleiben gesperrt', () => {
  const hero = fixture();
  for (const action of [null, { type: 'script' }, { type: 'resource', group: 'resources', id: 'second_wind_uses', delta: -2 },
    { type: 'vitals', name: 'heal', amount: -10 }, { type: 'rest', name: 'invalid' },
    { type: 'edras', name: 'revealSecret' }]) {
    assert.throws(() => applyCharacterAction(hero, catalog, action));
  }
});
