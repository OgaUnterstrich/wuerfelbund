/**
 * C3: echte Firebase-Auth-Identitäten + Firestore-Serverregeln.
 * Zwei explizite Ziele: demo-Emulator oder dediziertes Spark-Staging.
 * Niemals Service-Account, Admin SDK, Produktionsprojekt oder Hosting.
 */
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, connectAuthEmulator,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, writeBatch, getDoc,
  getDocFromCache, getDocFromServer, getDocs, setDoc, updateDoc, deleteDoc, query, where,
  serverTimestamp, runTransaction, onSnapshot, disableNetwork, enableNetwork, terminate } from 'firebase/firestore';
import { verifiedStagingTarget } from '../../scripts/staging-target.mjs';

const target = process.env.WB_C3_TARGET;
if (!['emulator', 'staging'].includes(target)) throw new Error('WB_C3_TARGET muss emulator oder staging sein.');
const real = target === 'staging';
const projectId = real ? verifiedStagingTarget() : 'demo-wuerfelbund';
const apiKey = real ? String(process.env.WB_C3_API_KEY || '').trim() : 'demo-key';
if (real && (!/^AIza[\w-]{20,}$/.test(apiKey) || /demo/i.test(apiKey))) {
  throw new Error('C3 gesperrt: Ein Web-API-Key des getrennten Staging-Projekts fehlt.');
}
if (!real && (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080'
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099')) {
  throw new Error('C3-Emulatortest erfordert beide Loopback-Emulatoren an 8080 und 9099.');
}

const nonce = randomBytes(8).toString('hex');
const password = `C3-${randomBytes(22).toString('base64url')}-9a!`;
const roles = ['leitung', 'spieler1', 'spieler2'];
const clients = [];
const unauthorized = async promise => assert.rejects(promise, error => {
  assert.equal(error?.code, 'permission-denied', `Erwartete Firestore-Sperre: ${error?.code}`);
  return true;
});

function createClient(role) {
  const app = initializeApp({projectId, apiKey,
    authDomain: `${projectId}.firebaseapp.com`, appId: `1:123456789:web:c3-${role}`},
  `c3-${nonce}-${role}`);
  const auth = initializeAuth(app, {persistence: inMemoryPersistence});
  const db = getFirestore(app);
  if (!real) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  const client = {role, app, auth, db, email: `wb-c3-${nonce}-${role}@example.test`, uid: null};
  clients.push(client);
  return client;
}

async function addMember(client, campaignId) {
  const batch = writeBatch(client.db);
  batch.set(doc(client.db, 'campaigns', campaignId, 'members', client.uid), {
    role: 'player', joinedAt: serverTimestamp(),
  });
  batch.set(doc(client.db, 'users', client.uid, 'campaigns', campaignId), {
    campaignId, role: 'player', addedAt: serverTimestamp(),
  });
  await batch.commit();
}

test(`C3 ${real ? 'REAL-STAGING' : 'DEMO-EMULATOR'}: drei echte Auth-Konten und Kampagnengrenzen`,
  {timeout: 240_000}, async t => {
    let owner, player, teammate, cid, characterId;
    try {
      await t.test('Drei unabhängige Firebase-Auth-Registrierungen', async () => {
        [owner, player, teammate] = roles.map(createClient);
        for (const client of clients) {
          const credential = await createUserWithEmailAndPassword(client.auth, client.email, password);
          client.uid = credential.user.uid;
        }
        assert.equal(new Set(clients.map(client => client.uid)).size, 3);
      });

      await t.test('Besitzer erzeugt Kampagne und Index atomar; Fremdnutzer bleibt ausgeschlossen', async () => {
        const campaign = doc(collection(owner.db, 'campaigns'));
        cid = campaign.id;
        const batch = writeBatch(owner.db);
        batch.set(campaign, {ownerId: owner.uid, name: `C3 Test ${nonce}`,
          description: 'Nur temporärer Staging-Sicherheitstest', createdAt: serverTimestamp(),
          rules: {base: 'srd-5.2.1', worlds: [], packs: []}});
        batch.set(doc(owner.db, 'users', owner.uid, 'campaigns', cid), {
          campaignId: cid, role: 'owner', addedAt: serverTimestamp(),
        });
        await batch.commit();
        assert.equal((await getDoc(doc(owner.db, 'campaigns', cid))).data().ownerId, owner.uid);
        await unauthorized(getDoc(doc(player.db, 'campaigns', cid)));
        await unauthorized(getDocs(collection(teammate.db, 'campaigns')));
      });

      await t.test('Einladungscode: zwei Beitritte, reale User-Indizes und unverfälschte Rollen', async () => {
        const inventedId = doc(collection(player.db, 'campaigns')).id;
        await unauthorized(addMember(player, inventedId));
        await Promise.all([addMember(player, cid), addMember(teammate, cid)]);
        for (const client of [player, teammate]) {
          assert.equal((await getDoc(doc(client.db, 'campaigns', cid))).data().name, `C3 Test ${nonce}`);
          assert.equal((await getDoc(doc(client.db, 'users', client.uid, 'campaigns', cid))).data().role, 'player');
          await unauthorized(updateDoc(doc(client.db, 'users', client.uid, 'campaigns', cid),
            {role: 'owner', addedAt: serverTimestamp()}));
          await unauthorized(updateDoc(doc(client.db, 'campaigns', cid), {name: 'Übernommen'}));
        }
        assert.equal((await getDocs(collection(owner.db, 'campaigns', cid, 'members'))).size, 2);
        await unauthorized(getDocs(collection(player.db, 'campaigns', cid, 'members')));
      });

      await t.test('Besitz, private SL-Daten und unzulässige Charakter-/Indexabfragen', async () => {
        characterId = `c3-${nonce}`;
        const character = {schemaVersion: 1, ownerId: player.uid,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          character: {id: characterId, name: 'C3 Heldin', level: 1,
            profile: {ruleset: 'srd-5.2.1', tracker: {c3Moves: 0}, vitals: {hp: 12}}}};
        await setDoc(doc(player.db, 'campaigns', cid, 'characters', characterId), character);
        assert.equal((await getDocs(query(collection(player.db, 'campaigns', cid, 'characters'),
          where('ownerId', '==', player.uid)))).size, 1);
        assert.equal((await getDocs(collection(owner.db, 'campaigns', cid, 'characters'))).size, 1);
        await unauthorized(getDoc(doc(teammate.db, 'campaigns', cid, 'characters', characterId)));
        await unauthorized(getDocs(collection(teammate.db, 'campaigns', cid, 'characters')));
        await unauthorized(updateDoc(doc(teammate.db, 'campaigns', cid, 'characters', characterId),
          {'character.name': 'Manipuliert', updatedAt: serverTimestamp()}));
        await unauthorized(setDoc(doc(teammate.db, 'campaigns', cid, 'characters', `forged-${nonce}`),
          {schemaVersion: 1, ownerId: player.uid, createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(), character: {id: `forged-${nonce}`, name: 'Fremdfigur', level: 1}}));
        await unauthorized(getDoc(doc(player.db, 'users', owner.uid, 'campaigns', cid)));
        await setDoc(doc(owner.db, 'campaigns', cid, 'dmPrivate', 'testnote'),
          {note: 'Nur für die Spielleitung'});
        await unauthorized(getDoc(doc(player.db, 'campaigns', cid, 'dmPrivate', 'testnote')));
      });

      await t.test('Server-Live-Synchronisierung und atomare Konkurrenzänderungen', async () => {
        const ownerRef = doc(owner.db, 'campaigns', cid, 'characters', characterId);
        const playerRef = doc(player.db, 'campaigns', cid, 'characters', characterId);
        let unsubscribe = () => {}, timer;
        const seen = new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Staging-Live-Listener hat kein Serverupdate empfangen')), 15000);
          unsubscribe = onSnapshot(ownerRef, {includeMetadataChanges: true}, snapshot => {
            if (!snapshot.metadata.fromCache && snapshot.data()?.character?.profile?.tracker?.c3Moves === 1) resolve();
          }, reject);
        });
        try {
          await updateDoc(playerRef, {'character.profile.tracker.c3Moves': 1, updatedAt: serverTimestamp()});
          await seen;
        } finally {clearTimeout(timer); unsubscribe();}
        const advance = client => runTransaction(client.db, async transaction => {
          const ref = doc(client.db, 'campaigns', cid, 'characters', characterId);
          const snapshot = await transaction.get(ref);
          transaction.update(ref, {'character.profile.tracker.c3Moves':
            snapshot.data().character.profile.tracker.c3Moves + 1, updatedAt: serverTimestamp()});
        });
        await Promise.all([advance(owner), advance(player)]);
        assert.equal((await getDocFromServer(ownerRef)).data().character.profile.tracker.c3Moves, 3);
      });

      await t.test('Abmelden, erneut authentifizieren und Charakterzustand behalten', async () => {
        await signOut(player.auth);
        await unauthorized(getDocFromServer(doc(player.db, 'campaigns', cid, 'characters', characterId)));
        const credential = await signInWithEmailAndPassword(player.auth, player.email, password);
        assert.equal(credential.user.uid, player.uid);
        assert.equal((await getDocFromServer(doc(player.db, 'campaigns', cid, 'characters', characterId)))
          .data().character.profile.tracker.c3Moves, 3);
      });

      await t.test('Verbindungsabbruch: lokale Cache-Lesung, Serverzugriff gesperrt, Wiederverbindung', async () => {
        const ref = doc(player.db, 'campaigns', cid, 'characters', characterId);
        await getDocFromServer(ref);
        await disableNetwork(player.db);
        try {
          assert.equal((await getDocFromCache(ref)).data().character.profile.tracker.c3Moves, 3);
          await assert.rejects(getDocFromServer(ref), error => error?.code === 'unavailable');
        } finally {await enableNetwork(player.db);}
        assert.equal((await getDocFromServer(ref)).data().character.profile.tracker.c3Moves, 3);
      });

      await t.test('Sperrung verhindert Lesen, Schreiben und Wiederbeitritt mit altem Einladungslink', async () => {
        await setDoc(doc(owner.db, 'campaigns', cid, 'blockedUsers', player.uid),
          {createdAt: serverTimestamp()});
        await unauthorized(getDocFromServer(doc(player.db, 'campaigns', cid, 'characters', characterId)));
        await unauthorized(updateDoc(doc(player.db, 'campaigns', cid, 'characters', characterId),
          {'character.name': 'Nach Sperrung', updatedAt: serverTimestamp()}));
        await deleteDoc(doc(owner.db, 'campaigns', cid, 'members', player.uid));
        await unauthorized(addMember(player, cid));
      });
    } finally {
      // Firebase-Regeln verbieten bewusst Kampagnenlöschung. Deshalb keine verdeckte
      // Admin-Löschung: im echten Staging bleiben Testdokumente zur Kontrolle zurück.
      const cleanup = await Promise.allSettled(clients.map(async client => {
        if (client.auth.currentUser) await deleteUser(client.auth.currentUser);
        await terminate(client.db);
        await deleteApp(client.app);
      }));
      const failures = cleanup.filter(result => result.status === 'rejected');
      if (failures.length) console.warn(`C3: ${failures.length} Testkonten konnten nicht vollständig entfernt werden.`);
      if (real) console.log('C3: Testkampagne bleibt absichtlich im separaten Staging; nach Nachweis per Firebase-Konsole bereinigen.');
    }
  });
