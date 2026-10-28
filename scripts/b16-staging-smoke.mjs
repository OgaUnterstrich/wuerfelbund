/** B16-R1-Smoke mit ausschließlich eigenen Testidentitäten, niemals Prod. */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, connectAuthEmulator,
  createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, getDoc,
  getDocs, setDoc, writeBatch, updateDoc, deleteDoc, runTransaction,
  serverTimestamp, terminate, query, where } from 'firebase/firestore';
import { STAGING_PROJECT, verifiedSite, verifiedWebApp, verifiedSdkConfig } from './staging-site-core.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mode = process.argv[2];
if (!['emulator', 'staging'].includes(mode) || process.argv.length !== 3) {
  throw new Error('Nur emulator oder staging zulässig; echtes Staging nur mit npm run staging:smoke.');
}
const real = mode === 'staging';
const projectId = real ? STAGING_PROJECT : 'demo-wuerfelbund';
if (real) {
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Staging-Smoke verweigert Emulator-/Live-Mischbetrieb.');
  }
  for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID']) {
    if (process.env[name] && process.env[name] !== STAGING_PROJECT) throw new Error(`${name} widerspricht Staging.`);
  }
} else if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080'
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') {
  throw new Error('Demo-Smoke darf nur auf beide festen Loopback-Emulatoren zugreifen.');
}

function cliJson(args) {
  if (!args.includes('--project') || args[args.indexOf('--project') + 1] !== STAGING_PROJECT) {
    throw new Error('Firebase-CLI-Aufruf ohne explizite Staging-ID verhindert.');
  }
  const binary = resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
  const result = spawnSync(process.execPath, [binary, ...args, '--json'], {
    cwd: root, encoding: 'utf8', env: process.env, maxBuffer: 5 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`Staging-CLI-Abfrage ${args[0]} fehlgeschlagen: Exitcode ${result.status}.`);
  const payload = JSON.parse(result.stdout);
  if (payload.status !== 'success' || !payload.result) throw new Error('Unvollständige Staging-CLI-Daten.');
  return payload.result;
}

let sdk;
if (real) {
  const site = verifiedSite(cliJson(['hosting:sites:list', '--project', STAGING_PROJECT]));
  const app = verifiedWebApp(cliJson(['apps:list', 'WEB', '--project', STAGING_PROJECT]),
    site, String(process.env.WB_STAGING_APP_ID || '').trim());
  sdk = verifiedSdkConfig(cliJson(['apps:sdkconfig', 'WEB', app.appId, '--project', STAGING_PROJECT]), app.appId);
} else sdk = {projectId, apiKey: 'demo-key', authDomain: `${projectId}.firebaseapp.com`,
  appId: '1:123456789:web:demo-b16'};

const nonce = randomBytes(8).toString('hex');
const password = `B16-${randomBytes(20).toString('base64url')}-9a!`;
const trail = { projectId, mode, createdAt: new Date().toISOString(),
  marker: `B16-SMOKE-${nonce}`, users: [], campaignId: '', characterPath: '',
  note: 'Nur isoliert erzeugte Staging-Testdaten. Keine automatische Kampagnen-/Admin-Löschung.' };
const recordPath = resolve(root, `test-results/b16-staging-smoke-${nonce}.json`);
await mkdir(resolve(root, 'test-results'), { recursive: true });
async function record() { await writeFile(recordPath, JSON.stringify(trail, null, 2) + '\n'); }
await record();

const clients = [];
function client(role) {
  const app = initializeApp(sdk, `wb-b16-${nonce}-${role}`);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  const db = getFirestore(app);
  if (!real) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  const result = { role, app, auth, db, uid: '',
    email: `wb-b16smoke-${nonce}-${role}@example.test` };
  clients.push(result);
  return result;
}
const owner = client('leitung'), member = client('spieler'), stranger = client('fremd');
const checks = [];
async function check(label, callback) {
  await callback();
  checks.push(label);
  console.log(`✓ ${checks.length}. ${label}`);
}
async function blocked(promise) {
  try { await promise; }
  catch (error) { if (error?.code === 'permission-denied') return; throw error; }
  throw new Error('Ein fremder oder gesperrter Firestore-Zugriff wurde wider Erwarten erlaubt.');
}
let done = false;
try {
  await check('Drei echte voneinander getrennte Firebase-Auth-Konten', async () => {
    for (const c of clients) {
      c.uid = (await createUserWithEmailAndPassword(c.auth, c.email, password)).user.uid;
      trail.users.push({ uid: c.uid, email: c.email, role: c.role });
      await record();
    }
    if (new Set(clients.map(c => c.uid)).size !== 3) throw new Error('UID-Kollision.');
  });
  const campaign = doc(collection(owner.db, 'campaigns'));
  const cid = campaign.id;
  await check('Kampagne mit atomarem SL-Index angelegt', async () => {
    trail.campaignId = cid;
    await record();
    const batch = writeBatch(owner.db);
    batch.set(campaign, {ownerId: owner.uid, name: trail.marker,
      description: 'Isolierter B16-R1-Berechtigungstest', createdAt: serverTimestamp(),
      rules: {base: 'srd-5.2.1', worlds: [], packs: []}});
    batch.set(doc(owner.db, 'users', owner.uid, 'campaigns', cid), {
      campaignId: cid, role: 'owner', addedAt: serverTimestamp()});
    await batch.commit();
  });
  await check('Fremde dürfen weder die Kampagne lesen noch Kampagnen auflisten', async () => {
    await blocked(getDoc(doc(stranger.db, 'campaigns', cid)));
    await blocked(getDocs(collection(stranger.db, 'campaigns')));
  });
  await check('Beitritt mit Mitglieds- und Nutzerindex, ohne Selbstbeförderung', async () => {
    const batch = writeBatch(member.db);
    batch.set(doc(member.db, 'campaigns', cid, 'members', member.uid), {
      role: 'player', joinedAt: serverTimestamp() });
    batch.set(doc(member.db, 'users', member.uid, 'campaigns', cid), {
      campaignId: cid, role: 'player', addedAt: serverTimestamp() });
    await batch.commit();
    await blocked(updateDoc(doc(member.db, 'users', member.uid, 'campaigns', cid),
      {role: 'owner', addedAt: serverTimestamp()}));
  });
  await check('Kein unbefugter Besitzerwechsel, keine Kampagnen-Löschung', async () => {
    await blocked(updateDoc(doc(member.db, 'campaigns', cid), {ownerId: member.uid}));
    await blocked(deleteDoc(doc(owner.db, 'campaigns', cid)));
    await blocked(runTransaction(owner.db, async tx => {
      await tx.get(doc(owner.db, 'campaigns', cid));
      tx.update(doc(owner.db, 'campaigns', cid), {ownerId: member.uid});
      tx.set(doc(owner.db, 'campaigns', cid, 'members', owner.uid), {
        role: 'player', joinedAt: serverTimestamp() });
      tx.set(doc(owner.db, 'users', owner.uid, 'campaigns', cid), {
        campaignId: cid, role: 'player', addedAt: serverTimestamp() });
    })); // Unbestätigte SL darf selbst bei formal korrekter Transaktion nicht übergeben.
  });
  const characterId = `b16-${nonce}`;
  const charRef = doc(member.db, 'campaigns', cid, 'characters', characterId);
  await check('Eigene Figur persistiert, SL kann lesen; Fremder kann nicht lesen/löschen', async () => {
    trail.characterPath = `campaigns/${cid}/characters/${characterId}`;
    await record();
    await setDoc(charRef, {schemaVersion: 1, ownerId: member.uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      character: {id: characterId, name: trail.marker, level: 1,
        profile: {ruleset: 'srd-5.2.1'}}});
    if ((await getDoc(doc(owner.db, 'campaigns', cid, 'characters', characterId))).data()?.ownerId !== member.uid) {
      throw new Error('SL sieht Spielerfigur nicht.');
    }
    await blocked(getDoc(doc(stranger.db, 'campaigns', cid, 'characters', characterId)));
    await blocked(deleteDoc(doc(stranger.db, 'campaigns', cid, 'characters', characterId)));
  });
  await check('SL-Privatnotiz für Spieler gesperrt', async () => {
    await setDoc(doc(owner.db, 'campaigns', cid, 'dmPrivate', 'testnote'),
      {note: `Nur isolierter Smoke-Test ${nonce}`});
    await blocked(getDoc(doc(member.db, 'campaigns', cid, 'dmPrivate', 'testnote')));
  });
  await check('Persönlicher Kontoauszug nur eigene Indizes und Figuren', async () => {
    const indexes = await getDocs(collection(member.db, 'users', member.uid, 'campaigns'));
    const own = await getDocs(query(collection(member.db, 'campaigns', cid, 'characters'),
      where('ownerId', '==', member.uid)));
    if (indexes.size !== 1 || own.size !== 1 || own.docs[0].data()?.ownerId !== member.uid) {
      throw new Error('Eigene Konto-Datensätze nicht erwartungsgemäß lesbar.');
    }
    await blocked(getDocs(collection(member.db, 'users', owner.uid, 'campaigns')));
  });
  await check('Kontolöschung eines Spielers: nur eigene Testfigur, Mitgliedschaft, Index, Auth', async () => {
    // Ausschließlich unmittelbar oben erzeugte, exakt bekannte Dokumentpfade.
    await deleteDoc(charRef);
    await runTransaction(member.db, async tx => {
      const rootRef = doc(member.db, 'campaigns', cid);
      const snapshot = await tx.get(rootRef);
      if (snapshot.data()?.ownerId !== owner.uid) throw new Error('Owner verändert: Stop vor Austritt.');
      tx.delete(doc(member.db, 'campaigns', cid, 'members', member.uid));
      tx.delete(doc(member.db, 'users', member.uid, 'campaigns', cid));
    });
    await deleteUser(member.auth.currentUser);
    trail.users.find(item => item.uid === member.uid).selfDeleted = true;
    await record();
  });
  done = true;
  console.log(`\nB16 ${real ? 'ECHTES STAGING' : 'DEMO'}: ${checks.length}/${checks.length} Prüfungen bestanden.`);
} finally {
  trail.finished = done;
  await record();
  await Promise.allSettled(clients.map(async c => {
    if (c.auth.currentUser) await signOut(c.auth);
    await terminate(c.db);
    await deleteApp(c.app);
  }));
  console.log(`Ressourcennachweis: ${recordPath}`);
  if (real) console.log(`HINWEIS: Smoke-Kampagne, SL-/Fremdkonto verbleiben gezielt nur in ${STAGING_PROJECT}; keine automatische Admin-Bereinigung.`);
}
