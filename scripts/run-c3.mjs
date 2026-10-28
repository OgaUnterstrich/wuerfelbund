import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifiedStagingTarget } from './staging-target.mjs';

const mode = process.argv[2];
if (!['emulator', 'staging'].includes(mode)) throw new Error('C3 nur als emulator oder staging ausführbar.');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const testFile = 'tests/staging/c3-staging.test.mjs';
const environment = {...process.env, WB_C3_TARGET: mode};
let args;
if (mode === 'staging') {
  // Zielprüfung vor jedem Netzwerkaufruf durchführen.
  verifiedStagingTarget(environment);
  args = ['--test', testFile];
} else {
  const firebaseCli = resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
  args = [firebaseCli, 'emulators:exec', '--only', 'auth,firestore',
    '--project', 'demo-wuerfelbund', `node --test ${testFile}`];
}
const result = spawnSync(process.execPath, args, {cwd: root, env: environment, stdio: 'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
