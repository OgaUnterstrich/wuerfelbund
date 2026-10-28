import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCategory } from '../js/rules/catalog.mjs';
import { wildShapeOptions, classDecisionOptions, validateClassDecisions,
  getSubclassResources, getClassDecisionEffects } from '../js/rules/class-decisions.mjs';
import { getCharacterTrackerSummary, getCharacterVitalContext, applyCharacterAction } from '../js/rules/character-actions.mjs';
import { getCastableSpells } from '../js/rules/casting.mjs';
import { getStartingProficiencies } from '../js/rules/dnd55.mjs';
import { getWeaponProfile } from '../js/rules/gear.mjs';
import { emptyGame, validateGameImport } from '../js/rules/characters.mjs';
import { prepareCloudCharacter } from '../js/rules/cloud-characters.mjs';

globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')) });
const data = Promise.all(['classes', 'subclasses', 'levels', 'spells', 'monsters', 'languages',
  'backgrounds', 'skills', 'equipment', 'species', 'subspecies', 'traits', 'feats', 'proficiencies'].map(loadCategory))
  .then(([classes, subclasses, levels, spells, monsters, languages, backgrounds, skills,
    equipment, species, subspecies, traits, feats, proficiencies]) => ({ classes, subclasses,
    levels, spells, monsters, languages, backgrounds, skills, equipment, species,
    subspecies, traits, feats, proficiencies }));
const attributes = { str: 16, dex: 14, con: 14, int: 14, wis: 16, cha: 16 };
const optionsFor = (catalog, classId, level, subclassId = '') => ({
  classLevels: { [classId]: level }, subclasses: { [classId]: subclassId },
  levels: catalog.levels, spells: catalog.spells, languages: catalog.languages, monsters: catalog.monsters,
});
const firstChoices = options => Object.fromEntries(options.map(group => [group.id,
  group.count ? group.options.slice(0, group.count).map(option => option.id) : group.options[0]?.id]));

test('B07: zwölf SRD-Klassen und zwölf Unterklassen: jede Stufe 1–20 deterministische Entscheidungen', async () => {
  const catalog = await data;
  assert.equal(catalog.classes.length, 12);
  assert.equal(catalog.subclasses.length, 12);
  for (const klass of catalog.classes) {
    const subclass = catalog.subclasses.find(entry => entry.class?.index === klass.index);
    assert.ok(subclass, klass.index);
    for (let level = 1; level <= 20; level++) {
      const args = optionsFor(catalog, klass.index, level, level >= 3 ? subclass.index : '');
      const base = classDecisionOptions(args);
      const choices = firstChoices(base);
      if (choices['cleric-divine-order'] === 'thaumaturge') choices['cleric-divine-order-extra-cantrip'] =
        catalog.spells.find(spell => spell.level === 0 && spell.classes?.some(item => item.index === 'cleric')).index;
      if (choices['druid-primal-order'] === 'magician') choices['druid-primal-order-extra-cantrip'] =
        catalog.spells.find(spell => spell.level === 0 && spell.classes?.some(item => item.index === 'druid')).index;
      const check = validateClassDecisions({ ...args, choices, strict: true });
      assert.equal(check.missing, 0, `${klass.index}/${level}`);
      assert.ok(base.every(group => group.options.length >= (group.count || 1)), `${klass.index}/${level}`);
    }
  }
});

test('B07: Entscheidungen erscheinen an den korrekten Quellenstufen und nur bei Unterklassen', async () => {
  const c = await data;
  const pairs = [
    ['cleric', 'cleric-divine-order', 1, ''], ['cleric', 'cleric-blessed-strikes', 7, ''],
    ['druid', 'druid-primal-order', 1, ''], ['druid', 'druid-elemental-fury', 7, ''],
    ['ranger', 'hunter-hunters-prey', 3, 'hunter'], ['ranger', 'hunter-defensive-tactics', 7, 'hunter'],
    ['sorcerer', 'draconic-sorcery-elemental-affinity', 6, 'draconic-sorcery'],
    ['warlock', 'fiend-patron-fiendish-resilience', 10, 'fiend-patron'],
    ['rogue', 'rogue-thieves-cant-language', 1, ''], ['druid', 'druid-wild-shape-forms', 2, ''],
  ];
  for (const [klass, feature, at, subclass] of pairs) {
    assert.ok(!classDecisionOptions(optionsFor(c, klass, at - 1, subclass)).some(group => group.id === feature), feature);
    assert.ok(classDecisionOptions(optionsFor(c, klass, at, subclass)).some(group => group.id === feature), feature);
    if (subclass) assert.ok(!classDecisionOptions(optionsFor(c, klass, at)).some(group => group.id === feature));
  }
});

test('B07: Pflicht-, Doppel-, fremde und noch nicht verfügbare Wahlen werden abgewiesen', async () => {
  const c = await data;
  const cleric = optionsFor(c, 'cleric', 7);
  assert.throws(() => validateClassDecisions({ ...cleric, strict: true }), /fehlen/);
  assert.throws(() => validateClassDecisions({ ...cleric,
    choices: { 'cleric-divine-order': 'not-an-order' } }), /ungültige Wahl/);
  assert.throws(() => validateClassDecisions({ ...cleric,
    choices: { 'hunter-hunters-prey': 'colossus-slayer' } }), /Nicht freigeschaltete/);
  const rogue = optionsFor(c, 'rogue', 1);
  assert.throws(() => validateClassDecisions({ ...rogue, knownLanguages: ['elvish'],
    choices: { 'rogue-thieves-cant-language': 'elvish' } }), /noch nicht bekannte/);
  assert.equal(validateClassDecisions({ ...rogue, choices: { 'rogue-thieves-cant-language': 'draconic' },
    strict: true }).missing, 0);
  assert.equal(validateClassDecisions({ ...rogue, choices: { 'rogue-thieves-cant-language': 'abyssal' },
    strict: true }).missing, 0);
  assert.throws(() => validateClassDecisions({ ...rogue, choices: { 'rogue-thieves-cant-language': 'druidic' } }), /ungültige Wahl/);
  const cantrip = c.spells.find(spell => spell.level === 0 && spell.classes?.some(item => item.index === 'cleric')).index;
  assert.equal(validateClassDecisions({ ...cleric, choices: {
    'cleric-divine-order': 'thaumaturge', 'cleric-divine-order-extra-cantrip': cantrip,
    'cleric-blessed-strikes': 'divine-strike',
  }, strict: true }).extraCantrips[0], cantrip);
  assert.throws(() => validateClassDecisions({ ...cleric, choices: {
    'cleric-divine-order': 'protector', 'cleric-divine-order-extra-cantrip': cantrip,
  } }), /Nicht freigeschaltete/);
  assert.throws(() => validateClassDecisions({ ...cleric, choices: {
    'cleric-divine-order': 'thaumaturge', 'cleric-divine-order-extra-cantrip': cantrip,
  }, knownCantrips: [cantrip] }), /ungültige Wahl/);
});

test('B07: Tiergestalt in vier, sechs, acht bekannte SRD-Beasts, HG/Fliegen und Eindeutigkeit', async () => {
  const c = await data;
  for (const [level, count, maxCr, allowFly] of [[1, 0, 0, false], [2, 4, .25, false],
    [4, 6, .5, false], [8, 8, 1, true]]) {
    const result = wildShapeOptions(c.monsters, level);
    assert.equal(result.count, count);
    assert.equal(result.maxCr, maxCr);
    assert.equal(result.allowFly, allowFly);
    assert.ok(result.options.every(option => {
      const monster = c.monsters.find(item => item.index === option.id);
      return monster.type === 'beast' && monster.challenge_rating <= maxCr && (allowFly || !monster.speed?.fly);
    }));
  }
  const args = optionsFor(c, 'druid', 2);
  const valid = wildShapeOptions(c.monsters, 2).options.slice(0, 4).map(entry => entry.id);
  assert.throws(() => validateClassDecisions({ ...args, choices: { 'druid-wild-shape-forms': [valid[0], valid[0]] } }), /ungültige Tierformenwahl/);
  assert.throws(() => validateClassDecisions({ ...args, choices: { 'druid-wild-shape-forms': [c.monsters.find(m => m.type === 'dragon').index] } }), /ungültige Tierformenwahl/);
  assert.equal(validateClassDecisions({ ...args, choices: {
    'druid-primal-order': 'warden', 'druid-wild-shape-forms': valid }, strict: true }).missing, 0);
});

test('B07: Klassenwirkungen nur auf passender Stufe, Waffen/Rüstung, Rettungswürfe und Zaubertricks', async () => {
  const c = await data;
  const cleric = getClassDecisionEffects({ choices: { 'cleric-divine-order': 'protector' },
    classLevels: { cleric: 1 }, levels: c.levels });
  assert.deepEqual(cleric.proficiencies, ['martial-weapons', 'heavy-armor']);
  const clericProfile = { ruleset: 'srd-5.2.1', classId: 'cleric', level: 1,
    speciesId: c.species[0].index, backgroundId: c.backgrounds[0].index,
    attributes, armorId: 'chain-mail', hitPoints: { method: 'fixed' },
    classFeatures: { decisions: { 'cleric-divine-order': 'protector' } },
    inventory: { items: { greataxe: 1 } } };
  assert.equal(getCharacterVitalContext({ level: 1, profile: clericProfile }, c).untrainedArmor, false);
  assert.equal(getCharacterVitalContext({ level: 1, profile: { ...clericProfile,
    classFeatures: {} } }, c).untrainedArmor, true);
  const greataxe = getWeaponProfile({ profile: clericProfile,
    classEntry: c.classes.find(entry => entry.index === 'cleric'),
    equipment: c.equipment, weaponId: 'greataxe', additionalProficiencies: cleric.proficiencies });
  assert.equal(greataxe.trained, true);
  assert.deepEqual(getClassDecisionEffects({ choices: { 'druid-primal-order': 'warden' },
    classLevels: { druid: 1 }, levels: c.levels }).proficiencies, ['martial-weapons', 'medium-armor']);
  assert.deepEqual(getClassDecisionEffects({ choices: {}, classLevels: { rogue: 14 }, levels: c.levels }).savingThrows, []);
  assert.deepEqual(getClassDecisionEffects({ choices: {}, classLevels: { rogue: 15 }, levels: c.levels }).savingThrows, ['wis', 'cha']);
  const klass = c.classes.find(entry => entry.index === 'rogue');
  const options = { classEntry: klass, background: c.backgrounds[0], skills: c.skills,
    attributes, level: 15, classLevel: 15 };
  const saves = getStartingProficiencies({ ...options, additionalSavingThrows: ['wis', 'cha'] });
  assert.equal(saves.savingThrows.find(entry => entry.id === 'wis').trained, true);
  assert.equal(saves.savingThrows.find(entry => entry.id === 'cha').trained, true);
  const extra = c.spells.find(spell => spell.level === 0 && spell.classes?.some(entry => entry.index === 'cleric'));
  const profile = { classId: 'cleric', level: 1, subclassId: '', spells: { cantrips: [], prepared: [] },
    classFeatures: { decisions: { 'cleric-divine-order': 'thaumaturge',
      'cleric-divine-order-extra-cantrip': extra.index } } };
  const summary = { spellcasting: { slots: [{ level: 1, max: 2 }] }, resources: [] };
  assert.ok(getCastableSpells({ profile, summary, spellCatalog: c.spells })
    .find(spell => spell.id === extra.index)?.modes.some(mode => mode.id === 'cantrip'));
});

test('B07: Unterklassenressourcen folgen Quellenfreischaltung, WIS/CHA-Maxima und Rast', async () => {
  const c = await data;
  const variants = [
    ['barbarian', 'path-of-the-berserker', 'berserker-intimidating-presence', 14, 1],
    ['druid', 'circle-of-the-land', 'land-natural-recovery', 6, 2],
    ['monk', 'warrior-of-the-open-hand', 'open-hand-wholeness-of-body', 6, 3],
    ['paladin', 'oath-of-devotion', 'devotion-holy-nimbus', 20, 1],
    ['sorcerer', 'draconic-sorcery', 'draconic-sorcery-dragon-companion', 18, 1],
    ['warlock', 'fiend-patron', 'fiend-patron-dark-ones-own-luck', 6, 3],
  ];
  for (const [id, subclassId, feature, level, count] of variants) {
    const at = current => getSubclassResources({ classLevels: { [id]: current },
      subclasses: { [id]: subclassId }, levels: c.levels, attributes });
    assert.ok(!at(level - 1).some(item => item.id.includes(feature)), feature);
    const resources = at(level).filter(item => item.id.includes(feature));
    assert.equal(resources.length, count === 2 ? 2 : 1, feature);
    assert.equal(resources[0].max, count === 2 ? 1 : count, feature);
    assert.ok(resources.every(item => item.shortRest === 'none'));
    assert.ok(!getSubclassResources({ classLevels: { [id]: level }, levels: c.levels,
      attributes }).some(item => item.id.includes(feature)), feature);
  }
  const character = { level: 6, profile: { ruleset: 'srd-5.2.1', classId: 'warlock',
    speciesId: c.species[0].index, backgroundId: c.backgrounds[0].index,
    subclassId: 'fiend-patron', attributes, hitPoints: { method: 'fixed' }, level: 6 } };
  const summary = getCharacterTrackerSummary(character, c);
  const resource = summary.resources.find(entry => entry.id === 'warlock:fiend-patron-dark-ones-own-luck');
  assert.equal(resource.max, 3);
  const spent = applyCharacterAction(character, c, { type: 'resource', group: 'resources',
    id: resource.id, delta: -1 });
  assert.equal(spent.profile.tracker.resources[resource.id], 2);
  const restored = applyCharacterAction(spent, c, { type: 'rest', name: 'long' });
  assert.equal(restored.profile.tracker.resources[resource.id], 3);
});

test('B07: sekundäre Unterklasse, Multi-Chronik, alter Profilimport und Cloud-Roundtrip ohne weitere Datenkopie', async () => {
  const c = await data;
  const history = ['fighter', 'fighter', 'fighter', 'cleric', 'cleric', 'cleric', 'cleric'];
  const choices = { 'cleric-divine-order': 'protector' };
  const args = { classLevels: { fighter: 3, cleric: 4 },
    subclasses: { fighter: 'champion', cleric: 'life-domain' }, levels: c.levels,
    languages: c.languages, spells: c.spells, monsters: c.monsters };
  assert.equal(validateClassDecisions({ ...args, choices, strict: true }).missing, 0);
  const profile = { ruleset: 'srd-5.2.1', classId: 'fighter', subclassId: 'champion',
    levelHistory: history, secondarySubclasses: { cleric: 'life-domain' }, attributes,
    classFeatures: { fightingStyles: [], styleCantrips: [], metamagic: [], invocations: [], decisions: choices } };
  const game = { ...emptyGame(), characters: [{ id: 'b07', name: 'Test', level: 7, profile }] };
  const restored = validateGameImport(JSON.parse(JSON.stringify(game)));
  assert.deepEqual(restored.characters[0].profile.secondarySubclasses, profile.secondarySubclasses);
  const cloud = prepareCloudCharacter(restored.characters[0], 'abc123');
  assert.deepEqual(cloud.profile.classFeatures.decisions, choices);
  const secondaryWarlock = { level: 9, profile: { ruleset: 'srd-5.2.1', classId: 'fighter',
    subclassId: 'champion', secondarySubclasses: { warlock: 'fiend-patron' },
    levelHistory: ['fighter', 'fighter', 'fighter', ...Array(6).fill('warlock')], attributes } };
  assert.ok(getCharacterTrackerSummary(secondaryWarlock, c).resources
    .some(entry => entry.id === 'warlock:fiend-patron-dark-ones-own-luck' && entry.max === 3));
  assert.ok(!getCharacterTrackerSummary({ ...secondaryWarlock, profile: {
    ...secondaryWarlock.profile, secondarySubclasses: { warlock: '' },
  } }, c).resources.some(entry => entry.id === 'warlock:fiend-patron-dark-ones-own-luck'));
  const original = { ...profile, levelHistory: undefined, secondarySubclasses: undefined,
    classFeatures: { fightingStyles: [], styleCantrips: [], metamagic: [], invocations: [] } };
  assert.equal(getCharacterTrackerSummary({ level: 3, profile: { ...original, classId: 'fighter' } }, c)
    .resources.some(entry => entry.id.startsWith('fighter:')), false);
});
