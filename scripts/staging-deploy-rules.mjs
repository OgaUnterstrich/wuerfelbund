import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verifiedStagingTarget } from './staging-target.mjs';

const projectId = verifiedStagingTarget();
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const binary = resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
console.log(`Nur Firestore-Sicherheitsregeln auf C3-Projekt ${projectId} bereitstellen. Kein Hosting, keine Produktionsressourcen.`);
const result = spawnSync(process.execPath, [binary, 'deploy', '--only', 'firestore:rules', '--project', projectId], {
  cwd: root, stdio: 'inherit', env: process.env,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
