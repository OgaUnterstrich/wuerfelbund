/** Nur bei ausdrücklichem Aufruf: geprüfte B16-Regeln ausschließlich nach Staging. */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGING_PROJECT } from './staging-site-core.mjs';

if (process.argv.length !== 2) throw new Error('Keine zusätzlichen Projekt-/Deploy-Argumente erlaubt.');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const rules = await readFile(resolve(root, 'firestore.rules'), 'utf8');
if (!rules.includes('Würfelbund B16-R1') || !rules.includes('validOwnerHandover')
  || !rules.includes('allow delete: if false; // Kein ungeprüftes rekursives Löschen')) {
  throw new Error('Unbekannte Firestore-Rules-Fassung; Staging-Deploy abgebrochen.');
}
for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID']) {
  if (process.env[name] && process.env[name] !== STAGING_PROJECT) throw new Error(`${name} widerspricht der Staging-ID.`);
}
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Emulatorvariable bei realem Staging-Regeldeploy gefunden.');
}
console.log('ACHTUNG: Dieser ausdrücklich separate Befehl ersetzt ausschließlich die Firestore-Regeln im Projekt wuerfelbund-staging.');
console.log('Die Regeln wurden lokal geprüft; keine Produktionsregeln, Testdaten oder Hosting-Kanäle werden verändert.');
const firebaseCli = resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
const execution = spawnSync(process.execPath, [firebaseCli, 'deploy',
  '--only', 'firestore:rules', '--project', STAGING_PROJECT,
  '--config', resolve(root, 'firebase.json'), '--non-interactive'], {
  cwd: root, stdio: 'inherit', env: process.env,
});
if (execution.error) throw execution.error;
process.exitCode = execution.status ?? 1;
