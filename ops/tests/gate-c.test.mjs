/** B15-C4: projektweite Abnahmegrenzen, zusätzlich zu Regel-, Browser- und Emulatorfällen. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const source = name => readFileSync(join(root, name), 'utf8');
const home = source('index.html');
const studio = source('studio.html');
const style = source('studio.css');
const config = JSON.parse(source('ops/release-config.json'));

test('C4 Lizenz/Quellen: 25 SRD-Kategorien, Versionspin und korrekt verlinkte Attribution', () => {
  const dataDir = join(root, 'data/srd-5.2.1/en');
  const files = readdirSync(dataDir).filter(name => name.endsWith('.json'));
  assert.equal(files.length, 25);
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
    assert.ok(Array.isArray(data) && data.length, `${file} ist leer/kein Array`);
  }
  const licenses = source('LICENSES.md');
  assert.match(licenses, /SRD 5\.2\.1/);
  assert.match(licenses, /Wizards of the Coast LLC/);
  assert.match(licenses, /creativecommons\.org\/licenses\/by\/4\.0/);
  assert.match(licenses, /github\.com\/5e-bits\/5e-database/);
  assert.match(licenses, /a6212beb4b278917c2cff41c2b04c4ef4f3e0d6f/);
  assert.ok(existsSync(join(root, 'licenses/5e-bits-MIT.md')));
  assert.match(studio, /licenses\/5e-bits-MIT\.md/);
  assert.match(studio, /creativecommons\.org\/licenses\/by\/4\.0/);
});

test('C4 Datenfluss: nur gepinnte Firebase-Webmodule und lokale SRD-Dateien, keine Tracker', () => {
  const cloud = source('js/studio/cloud.mjs');
  const remoteImports = [home, cloud].flatMap(text => [...text.matchAll(/from\s+["'](https:\/\/[^"']+)["']/g)]
    .map(match => match[1]));
  assert.equal(remoteImports.length, 6);
  for (const url of remoteImports) assert.match(url, /^https:\/\/www\.gstatic\.com\/firebasejs\/13\.1\.0\/firebase-(?:app|auth|firestore)\.js$/);
  assert.match(source('js/rules/catalog.mjs'), /new URL\(`\.\.\/\.\.\/data\/srd-5\.2\.1\/en\/5e-SRD-/);
  assert.doesNotMatch(home + studio + cloud + style,
    /google-analytics|googletagmanager|hotjar|mixpanel|fonts\.googleapis\.com|\bgtag\(/i);
  assert.match(home, /Lokale Chronik, Würfel und Initiative werden nicht synchronisiert/);
  assert.match(home, /data-cloud=\\?"upload-character/);
  assert.match(home, /data-cloud=\\?"download-character/);
});

test('C4 Sicherheit: keine automatische Produktions- oder Live-Staging-Verbindung durch Tests', () => {
  const firebase = JSON.parse(source('firebase.json'));
  assert.deepEqual(Object.keys(firebase).sort(), ['emulators', 'firestore']);
  assert.equal(firebase.emulators.auth.host, '127.0.0.1');
  assert.equal(firebase.emulators.firestore.host, '127.0.0.1');
  const verify = source('.github/workflows/verify.yml');
  assert.match(verify, /npm run test:c3:emulator/);
  assert.doesNotMatch(verify, /test:c3:staging|staging:deploy-rules|deploy-pages|firebase deploy/);
  assert.match(source('scripts/run-c3.mjs'), /'--project', 'demo-wuerfelbund'/);
  const guard = source('scripts/staging-target.mjs');
  assert.match(guard, /id === 'wuerfelbund'/);
  assert.match(guard, /id\.includes\('staging'\)/);
  assert.match(guard, /STAGING:\$\{id\}/);
  assert.match(source('scripts/staging-deploy-rules.mjs'), /'--only', 'firestore:rules'/);
});

test('C4 mobile UX/Design: 320px-Belege, Fokus und reduzierte Bewegung bleiben erhalten', () => {
  const screenshots = readdirSync(join(root, 'docs/screenshots/b15')).filter(name => name.endsWith('-320.png'));
  assert.ok(screenshots.length >= 10, 'Vorhandene echte Mobile-Screenshots fehlen');
  for (const file of screenshots) {
    const bytes = readFileSync(join(root, 'docs/screenshots/b15', file));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', file);
    assert.equal(bytes.readUInt32BE(16), 320, `${file}: kein 320-Pixel-Beleg`);
  }
  assert.match(home, /@media\(max-width:550px\)/);
  assert.match(style, /@media\(max-width:370px\)/);
  assert.match(home + style, /prefers-reduced-motion:reduce/);
  assert.match(home + style, /:focus-visible/);
  assert.match(home, /class="skip-link"/);
  assert.match(studio, /class="skip-link"/);
  assert.doesNotMatch(home + studio + style, /lorem ipsum|fake metrics|premium freischalten|künstlicher fortschritt/i);
});

test('C4 Anti-Bloat: keine zusätzlichen Produktionspakete, Frameworks oder Speichersysteme', () => {
  const pkg = JSON.parse(source('package.json'));
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
  assert.deepEqual(Object.keys(pkg.devDependencies).sort(), [
    '@firebase/rules-unit-testing', '@playwright/test', 'axe-core', 'firebase', 'firebase-tools',
  ].sort());
  assert.doesNotMatch(home + studio, /cdn\.jsdelivr\.net\/npm\/(?:react|vue)|unpkg\.com\/(?:react|vue)|indexedDB\.open/i);
  assert.ok(!existsSync(join(root, 'src/node_modules')), 'Eingebettete Pakete im Quellbaum');
});

test('C4 Veröffentlichung: Pages nur manuell, alle B16-Freigaben bleiben gesperrt', () => {
  const release = source('.github/workflows/pages-release.yml');
  assert.match(release, /workflow_dispatch:/);
  assert.doesNotMatch(release, /\n\s+push:\s*\n/);
  assert.match(release, /release_confirmation == 'PUBLIC-V1-CONFIRMED'/);
  assert.match(release, /npm run check:release/);
  assert.match(release, /environment:\s*\n\s+name: github-pages/);
  for (const field of ['publicReleaseApproved', 'privacyReviewed', 'imprintReviewed',
    'firebaseStagingVerified', 'appCheckVerified', 'costAlertsVerified',
    'accountDataRemovalVerified', 'retentionPolicyReviewed']) {
    assert.equal(config[field], false, `${field} darf in C4 keine Release-Freigabe erteilen`);
  }
  assert.match(source('datenschutz.html'), /RELEASE_BLOCKER/);
  assert.match(source('impressum.html'), /RELEASE_BLOCKER/);
  const result = spawnSync(process.execPath, ['scripts/check-release-gate.mjs'],
    {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /GESPERRT/);
});

test('C4 Staging-Aufräumplan sperrt Produktion und vermeidet rekursive Massenlöschung', () => {
  const guide = source('docs/B15_C4_STAGING_BEREINIGUNG.md');
  assert.match(guide, /wuerfelbund-staging/);
  assert.match(guide, /wuerfelbund`/);
  assert.match(guide, /Unterkollektionen/);
  assert.match(guide, /kein automatisches/);
  assert.doesNotMatch(source('package.json'), /staging:cleanup|staging:delete-all/);
});
