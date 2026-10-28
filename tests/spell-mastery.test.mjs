import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCategory } from '../js/rules/catalog.mjs';
import { getSpellMastery } from '../js/rules/dnd55.mjs';

globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')) });

const book = ['magic-missile', 'mirror-image', 'shield', 'misty-step', 'detect-magic', 'invisibility'];
const context = async options => ({ classId: 'wizard', level: 18,
  spells: await loadCategory('spells'), spellbook: book, ...options });

test('Wizard 18: ein Aktionszauber Grad 1 und einer Grad 2 werden zusätzlich vorbereitet', async () => {
  const input = await context();
  const choices = getSpellMastery(input);
  assert.equal(choices.missing, 2);
  assert.ok(choices.available[1].some(spell => spell.index === 'magic-missile'));
  assert.ok(choices.available[2].some(spell => spell.index === 'mirror-image'));
  const valid = getSpellMastery({ ...input, mastery: ['magic-missile', 'mirror-image'] });
  assert.equal(valid.missing, 0);
  assert.deepEqual(valid.chosen.map(spell => spell.index), ['magic-missile', 'mirror-image']);
});

test('Spell Mastery: keine Reaktionen, Bonusaktionen, falschen Grade oder fremden Buchzauber', async () => {
  const input = await context();
  for (const mastery of [
    ['shield', 'mirror-image'], ['magic-missile', 'misty-step'],
    ['mirror-image', 'magic-missile'], ['unknown-spell', 'mirror-image'],
  ]) assert.throws(() => getSpellMastery({ ...input, mastery }), /Spell Mastery/);
  assert.throws(() => getSpellMastery({ ...input, spellbook: ['mirror-image'],
    mastery: ['magic-missile', 'mirror-image'] }), /Zauber muss im Buch/);
  assert.throws(() => getSpellMastery({ ...input, mastery: ['magic-missile'] }), /Spell-Mastery-Daten/);
});

test('Spell Mastery ab 18, und nur für Magier; normale Vorbereitung zählt separat', async () => {
  const input = await context();
  assert.equal(getSpellMastery({ ...input, level: 17 }).missing, 0);
  assert.deepEqual(getSpellMastery({ ...input, level: 17 }).available, { 1: [], 2: [] });
  assert.throws(() => getSpellMastery({ ...input, level: 17,
    mastery: ['magic-missile', 'mirror-image'] }), /Spell Mastery/);
  assert.throws(() => getSpellMastery({ ...input, classId: 'bard',
    mastery: ['magic-missile', 'mirror-image'] }), /Spell Mastery/);
  assert.throws(() => getSpellMastery({ ...input, prepared: ['magic-missile'],
    mastery: ['magic-missile', 'mirror-image'] }), /regulär vorbereitet/);
});

test('Weltmodule sperren auch Spell Mastery; andere Welten behalten ihre SRD-Auswahl', async () => {
  const input = await context();
  assert.equal(getSpellMastery({ ...input, mastery: ['magic-missile', 'mirror-image'] }).missing, 0);
  assert.throws(() => getSpellMastery({ ...input,
    excludedIds: ['magic-missile'], mastery: ['magic-missile', 'mirror-image'] }), /Spell Mastery/);
  assert.ok(!getSpellMastery({ ...input, excludedIds: ['magic-missile'] }).available[1]
    .some(spell => spell.index === 'magic-missile'));
});

test('Wizard 1–20: Spell Mastery erst auf 18 aktiviert, mit immer zwei Grad-Feldern', async () => {
  const input = await context();
  for (let level = 1; level <= 20; level++) {
    const result = getSpellMastery({ ...input, level });
    assert.equal(result.missing, level >= 18 ? 2 : 0);
    assert.ok(result.available[1].every(spell => spell.level === 1 && spell.casting_time === 'Action'));
    assert.ok(result.available[2].every(spell => spell.level === 2 && spell.casting_time === 'Action'));
  }
});

test('UI verwendet vorhandene Zauberliste; keine zweite Komponente oder Datenquelle', async () => {
  const ui = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  assert.match(ui, /getSpellMastery/);
  assert.match(ui, /mastery1/);
  assert.match(ui, /mastery2/);
  assert.match(ui, /checkCharacterSpells\(values, summary\)/);
  assert.match(ui, /mastery\.missing/);
});
