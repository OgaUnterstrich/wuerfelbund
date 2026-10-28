/**
 * Freiwillige, private Paketsicherung für bestehende Würfelbund-Konten.
 * Firestore-Zugriffsregeln müssen separat vom Betreiber freigegeben werden.
 * Keine automatische Überschreibung lokaler Daten.
 */
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, connectAuthEmulator, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator, collection, doc, getDocs, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { firebaseRuntime } from '../rules/firebase-runtime.mjs';

export function setupCloud(onState) {
  const runtime = firebaseRuntime(location.hostname, location.protocol);
  const app = getApps().length ? getApp() : initializeApp(runtime.config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (runtime.emulator) {
    connectAuthEmulator(auth, runtime.emulator.authUrl, { disableWarnings: true });
    connectFirestoreEmulator(db, runtime.emulator.host, runtime.emulator.firestorePort);
  }
  let user = null;
  onAuthStateChanged(auth, next => { user = next; onState(user ? user.email || 'Angemeldet' : null); });
  const requireUser = () => {
    if (!user) throw new Error('Bitte melde dich zuerst auf der Würfelbund-Startseite an.');
    return user.uid;
  };
  return {
    get signedIn() { return Boolean(user); },
    async save(pack) {
      const userId = requireUser();
      const target = doc(db, 'users', userId, 'rulePacks', pack.id);
      await setDoc(target, {
        schemaVersion: pack.schemaVersion, id: pack.id, name: pack.name,
        version: pack.version, abilities: pack.abilities, source: 'homebrew',
        ownerId: userId, updatedAt: serverTimestamp(),
      });
    },
    async list() {
      const userId = requireUser();
      const snapshots = await getDocs(collection(db, 'users', userId, 'rulePacks'));
      return snapshots.docs.map(snapshot => snapshot.data());
    },
  };
}
