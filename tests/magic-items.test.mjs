import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeMagicItems, changeMagicItems } from '../js/rules/magic-items.mjs';
import { applyCharacterAction } from '../js/rules/character-actions.mjs';
import { emptyGame, validateGameImport } from '../js/rules/characters.mjs';
import { commitCloudAction, prepareCloudCharacter } from '../js/rules/cloud-characters.mjs';

const data = id => JSON.parse(readFileSync(new URL(`../data/srd-5.2.1/en/5e-SRD-${id}.json`, import.meta.url), 'utf8'));
const magicItems = data('Magic-Items');
const catalog = Object.fromEntries(Object.entries({ classes: 'Classes', levels: 'Levels',
  equipment: 'Equipment', species: 'Species', backgrounds: 'Backgrounds',
  subspecies: 'Subspecies', traits: 'Traits', feats: 'Feats', skills: 'Skills',
  languages: 'Languages', proficiencies: 'Proficiencies' })
  .map(([key, file]) => [key, data(file)]));
catalog.magicItems = magicItems;
const hero = () => ({ id: 'hero1', name: 'Alin', level: 5, className: 'Fighter', race: 'Dwarf',
  profile: { ruleset: 'srd-5.2.1', classId: 'fighter', speciesId: 'dwarf', backgroundId: 'acolyte',
    attributes: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    originChoices: { languages: ['elvish', 'dwarvish'] } } });

test('262 Original-SRD-Gegenstände ohne zweite Gegenstandsdatenbank', () => {
  assert.equal(magicItems.length, 262);
  assert.equal(magicItems.find(item => item.index === 'ring-of-protection').attunement, true);
  assert.equal(magicItems.find(item => item.index === 'bag-of-holding').attunement, false);
  assert.deepEqual(normalizeMagicItems(magicItems), []);
});

test('Mehrere Exemplare desselben Gegenstands behalten unterschiedliche Instanz-IDs', () => {
  const one = changeMagicItems(magicItems, [], { type: 'add', catalogId: 'bag-of-holding' });
  const two = changeMagicItems(magicItems, one, { type: 'add', catalogId: 'bag-of-holding' });
  assert.deepEqual(two.map(entry => entry.instanceId), ['mi1', 'mi2']);
  assert.equal(one.length, 1);
  assert.equal(changeMagicItems(magicItems, two, { type: 'remove', instanceId: 'mi1' })[0].instanceId, 'mi2');
  assert.throws(() => changeMagicItems(magicItems, two, { type: 'add', catalogId: 'imaginary' }), /unbekannt/);
  assert.throws(() => changeMagicItems(magicItems, two, { type: 'remove', instanceId: 'missing' }), /existiert nicht/);
});

test('Einstimmung höchstens 3, nie am falschen Gegenstand oder an zwei identischen Exemplaren', () => {
  let items = [];
  for (const id of ['ring-of-protection', 'cloak-of-protection', 'boots-of-speed', 'bracers-of-defense']) {
    items = changeMagicItems(magicItems, items, { type: 'add', catalogId: id });
  }
  for (const instanceId of ['mi1', 'mi2', 'mi3']) {
    items = changeMagicItems(magicItems, items, { type: 'attune', instanceId, active: true });
  }
  assert.throws(() => changeMagicItems(magicItems, items, { type: 'attune', instanceId: 'mi4', active: true }), /Maximal drei/);
  items = changeMagicItems(magicItems, items, { type: 'attune', instanceId: 'mi2', active: false });
  items = changeMagicItems(magicItems, items, { type: 'attune', instanceId: 'mi4', active: true });
  assert.equal(items.filter(entry => entry.attuned).length, 3);
  const dup = changeMagicItems(magicItems, items, { type: 'add', catalogId: 'ring-of-protection' });
  assert.throws(() => changeMagicItems(magicItems, dup, { type: 'attune', instanceId: 'mi5', active: true }), /Maximal drei/);
  const solo = changeMagicItems(magicItems, [], { type: 'add', catalogId: 'ring-of-protection' });
  const paired = changeMagicItems(magicItems, solo, { type: 'add', catalogId: 'ring-of-protection' });
  const attuned = changeMagicItems(magicItems, paired, { type: 'attune', instanceId: 'mi1', active: true });
  assert.throws(() => changeMagicItems(magicItems, attuned, { type: 'attune', instanceId: 'mi2', active: true }), /zwei Exemplare/);
  const mundane = changeMagicItems(magicItems, [], { type: 'add', catalogId: 'bag-of-holding' });
  assert.throws(() => changeMagicItems(magicItems, mundane, { type: 'attune', instanceId: 'mi1', active: true }), /nicht eingestimmt/);
});

test('Ladungen atomar, niemals negativ oder über dem manuellen Maximum', () => {
  let items = changeMagicItems(magicItems, [], { type: 'add', catalogId: 'wand-of-magic-missiles' });
  assert.equal(items[0].maxCharges, null, 'Freitext-Ladungen werden nicht fälschlich maschineninterpretiert');
  assert.throws(() => changeMagicItems(magicItems, items, { type: 'charge', instanceId: 'mi1', delta: -1 }), /Ladungen/);
  items = changeMagicItems(magicItems, items, { type: 'capacity', instanceId: 'mi1', max: 7 });
  for (let n = 0; n < 7; n++) items = changeMagicItems(magicItems, items, { type: 'charge', instanceId: 'mi1', delta: -1 });
  assert.equal(items[0].charges, 0);
  assert.throws(() => changeMagicItems(magicItems, items, { type: 'charge', instanceId: 'mi1', delta: -1 }), /Ladungen/);
  items = changeMagicItems(magicItems, items, { type: 'charge', instanceId: 'mi1', delta: 1 });
  assert.equal(items[0].charges, 1);
  assert.throws(() => changeMagicItems(magicItems, items, { type: 'charge', instanceId: 'mi1', delta: 999 }), /Ladungen/);
  assert.throws(() => changeMagicItems(magicItems, items, { type: 'capacity', instanceId: 'mi1', max: -1 }), /Ladungskapazität/);
  assert.equal(changeMagicItems(magicItems, items, { type: 'capacity', instanceId: 'mi1', max: 0 })[0].charges, null);
});

test('Import beschädigter Instanzen bleibt begrenzt und verliert keine gültigen Duplikate', () => {
  const untrusted = [
    { instanceId: 'mi1', catalogId: 'ring-of-protection', attuned: true, maxCharges: 7, charges: 900 },
    { instanceId: 'mi2', catalogId: 'ring-of-protection', attuned: true },
    { instanceId: 'mi2', catalogId: 'bag-of-holding' },
    { instanceId: '__proto__', catalogId: 'bag-of-holding' },
    { instanceId: 'mi3', catalogId: 'not-srd' },
  ];
  const safe = normalizeMagicItems(magicItems, untrusted);
  assert.equal(safe.length, 2);
  assert.equal(safe[0].charges, 7);
  assert.equal(safe[1].attuned, false);
});

test('Cloud-Transaktion kann magische Ladung und Aktionsmarker auf dem einen Profil ändern', () => {
  const added = applyCharacterAction(hero(), catalog, { type: 'magicItem', operation: { type: 'add', catalogId: 'wand-of-magic-missiles' } });
  const prepared = applyCharacterAction(added, catalog, { type: 'magicItem', operation: { type: 'capacity', instanceId: 'mi1', max: 7 } });
  const used = applyCharacterAction(prepared, catalog, { type: 'magicItem', operation: { type: 'charge', instanceId: 'mi1', delta: -1 } });
  assert.equal(used.profile.magicItems[0].charges, 6);
  assert.equal(prepared.profile.magicItems[0].charges, 7);
  const turn = applyCharacterAction(used, catalog, { type: 'turn', key: 'reaction', used: true });
  assert.equal(turn.profile.combatTurn.reaction, true);
  assert.equal(applyCharacterAction(turn, catalog, { type: 'turn', key: 'reset' }).profile.combatTurn.reaction, false);
  const damaged = applyCharacterAction(turn, catalog, { type: 'typedDamage', amount: 11, damageType: 'fire', immune: true });
  assert.equal(damaged.profile.vitals.hp, applyCharacterAction(turn, catalog, { type: 'typedDamage', amount: 0, damageType: 'fire' }).profile.vitals.hp);
  assert.throws(() => applyCharacterAction(turn, catalog, { type: 'magicItem', operation: { type: 'charge', instanceId: 'mi1', delta: -100 } }), /Ladungen/);
});

test('Magische Instanzen und Aktionsmerker überleben Import/Cloud-Roundtrip', () => {
  let figure = applyCharacterAction(hero(), catalog, { type: 'magicItem', operation: { type: 'add', catalogId: 'ring-of-protection' } });
  figure = applyCharacterAction(figure, catalog, { type: 'magicItem', operation: { type: 'attune', instanceId: 'mi1', active: true } });
  figure = applyCharacterAction(figure, catalog, { type: 'turn', key: 'bonus', used: true });
  const game = { ...emptyGame(), characters: [figure] };
  assert.doesNotThrow(() => validateGameImport(game));
  const exported = JSON.parse(JSON.stringify(game));
  assert.deepEqual(exported.characters[0].profile.magicItems, figure.profile.magicItems);
  assert.deepEqual(prepareCloudCharacter(figure).profile.combatTurn, figure.profile.combatTurn);
});

test('Transaktion: eine Ladung wird genau einmal verbraucht, gleiche Aktions-ID bleibt idempotent', async () => {
  let figure = applyCharacterAction(hero(), catalog, { type: 'magicItem', operation: { type: 'add', catalogId: 'wand-of-magic-missiles' } });
  figure = applyCharacterAction(figure, catalog, { type: 'magicItem', operation: { type: 'capacity', instanceId: 'mi1', max: 1 } });
  let record = { schemaVersion: 1, recentActionIds: [], character: figure };
  const transaction = {
    async get() { return { exists: () => true, data: () => structuredClone(record) }; },
    update(_reference, update) { record = { ...record, ...update }; },
  };
  const action = { type: 'magicItem', operation: { type: 'charge', instanceId: 'mi1', delta: -1 } };
  const request = { transaction, reference: {}, action, catalog, serverTimestamp: () => 1, operationId: 'charge001' };
  const first = await commitCloudAction(transaction, request.reference, request);
  assert.equal(first.duplicate, false);
  assert.equal(record.character.profile.magicItems[0].charges, 0);
  assert.equal((await commitCloudAction(transaction, request.reference, request)).duplicate, true);
  await assert.rejects(() => commitCloudAction(transaction, request.reference,
    { ...request, operationId: 'charge002' }), /Ladungen/);
  assert.equal(record.character.profile.magicItems[0].charges, 0);
});

test('Studio besitzt nur bestehende Profil-, Speicher- und SRD-Pfade', () => {
  const ui = readFileSync(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  assert.match(ui, /function renderMagicItems\(profile, parent, wasOpen, selectedId, expandedIds\)/);
  assert.match(ui, /loadCategory\('magicItems'\)/);
  assert.match(ui, /character\.profile\.magicItems = changeMagicItems/);
  assert.match(ui, /source\.desc\.join/);
});
