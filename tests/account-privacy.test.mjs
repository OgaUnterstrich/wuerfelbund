import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateHandover, assertErasurePossible, ownCharacterRecords, accountArchive } from '../js/rules/account-privacy.mjs';

test('B16: Besitzübergabe nur an aktives Mitglied mit verifizierter SL', () => {
  const valid = { actorId: 'alice', ownerId: 'alice', successorId: 'bob', successorRole: 'player',
    successorBlocked: false, emailVerified: true };
  assert.equal(validateHandover(valid), 'bob');
  for (const bad of [
    { actorId: 'mallory' }, { successorId: 'alice' }, { successorRole: 'owner' },
    { successorBlocked: true }, { emailVerified: false }, { successorId: '' },
  ]) assert.throws(() => validateHandover({ ...valid, ...bad }));
});

test('B16: Kontolöschung bei SL-Besitz und unzugänglichen Cloud-Daten gesperrt', () => {
  assert.equal(assertErasurePossible([{ name: 'Spiel', owner: false, accessible: true }]), true);
  assert.throws(() => assertErasurePossible([{ name: 'Spiel', owner: true, accessible: true }]), /Übergib/);
  assert.throws(() => assertErasurePossible([{ name: 'Alt', owner: false, accessible: false }]), /Betreiber/);
});

test('B16: Auskunft enthält keine fremden Figuren und kein Passwort', () => {
  const characters = [{ ownerId: 'alice', character: { name: 'A' } }, { ownerId: 'bob', character: { name: 'B' } }];
  assert.equal(ownCharacterRecords(characters, 'alice').length, 1);
  const archive = accountArchive({ uid: 'alice', email: 'alice@example.org', emailVerified: true,
    exportedAt: '2026-10-28T00:00:00.000Z', campaigns: [
      { id: 'c1', name: 'Runde', description: '', owner: true, characters, dmPrivate: [{ note: 'Privat' }] },
      { id: 'c2', name: 'Mitglied', description: '', owner: false, characters, dmPrivate: [{ note: 'Nicht zugänglich' }] },
    ], personalPacks: [] });
  assert.equal(archive.campaigns[0].ownCharacters.length, 1);
  assert.equal(archive.campaigns[1].ownCharacters.length, 1);
  assert.equal(archive.campaigns[1].dmPrivate, undefined);
  assert.equal(JSON.stringify(archive).includes('Nicht zugänglich'), false);
  assert.equal(JSON.stringify(archive).includes('"name":"B"'), false);
});
