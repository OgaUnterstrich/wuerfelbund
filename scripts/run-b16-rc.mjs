/** Reproduzierbarer, zusammenhängender B16-RC-Lauf – niemals Live-Firebase. */
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const stages = [
  ['Regel- und Lebenszyklus-Logik', 'test:logic'],
  ['Firestore-Berechtigungen', 'test:firestore'],
  ['Drei-Konten-Demo-Emulator', 'test:c3:emulator'],
  ['B16-Konto-/Berechtigungs-Smoke im Demo-Emulator', 'test:b16:smoke:emulator'],
  ['Public-Build', 'build:public'],
  ['Public-Build-Audit', 'test:public'],
  ['C4-Sicherheits-/Lizenz-Audit', 'test:c4:audit'],
  ['B16-Konto-/Release-Audit', 'test:b16:audit'],
  ['B16-Dauer-Staging: Isolation und Hostprüfung', 'test:b16:staging-site'],
  ['Chromium im Demo-Emulator', 'test:browser:isolated:chromium'],
  ['Firefox im Demo-Emulator', 'test:browser:isolated:firefox'],
];

if (process.argv.length !== 2) throw new Error('B16-RC-Lauf unterstützt keine verkürzte Freigabeoption.');
const results = [];
for (const [name, script] of stages) {
  console.log(`\n=== B16: ${name} (${script}) ===`);
  const execution = spawnSync(command, ['run', script], { cwd: root, env: process.env, stdio: 'inherit' });
  const code = execution.status ?? 1;
  results.push({ name, script, status: code === 0 ? 'passed' : 'failed_or_unavailable', exitCode: code,
    ...(execution.error ? { error: execution.error.message } : {}) });
  // Folgeprüfungen trotz eines fehlenden Browsers ausführen; keine stille Freigabe.
}
const gate = spawnSync(command, ['run', 'check:release'], { cwd: root, env: process.env, stdio: 'inherit' });
results.push({ name: 'Öffentliches Release-Gate soll gesperrt bleiben', script: 'check:release',
  status: gate.status === 1 ? 'blocked_as_required' : 'unexpected', exitCode: gate.status ?? 1 });
const report = { project: 'Würfelbund', phase: 'B16', mode: 'local_demo_only',
  createdAt: new Date().toISOString(), results };
await mkdir(resolve(root, 'test-results'), { recursive: true });
await writeFile(resolve(root, 'test-results/b16-rc-summary.json'), JSON.stringify(report, null, 2) + '\n');
const passed = results.filter(row => ['passed', 'blocked_as_required'].includes(row.status)).length;
console.log(`\nB16-RC-Prüfkette: ${passed}/${results.length} erfolgreich oder absichtlich gesperrt.`);
if (passed !== results.length) process.exitCode = 1;
