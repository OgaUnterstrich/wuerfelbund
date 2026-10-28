import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getCharacterTrackerSummary } from '../js/rules/character-actions.mjs';
import { normalizeResourceTracker, restResourceTracker } from '../js/rules/dnd55.mjs';
import { classSpellSources, getCastableSpells, castSelectedSpell,
  getSpellDamageReference } from '../js/rules/casting.mjs';
import { EDRAS_FORBIDDEN_SPELLS } from '../js/rules/edras.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../data/srd-5.2.1/en/5e-SRD-${name}.json`, import.meta.url), 'utf8'));
const data = Promise.all(['Classes', 'Levels', 'Spells'].map(load));
const abilities = { str: 16, dex: 16, con: 16, int: 18, wis: 18, cha: 18 };
const wizardSpells = { cantrips: ['mage-hand'], spellbook: ['magic-missile'], prepared: ['magic-missile'] };
const vitals = { maxHp: 65, level: 10, hitDie: 8, conModifier: 3 };

async function setup(history, spells = {}, spellsByClass = {}, extra = {}) {
  const [classes, levels, spellCatalog] = await data;
  const profile = { ruleset: 'srd-5.2.1', classId: history[0], level: history.length,
    attributes: abilities, levelHistory: history, spells, spellsByClass, ...extra };
  const summary = getCharacterTrackerSummary({ id: 'test', name: 'Test', level: history.length, profile }, { classes, levels });
  const args = { profile, summary, spellCatalog, classCatalog: classes, levelRows: levels };
  return { profile, summary, spellCatalog, classes, levels, args,
    list: () => getCastableSpells(args),
    cast: (spellId, modeId) => castSelectedSpell({ ...args,
      vitalContext: { ...vitals, level: history.length }, spellId, modeId }) };
}

test('B09: Charakterchronik erzeugt genau eine eindeutige Zauberquelle pro echter Klasse', () => {
  const wizard = { classId: 'wizard', level: 2, spells: wizardSpells };
  assert.deepEqual(classSpellSources(wizard).map(item => [item.id, item.level]), [['wizard', 2]]);
  const multi = { ...wizard, level: 4, levelHistory: ['wizard', 'cleric', 'wizard', 'cleric'],
    spellsByClass: { cleric: { prepared: ['cure-wounds'] } } };
  assert.deepEqual(classSpellSources(multi).map(item => [item.id, item.level]), [['wizard', 2], ['cleric', 2]]);
  assert.throws(() => classSpellSources({ ...multi, spellsByClass: { rogue: {} } }), /zusätzliche Klassenzauber/);
  assert.throws(() => classSpellSources({ ...multi, spellsByClass: { wizard: {} } }), /zusätzliche Klassenzauber/);
  assert.throws(() => classSpellSources({ ...multi, levelHistory: ['cleric', 'wizard', 'wizard', 'cleric'] }), /Stufenchronik/);
});

test('B09: Cleric 9/Wizard 1 – eigene Vorbereitungen, gemeinsame höhere Slots, Upcasting und Ressourcen', async () => {
  const c = await setup([...Array(9).fill('cleric'), 'wizard'],
    { prepared: ['cure-wounds'] }, { wizard: wizardSpells });
  assert.equal(c.summary.spellcasting.slots.at(-1).level, 5);
  const missile = c.list().find(spell => spell.id === 'magic-missile');
  assert.ok(missile.modes.some(mode => mode.id === 'slot:5'));
  const after = c.cast('magic-missile', 'slot:5').tracker;
  assert.equal(after.slots[5], c.summary.spellcasting.slots.at(-1).max - 1);
  assert.equal(after.slots[1], c.summary.spellcasting.slots[0].max);
  assert.ok(c.list().find(spell => spell.id === 'cure-wounds'));
  c.profile.spellsByClass.wizard = { ...wizardSpells, prepared: ['fireball'], spellbook: ['fireball'] };
  assert.throws(() => c.list(), /Vorbereitete Zauber|Zauberbuch/);
});

test('B09: Zweitklassen-Magier zaubert Rituale allein aus dem eigenen Zauberbuch', async () => {
  const c = await setup(['fighter', 'fighter', 'wizard'], {}, { wizard: {
    spellbook: ['detect-magic'], prepared: [], cantrips: ['mage-hand'],
  } });
  const detect = c.list().find(spell => spell.id === 'detect-magic');
  assert.deepEqual(detect.modes.map(mode => mode.id), ['ritual']);
  assert.deepEqual(c.cast('detect-magic', 'ritual').tracker, normalizeResourceTracker(c.summary));
});

test('B09: Paktmagie als Zweitklasse – getrennte Zähler, gemeinsame Verwendung, kurze Rast', async () => {
  const c = await setup([...Array(3).fill('cleric'), ...Array(5).fill('warlock')],
    { prepared: ['cure-wounds'] }, { warlock: { prepared: ['hex'], cantrips: ['eldritch-blast'] } });
  const hex = c.list().find(spell => spell.id === 'hex');
  assert.ok(hex.modes.some(mode => mode.id === 'slot:1'));
  assert.ok(hex.modes.some(mode => mode.id === 'pact:3'));
  const used = c.cast('hex', 'pact:3').tracker;
  assert.equal(used.resources['warlock:pact-3'], 1);
  assert.equal(used.slots[1], c.summary.spellcasting.slots[0].max);
  assert.equal(restResourceTracker(c.summary, used, 'short').resources['warlock:pact-3'], 2);
  const normal = c.cast('hex', 'slot:1').tracker;
  assert.equal(normal.slots[1], c.summary.spellcasting.slots[0].max - 1);
  assert.equal(normal.resources['warlock:pact-3'], 2);
});

test('B09: Arkanum gilt nach Warlock-Klassenstufe, nicht Gesamtstufe', async () => {
  const c = await setup(['fighter', ...Array(11).fill('warlock')], {}, { warlock: {
    prepared: ['hex'], arcanum: ['eyebite', '', '', ''],
  } });
  const eyebite = c.list().find(spell => spell.id === 'eyebite');
  assert.ok(eyebite.modes.some(mode => mode.id === 'arcanum:6'));
  assert.equal(c.cast('eyebite', 'arcanum:6').tracker.resources['warlock:arcanum_6'], 0);
  c.profile.levelHistory = ['fighter', ...Array(10).fill('warlock'), 'fighter'];
  assert.throws(() => c.list(), /Mystic Arcanum/);
});

test('B09: Bard Magical Secrets auch als zweite Klasse, Quelle wird separat geprüft', async () => {
  const c = await setup(['fighter', ...Array(10).fill('bard')], {}, { bard: {
    prepared: ['healing-word'], secrets: ['revivify'],
  } });
  assert.ok(c.list().find(spell => spell.id === 'revivify').modes.some(mode => mode.id === 'slot:3'));
  c.profile.spellsByClass.bard.secrets = ['wish'];
  assert.throws(() => c.list(), /Magical Secrets/);
});

test('B09: Edras-Sperren wirken auch bei Zweitklassenzaubern, andere Welten bleiben offen', async () => {
  const c = await setup(['fighter', ...Array(5).fill('cleric')], {}, { cleric: { prepared: ['revivify', 'cure-wounds'] } });
  assert.ok(c.list().some(spell => spell.id === 'revivify'));
  const edras = { ...c.args, excludedIds: EDRAS_FORBIDDEN_SPELLS };
  assert.ok(!getCastableSpells(edras).some(spell => spell.id === 'revivify'));
  assert.ok(getCastableSpells(edras).some(spell => spell.id === 'cure-wounds'));
  assert.throws(() => castSelectedSpell({ ...edras, vitalContext: vitals,
    spellId: 'revivify', modeId: 'slot:3' }), /nicht gültig/);
});

test('B09: Manipulierte Zweitklassenauswahl kann weder Fremdzauber noch Zukunftszauber wirken', async () => {
  const c = await setup(['fighter', 'wizard'], {}, { wizard: wizardSpells });
  c.profile.spellsByClass.wizard.prepared = ['cure-wounds'];
  assert.throws(() => c.list(), /Vorbereitete Zauber/);
  c.profile.spellsByClass.wizard.prepared = ['magic-missile'];
  c.profile.spellsByClass.wizard.spellbook = ['magic-missile', 'fireball'];
  assert.throws(() => c.cast('fireball', 'slot:3'), /Zauberbuch/);
});

test('B09: SRD-Schadensreferenz würfelt nur belegte Formel; Skalierung und Heilung bleiben manuell', async () => {
  const [,, spells] = await data;
  const find = id => spells.find(spell => spell.index === id);
  assert.deepEqual(getSpellDamageReference({ spell: find('fireball'), modeId: 'slot:3', characterLevel: 5 }),
    { formula: '8d6', type: 'Fire', manual: false });
  assert.equal(getSpellDamageReference({ spell: find('fireball'), modeId: 'slot:4', characterLevel: 7 }).formula, null);
  assert.equal(getSpellDamageReference({ spell: find('fire-bolt'), modeId: 'cantrip', characterLevel: 1 }).formula, '1d10');
  assert.equal(getSpellDamageReference({ spell: find('fire-bolt'), modeId: 'cantrip', characterLevel: 5 }).formula, null);
  assert.equal(getSpellDamageReference({ spell: find('cure-wounds'), modeId: 'slot:1', characterLevel: 1 }).formula, null);
  assert.throws(() => getSpellDamageReference({ spell: find('fireball'), modeId: '', characterLevel: 21 }), /Schadensreferenz/);
});

test('B09: UI speichert Zweitklassenwahl, öffnet sie wieder und zeigt je Klasse Angriffe', async () => {
  const [ui, html] = await Promise.all([
    readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../studio.html', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="character-secondary-spells"/);
  for (const piece of ['readSecondarySpellSelections()', 'renderSecondarySpellOptions(false, profile.spellsByClass || {})',
    'checkSecondaryCharacterSpells(values)', 'classCatalog: characterData.classes',
    'getSpellDamageReference(', 'id: `spell-${source.classId}`', 'section.open = openPanels.has(id)',
    "modeSelect.addEventListener('change', updateCastHint)"]) {
    assert.ok(ui.includes(piece), `Fehlende UI-Verbindung: ${piece}`);
  }
});

test('B09: Zwölf SRD-Klassen – bestehender Slot- und Zweitklassenadapter bleibt bei Randstufen gültig', async () => {
  const [classes] = await data;
  let checks = 0;
  for (const klass of classes.filter(entry => entry.index !== 'fighter')) {
    for (const secondLevel of [1, 5, 11, 19]) {
      const history = ['fighter', ...Array(secondLevel).fill(klass.index)];
      const c = await setup(history);
      const list = c.list();
      assert.equal(new Set(list.map(entry => entry.id)).size, list.length);
      assert.equal(classSpellSources(c.profile).find(entry => entry.id === klass.index).level, secondLevel);
      checks++;
    }
  }
  assert.equal(checks, 44);
});
