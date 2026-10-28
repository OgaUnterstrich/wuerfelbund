/** Sicherheitsgrenze der dauerhaften B16-RC.1-Staging-Website. Keine Produktiv-Fallbacks. */
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, posix, resolve } from 'node:path';

export const STAGING_PROJECT = 'wuerfelbund-staging';
export const STAGING_SITE = 'wuerfelbund-staging';
export const STAGING_HOST = `${STAGING_SITE}.web.app`;
const generatedMarker = 'Würfelbund B16 staging-site; nur wuerfelbund-staging\n';

export function assertProjectId(projectId) {
  if (projectId !== STAGING_PROJECT) throw new Error('ABBRUCH: Nur das feste Projekt wuerfelbund-staging ist erlaubt.');
  return projectId;
}

export function assertStagingUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Ungültige Firebase-Hosting-Staging-URL.'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== STAGING_HOST
    || parsed.username || parsed.password || parsed.port || parsed.pathname !== '/'
    || parsed.search || parsed.hash) {
    throw new Error('ABBRUCH: Hosting hat einen unerwarteten Staging-Host zurückgegeben.');
  }
  return parsed.origin;
}

export function verifiedSite(payload) {
  const sites = Array.isArray(payload) ? payload : payload?.sites;
  if (!Array.isArray(sites)) throw new Error('Firebase-CLI lieferte keine prüfbare Hosting-Site-Liste.');
  const site = sites.find(entry => entry?.name === `projects/${STAGING_PROJECT}/sites/${STAGING_SITE}`);
  if (!site || site.defaultUrl !== `https://${STAGING_HOST}`) {
    throw new Error('ABBRUCH: Die Hosting-Site wuerfelbund-staging mit erwarteter web.app-Domain fehlt. Nur dort ist ein Staging-Deploy gestattet.');
  }
  return site;
}

export function verifiedWebApp(payload, site, requestedId = '') {
  const apps = (Array.isArray(payload) ? payload : payload?.apps)?.filter(entry => entry?.platform === 'WEB') ?? [];
  if (!apps.length) throw new Error('In wuerfelbund-staging ist keine Firebase-Web-App registriert.');
  const linkedId = site.appId || '';
  if (requestedId && linkedId && requestedId !== linkedId) {
    throw new Error('Die angegebene Staging-Web-App widerspricht der mit Hosting verknüpften App.');
  }
  const desired = requestedId || linkedId || (apps.length === 1 ? apps[0].appId : '');
  if (!desired) throw new Error('Mehrere Staging-Web-Apps: WB_STAGING_APP_ID auf die gewünschte öffentliche App-ID setzen.');
  const app = apps.find(entry => entry.appId === desired);
  if (!app || !/^1:\d+:web:[a-z0-9]+$/i.test(app.appId)) {
    throw new Error('Die Web-App-ID gehört nicht zur geprüften Staging-App-Liste.');
  }
  return app;
}

export function verifiedSdkConfig(raw, appId) {
  const config = raw?.sdkConfig || raw;
  if (config?.projectId !== STAGING_PROJECT || config?.appId !== appId
    || config?.authDomain !== `${STAGING_PROJECT}.firebaseapp.com`
    || !/^AIza[A-Za-z0-9_-]{20,}$/.test(config?.apiKey ?? '')
    || !/^\d+$/.test(String(config?.messagingSenderId || ''))) {
    throw new Error('ABBRUCH: Firebase-Web-Konfiguration stimmt nicht exakt mit Staging-Projekt, App-ID und Auth-Domain überein.');
  }
  // Nur öffentliche Firebase-Webkonfiguration; unbekannte Felder nicht übernehmen.
  return Object.freeze(Object.fromEntries(['apiKey', 'authDomain', 'projectId',
    'storageBucket', 'messagingSenderId', 'appId', 'measurementId']
    .filter(key => typeof config[key] === 'string' && config[key]).map(key => [key, config[key]])));
}

export function stagingRuntimeSource(config) {
  if (config.projectId !== STAGING_PROJECT || config.authDomain !== `${STAGING_PROJECT}.firebaseapp.com`) {
    throw new Error('Keine Build-Erzeugung ohne validierte Staging-Konfiguration.');
  }
  return `/** Nur Firebase-Hosting-Website ${STAGING_PROJECT}; kein Prod-/Emulator-Fallback. */
const stagingConfig = Object.freeze(${JSON.stringify(config, null, 2)});
const stagingHost = '${STAGING_HOST}';
export function firebaseRuntime(hostname, protocol = 'https:') {
  if (protocol !== 'https:' || hostname !== stagingHost) {
    throw new Error('Staging-Website verweigert: Host ist nicht die geprüfte Staging-Domain.');
  }
  return { config: stagingConfig, emulator: null };
}
`;
}

export function hostingStagingConfig() {
  return { hosting: {
    site: STAGING_SITE,
    public: 'dist-staging-site',
    ignore: ['**/.*'],
    headers: [{ source: '**', headers: [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Cache-Control', value: 'no-store' },
    ] }],
  } };
}

export function stagingDeployArgs(configPath) {
  if (typeof configPath !== 'string' || !configPath.endsWith('.json')) throw new Error('Hosting-Konfigurationsdatei fehlt.');
  return ['deploy', '--only', 'hosting', '--project', STAGING_PROJECT,
    '--config', configPath, '--non-interactive', '--json'];
}

export function verifiedDeployResult(raw) {
  if (!raw || Object.keys(raw).length !== 1 || !Object.hasOwn(raw, 'hosting')) {
    throw new Error('ABBRUCH: Firebase hat keinen reinen Hosting-Deploy bestätigt.');
  }
  const versions = Array.isArray(raw.hosting) ? raw.hosting : [raw.hosting];
  if (versions.length !== 1 || typeof versions[0] !== 'string'
    || !new RegExp(`^(?:projects/${STAGING_PROJECT}/)?sites/${STAGING_SITE}/versions/[A-Za-z0-9_-]+$`).test(versions[0])) {
    throw new Error('ABBRUCH: Hosting meldet eine Version außerhalb von wuerfelbund-staging.');
  }
  return { origin: `https://${STAGING_HOST}`, version: versions[0] };
}

async function ownedDirectory(path) {
  try {
    const details = await lstat(path);
    if (!details.isDirectory() || details.isSymbolicLink()
      || await readFile(join(path, '.wuerfelbund-staging-site'), 'utf8') !== generatedMarker) {
      throw new Error(`Bereits vorhandenes Verzeichnis ist nicht unser Staging-Build: ${path}`);
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' && !error.path?.endsWith('.wuerfelbund-staging-site')) return false;
    throw error;
  }
}

/** Kopiert nur das bereits verifizierte Public-Manifest, niemals das Quellverzeichnis. */
export async function buildStagingBundle(root, config) {
  const source = resolve(root, 'dist');
  const destination = resolve(root, 'dist-staging-site');
  if ((await readFile(join(source, '.wuerfelbund-generated'), 'utf8')) !== 'Erzeugt durch Würfelbund build-public.mjs\n') {
    throw new Error('Öffentlicher Quellbuild ist nicht der geprüfte Würfelbund-Allowlist-Build.');
  }
  const manifest = JSON.parse(await readFile(join(source, 'public-manifest.json'), 'utf8'));
  const files = manifest.files;
  if (!Array.isArray(files) || files.length < 55 || files.length > 80
    || !files.some(entry => entry.path === 'js/rules/firebase-runtime.mjs')
    || !files.some(entry => entry.path === 'index.html')) {
    throw new Error('Unbekannte oder unvollständige freigegebene Web-Dateiliste.');
  }
  const seen = new Set();
  for (const entry of files) {
    const name = entry.path;
    if (typeof name !== 'string' || name.startsWith('/') || name.includes('\\')
      || name.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))
      || posix.normalize(name) !== name || seen.has(name)) {
      throw new Error('Unsicherer oder mehrfacher Pfad im Public-Manifest.');
    }
    seen.add(name);
    const path = join(source, name);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Verlinkte oder unbekannte Webdatei: ${name}`);
    const content = await readFile(path);
    if (createHash('sha256').update(content).digest('hex') !== entry.sha256 || content.length !== entry.bytes) {
      throw new Error(`Public-Manifest-Prüfsumme stimmt nicht: ${name}`);
    }
  }
  const existed = await ownedDirectory(destination);
  const temp = resolve(root, '.wuerfelbund-staging-site-incomplete');
  try { await lstat(temp); throw new Error('Unvollständiger alter Staging-Build gefunden. Bitte manuell prüfen.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(temp);
  try {
    for (const entry of files) {
      const dst = join(temp, entry.path);
      await mkdir(dirname(dst), { recursive: true });
      if (entry.path === 'js/rules/firebase-runtime.mjs') {
        await writeFile(dst, stagingRuntimeSource(config), { flag: 'wx' });
      } else {
        await copyFile(join(source, entry.path), dst);
      }
      // Abwehr eines später hinzukommenden zweiten hart codierten Prod-Clients.
      const deployed = await readFile(dst, 'utf8');
      if (deployed.includes('wuerfelbund.firebaseapp.com')
        || /(?:projectId\s*:\s*|["']projectId["']\s*:\s*)["']wuerfelbund["']/.test(deployed)) {
        throw new Error(`Produktiver Firebase-Client darf niemals in Staging-Dateien gelangen: ${entry.path}`);
      }
      if (entry.path === 'js/rules/app-check-config.mjs'
        && !/enterpriseAppCheckSiteKey\s*=\s*['"]['"]\s*;/.test(deployed)) {
        throw new Error('App Check darf in dieser Staging-Vorschau nicht unbemerkt aktiviert werden.');
      }
    }
    for (const filename of await readdir(temp)) {
      if (filename.startsWith('.') || ['node_modules', 'tests', 'ops', 'firebase.json'].includes(filename)) {
        throw new Error(`Nicht erlaubter Web-Inhalt: ${filename}`);
      }
    }
    await writeFile(join(temp, '.wuerfelbund-staging-site'), generatedMarker, { flag: 'wx' });
    // Nie ein fremdes oder unmarkiertes Verzeichnis überschreiben.
    if (existed) await rm(destination, { recursive: true });
    await rename(temp, destination);
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
  return { directory: destination, files: files.length };
}
