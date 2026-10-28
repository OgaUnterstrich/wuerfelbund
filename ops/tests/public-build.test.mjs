import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { join, resolve, relative, sep, dirname } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const publicRoot = join(root, 'dist');
const manifest = JSON.parse(readFileSync(join(publicRoot, 'public-manifest.json'), 'utf8'));

function allPublicFiles(at = publicRoot) {
  return readdirSync(at).flatMap(name => {
    const path = join(at, name);
    const info = lstatSync(path);
    assert.equal(info.isSymbolicLink(), false, `Öffentlicher Symlink: ${path}`);
    return info.isDirectory() ? allPublicFiles(path) : [relative(publicRoot, path).split(sep).join('/')];
  });
}

test('Pages-Artefakt enthält nur freigegebene Dateien, keine Entwicklungs-/Secret-Pfade', () => {
  const files = allPublicFiles();
  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('studio.html'));
  assert.ok(files.includes('datenschutz.html'));
  assert.ok(files.includes('impressum.html'));
  assert.ok(files.includes('LICENSES.md'));
  assert.ok(files.includes('.nojekyll'));
  assert.ok(files.some(path => path.startsWith('data/srd-5.2.1/en/')));
  for (const name of files) {
    assert.doesNotMatch(name, /(^|\/)(node_modules|tests|ops|docs|\.github|\.firebase|\.env)(\/|$)/);
    assert.doesNotMatch(name, /(firestore\.rules|package-lock\.json|serviceAccount|private-key|\.log)$/i);
    assert.ok(name === '.nojekyll' || name === '.wuerfelbund-generated'
      || name === 'public-manifest.json' || manifest.files.some(item => item.path === name), name);
  }
  assert.equal(manifest.files.length + 3, files.length);
  for (const path of files.filter(value => /\.(html|mjs|css)$/.test(value))) {
    const text = readFileSync(join(publicRoot, path), 'utf8');
    assert.doesNotMatch(text, /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|["']private_key["']\s*:/i, path);
    assert.doesNotMatch(text, /(?:serviceAccountKey|google-services-secret)\s*[:=]/i, path);
  }
});

test('Prüfbares Inhaltsinventar nennt jede öffentliche Quelldatei exakt mit SHA-256', () => {
  assert.match(manifest.version, /^\d+\.\d+\.\d+(-[a-z0-9]+(?:[.-][a-z0-9]+)*)?$/);
  const paths = manifest.files.map(item => item.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const item of manifest.files) {
    const bytes = readFileSync(join(publicRoot, item.path));
    assert.equal(item.bytes, bytes.byteLength, item.path);
    assert.equal(item.sha256, createHash('sha256').update(bytes).digest('hex'), item.path);
  }
});

test('Anmeldung zeigt Datenhinweis, rechtliche Entwürfe sind bewusst nicht live-freigegeben', () => {
  const index = readFileSync(join(publicRoot, 'index.html'), 'utf8');
  const studio = readFileSync(join(publicRoot, 'studio.html'), 'utf8');
  const css = readFileSync(join(publicRoot, 'studio.css'), 'utf8');
  assert.match(index, /id="cloud-auth-data-hint"/);
  assert.match(index, /href="datenschutz\.html"/);
  assert.match(index, /href="impressum\.html"/);
  assert.match(studio, /href="licenses\/5e-bits-MIT\.md"/);
  assert.match(studio, /href="datenschutz\.html"/);
  assert.doesNotMatch(css, /fonts\.googleapis\.com|@import\s+url/);
  for (const page of ['datenschutz.html', 'impressum.html']) {
    const markup = readFileSync(join(publicRoot, page), 'utf8');
    assert.match(markup, /lang="de"/);
    assert.match(markup, /href="studio\.css"/);
    assert.match(markup, /RELEASE_BLOCKER/);
  }
  const config = JSON.parse(readFileSync(join(root, 'ops/release-config.json'), 'utf8'));
  const status = spawnSync(process.execPath, ['scripts/check-release-gate.mjs'], {cwd:root,encoding:'utf8'});
  if (config.publicReleaseApproved !== true) {
    assert.equal(status.status, 1);
    assert.match(status.stderr, /GESPERRT/);
  } else {
    assert.equal(status.status, 0, status.stderr);
  }
});

test('GitHub-Pages-Auslieferung wird nur manuell nach CI- und menschlichen Gates möglich', () => {
  const verify = readFileSync(join(root, '.github/workflows/verify.yml'), 'utf8');
  const release = readFileSync(join(root, '.github/workflows/pages-release.yml'), 'utf8');
  assert.match(verify, /pull_request:/);
  assert.match(verify, /npm run test:logic/);
  assert.match(verify, /npm run test:firestore/);
  assert.match(verify, /npm run test:c3:emulator/);
  assert.match(verify, /npm run test:public/);
  assert.match(release, /workflow_dispatch:/);
  assert.doesNotMatch(release, /\n\s+push:\s*\n/);
  assert.match(release, /release_confirmation == 'PUBLIC-V1-CONFIRMED'/);
  assert.match(release, /npm run check:release/);
  assert.match(release, /needs: prepare/);
  assert.match(release, /environment:\s*\n\s+name: github-pages/);
  assert.match(verify, /runs-on: ubuntu-24\.04/);
  assert.match(verify, /actions\/checkout@v7/);
  assert.match(verify, /actions\/setup-node@v7/);
  assert.match(verify, /actions\/setup-java@v6/);
  assert.match(verify, /actions\/upload-artifact@v7/);
  assert.doesNotMatch(verify, /deploy-pages|upload-pages-artifact/);
  assert.doesNotMatch(verify + release, /ubuntu-latest|actions\/setup-java@v4/);
  assert.match(release, /actions\/deploy-pages@v5/);
});

test('C3-Sicherheit: echte Staging-Tests laufen nicht automatisch auf GitHub oder im Public-Bundle', () => {
  const verify = readFileSync(join(root, '.github/workflows/verify.yml'), 'utf8');
  const release = readFileSync(join(root, '.github/workflows/pages-release.yml'), 'utf8');
  const packageInfo = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.doesNotMatch(verify + release, /WB_C3_API_KEY|test:c3:staging|staging:deploy-rules/);
  assert.match(packageInfo.scripts['test:c3:emulator'], /run-c3\.mjs emulator/);
  assert.match(packageInfo.scripts['test:c3:staging'], /run-c3\.mjs staging/);
  const runner = readFileSync(join(root, 'scripts/run-c3.mjs'), 'utf8');
  assert.match(runner, /--project', 'demo-wuerfelbund'/);
  assert.match(runner, /verifiedStagingTarget\(environment\)/);
  assert.ok(!manifest.files.some(file => file.path.startsWith('scripts/') || file.path.startsWith('tests/')));
});

test('B15: Navigationsziele, lokale Weblinks und Modulimporte existieren im öffentlichen Build', () => {
  for (const page of ['index.html', 'studio.html', 'datenschutz.html', 'impressum.html']) {
    const html = readFileSync(join(publicRoot, page), 'utf8');
    const markup = html.split(/<script\b/i)[0]; // Keine dynamischen HTML-Strings im Skript als statische Links ausgeben.
    const ids = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    for (const match of markup.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const value = match[1];
      if (/^(?:https?:|mailto:|tel:|data:)/i.test(value)) continue;
      const url = new URL(value, `https://example.invalid/${page}`);
      if (url.hostname !== 'example.invalid') continue;
      const path = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      assert.ok(existsSync(join(publicRoot, path)), `${page} → fehlende Ressource ${value}`);
      if (url.hash && path === page) {
        const id = decodeURIComponent(url.hash.slice(1));
        assert.ok(ids.has(id), `${page} → fehlender Anker #${id}`);
      }
    }
  }
  for (const path of allPublicFiles().filter(value => value.endsWith('.mjs'))) {
    const source = readFileSync(join(publicRoot, path), 'utf8');
    for (const match of source.matchAll(/\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]|\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      const specifier = match[1] || match[2];
      assert.ok(existsSync(resolve(publicRoot, dirname(path), specifier)), `${path} → fehlender Import ${specifier}`);
    }
  }
});

test('B15: Einsteigerwege behalten benannte Aktionen statt dekorativer Scheinbedienung', () => {
  const index = readFileSync(join(publicRoot, 'index.html'), 'utf8');
  const studio = readFileSync(join(publicRoot, 'studio.html'), 'utf8');
  const css = readFileSync(join(publicRoot, 'studio.css'), 'utf8');
  for (const [page, html] of [['Startseite', index], ['Studio', studio]]) {
    assert.match(html, /<main\b/, `${page}: Hauptinhalt fehlt`);
    assert.match(html, /lang="de"/, `${page}: Sprache fehlt`);
    const ids = [...html.split(/<script\b/i)[0].matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${page}: doppelte IDs`);
  }
  assert.match(index, /id="cloud-auth-dialog"/);
  assert.match(studio, /id="character-mode-build"/);
  assert.match(studio, /id="character-mode-play"/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(index + studio + css, /lorem ipsum|\b(?:fake metrics|coming soon card)\b/i);
});

test('B15: alle ausgelieferten JS-Module einschließlich Inline-Skripten sind syntaktisch gültig', () => {
  for (const path of allPublicFiles().filter(value => value.endsWith('.mjs'))) {
    const check = spawnSync(process.execPath, ['--check', join(publicRoot, path)], { encoding: 'utf8' });
    assert.equal(check.status, 0, `${path}: ${check.stderr}`);
  }
  for (const page of ['index.html', 'studio.html', 'datenschutz.html', 'impressum.html']) {
    const html = readFileSync(join(publicRoot, page), 'utf8');
    for (const match of html.matchAll(/<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/gi)) {
      const source = match[1].trim();
      if (!source) continue;
      const check = spawnSync(process.execPath, ['--input-type=module', '--check'],
        { input: source, encoding: 'utf8' });
      assert.equal(check.status, 0, `${page}: ${check.stderr}`);
    }
  }
});
