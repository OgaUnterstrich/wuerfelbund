import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyGame, validateGameImport, saveImportedGame, restoreImportedGame } from '../js/rules/characters.mjs';
import { prepareCloudCharacter, mergeCloudCharacter } from '../js/rules/cloud-characters.mjs';

const hero = () => ({
  id: 'hero-8', name: 'Lyra', className: 'Wizard', race: 'Elf', level: 8,
  profile: {
    ruleset: 'srd-5.2.1', rulesetVersion: '5.2.1', classId: 'wizard',
    spellChoices: { known: ['magic-missile', 'shield'], prepared: ['shield'] },
    inventory: { items: [{ id: 'staff', quantity: 1, charges: 3 }] },
    vitals: { hp: 34, tempHp: 6 },
    edras: { lifeEnergy: 8, potential: 2, techniqueId: 'resonance' },
  },
});

function memoryStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('5.5e-Profil Stufe 8, Zauber, Ausrüstung und Edras bleiben vollständig erhalten', () => {
  const local = hero();
  const result = prepareCloudCharacter(local);
  assert.deepEqual(result, local);
  assert.notStrictEqual(result.profile, local.profile);
  const game = mergeCloudCharacter(emptyGame(), { schemaVersion: 1, ownerId: 'bob', character: result });
  assert.deepEqual(game.characters, [local]);
  assert.deepEqual(emptyGame().characters, []);
  assert.doesNotThrow(() => validateGameImport(game));
});

test('Cloud-Kopie kollidiert nicht unbemerkt mit einem bestehenden lokalen Entwurf', () => {
  const old = hero();
  const game = { ...emptyGame(), characters: [{ ...old, name: 'Lokale Änderung' }] };
  const remote = { schemaVersion: 1, ownerId: 'bob', character: old };
  assert.throws(() => mergeCloudCharacter(game, remote), /existiert bereits/);
  assert.equal(game.characters[0].name, 'Lokale Änderung');
  const merged = mergeCloudCharacter(game, remote, { replace: true });
  assert.equal(merged.characters[0].name, 'Lyra');
  assert.equal(game.characters[0].name, 'Lokale Änderung');
});

test('Ersetzen der lokalen Figur erzeugt eine wiederherstellbare Einmal-Sicherung', () => {
  const local = { ...emptyGame(), characters: [{ ...hero(), name: 'Vorher' }] };
  const store = memoryStore({ 'wuerfelbund-save-v1': JSON.stringify(local) });
  const merged = mergeCloudCharacter(local, { schemaVersion: 1, ownerId: 'bob', character: hero() }, { replace: true });
  saveImportedGame(merged, store);
  assert.equal(JSON.parse(store.getItem('wuerfelbund-save-v1')).characters[0].name, 'Lyra');
  assert.equal(restoreImportedGame(store).characters[0].name, 'Vorher');
  assert.equal(store.getItem('wuerfelbund-import-backup-v1'), null);
});

test('Ungültige IDs, Ebenen, Regelprofile und fremde Felder werden sicher abgewiesen', () => {
  assert.throws(() => prepareCloudCharacter({ ...hero(), id: 'a/b' }), /nicht für die Cloud/);
  assert.throws(() => prepareCloudCharacter({ ...hero(), level: 21 }), /außerhalb/);
  assert.throws(() => prepareCloudCharacter({ ...hero(), profile: { ruleset: 'srd-5.2.1' } }), /beschädigt/);
  assert.throws(() => mergeCloudCharacter(emptyGame(), { schemaVersion: 2, ownerId: 'bob', character: hero() }), /Unbekannte/);
  assert.throws(() => prepareCloudCharacter({ ...hero(), profile: { ...hero().profile, invalid: undefined } }), /nicht speicherbare/);
  assert.throws(() => prepareCloudCharacter({ ...hero(), profile: { ...hero().profile, invalid: Infinity } }), /nicht speicherbare/);
  assert.throws(() => prepareCloudCharacter({ ...hero(), profile: { ...hero().profile, __secret__: 'secret' } }), /nicht unterstützte/);
});

test('Große Profile und volle lokale Charakterlisten werden abgefangen', () => {
  assert.throws(() => prepareCloudCharacter({ ...hero(), profile: { ...hero().profile, text: 'a'.repeat(710_000) } }), /zu groß/);
  const full = { ...emptyGame(), characters: Array.from({ length: 200 }, (_, i) => ({ ...hero(), id: `person${i}` })) };
  assert.throws(() => mergeCloudCharacter(full, { schemaVersion: 1, ownerId: 'bob', character: hero() }), /voll/);
});
