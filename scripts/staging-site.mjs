/** Bewusster dauerhafter Staging-Site-Deploy: nur wuerfelbund-staging/Hosting. */
import { spawnSync } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STAGING_PROJECT, STAGING_SITE, STAGING_HOST,
  assertStagingUrl, verifiedSite, verifiedWebApp, verifiedSdkConfig,
  verifiedDeployResult, stagingDeployArgs, hostingStagingConfig, buildStagingBundle,
} from './staging-site-core.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const firebaseCli = resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
const siteConfigPath = resolve(root, '.firebase.staging-site.generated.json');
const mode = process.argv[2] || 'deploy';
if (!['deploy', '--prepare-only'].includes(mode) || process.argv.length > (mode === 'deploy' ? 2 : 3)) {
  throw new Error('Nur npm run staging:site oder node scripts/staging-preview.mjs --prepare-only erlaubt.');
}

for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT']) {
  if (process.env[name] && process.env[name] !== STAGING_PROJECT) {
    throw new Error(`ABBRUCH: ${name} widerspricht dem festen Projekt ${STAGING_PROJECT}.`);
  }
}
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('ABBRUCH: Verwechslung mit Demo-Emulator erkannt.');
}
const release = JSON.parse(await readFile(resolve(root, 'ops/release-config.json'), 'utf8'));
if (release.publicReleaseApproved !== false) throw new Error('ABBRUCH: Projekt wurde bereits für eine öffentliche Veröffentlichung verändert.');
await stat(firebaseCli).catch(() => { throw new Error('Firebase-CLI fehlt. Bitte zunächst npm ci im Projektordner ausführen.'); });

/** Die CLI erhält bei jedem Aufruf explizit --project und niemals einen Alias. */
function firebaseJson(args) {
  if (args.at(-1) !== '--json' || !args.includes('--project')
    || args[args.indexOf('--project') + 1] !== STAGING_PROJECT) {
    throw new Error('ABBRUCH: Firebase-CLI-Aufruf ohne explizites Staging-Projekt.');
  }
  const result = spawnSync(process.execPath, [firebaseCli, ...args], {
    cwd: root, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, env: process.env,
  });
  if (result.status !== 0) {
    // Keine Auth-Tokens, Firebase-Debugausgaben oder Schlüssel ungefiltert ausgeben.
    throw new Error(`Firebase-CLI-Abfrage ${args[0]} fehlgeschlagen (Exitcode ${result.status ?? 'unbekannt'}). Anmeldung mit firebase login, Hosting-Site und Rechte für ${STAGING_PROJECT} prüfen.`);
  }
  let data;
  try { data = JSON.parse(result.stdout); }
  catch { throw new Error(`Firebase-CLI-Abfrage ${args[0]} lieferte keine parsebaren JSON-Daten.`); }
  if (data.status !== 'success' || data.result === undefined) {
    throw new Error(`Firebase-CLI-Abfrage ${args[0]} hat keinen bestätigten Erfolg geliefert.`);
  }
  return data.result;
}

console.log(`B16-Dauer-Staging: ausschließlich Firebase-Projekt ${STAGING_PROJECT}; Host ${STAGING_HOST}.`);
const sites = firebaseJson(['hosting:sites:list', '--project', STAGING_PROJECT, '--json']);
const site = verifiedSite(sites);
const apps = firebaseJson(['apps:list', 'WEB', '--project', STAGING_PROJECT, '--json']);
const app = verifiedWebApp(apps, site, String(process.env.WB_STAGING_APP_ID || '').trim());
const configResult = firebaseJson(['apps:sdkconfig', 'WEB', app.appId,
  '--project', STAGING_PROJECT, '--json']);
const sdk = verifiedSdkConfig(configResult, app.appId);
console.log(`Hosting-Site und registrierte Web-App verifiziert: ${STAGING_SITE} / ${app.appId}.`);
const build = spawnSync(process.execPath, [resolve(root, 'scripts/build-public.mjs')], {
  cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024, env: process.env,
});
if (build.status !== 0) throw new Error(`Allowlist-Public-Build fehlgeschlagen (${build.status ?? 'unbekannt'}). Kein Deployment.`);
const output = await buildStagingBundle(root, sdk);
const configText = JSON.stringify(hostingStagingConfig(), null, 2) + '\n';
try {
  const existing = await readFile(siteConfigPath, 'utf8');
  if (existing !== configText) throw new Error('Vorhandene Hosting-Preview-Konfiguration wurde nicht von diesem Build erstellt.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await writeFile(siteConfigPath, configText, { flag: 'wx' });
}
console.log(`Staging-only-Bundle erstellt: ${output.files} freigegebene Dateien; produktive Firebase-Clientkonfiguration nicht enthalten.`);

if (mode === '--prepare-only') {
  console.log('Nur vorbereitet: Keine Hosting-Dateien hochgeladen und keine Staging-Website geändert.');
  process.exit(0);
}

// Vor dem Upload gilt die durch die Hosting-Site-Liste nachgewiesene feste Ziel-Domain.
assertStagingUrl(`https://${STAGING_HOST}/`);
console.log('Deploy jetzt ausschließlich auf den dauerhaften Hosting-Hauptkanal der STAGING-Site. Kein Produktiv-Hosting.');
const deployment = firebaseJson(stagingDeployArgs(siteConfigPath));
const published = verifiedDeployResult(deployment);

// Nachweis des wirklich ausgelieferten Bundles. Keine Umleitung auf fremde Hosts zulassen.
for (const [pathname, required] of [
  ['/', '<title'],
  ['/js/rules/firebase-runtime.mjs', `projectId": "${STAGING_PROJECT}"`],
]) {
  const url = new URL(pathname, published.origin);
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  if (response.status !== 200 || new URL(response.url).origin !== published.origin) {
    throw new Error('Hosting-Kontrollabruf fehlgeschlagen. Der Kanal wurde bereits im Staging erstellt, aber die Vorschau darf noch nicht verwendet werden.');
  }
  const content = await response.text();
  if (!content.includes(required) || content.includes('wuerfelbund.firebaseapp.com')
    || content.includes('AIzaSyB3Tlq5zaXXpE0rwG4C4si-BkAHIeplISk')) {
    throw new Error('ABBRUCH: Unerwartete Firebase-Konfiguration im ausgelieferten Vorschau-Bundle. Kanal im Staging prüfen.');
  }
}
const finalSite = verifiedSite(firebaseJson(['hosting:sites:list', '--project', STAGING_PROJECT, '--json']));
if (finalSite.name !== site.name) throw new Error('Hosting-Site hat sich während des Deploys geändert.');
console.log(`\nDAUER-STAGING VERIFIZIERT: ${published.origin}/`);
console.log('Ohne automatischen Ablauf; Spark-Nutzungsgrenzen weiterhin beachten.');
console.log(`Nur Staging-Hosting auf ${STAGING_SITE}; kein Produktiv- oder GitHub-Pages-Deployment.`);
