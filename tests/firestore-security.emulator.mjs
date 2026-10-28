/** Nur mit `npm run test:firestore`: Firebase-Emulator, niemals Live-Firestore. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, before, beforeEach, after } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch, Timestamp, runTransaction, onSnapshot } from 'firebase/firestore';
import { prepareCloudCharacter, mergeCloudCharacter, commitCloudAction } from '../js/rules/cloud-characters.mjs';
import { applyCharacterAction } from '../js/rules/character-actions.mjs';
import { emptyGame } from '../js/rules/characters.mjs';
import { defaultCampaignRules, preparePublishedPack } from '../js/rules/sources.mjs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
let env;
const db = userId => userId ? env.authenticatedContext(userId).firestore()
  : env.unauthenticatedContext().firestore();
const campaignRef = (database, campaignId = 'abc12345678901234567') => doc(database, 'campaigns', campaignId);
const memberRef = (database, id = 'alice', cid = 'abc12345678901234567') =>
  doc(database, 'campaigns', cid, 'members', id);
const indexRef = (database, id = 'alice', cid = 'abc12345678901234567') =>
  doc(database, 'users', id, 'campaigns', cid);
const characterRef = (database, id = 'hero1', cid = 'abc12345678901234567') =>
  doc(database, 'campaigns', cid, 'characters', id);
const privateRef = database => doc(database, 'campaigns', 'abc12345678901234567', 'dmPrivate', 'secret');
const blockedRef = (database, userId = 'bob') => doc(database, 'campaigns', 'abc12345678901234567', 'blockedUsers', userId);
const packRef = (database, id = 'alice') => doc(database, 'users', id, 'rulePacks', 'pack.demo1');

async function createCampaign(owner = 'alice', cid = 'abc12345678901234567') {
  const database = db(owner);
  const batch = writeBatch(database);
  batch.set(campaignRef(database, cid), {
    ownerId: owner, name: 'Testrunde', description: '', createdAt: serverTimestamp(),
  });
  batch.set(indexRef(database, owner, cid), {
    campaignId: cid, role: 'owner', addedAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
}

async function joinCampaign(player = 'bob', cid = 'abc12345678901234567') {
  const database = db(player);
  const batch = writeBatch(database);
  batch.set(memberRef(database, player, cid), { role: 'player', joinedAt: serverTimestamp() });
  batch.set(indexRef(database, player, cid), {
    campaignId: cid, role: 'player', addedAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
}

async function seed({ owner = 'alice', members = ['bob'], cid = 'abc12345678901234567', edras = true } = {}) {
  await createCampaign(owner, cid);
  // B03/B04-Figuren enthalten Edras: explizite Freigabe statt impliziter Altwelt.
  if (edras) await assertSucceeds(updateDoc(campaignRef(db(owner), cid), {
    rules: { ...defaultCampaignRules(), worlds: ['edras-v1'] },
  }));
  for (const member of members) await joinCampaign(member, cid);
}

function character(id = 'hero1') {
  return { schemaVersion: 1, ownerId: 'bob', createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(), character: { id, name: 'Arven', level: 8,
      profile: { ruleset: 'srd-5.2.1', classId: 'paladin', vitals: { hp: 48 },
        inventory: { items: [{ id: 'longsword', quantity: 1 }] },
        edras: { lifeEnergy: 8, potential: 2 } } } };
}

const b04Files = { classes: 'Classes', levels: 'Levels', equipment: 'Equipment',
  species: 'Species', backgrounds: 'Backgrounds', subspecies: 'Subspecies',
  traits: 'Traits', feats: 'Feats', skills: 'Skills', languages: 'Languages',
  proficiencies: 'Proficiencies' };
const b04Catalog = Object.fromEntries(Object.entries(b04Files).map(([key, file]) => [key,
  JSON.parse(readFileSync(new URL(`../data/srd-5.2.1/en/5e-SRD-${file}.json`, import.meta.url), 'utf8'))]));
const publishedPackRef = (database, id = 'pack.testauthorb05') =>
  doc(database, 'campaigns', 'abc12345678901234567', 'rulePacks', id);
const publishedB05 = (version = 1) => preparePublishedPack({
  schemaVersion: 1, id: 'pack.testauthorb05', name: 'B05-Eigenregel', version,
  source: 'homebrew', abilities: [],
}, 'alice');
function liveCharacter() {
  return { schemaVersion: 1, ownerId: 'bob', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    character: { id: 'hero1', name: 'Balor', className: 'Fighter', race: 'Dwarf', level: 8,
      profile: { ruleset: 'srd-5.2.1', classId: 'fighter', speciesId: 'dwarf', backgroundId: 'acolyte',
        attributes: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
        originChoices: { languages: ['elvish', 'dwarvish'] },
        inventory: { items: { longsword: 1 } }, tracker: { resources: { second_wind_uses: 1 } } } } };
}

test('B16-R1: verifizierte SL übergibt Besitz atomar, bisherige SL bleibt Spieler', async () => {
  await seed({ members: ['bob', 'carol'], edras: false });
  const oldOwner = env.authenticatedContext('alice', { email: 'alice@example.org', email_verified: true }).firestore();
  const batch = writeBatch(oldOwner);
  batch.set(memberRef(oldOwner, 'alice'), { role: 'player', joinedAt: serverTimestamp() });
  batch.set(indexRef(oldOwner, 'alice'), { campaignId: 'abc12345678901234567', role: 'player', addedAt: serverTimestamp() });
  batch.update(campaignRef(oldOwner), { ownerId: 'bob' });
  await assertSucceeds(batch.commit());
  assert.equal((await assertSucceeds(getDoc(campaignRef(db('bob'))))).data().ownerId, 'bob');
  await assertSucceeds(getDoc(campaignRef(db('alice'))));
  await assertSucceeds(updateDoc(campaignRef(db('bob')), { name: 'Neue Spielleitung' }));
  await assertFails(updateDoc(campaignRef(db('alice')), { name: 'Unbefugte SL' }));
  await assertFails(updateDoc(campaignRef(db('carol')), { ownerId: 'carol' }));
  assert.equal((await assertSucceeds(getDoc(indexRef(db('alice'))))).data().role, 'player');
});

test('B16-R1: unbestätigte, unvollständige, gesperrte und fremde Besitzerwechsel verboten', async () => {
  await seed({ members: ['bob'], edras: false });
  const makeTransfer = database => {
    const batch = writeBatch(database);
    batch.set(memberRef(database, 'alice'), { role: 'player', joinedAt: serverTimestamp() });
    batch.set(indexRef(database, 'alice'), { campaignId: 'abc12345678901234567', role: 'player', addedAt: serverTimestamp() });
    batch.update(campaignRef(database), { ownerId: 'bob' });
    return batch.commit();
  };
  await assertFails(makeTransfer(db('alice'))); // kein email_verified-Claim
  const verified = env.authenticatedContext('alice', { email_verified: true }).firestore();
  await assertFails(updateDoc(campaignRef(verified), { ownerId: 'bob' })); // alte SL ohne Mitgliedschaft
  await assertFails(updateDoc(campaignRef(db('bob')), { ownerId: 'bob' }));
  await assertFails(updateDoc(campaignRef(verified), { ownerId: 'mallory' }));
  await assertSucceeds(setDoc(blockedRef(db('alice')), { createdAt: serverTimestamp() }));
  await assertFails(makeTransfer(verified));
  assert.equal((await assertSucceeds(getDoc(campaignRef(db('alice'))))).data().ownerId, 'alice');
});

test('B16-R1: Spieler kann eigene Cloud-Daten entfernen, Fremd- und Kampagnenlöschung bleibt verboten', async () => {
  await seed({ members: ['bob', 'carol'] });
  const player = db('bob');
  await assertSucceeds(setDoc(characterRef(player), liveCharacter()));
  await assertFails(deleteDoc(characterRef(db('carol'))));
  await assertFails(deleteDoc(campaignRef(db('alice'))));
  await assertFails(deleteDoc(campaignRef(player)));
  await assertSucceeds(deleteDoc(characterRef(player)));
  const leave = writeBatch(player);
  leave.delete(memberRef(player, 'bob'));
  leave.delete(indexRef(player, 'bob'));
  await assertSucceeds(leave.commit());
  await assertFails(getDoc(campaignRef(player)));
  await assertSucceeds(getDoc(campaignRef(db('carol'))));
});

test('B16-R1: gesperrter Spieler darf fremde und eigene Cloud-Figuren nicht ungesehen löschen', async () => {
  await seed({ members: ['bob'] });
  await assertSucceeds(setDoc(characterRef(db('bob')), liveCharacter()));
  await assertSucceeds(setDoc(blockedRef(db('alice')), { createdAt: serverTimestamp() }));
  await assertFails(deleteDoc(characterRef(db('bob'))));
  await assertFails(deleteDoc(characterRef(db('mallory'))));
});

test('B16-R1: keine indexlosen Kampagnen oder unerreichbaren Mitgliedschaften anlegbar', async () => {
  const owner = db('alice');
  await assertFails(setDoc(campaignRef(owner), {
    ownerId: 'alice', name: 'Verwaist', description: '', createdAt: serverTimestamp(),
  }));
  await createCampaign();
  await assertFails(setDoc(memberRef(db('bob'), 'bob'), { role: 'player', joinedAt: serverTimestamp() }));
  await joinCampaign('bob');
  assert.equal((await assertSucceeds(getDoc(indexRef(db('bob'), 'bob')))).data().role, 'player');
});

test('B05: Standardkampagne nur SRD; Edras wird erst nach SL-Freigabe speicherbar', async () => {
  await seed({ edras: false });
  const otherCampaign = 'other123456789012345';
  await seed({ cid: otherCampaign, edras: false });
  const player = db('bob'), owner = db('alice');
  const plain = liveCharacter();
  await assertSucceeds(setDoc(characterRef(player), plain));
  await assertFails(updateDoc(characterRef(player), { 'character.profile.edras': { potential: 2 }, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(campaignRef(player), { rules: { ...defaultCampaignRules(), worlds: ['edras-v1'] } }));
  await assertFails(updateDoc(campaignRef(owner), { rules: { base: 'srd-2014', worlds: [], packs: [] } }));
  await assertSucceeds(updateDoc(campaignRef(owner), { rules: { ...defaultCampaignRules(), worlds: ['edras-v1'] } }));
  assert.deepEqual((await assertSucceeds(getDoc(campaignRef(player, otherCampaign)))).data().rules || defaultCampaignRules(), defaultCampaignRules());
  await assertSucceeds(updateDoc(characterRef(player), { 'character.profile.edras': { potential: 2 }, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(campaignRef(owner), { rules: defaultCampaignRules() }));
  const unchanged = (await assertSucceeds(getDoc(characterRef(player)))).data().character.profile.edras;
  assert.deepEqual(unchanged, { potential: 2 });
  await assertSucceeds(updateDoc(characterRef(player), { 'character.name': 'Weiter ohne Edrasänderung', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(characterRef(player), { 'character.profile.edras': { potential: 3 }, updatedAt: serverTimestamp() }));
});

test('B05: Nur SL publiziert Hausregeln, nur aktive Kampagne erhält ihre Umschalter', async () => {
  await seed({ edras: false, members: ['bob', 'carol'] });
  const owner = db('alice'), player = db('bob');
  const reference = publishedPackRef(owner), payload = publishedB05();
  await assertFails(setDoc(publishedPackRef(player), { ...payload, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(reference, { ...payload, license: 'unknown', updatedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(reference, { ...payload, updatedAt: serverTimestamp() }));
  assert.equal((await assertSucceeds(getDocs(collection(owner, 'campaigns', 'abc12345678901234567', 'rulePacks')))).size, 1);
  assert.equal((await assertSucceeds(getDoc(publishedPackRef(player)))).data().version, 1);
  await assertFails(getDocs(collection(player, 'campaigns', 'abc12345678901234567', 'rulePacks')));
  await assertFails(getDoc(publishedPackRef(db('intruder'))));
  await assertSucceeds(updateDoc(campaignRef(owner), {
    rules: { ...defaultCampaignRules(), packs: [payload.id] },
  }));
  assert.deepEqual((await assertSucceeds(getDoc(campaignRef(player)))).data().rules.packs, [payload.id]);
  await assertFails(updateDoc(campaignRef(player), { rules: defaultCampaignRules() }));
  await assertSucceeds(updateDoc(reference, { version: 2, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(reference, { version: 2, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(reference, { publisherId: 'carol', version: 3, updatedAt: serverTimestamp() }));
});

test('B05: Server verweigert neue nicht aktivierte Paket-Quellen, lässt Bestandsreferenz unverändert', async () => {
  await seed({ edras: false });
  const player = db('bob'), owner = db('alice');
  const referenced = liveCharacter();
  referenced.character.profile.sourceRefs = { base: 'srd-5.2.1', worlds: {}, packs: { 'pack.testauthorb05': 1 } };
  await assertFails(setDoc(characterRef(player), referenced));
  await assertSucceeds(setDoc(publishedPackRef(owner), { ...publishedB05(), updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(campaignRef(owner), {
    rules: { ...defaultCampaignRules(), packs: ['pack.testauthorb05'] },
  }));
  await assertSucceeds(setDoc(characterRef(player), referenced));
  await assertSucceeds(updateDoc(campaignRef(owner), { rules: defaultCampaignRules() }));
  await assertSucceeds(updateDoc(characterRef(player), { 'character.name': 'Quellenstand bleibt', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(characterRef(player), {
    'character.profile.sourceRefs.packs': {
      'pack.testauthorb05': 1, 'pack.anotherauthor02': 1,
    }, updatedAt: serverTimestamp(),
  }));
});

test('B04: konkurrierende Spieler-/SL-Transaktionen können letzte Ressource nur einmal verbrauchen', async () => {
  await seed();
  const owner = db('alice'), player = db('bob');
  const ownerRef = characterRef(owner), playerRef = characterRef(player);
  await assertSucceeds(setDoc(playerRef, liveCharacter()));
  const action = { type: 'resource', group: 'resources', id: 'second_wind_uses', delta: -1 };
  const execute = (database, reference, id) => runTransaction(database, transaction =>
    commitCloudAction(transaction, reference, { operationId: id, action, catalog: b04Catalog, serverTimestamp }));
  const results = await Promise.allSettled([
    execute(owner, ownerRef, 'op-alice-b04-0001'), execute(player, playerRef, 'op-bob-b04-00002'),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal((await assertSucceeds(getDoc(playerRef))).data().character.profile.tracker.resources.second_wind_uses, 0);
});

test('B04: dieselbe Aktions-ID ist bei Wiederholung und Client-Retry idempotent', async () => {
  await seed();
  const database = db('bob'), reference = characterRef(database);
  await assertSucceeds(setDoc(reference, liveCharacter()));
  const op = { operationId: 'unique-b04-action-1',
    action: { type: 'resource', group: 'resources', id: 'second_wind_uses', delta: -1 },
    catalog: b04Catalog, serverTimestamp };
  const first = await assertSucceeds(runTransaction(database, tx => commitCloudAction(tx, reference, op)));
  const repeat = await assertSucceeds(runTransaction(database, tx => commitCloudAction(tx, reference, op)));
  assert.equal(first.duplicate, false);
  assert.equal(repeat.duplicate, true);
  const final = (await assertSucceeds(getDoc(reference))).data();
  assert.equal(final.character.profile.tracker.resources.second_wind_uses, 0);
  assert.deepEqual(final.recentActionIds, ['unique-b04-action-1']);
});

test('B04: Live-Listener der Spielleitung empfängt Spieleränderung am selben Dokument', async () => {
  await seed();
  const owner = db('alice'), player = db('bob');
  const ownerRef = characterRef(owner), playerRef = characterRef(player);
  await assertSucceeds(setDoc(playerRef, liveCharacter()));
  const action = { type: 'vitals', name: 'damage', amount: 10 };
  const expectedHp = applyCharacterAction(liveCharacter().character, b04Catalog, action).profile.vitals.hp;
  let unsubscribe = () => {};
  let timer;
  const observed = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Live-Listener hat kein Update empfangen.')), 6000);
    unsubscribe = onSnapshot(ownerRef, { includeMetadataChanges: true }, snapshot => {
      if (snapshot.exists() && snapshot.data().character.profile.vitals?.hp === expectedHp && !snapshot.metadata.fromCache) resolve();
    }, reject);
  });
  try {
    await assertSucceeds(runTransaction(player, tx => commitCloudAction(tx, playerRef, {
      operationId: 'hitpoints-b04-live', action,
      catalog: b04Catalog, serverTimestamp,
    })));
    const actualHp = (await assertSucceeds(getDoc(playerRef))).data().character.profile.vitals.hp;
    assert.equal(actualHp, expectedHp);
    await observed;
  } finally { clearTimeout(timer); unsubscribe(); }
});

test('B04: Aktionsprotokoll auf 24 IDs begrenzt, Fremd- und gesperrte Änderungen verweigert', async () => {
  await seed({ members: ['bob', 'carol'] });
  const player = db('bob');
  await assertSucceeds(setDoc(characterRef(player), liveCharacter()));
  await assertFails(updateDoc(characterRef(db('bob')), { recentActionIds: Array.from({ length: 25 }, (_, i) => `op-${i}`), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(characterRef(db('carol')), { 'character.name': 'Gefälscht', updatedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(blockedRef(db('alice')), { createdAt: serverTimestamp() }));
  await assertFails(runTransaction(player, tx => commitCloudAction(tx, characterRef(player), {
    operationId: 'blocked-b04-action', action: { type: 'inventory', id: 'longsword', delta: -1 },
    catalog: b04Catalog, serverTimestamp,
  })));
});

test('B03: Vollständiger SRD-/Edras-Roundtrip zwischen Spieler und SL, Fremdprofil privat', async () => {
  await seed({ members: ['bob', 'carol'] });
  const local = { id: 'hero-b03', name: 'Lyra', className: 'Wizard', race: 'Elf', level: 8,
    profile: { ruleset: 'srd-5.2.1', classId: 'wizard', spells: ['shield', 'fireball'],
      inventory: { items: [{ id: 'wand', quantity: 1 }] },
      vitals: { hp: 29 }, edras: { lifeEnergy: 12, potential: 3 } } };
  const payload = prepareCloudCharacter(local);
  await assertSucceeds(setDoc(characterRef(db('bob'), local.id), {
    schemaVersion: 1, ownerId: 'bob', character: payload,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  const bobQuery = query(collection(db('bob'), 'campaigns', 'abc12345678901234567', 'characters'), where('ownerId', '==', 'bob'));
  const asPlayer = await assertSucceeds(getDocs(bobQuery));
  assert.equal(asPlayer.size, 1);
  const asDM = await assertSucceeds(getDocs(collection(db('alice'), 'campaigns', 'abc12345678901234567', 'characters')));
  assert.equal(asDM.size, 1);
  const imported = mergeCloudCharacter(emptyGame(), asPlayer.docs[0].data());
  assert.deepEqual(imported.characters[0], local);
  assert.deepEqual(asDM.docs[0].data().character.profile.edras, local.profile.edras);
  await assertFails(getDoc(characterRef(db('carol'), local.id)));
  await assertFails(getDocs(collection(db('carol'), 'campaigns', 'abc12345678901234567', 'characters')));
  assert.equal((await assertSucceeds(getDocs(query(collection(db('carol'), 'campaigns',
    'abc12345678901234567', 'characters'), where('ownerId', '==', 'carol'))))).size, 0);
  await assertFails(updateDoc(characterRef(db('carol'), local.id), {
    'character.name': 'Fremdänderung', updatedAt: serverTimestamp(),
  }));
});

test('B03: Gleiche Charakter-ID in zwei Kampagnen isoliert, nach Entzug kein Upload oder Download', async () => {
  const anotherCampaign = 'other123456789012345';
  await seed();
  await seed({ cid: anotherCampaign });
  await assertSucceeds(setDoc(characterRef(db('bob'), 'hero1'), character()));
  await assertSucceeds(setDoc(characterRef(db('bob'), 'hero1', anotherCampaign), {
    ...character(), character: { ...character().character, name: 'Andere Welt' },
  }));
  assert.equal((await assertSucceeds(getDoc(characterRef(db('bob'), 'hero1')))).data().character.name, 'Arven');
  assert.equal((await assertSucceeds(getDoc(characterRef(db('bob'), 'hero1', anotherCampaign)))).data().character.name, 'Andere Welt');
  await assertSucceeds(deleteDoc(memberRef(db('alice'), 'bob')));
  await assertFails(getDoc(characterRef(db('bob'), 'hero1')));
  await assertFails(updateDoc(characterRef(db('bob'), 'hero1'), { 'character.name': 'Nach Ausschluss', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(characterRef(db('bob'), 'neu'), { ...character('neu'), character: {
    ...character('neu').character, name: 'Erneut hochgeladen',
  } }));
  assert.equal((await assertSucceeds(getDoc(characterRef(db('bob'), 'hero1', anotherCampaign)))).data().character.name, 'Andere Welt');
});

test('B03: Explizites Update schützt durch Transaktion vor veraltetem Cloud-Stand', async () => {
  await seed();
  const bobDb = db('bob'), aliceDb = db('alice');
  const bobRef = characterRef(bobDb), aliceRef = characterRef(aliceDb);
  await assertSucceeds(setDoc(bobRef, character()));
  const before = (await assertSucceeds(getDoc(bobRef))).data();
  await assertSucceeds(runTransaction(bobDb, async transaction => {
    const latest = await transaction.get(bobRef);
    assert.ok(before.updatedAt.isEqual(latest.data().updatedAt));
    transaction.update(bobRef, { character: { ...before.character, name: 'Neue Fassung' }, updatedAt: serverTimestamp() });
  }));
  await assert.rejects(runTransaction(aliceDb, async transaction => {
    const latest = await transaction.get(aliceRef);
    if (!before.updatedAt.isEqual(latest.data().updatedAt)) throw new Error('Cloud-Konflikt');
    transaction.update(aliceRef, { character: { ...before.character, name: 'Veraltete Fassung' }, updatedAt: serverTimestamp() });
  }), /Cloud-Konflikt/);
  assert.equal((await assertSucceeds(getDoc(bobRef))).data().character.name, 'Neue Fassung');
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-wuerfelbund', firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
});
beforeEach(async () => env.clearFirestore());
after(async () => { if (env) await env.cleanup(); });

test('anonym: Kampagnen, Rollen, Figuren, Privatdokumente und Homebrew bleiben gesperrt', async () => {
  await createCampaign();
  const anonymous = db();
  await assertFails(getDoc(campaignRef(anonymous)));
  await assertFails(getDoc(memberRef(anonymous)));
  await assertFails(getDocs(collection(anonymous, 'campaigns')));
  await assertFails(getDoc(characterRef(anonymous)));
  await assertFails(getDoc(privateRef(anonymous)));
  await assertFails(getDoc(packRef(anonymous)));
  await assertFails(setDoc(campaignRef(anonymous, 'other123456789012345'), {
    ownerId: 'alice', name: 'Fake', description: '', createdAt: serverTimestamp(),
  }));
});

test('bestehender Zwei-Dokumente-Batch: Eigentümer erstellt Kampagne, eigener Index kein Rollenbeweis', async () => {
  await createCampaign();
  assert.equal((await assertSucceeds(getDoc(campaignRef(db('alice'))))).data().ownerId, 'alice');
  assert.equal((await assertSucceeds(getDocs(collection(db('alice'), 'users', 'alice', 'campaigns')))).size, 1);
  await assertFails(getDoc(campaignRef(db('mallory'))));
  await assertFails(getDocs(collection(db('mallory'), 'users', 'alice', 'campaigns')));
  await assertFails(getDocs(collection(db('alice'), 'campaigns')));
  await assertFails(setDoc(indexRef(db('mallory'), 'mallory'), {
    campaignId: 'abc12345678901234567', role: 'owner', addedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(indexRef(db('mallory'), 'alice'), {
    campaignId: 'abc12345678901234567', role: 'player', addedAt: serverTimestamp(),
  }));
});

test('Einladungsbeitritt als Batch: eigenes Mitgliedsprofil, Leserolle und Kampagne sind zulässig', async () => {
  await createCampaign();
  await joinCampaign('bob');
  assert.equal((await assertSucceeds(getDoc(memberRef(db('bob'), 'bob')))).data().role, 'player');
  assert.equal((await assertSucceeds(getDoc(campaignRef(db('bob'))))).data().name, 'Testrunde');
  assert.equal((await assertSucceeds(getDoc(indexRef(db('bob'), 'bob')))).data().role, 'player');
  await assertFails(getDoc(memberRef(db('mallory'), 'bob')));
  await assertFails(getDocs(collection(db('bob'), 'campaigns', 'abc12345678901234567', 'members')));
  assert.equal((await assertSucceeds(getDocs(collection(db('alice'), 'campaigns', 'abc12345678901234567', 'members')))).size, 1);
});

test('Rollen- und Zeitstempelfälschung bei Beitritt sind verboten', async () => {
  await createCampaign();
  await assertFails(setDoc(memberRef(db('bob'), 'alice'), { role: 'player', joinedAt: serverTimestamp() }));
  await assertFails(setDoc(memberRef(db('bob'), 'bob'), { role: 'owner', joinedAt: serverTimestamp() }));
  await assertFails(setDoc(memberRef(db('bob'), 'bob'), { role: 'player', joinedAt: Timestamp.fromMillis(0) }));
  await assertFails(setDoc(memberRef(db('bob'), 'bob'), { role: 'player', joinedAt: serverTimestamp(), admin: true }));
  await assertFails(setDoc(indexRef(db('bob'), 'bob'), {
    campaignId: 'abc12345678901234567', role: 'player', addedAt: serverTimestamp(),
  })); // Mitglied existiert noch nicht.
  await assertFails(setDoc(memberRef(db('bob'), 'bob', 'nichtvorhanden123456'), {
    role: 'player', joinedAt: serverTimestamp(),
  }));
});

test('Eigentümer darf nur erlaubte Kampagnenfelder ändern – weder Eigentum noch Schema', async () => {
  await seed();
  await assertSucceeds(updateDoc(campaignRef(db('alice')), { name: 'Anderer Name', description: 'Spiel' }));
  await assertFails(updateDoc(campaignRef(db('bob')), { name: 'Übernommen' }));
  await assertFails(updateDoc(campaignRef(db('alice')), { ownerId: 'bob' }));
  await assertFails(updateDoc(campaignRef(db('alice')), { createdAt: serverTimestamp() }));
  await assertFails(updateDoc(campaignRef(db('alice')), { role: 'gm' }));
  await assertFails(deleteDoc(campaignRef(db('alice'))));
});

test('Mitgliedschaft kann entzogen werden; alter Nutzerindex verleiht danach keinen Zugriff', async () => {
  await seed();
  await assertFails(updateDoc(memberRef(db('bob'), 'bob'), { role: 'owner' }));
  await assertFails(deleteDoc(memberRef(db('mallory'), 'bob')));
  await assertSucceeds(deleteDoc(memberRef(db('alice'), 'bob')));
  await assertFails(getDoc(campaignRef(db('bob'))));
  await assertFails(getDoc(privateRef(db('bob'))));
  await assertSucceeds(getDoc(indexRef(db('bob'), 'bob'))); // nur navigationsinterner Rest.
  await assertFails(setDoc(indexRef(db('bob'), 'bob'), {
    campaignId: 'abc12345678901234567', role: 'owner', addedAt: serverTimestamp(),
  }));
});

test('SL-Sperre beendet Zugriff sofort und verhindert erneuten Eintritt mit demselben Link', async () => {
  await seed();
  await assertFails(setDoc(blockedRef(db('bob'), 'alice'), { createdAt: serverTimestamp() }));
  await assertSucceeds(setDoc(blockedRef(db('alice')), { createdAt: serverTimestamp() }));
  await assertFails(getDoc(campaignRef(db('bob'))));
  await assertFails(getDoc(privateRef(db('bob'))));
  await assertFails(getDoc(blockedRef(db('bob'))));
  await assertSucceeds(deleteDoc(memberRef(db('alice'), 'bob')));
  await assertFails(setDoc(memberRef(db('bob'), 'bob'), { role: 'player', joinedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(blockedRef(db('alice'))));
  await joinCampaign('bob');
  await assertSucceeds(getDoc(campaignRef(db('bob'))));
});

test('Charakter: Besitz, Version, Bearbeitungsrecht und Quellprofil erhalten, Fremde ausgeschlossen', async () => {
  await seed({ members: ['bob', 'carol'] });
  await assertSucceeds(setDoc(characterRef(db('bob')), character()));
  assert.deepEqual((await assertSucceeds(getDoc(characterRef(db('bob'))))).data().character.profile.edras,
    { lifeEnergy: 8, potential: 2 });
  await assertSucceeds(getDoc(characterRef(db('alice'))));
  await assertFails(getDoc(characterRef(db('carol'))));
  await assertFails(updateDoc(characterRef(db('carol')), { 'character.name': 'Fremdänderung', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(characterRef(db('bob')), { ownerId: 'carol', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(characterRef(db('bob')), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(characterRef(db('bob')), { 'character.name': 'Arven II', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(characterRef(db('alice')), { 'character.name': 'SL-Korrektur', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(characterRef(db('carol'), 'hero2'), { ...character('hero2'), ownerId: 'alice' }));
  await assertFails(setDoc(characterRef(db('bob'), 'bad'), { ...character('bad'), character: {
    ...character('bad').character, dmSecret: 'leak',
  } }));
  await assertFails(setDoc(characterRef(db('bob'), 'badname'), { ...character('badname'), character: {
    ...character('badname').character, name: 'x'.repeat(61),
  } }));
  await assertFails(setDoc(characterRef(db('bob'), 'badlevel'), { ...character('badlevel'), character: {
    ...character('badlevel').character, level: 21,
  } }));
});

test('Charakterlisten sind nur mit Besitzerfilter oder als Spielleitung erlaubt', async () => {
  await seed({ members: ['bob', 'carol'] });
  await assertSucceeds(setDoc(characterRef(db('bob')), character()));
  assert.equal((await assertSucceeds(getDocs(collection(db('alice'), 'campaigns', 'abc12345678901234567', 'characters')))).size, 1);
  await assertFails(getDocs(collection(db('carol'), 'campaigns', 'abc12345678901234567', 'characters')));
  const filtered = query(collection(db('bob'), 'campaigns', 'abc12345678901234567', 'characters'), where('ownerId', '==', 'bob'));
  assert.equal((await assertSucceeds(getDocs(filtered))).size, 1);
});

test('SL-Daten sind getrennt; Spieler, Fremdkonto und anderes Kampagnenmitglied sehen nichts', async () => {
  await seed();
  await createCampaign('carol', 'other1234567890123456');
  await assertSucceeds(setDoc(privateRef(db('alice')), { note: 'Plot', hiddenSeed: 137 }));
  await assertSucceeds(getDoc(privateRef(db('alice'))));
  await assertFails(getDoc(privateRef(db('bob'))));
  await assertFails(setDoc(privateRef(db('bob')), { hiddenSeed: 999 }));
  await assertFails(getDoc(privateRef(db('carol'))));
  await assertFails(getDoc(campaignRef(db('bob'), 'other1234567890123456')));
});

test('B12: SL-private Edras-Saat auch gegen Listen, Überschreiben und anonyme Zugriffe geschützt', async () => {
  await seed({ members: ['bob', 'carol'] });
  const owner = db('alice');
  await assertSucceeds(setDoc(privateRef(owner), { kind: 'edras-secret-test', hiddenSeed: 'server-only' }));
  assert.equal((await assertSucceeds(getDoc(privateRef(owner)))).data().hiddenSeed, 'server-only');
  assert.equal((await assertSucceeds(getDocs(collection(owner, 'campaigns', 'abc12345678901234567', 'dmPrivate')))).size, 1);
  for (const current of [db('bob'), db('carol'), db()]) {
    await assertFails(getDoc(privateRef(current)));
    await assertFails(getDocs(collection(current, 'campaigns', 'abc12345678901234567', 'dmPrivate')));
    await assertFails(updateDoc(privateRef(current), { hiddenSeed: 'stolen' }));
  }
});

test('B14: SL-private Dokumente begrenzen Inhalt und verhindern versteckte Zusatzfelder', async () => {
  await seed();
  const owner = db('alice');
  await assertSucceeds(setDoc(privateRef(owner), { kind: 'edras', hiddenSeed: 'spieltest-137' }));
  await assertSucceeds(updateDoc(privateRef(owner), { note: 'Nur für die Spielleitung.' }));
  await assertFails(updateDoc(privateRef(owner), { exposedPublicly: true }));
  await assertFails(setDoc(privateRef(owner), { note: 'x'.repeat(10001) }));
  await assertFails(setDoc(privateRef(owner), { hiddenSeed: 's'.repeat(129) }));
  await assertFails(setDoc(privateRef(owner), { kind: 'x'.repeat(61), hiddenSeed: 'abc' }));
  await assertFails(setDoc(privateRef(owner), { arbitrary: { huge: 'data' } }));
  await assertFails(setDoc(privateRef(db('bob')), { note: 'Fremde Notiz' }));
  assert.equal((await assertSucceeds(getDoc(privateRef(owner)))).data().hiddenSeed, 'spieltest-137');
});

test('Persönliche Regelpakete bleiben privat; unerlaubte Felder und Größen abgewiesen', async () => {
  const pack = { schemaVersion: 1, id: 'pack.demo1', name: 'Hausregeln', version: 1,
    abilities: [], source: 'homebrew', ownerId: 'alice', updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(packRef(db('alice')), pack));
  await assertSucceeds(getDoc(packRef(db('alice'))));
  await assertFails(getDoc(packRef(db('bob'))));
  await assertFails(getDocs(collection(db('bob'), 'users', 'alice', 'rulePacks')));
  await assertFails(setDoc(packRef(db('bob')), pack));
  await assertFails(setDoc(packRef(db('alice')), { ...pack, ownerId: 'bob' }));
  await assertFails(setDoc(packRef(db('alice')), { ...pack, superadmin: true }));
  await assertFails(setDoc(packRef(db('alice')), { ...pack, abilities: Array(101).fill({}) }));
  await assertFails(setDoc(packRef(db('alice')), { ...pack, updatedAt: Timestamp.fromMillis(0) }));
});

test('Unbekannte Pfade bleiben standardmäßig geschlossen', async () => {
  await seed();
  await assertFails(setDoc(doc(db('alice'), 'campaigns', 'abc12345678901234567', 'unknown', 'x'), { anything: true }));
  await assertFails(setDoc(doc(db('alice'), 'users', 'alice'), { isAdmin: true }));
  await assertFails(setDoc(doc(db('alice'), 'users', 'bob', 'secret', 'x'), { a: 1 }));
});

test('B15: eine SL und zwei Spieler behalten getrennte Figuren und Rechte beim Entzug', async () => {
  await seed({ members: ['bob', 'carol'], edras: false });
  const owner = db('alice'), bob = db('bob'), carol = db('carol');
  const bobHero = liveCharacter();
  const carolHero = { ...liveCharacter(), ownerId: 'carol',
    character: { ...liveCharacter().character, id: 'carolHero', name: 'Rina' } };
  await assertSucceeds(setDoc(characterRef(bob), bobHero));
  await assertSucceeds(setDoc(characterRef(carol, 'carolHero'), carolHero));
  assert.equal((await assertSucceeds(getDocs(collection(owner, 'campaigns',
    'abc12345678901234567', 'characters')))).size, 2);
  assert.equal((await assertSucceeds(getDocs(query(collection(bob, 'campaigns',
    'abc12345678901234567', 'characters'), where('ownerId', '==', 'bob'))))).size, 1);
  assert.equal((await assertSucceeds(getDocs(query(collection(carol, 'campaigns',
    'abc12345678901234567', 'characters'), where('ownerId', '==', 'carol'))))).size, 1);
  await assertFails(getDoc(characterRef(bob, 'carolHero')));
  await assertFails(getDoc(characterRef(carol)));
  await assertFails(getDoc(characterRef(db('outsider'))));
  await assertFails(updateDoc(characterRef(bob, 'carolHero'), {
    'character.name': 'Manipuliert', updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(characterRef(owner), {
    'character.name': 'Von SL korrigiert', updatedAt: serverTimestamp(),
  }));
  assert.equal((await assertSucceeds(getDoc(characterRef(bob)))).data().character.name, 'Von SL korrigiert');
  await assertSucceeds(setDoc(blockedRef(owner, 'bob'), { createdAt: serverTimestamp() }));
  await assertFails(getDoc(characterRef(bob)));
  await assertFails(updateDoc(characterRef(bob), {
    'character.name': 'Unberechtigter Retry', updatedAt: serverTimestamp(),
  }));
  assert.equal((await assertSucceeds(getDoc(characterRef(carol, 'carolHero')))).data().character.name, 'Rina');
  assert.equal((await assertSucceeds(getDoc(characterRef(owner)))).data().character.name, 'Von SL korrigiert');
});
