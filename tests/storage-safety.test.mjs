import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyGame, SAVE_KEY, IMPORT_BACKUP_KEY, inspectGameStorage,
  readGame, saveGame, saveImportedGame, restoreImportedGame, upsertCharacter } from '../js/rules/characters.mjs';

function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

const levelEight = () => ({ id: 'paladin-8', name: 'Arven', level: 8,
  className: 'Paladin', race: 'Human', profile: { ruleset: 'srd-5.2.1', classId: 'paladin',
    attributes: { str: 18, dex: 10, con: 16, int: 8, wis: 12, cha: 16 },
    tracker: { slots: { 1: 2, 2: 1 }, features: { layOnHands: 11 } },
    vitals: { hp: 54, tempHp: 5, hitDiceSpent: 3 },
    inventory: { items: [{ id: 'longsword', quantity: 1 }], coins: { gp: 25 } },
    edras: { lifeEnergy: 13, stress: 2, potential: 3 } } });

test('Stufe-8-Figur samt 5.5e, Inventar und optionalem Edras: Neuanlage, Bearbeitung, Reload', () => {
  const store = memory();
  assert.equal(inspectGameStorage(store).status, 'empty');
  const created = upsertCharacter(emptyGame(), levelEight());
  saveGame(created, store);
  assert.equal(inspectGameStorage(store).status, 'ready');
  const loaded = readGame(store);
  assert.deepEqual(loaded, created);
  const edited = { ...loaded.characters[0], name: 'Arven II', profile: {
    ...loaded.characters[0].profile, vitals: { hp: 47, tempHp: 0, hitDiceSpent: 4 } } };
  saveGame(upsertCharacter(loaded, edited, edited.id), store);
  assert.equal(readGame(store).characters.length, 1);
  assert.equal(readGame(store).characters[0].profile.vitals.hp, 47);
  assert.equal(readGame(store).characters[0].profile.edras.lifeEnergy, 13);
});

test('Export, Import und einmalige Wiederherstellung sind verlustfrei', () => {
  const store = memory();
  const first = { ...emptyGame(), characters: [levelEight()], campaign: 'Alte Geschichte' };
  saveGame(first, store);
  const exported = JSON.parse(JSON.stringify(readGame(store)));
  const second = { ...emptyGame(), characters: [{ ...levelEight(), id: 'new', name: 'Neuer Held' }] };
  saveImportedGame(second, store);
  assert.deepEqual(readGame(store), second);
  assert.deepEqual(restoreImportedGame(store), exported);
  assert.deepEqual(readGame(store), exported);
  assert.equal(store.getItem(IMPORT_BACKUP_KEY), null);
});

test('Beschädigte JSON-Rohdaten sind erkennbar und gegen alle normalen Schreibwege geschützt', () => {
  for (const raw of ['{abgeschnitten', 'null', '[]', JSON.stringify({ version: 99, characters: [], notes: [] }),
    JSON.stringify({ version: 1, notes: [] })]) {
    const store = memory({ [SAVE_KEY]: raw });
    assert.equal(inspectGameStorage(store).status, 'invalid');
    assert.throws(() => saveGame(emptyGame(), store), /beschädigt oder unbekannt/);
    assert.equal(store.getItem(SAVE_KEY), raw);
  }
});

test('Gesperrter Speicherzugriff und volles Kontingent sind sichtbare Fehler, kein erfolgreicher Save', () => {
  const unavailable = { getItem() { throw new Error('SecurityError'); } };
  assert.equal(inspectGameStorage(unavailable).status, 'blocked');
  assert.throws(() => saveGame(emptyGame(), unavailable), /nicht erreichbar/);
  const before = JSON.stringify({ ...emptyGame(), campaign: 'Nicht verlieren' });
  const full = memory({ [SAVE_KEY]: before });
  full.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => saveGame({ ...emptyGame(), campaign: 'Neu' }, full), /nicht gespeichert/);
  assert.equal(full.getItem(SAVE_KEY), before);
});

test('Import beschädigter Alt-Rohdaten sichert unverändertes Original und erlaubt keinen unsicheren Restore', () => {
  const raw = '{beschaedigt';
  const store = memory({ [SAVE_KEY]: raw });
  saveImportedGame({ ...emptyGame(), characters: [levelEight()] }, store);
  assert.equal(store.getItem(IMPORT_BACKUP_KEY), raw);
  assert.equal(readGame(store).characters[0].name, 'Arven');
  assert.throws(() => restoreImportedGame(store), /beschädigt/);
  assert.equal(readGame(store).characters[0].name, 'Arven');
});

test('Ungültige nächste Spielstände dürfen den vorhandenen Spielstand nicht überschreiben', () => {
  const original = { ...emptyGame(), characters: [levelEight()] };
  const store = memory({ [SAVE_KEY]: JSON.stringify(original) });
  assert.throws(() => saveGame({ ...emptyGame(), characters: [levelEight(), levelEight()] }, store), /doppelt/);
  assert.deepEqual(readGame(store), original);
});

test('Alte Regelprofil-Migration darf beschädigte Originaldaten ebenfalls nicht überschreiben', () => {
  const legacy = JSON.stringify({ version: 1, characters: [{ id: 'old', name: 'Alt', level: 8 }] });
  const store = memory({ [SAVE_KEY]: legacy,
    'wuerfelbund-ruleprofiles-v1': JSON.stringify({ old: { ruleset: 'srd-5.2.1', classId: 'fighter' } }) });
  assert.equal(readGame(store).characters[0].profile.classId, 'fighter');
  assert.equal(store.getItem(SAVE_KEY), legacy, 'Original muss unverändert bleiben');
  assert.equal(inspectGameStorage(store).status, 'invalid');
});
