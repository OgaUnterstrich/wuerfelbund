import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCategory } from '../js/rules/catalog.mjs';
import { getAutomaticSpells, getClassLevelSummary, getMagicalDiscoveries } from '../js/rules/dnd55.mjs';
import { EDRAS_FORBIDDEN_SPELLS } from '../js/rules/edras.mjs';

globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')) });

const source = async () => {
  const [classes, levels, spells] = await Promise.all([
    loadCategory('classes'), loadCategory('levels'), loadCategory('spells'),
  ]);
  const bard = classes.find(entry => entry.index === 'bard');
  const choices = (level, options = {}) => getMagicalDiscoveries({
    summary: getClassLevelSummary(levels, bard, level), classId: 'bard',
    subclassId: 'college-of-lore', level, spells, ...options,
  });
  const highestSlot = level => Math.max(0, ...getClassLevelSummary(levels, bard, level)
    .spellcasting.slots.map(slot => slot.level));
  return { spells, choices, highestSlot };
};

test('College of Lore: genau zwei kostenlose Zauber ab Bard 6, darunter Zaubertricks', async () => {
  const { choices } = await source();
  assert.deepEqual(choices(5).available, []);
  assert.equal(choices(5).missing, 0);
  const options = choices(6);
  assert.equal(options.missing, 2);
  assert.ok(options.available.some(spell => spell.index === 'guidance' && spell.level === 0));
  assert.ok(options.available.some(spell => spell.index === 'fireball' && spell.level === 3));
  assert.ok(!options.available.some(spell => spell.index === 'cone-of-cold'));
  assert.ok(!options.available.some(spell => spell.index === 'eldritch-blast'));
  const completed = choices(6, { selected: ['guidance', 'fireball'] });
  assert.equal(completed.missing, 0);
  assert.deepEqual(completed.chosen.map(spell => spell.index), ['guidance', 'fireball']);
});

test('College of Lore: doppelte, fremde und zu hochstufige Zauber werden abgewiesen', async () => {
  const { choices } = await source();
  for (const selected of [
    ['guidance', 'guidance'], ['fireball', 'guidance', 'shield'],
    ['cone-of-cold'], ['eldritch-blast'], ['__falscher__'],
  ]) assert.throws(() => choices(6, { selected }), /Magical Discoveries/);
  assert.throws(() => choices(5, { selected: ['guidance'] }), /Magical Discoveries/);
  assert.throws(() => choices(6, { selected: ['guidance'], cantrips: ['guidance'] }), /nicht doppelt/);
  assert.throws(() => choices(6, { selected: ['shield'], prepared: ['shield'] }), /nicht doppelt/);
  assert.equal(choices(6, { selected: ['shield'] }).missing, 1);
  assert.equal(choices(6, { subclassId: '', selected: [] }).missing, 0);
  assert.throws(() => choices(6, { subclassId: '', selected: ['shield'] }), /Magical Discoveries/);
});

test('Edras blockiert verbotene Entdeckungen; normale Kampagnen dürfen sie wählen', async () => {
  const { choices } = await source();
  assert.ok(choices(6).available.some(spell => spell.index === 'revivify'));
  const edras = choices(6, { excludedIds: EDRAS_FORBIDDEN_SPELLS });
  assert.ok(!edras.available.some(spell => spell.index === 'revivify'));
  assert.throws(() => choices(6, { selected: ['revivify'], excludedIds: EDRAS_FORBIDDEN_SPELLS }), /unzulässige/);
  assert.equal(choices(6, { selected: ['revivify'] }).missing, 1);
});

test('Bard 20: Words of Creation gibt Power Word Heal/Kill zusätzlich und niemals vor Stufe 20', async () => {
  const { spells } = await source();
  assert.ok(!getAutomaticSpells({ classId: 'bard', level: 19, spells }).granted.length);
  const granted = getAutomaticSpells({ classId: 'bard', level: 20, spells }).granted;
  assert.deepEqual(granted.map(spell => spell.id), ['power-word-heal', 'power-word-kill']);
  const excluded = getAutomaticSpells({ classId: 'bard', level: 20, spells, excludedIds: ['power-word-kill'] });
  assert.deepEqual(excluded.granted.map(spell => spell.id), ['power-word-heal']);
  assert.deepEqual(excluded.blocked.map(spell => spell.id), ['power-word-kill']);
});

test('Bard 1–20: Entdeckungen sind erst ab Stufe 6 möglich und entsprechen verfügbaren Zauberplätzen', async () => {
  const { choices, highestSlot } = await source();
  for (let level = 1; level <= 20; level++) {
    const options = choices(level);
    assert.equal(options.missing, level >= 6 ? 2 : 0);
    assert.ok(options.available.every(spell => spell.level >= 0 && spell.level <= highestSlot(level)));
    if (level < 6) assert.equal(options.available.length, 0);
    else {
      const ids = options.available.slice(0, 2).map(spell => spell.index);
      assert.equal(choices(level, { selected: ids }).missing, 0);
    }
  }
});

test('Magical Discoveries bleibt Teil des normalen gespeicherten Charakterprofils', async () => {
  const html = await readFile(new URL('../studio.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  assert.match(html, /id="character-spell-options"/);
  assert.match(script, /getMagicalDiscoveries/);
  assert.match(script, /discoveries: checked\('discoveries'\)/);
  assert.match(script, /makeGroup\(section, 'discoveries', 'Magical Discoveries'/);
  assert.match(script, /missing.*Magical Discoveries/);
});
