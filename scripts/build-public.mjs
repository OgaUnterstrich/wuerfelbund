import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Explizite Freigabeliste: Quellprojekt ≠ öffentliches GitHub-Pages-Artefakt. */
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = join(root, 'dist');
const staging = join(root, '.dist-staging');
const marker = '.wuerfelbund-generated';
const inputs = [
  'index.html', 'studio.html', 'studio.css', 'datenschutz.html', 'impressum.html',
  'LICENSES.md', 'js', 'data/srd-5.2.1/en', 'licenses',
];
const expectedExtension = path => path.startsWith('js/') ? '.mjs'
  : path.startsWith('data/') ? '.json'
  : path.startsWith('licenses/') ? '.md' : null;

const config = JSON.parse(await readFile(join(root, 'ops/release-config.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+(-[a-z0-9-]+)?$/.test(config.releaseVersion)) {
  throw new Error('Ungültige Release-Version in ops/release-config.json.');
}

// Manuell erzeugte oder fremde dist-Verzeichnisse dürfen nicht gelöscht werden.
try {
  await lstat(staging);
  throw new Error('Altes .dist-staging gefunden. Bitte zuerst prüfen.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
let outputExists = false;
try {
  const existing = await lstat(output);
  if (!existing.isDirectory()) throw new Error('dist ist kein reguläres Build-Verzeichnis.');
  outputExists = true;
} catch (error) { if (error.code !== 'ENOENT') throw error; }
if (outputExists) {
  const record = await readFile(join(output, marker), 'utf8');
  if (record !== 'Erzeugt durch Würfelbund build-public.mjs\n') {
    throw new Error('dist stammt nicht nachweisbar vom Würfelbund-Build.');
  }
}

const entries = [];
async function copyAllowed(path) {
  const from = join(root, path);
  const to = join(staging, path);
  const details = await lstat(from);
  if (details.isSymbolicLink()) throw new Error(`Verlinkter Inhalt nicht erlaubt: ${path}`);
  if (details.isDirectory()) {
    await mkdir(to, { recursive: true });
    for (const name of (await readdir(from)).sort()) {
      if (name.startsWith('.')) throw new Error(`Versteckter Inhalt im Web-Bundle: ${path}/${name}`);
      await copyAllowed(`${path}/${name}`);
    }
    return;
  }
  if (!details.isFile()) throw new Error(`Kein regulärer Dateiinhalt: ${path}`);
  const extension = expectedExtension(path);
  if (extension && !path.endsWith(extension)) throw new Error(`Unbekannte öffentliche Dateiendung: ${path}`);
  const content = await readFile(from);
  await mkdir(dirname(to), { recursive: true });
  await writeFile(to, content, { flag: 'wx' });
  entries.push({ path: path.split(sep).join('/'), bytes: content.length,
    sha256: createHash('sha256').update(content).digest('hex') });
}

await mkdir(staging);
try {
  for (const path of inputs) await copyAllowed(path);
  await writeFile(join(staging, '.nojekyll'), '', { flag: 'wx' });
  await writeFile(join(staging, marker), 'Erzeugt durch Würfelbund build-public.mjs\n', { flag: 'wx' });
  await writeFile(join(staging, 'public-manifest.json'), JSON.stringify({
    project: 'Würfelbund', version: config.releaseVersion, files: entries.sort((a, b) => a.path.localeCompare(b.path)),
  }, null, 2) + '\n', { flag: 'wx' });
  if (outputExists) await rm(output, { recursive: true }); // Nur zuvor über Marker verifiziertes dist.
  await rename(staging, output);
  console.log(`Öffentliches Prüf-Bundle vorbereitet: ${entries.length} freigegebene Dateien.`);
} catch (error) {
  await rm(staging, { recursive: true, force: true }); // Eigene, gerade angelegte Staging-Kopie.
  throw error;
}
