import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('../studio.html', import.meta.url), 'utf8');
const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
const characterActions = readFileSync(new URL('../js/rules/character-actions.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../studio.css', import.meta.url), 'utf8');

test('alle Sprungziele der Charakterfehlermeldungen existieren', () => {
  const ids = new Set([...page.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const targets = [...main.matchAll(/target:\s*'#([\w-]+)'/g)].map(match => match[1]);
  assert.ok(targets.length >= 6);
  for (const target of targets) assert.ok(ids.has(target), `Fehlerziel fehlt: ${target}`);
});

test('Charaktereditor hat nur eindeutige IDs und eine fokussierbare Fehlerliste', () => {
  const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(page, /id="character-errors"[^>]*tabindex="-1"/);
  assert.match(main, /box\.focus\(\{ preventScroll: true \}\)/);
});

test('B07: SRD-Entscheidungen und Zweitunterklassen verwenden bestehendes Charakterformular', () => {
  for (const id of ['character-secondary-subclasses', 'character-secondary-subclass-list',
    'character-source-decisions', 'character-source-decision-list', 'character-source-decision-count']) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  assert.match(main, /classFeatures: getClassFeatureSelection\(\)/);
  assert.match(main, /restoreSourceDecisions\(profile\.classFeatures\?\.decisions\)/);
  assert.match(main, /'secondarySubclasses'/);
  assert.match(main, /validateClassDecisions\(/);
  assert.match(main, /additionalSavingThrows: effects\.savingThrows/);
  assert.match(main, /additionalProficiencies: \[\.\.\.\(multi\?\.proficiencies \|\| \[\]\), \.\.\.effects\.proficiencies\]/);
});

test('Hauptweg zur 5.5e-Erstellung bleibt eindeutig', () => {
  assert.match(home, /href="studio\.html#characters"[^>]*>[\s\S]*?5\.5e-Held erstellen/);
  assert.match(home, /Kurzprofil hinzufügen/);
  assert.match(home, /Einzelne Charaktere können im Kampagnenbereich (manuell|ausdrücklich) hochgeladen/);
  assert.match(home, /Nur der geöffnete Cloud-Spielmodus überträgt Änderungen seiner Figurenressourcen live/);
});

test('Vorschau meldet nicht jede Eingabe vollständig an Screenreader', () => {
  assert.doesNotMatch(page, /id="character-preview"[^>]*aria-live/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
});

test('manuelle Fähigkeiten verlangen keine unsichtbare Würfelformel', () => {
  assert.match(main, /\$\('#ability-value'\)\.required = !isManual/);
});

test('Trefferpunktwahlen sind sichtbar, im Charakterprofil enthalten und lassen inaktive Eingaben aus', () => {
  assert.match(page, /id="character-hitpoints"/);
  assert.match(page, /id="character-hp-roll-missing"/);
  assert.match(main, /hitPoints: readHitPointChoices\(\)/);
  assert.match(main, /getCharacterVitalContext\(/);
  assert.match(characterActions, /hitPoints: profile\.hitPoints/);
  assert.match(main, /input\.disabled = !active \|\| !rolled/);
});

test('Spielstandimport ist vor Ersetzung validiert und hat Wiederherstellung mit sichtbarem Status', () => {
  assert.match(home, /id="restore-data"/);
  assert.match(home, /id="backup-status"[^>]*role="status"/);
  assert.match(home, /validateGameImport\(JSON\.parse\(await f\.text\(\)\)\)/);
  assert.match(home, /saveImportedGame\(next,localStorage\)/);
  assert.match(home, /restoreImportedGame\(localStorage\)/);
  assert.match(home, /resetSavedGame\(localStorage\)/);
});
