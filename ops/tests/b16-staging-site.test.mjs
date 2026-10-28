import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  STAGING_PROJECT, STAGING_SITE,
  assertProjectId, assertStagingUrl, verifiedSite, verifiedWebApp,
  verifiedSdkConfig, hostingStagingConfig, stagingDeployArgs,
  verifiedDeployResult, buildStagingBundle,
} from '../../scripts/staging-site-core.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const appId = '1:123456789:web:abc123456';
const site = { name: `projects/${STAGING_PROJECT}/sites/${STAGING_SITE}`,
  defaultUrl: `https://${STAGING_SITE}.web.app`, appId };
const sdk = { apiKey: `AIza${'A'.repeat(32)}`, authDomain: `${STAGING_PROJECT}.firebaseapp.com`,
  projectId: STAGING_PROJECT, appId, messagingSenderId: '123456789' };
const url = 'https://wuerfelbund-staging.web.app/';

test('Staging: feste Projekt-, Site- und dauerhafte Hostgrenzen verhindern Produktion', () => {
  assert.equal(assertProjectId(STAGING_PROJECT), STAGING_PROJECT);
  for (const id of ['wuerfelbund', 'demo-wuerfelbund', 'staging-other', undefined, '']) {
    assert.throws(() => assertProjectId(id));
  }
  assert.equal(verifiedSite({ sites: [site] }), site);
  assert.throws(() => verifiedSite({ sites: [{ ...site, name: 'projects/wuerfelbund/sites/wuerfelbund-staging' }] }));
  assert.throws(() => verifiedSite({ sites: [{ ...site, defaultUrl: 'https://wuerfelbund.web.app' }] }));
  assert.equal(assertStagingUrl(url), new URL(url).origin);
  for (const wrong of [
    'https://wuerfelbund.web.app/', 'https://wuerfelbund-staging--b16-rc1-a3.web.app/',
    'https://wuerfelbund-staging--live-a3.web.app/',
    'https://wuerfelbund-staging--b16-rc1-a3s9d.firebaseapp.com/',
    'http://wuerfelbund-staging.web.app/',
    `${url}redirect=1`, 'https://wuerfelbund-staging.web.app.evil.org/',
  ]) assert.throws(() => assertStagingUrl(wrong), wrong);
});

test('Staging: nur registrierte/zu Hosting passende Web-App und exakte SDK-Konfiguration', () => {
  const app = { appId, platform: 'WEB' };
  assert.equal(verifiedWebApp([app], site).appId, appId);
  assert.equal(verifiedSdkConfig({ sdkConfig: sdk }, appId).projectId, STAGING_PROJECT);
  assert.throws(() => verifiedWebApp([{ ...app, appId: '1:123:web:wrong' }], site));
  assert.throws(() => verifiedWebApp([app], site, '1:123:web:wrong'));
  assert.throws(() => verifiedWebApp([app, { ...app, appId: '1:456:web:other' }],
    { ...site, appId: '' }));
  for (const change of [
    { projectId: 'wuerfelbund' }, { authDomain: 'wuerfelbund.firebaseapp.com' },
    { appId: '1:333:web:prod' }, { apiKey: 'demo-key' },
  ]) assert.throws(() => verifiedSdkConfig({ ...sdk, ...change }, appId));
});

test('Staging: CLI-Argumente enthalten zwingend Projekt-ID und nur Hosting der eigenen Site', () => {
  const config = hostingStagingConfig();
  const args = stagingDeployArgs('/some/place/firebase-staging.json');
  assert.equal(config.hosting.site, STAGING_SITE);
  assert.equal(config.hosting.public, 'dist-staging-site');
  assert.equal(config.hosting.headers[0].headers.find(row => row.key === 'X-Robots-Tag')?.value,
    'noindex, nofollow, noarchive');
  assert.equal(args[0], 'deploy');
  assert.equal(args[args.indexOf('--only') + 1], 'hosting');
  assert.equal(args[args.indexOf('--project') + 1], STAGING_PROJECT);
  assert.ok(!args.includes('firestore') && !args.includes('--expires') && !args.includes('functions'));
  assert.throws(() => stagingDeployArgs('/unsafe/path'));
});

test('Staging: Deploy-Ausgabe akzeptiert nur genau eine Version der richtigen Hosting-Site', () => {
  const data = { hosting: `projects/${STAGING_PROJECT}/sites/${STAGING_SITE}/versions/abc123` };
  assert.equal(verifiedDeployResult(data).origin, new URL(url).origin);
  assert.throws(() => verifiedDeployResult({ wuerfelbund: data.hosting }));
  assert.throws(() => verifiedDeployResult({ ...data, firestore: true }));
  assert.throws(() => verifiedDeployResult({ hosting: 'projects/wuerfelbund/sites/wuerfelbund/versions/abc' }));
  assert.throws(() => verifiedDeployResult({ hosting: [data.hosting, data.hosting] }));
});

test('Staging: Build enthält nur geprüfte Allowlist, ersetzt Prod-Konfiguration und verweigert falsche Hosts', async () => {
  const temp = await mkdtemp(join(root, '.staging-site-test-'));
  try {
    await cp(join(root, 'dist'), join(temp, 'dist'), { recursive: true });
    const built = await buildStagingBundle(temp, verifiedSdkConfig(sdk, appId));
    assert.ok(built.files >= 55);
    const local = await readFile(join(built.directory, 'js/rules/firebase-runtime.mjs'), 'utf8');
    assert.match(local, /wuerfelbund-staging/);
    assert.doesNotMatch(local, /['"]wuerfelbund['"]|wuerfelbund\.firebaseapp\.com/);
    const module = await import(pathToFileURL(join(built.directory, 'js/rules/firebase-runtime.mjs')).href);
    assert.equal(module.firebaseRuntime(new URL(url).hostname).config.projectId, STAGING_PROJECT);
    for (const host of ['wuerfelbund.web.app', 'localhost', 'wuerfelbund-staging.firebaseapp.com']) {
      assert.throws(() => module.firebaseRuntime(host));
    }
    assert.throws(() => module.firebaseRuntime(new URL(url).hostname, 'http:'));
    await readFile(join(built.directory, 'index.html'));
    await assert.rejects(readFile(join(built.directory, 'firestore.rules')));
    await assert.rejects(readFile(join(built.directory, 'ops/release-config.json')));
    await assert.rejects(readFile(join(built.directory, 'tests/account-privacy.test.mjs')));
    // Zweiter Build überschreibt ausschließlich ein von uns markiertes Ziel.
    assert.equal((await buildStagingBundle(temp, sdk)).files, built.files);
    const stylesheet = join(temp, 'dist/studio.css');
    const compromised = `${await readFile(stylesheet, 'utf8')}\n/* wuerfelbund.firebaseapp.com */\n`;
    await writeFile(stylesheet, compromised);
    const manifestPath = join(temp, 'dist/public-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const altered = manifest.files.find(entry => entry.path === 'studio.css');
    altered.bytes = Buffer.byteLength(compromised);
    altered.sha256 = createHash('sha256').update(compromised).digest('hex');
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(buildStagingBundle(temp, sdk), /Produktiver Firebase-Client/);
    await writeFile(join(built.directory, '.wuerfelbund-staging-site'), 'fremd');
    await assert.rejects(buildStagingBundle(temp, sdk), /nicht unser Staging-Build/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
