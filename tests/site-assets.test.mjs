import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname } from 'node:path';
import { CATEGORIES, loadCategory } from '../js/rules/catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const local = name => readFileSync(resolve(root, name), 'utf8');

test('Hauptseite und Studio referenzieren nur existierende lokale Assets und Seiten', () => {
  for (const name of ['index.html', 'studio.html']) {
    const html = local(name);
    const references = [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map(match => match[1]);
    for (const ref of references) {
      if (/^(?:https?:|mailto:|data:|#|javascript:)/.test(ref) || ref.includes('${')) continue;
      const file = decodeURIComponent(ref.split(/[?#]/)[0]);
      if (!file || !extname(file)) continue;
      assert.ok(existsSync(resolve(root, file)), `${name}: ${ref} fehlt`);
    }
    const ids = [...html.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${name}: doppelte HTML-IDs`);
  }
});

test('Beide Inline-Module der Hauptseite sind syntaktisch gültig', () => {
  const scripts = [...local('index.html').matchAll(/<script\s+type="module"\s*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 2);
  for (const [index, match] of scripts.entries()) {
    const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: match[1], encoding: 'utf8' });
    assert.equal(result.status, 0, `Inline-Modul ${index + 1}: ${result.stderr}`);
  }
});

test('Jedes lokale Regel-/Studio-Modul hat gültige Syntax und existierende relative Imports', () => {
  for (const dir of ['js/rules', 'js/studio']) {
    for (const filename of readdirSync(resolve(root, dir)).filter(name => name.endsWith('.mjs'))) {
      const path = resolve(root, dir, filename);
      const source = readFileSync(path, 'utf8');
      const parsed = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
      assert.equal(parsed.status, 0, `${dir}/${filename}: ${parsed.stderr}`);
      for (const match of source.matchAll(/(?:from\s*|import\s*\()['"](\.[^'"\n]+)['"]/g)) {
        assert.ok(existsSync(resolve(root, dir, match[1])), `${filename}: Modul ${match[1]} fehlt`);
      }
    }
  }
});

test('Alle 25 SRD-Kategorien besitzen lokal parsebare Datensätze ohne Netzwerkabfrage', () => {
  const categories = Object.entries(CATEGORIES);
  assert.equal(categories.length, 25);
  for (const [name, entry] of categories) {
    const path = `data/srd-5.2.1/en/5e-SRD-${entry.file}.json`;
    const json = JSON.parse(local(path));
    assert.ok(Array.isArray(json) && json.length > 0, `${name}: leer/ungültig`);
  }
  assert.equal(JSON.parse(local('data/srd-5.2.1/en/5e-SRD-Classes.json')).length, 12);
});

test('Der Katalog lädt relativ zum Modul, teilt parallele Abrufe und kann fehlgeschlagene Abrufe wiederholen', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async url => {
      calls++;
      const path = fileURLToPath(url);
      if (calls === 1) return { ok: false, status: 503 };
      return { ok: true, json: async () => JSON.parse(readFileSync(path, 'utf8')) };
    };
    await assert.rejects(loadCategory('alignments'), /503/);
    const [a, b] = await Promise.all([loadCategory('alignments'), loadCategory('alignments')]);
    assert.equal(calls, 2);
    assert.strictEqual(a, b);
    assert.ok(a.length > 0);
  } finally { globalThis.fetch = previous; }
});
