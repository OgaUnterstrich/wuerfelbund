import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyGame, SAVE_KEY, IMPORT_BACKUP_KEY, readGame, validateGameImport,
  saveImportedGame, restoreImportedGame, resetSavedGame } from '../js/rules/characters.mjs';

const makeStorage = (initial = {}) => ({
  data: new Map(Object.entries(initial)),
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; },
  setItem(key, value) { this.data.set(key, value); },
  removeItem(key) { this.data.delete(key); },
});

const character = (id, name = id) => ({ id, name, level: 12, className: 'Fighter', race: 'Human',
  profile: { ruleset: 'srd-5.2.1', classId: 'fighter', levelChoices: [{ level: 4, kind: 'asi' }],
    hitPoints: { method: 'rolled', rolls: [6, 9, 5, 10, 4, 8, 7, 6, 3, 5, 10] },
    vitals: { hp: 44, tempHp: 7, hitDiceSpent: 2 }, tracker: { slots: { 1: 2 } },
    inventory: { items: [{ id: 'longsword', quantity: 1 }] },
    edras: { potential: 3, lifeEnergy: 12, stress: 1 } } });

test('gültiger Spielstand bewahrt komplette 5.5e-, Inventar- und Edras-Profile exakt', () => {
  const next = { ...emptyGame(), campaign: 'Spieltest', characters: [character('held')],
    notes: [{ id: 'n', title: 'Prolog', body: 'Text', created: '2026-10-26T00:00:00Z' }] };
  const storage = makeStorage();
  saveImportedGame(next, storage);
  assert.deepEqual(readGame(storage), next);
  assert.deepEqual(JSON.parse(storage.getItem(IMPORT_BACKUP_KEY)), emptyGame());
  const old = restoreImportedGame(storage);
  assert.deepEqual(old, emptyGame());
  assert.deepEqual(readGame(storage), old);
  assert.equal(storage.getItem(IMPORT_BACKUP_KEY), null);
  assert.throws(() => restoreImportedGame(storage), /Keine Import-Sicherung/);
});

test('Import behält genau den letzten vorangegangenen Spielstand zum Wiederherstellen', () => {
  const first = { ...emptyGame(), characters: [character('a')] };
  const second = { ...emptyGame(), characters: [character('b')] };
  const third = { ...emptyGame(), characters: [character('c')] };
  const storage = makeStorage({ [SAVE_KEY]: JSON.stringify(first) });
  saveImportedGame(second, storage);
  assert.deepEqual(JSON.parse(storage.getItem(IMPORT_BACKUP_KEY)), first);
  saveImportedGame(third, storage);
  assert.deepEqual(JSON.parse(storage.getItem(IMPORT_BACKUP_KEY)), second);
  assert.deepEqual(restoreImportedGame(storage), second);
});

test('beschädigte, doppelte und zu große Daten werden ohne Speicheränderung abgewiesen', () => {
  const valid = { ...emptyGame(), characters: [character('a')] };
  const storage = makeStorage({ [SAVE_KEY]: JSON.stringify(valid) });
  const invalid = [
    { ...valid, version: 2 },
    { ...valid, characters: [...valid.characters, character('a')] },
    { ...valid, characters: [{ ...character('b'), level: 21 }] },
    { ...valid, characters: [{ ...character('b'), profile: [] }] },
    { ...valid, characters: [{ ...character('b'), profile: { ruleset: 'srd-5.2.1' } }] },
    { ...valid, notes: [{ id: 'n', title: 'Text' }, { id: 'n', title: 'Duplikat' }] },
    { ...valid, rolls: Array.from({ length: 31 }, () => ({ values: [] })) },
    { ...valid, encounter: { actors: [{ id: 'x' }] } },
    { ...valid, characters: Array.from({ length: 201 }, (_, i) => character(String(i))) },
  ];
  for (const payload of invalid) assert.throws(() => saveImportedGame(payload, storage));
  assert.equal(storage.getItem(SAVE_KEY), JSON.stringify(valid));
  assert.equal(storage.getItem(IMPORT_BACKUP_KEY), null);
});

test('Speicherfehler beim Backup lassen den aktiven Spielstand unangetastet', () => {
  const initial = { ...emptyGame(), characters: [character('original')] };
  const data = new Map([[SAVE_KEY, JSON.stringify(initial)]]);
  const storage = { getItem: key => data.get(key) ?? null,
    setItem(key, value) { if (key === IMPORT_BACKUP_KEY) throw new Error('QuotaExceeded'); data.set(key, value); } };
  assert.throws(() => saveImportedGame(emptyGame(), storage), /QuotaExceeded/);
  assert.equal(data.get(SAVE_KEY), JSON.stringify(initial));
});

test('fehlgeschlagener Hauptimport bewahrt aktuelle Daten und eine frühere Rücksicherung', () => {
  const current = JSON.stringify({ ...emptyGame(), characters: [character('aktuell')] });
  const olderBackup = JSON.stringify({ ...emptyGame(), characters: [character('frueher')] });
  const data = new Map([[SAVE_KEY, current], [IMPORT_BACKUP_KEY, olderBackup]]);
  const storage = { getItem: key => data.get(key) ?? null,
    setItem(key, value) { if (key === SAVE_KEY) throw new Error('Speicher voll'); data.set(key, value); },
    removeItem(key) { data.delete(key); } };
  assert.throws(() => saveImportedGame(emptyGame(), storage), /Speicher voll/);
  assert.equal(data.get(SAVE_KEY), current);
  assert.equal(data.get(IMPORT_BACKUP_KEY), olderBackup);
});

test('beschädigte letzte Sicherung überschreibt keinen bestehenden Spielstand', () => {
  const current = { ...emptyGame(), characters: [character('c')] };
  const storage = makeStorage({ [SAVE_KEY]: JSON.stringify(current), [IMPORT_BACKUP_KEY]: '{kaputt' });
  assert.throws(() => restoreImportedGame(storage), /beschädigt/);
  assert.deepEqual(readGame(storage), current);
});

test('explizites Zurücksetzen entfernt Import- und alte Profilkopien, aber keine Regelpakete', () => {
  const storage = makeStorage({
    [SAVE_KEY]: JSON.stringify({ ...emptyGame(), characters: [character('a')] }),
    [IMPORT_BACKUP_KEY]: JSON.stringify(emptyGame()),
    'wuerfelbund-ruleprofiles-v1': '{"a":{}}',
    'wuerfelbund-rulepacks-v1': '[{"id":"pack.test"}]',
  });
  resetSavedGame(storage);
  assert.deepEqual(readGame(storage), emptyGame());
  assert.equal(storage.getItem(IMPORT_BACKUP_KEY), null);
  assert.equal(storage.getItem('wuerfelbund-ruleprofiles-v1'), null);
  assert.ok(storage.getItem('wuerfelbund-rulepacks-v1'));
});

test('gültiges bereits gespeichertes Format wird weiterhin akzeptiert', () => {
  assert.equal(validateGameImport(emptyGame()).version, 1);
  assert.equal(validateGameImport({ version: 1, characters: [], notes: [] }).version, 1);
  const complete = { ...emptyGame(), rolls: [{ id: 'r', sides: 20, count: 2,
    mod: 1, values: [2, 17], total: 20, created: '2026-10-26' }],
    encounter: { actors: [{ id: 'gegner', name: 'Wache', initiative: 12 }], turn: 0, round: 3 } };
  assert.deepEqual(validateGameImport(complete), complete);
  assert.throws(() => validateGameImport({ ...complete, rolls: [{ ...complete.rolls[0], values: [22, 1] }] }), /Würfelhistorie/);
  assert.throws(() => validateGameImport({ ...complete, encounter: { ...complete.encounter, round: -1 } }), /Kampfinitiative/);
});
