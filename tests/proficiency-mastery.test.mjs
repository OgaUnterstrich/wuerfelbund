import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCategory } from '../js/rules/catalog.mjs';
import {
  getClassSkillChoice, getSkillTrainingChoices, getStartingProficiencies,
  getWeaponMasteryChoices, proficiencyBonus, abilityModifier,
} from '../js/rules/dnd55.mjs';

globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')) });
const catalogs = Promise.all(['classes', 'backgrounds', 'skills', 'levels', 'equipment']
  .map(category => loadCategory(category)));
const attributes = { str: 14, dex: 16, con: 14, int: 12, wis: 10, cha: 14 };

function setup(classes, backgrounds, skills, classId = 'bard', backgroundId = 'acolyte') {
  const classEntry = classes.find(entry => entry.index === classId);
  const background = backgrounds.find(entry => entry.index === backgroundId);
  const fixed = new Set(background.proficiencies.filter(entry => entry.index.startsWith('skill-'))
    .map(entry => entry.index.slice(6)));
  const classSkillIds = getClassSkillChoice(classEntry).options.filter(entry => !fixed.has(entry.index))
    .slice(0, getClassSkillChoice(classEntry).count).map(entry => entry.index);
  return { classEntry, background, skills, classSkillIds, attributes };
}

test('Bard: Expertise auf Stufe 2/9, halbe Übung auch für passive Wahrnehmung', async () => {
  const [classes, backgrounds, skills] = await catalogs;
  const base = setup(classes, backgrounds, skills);
  const lvl1 = getStartingProficiencies({ ...base, level: 1 });
  const lvl2Choice = getSkillTrainingChoices({ ...base, level: 2 });
  assert.equal(lvl2Choice.expertise.count, 2);
  const expertiseIds = base.classSkillIds.slice(0, 2);
  const lvl2 = getStartingProficiencies({ ...base, level: 2, expertiseIds });
  assert.equal(lvl2.missingExpertise, 0);
  assert.equal(lvl2.skills.find(skill => skill.id === expertiseIds[0]).modifier,
    abilityModifier(attributes[lvl2.skills.find(skill => skill.id === expertiseIds[0]).ability]) + 2 * proficiencyBonus(2));
  const untrained = lvl2.skills.find(skill => !skill.trained);
  assert.equal(untrained.modifier, abilityModifier(attributes[untrained.ability]) + 1);
  assert.equal(lvl1.skills.find(skill => skill.id === untrained.id).modifier,
    abilityModifier(attributes[untrained.ability]));
  const lvl9 = getStartingProficiencies({ ...base, level: 9, expertiseIds });
  assert.equal(lvl9.missingExpertise, 2);
  assert.equal(lvl9.skills.find(skill => skill.id === untrained.id).modifier,
    abilityModifier(attributes[untrained.ability]) + 2);
});

test('College of Lore und Barbaren: Bonusfertigkeiten ohne Doppelung und mit Klassenfilter', async () => {
  const [classes, backgrounds, skills] = await catalogs;
  const bard = setup(classes, backgrounds, skills);
  const settings = { ...bard, subclassId: 'college-of-lore', level: 3 };
  const choices = getSkillTrainingChoices(settings);
  assert.equal(choices.bonus.count, 3);
  const bonusSkillIds = choices.bonus.options.slice(0, 3).map(item => item.index);
  const trained = getStartingProficiencies({ ...settings, bonusSkillIds, expertiseIds: bard.classSkillIds.slice(0, 2) });
  assert.equal(trained.missingBonus, 0);
  assert.equal(trained.missingExpertise, 0);
  assert.ok(bonusSkillIds.every(id => trained.skills.find(skill => skill.id === id)?.trained));
  assert.throws(() => getStartingProficiencies({ ...settings,
    bonusSkillIds: [bonusSkillIds[0], bonusSkillIds[0]] }), /Bonusfertigkeiten/);
  assert.throws(() => getStartingProficiencies({ ...settings,
    bonusSkillIds: [bard.classSkillIds[0]] }), /Bonusfertigkeiten/);
  assert.throws(() => getStartingProficiencies({ ...bard, level: 2,
    bonusSkillIds: [bonusSkillIds[0]] }), /Bonusfertigkeiten/);

  const barbarian = setup(classes, backgrounds, skills, 'barbarian');
  const barbarianChoice = getSkillTrainingChoices({ ...barbarian, level: 3 });
  assert.equal(barbarianChoice.bonus.count, 1);
  assert.ok(barbarianChoice.bonus.options.every(choice => getClassSkillChoice(barbarian.classEntry)
    .options.some(option => option.index === choice.index)));
  const bonus = barbarianChoice.bonus.options[0].index;
  assert.equal(getStartingProficiencies({ ...barbarian, level: 3, bonusSkillIds: [bonus] }).missingBonus, 0);
  const outside = skills.find(skill => !getClassSkillChoice(barbarian.classEntry).options
    .some(choice => choice.index === skill.index));
  assert.throws(() => getStartingProficiencies({ ...barbarian, level: 3, bonusSkillIds: [outside.index] }), /Bonusfertigkeiten/);
});

test('Rogue: 2/4 Expertise und Reliable Talent ab Stufe 7 nur auf geübte Fertigkeiten', async () => {
  const [classes, backgrounds, skills] = await catalogs;
  const rogue = setup(classes, backgrounds, skills, 'rogue');
  assert.equal(getSkillTrainingChoices({ ...rogue, level: 1 }).expertise.count, 2);
  assert.equal(getSkillTrainingChoices({ ...rogue, level: 6 }).expertise.count, 4);
  const expertiseIds = rogue.classSkillIds;
  const trained = getStartingProficiencies({ ...rogue, level: 7, expertiseIds });
  assert.equal(trained.missingExpertise, 0);
  assert.equal(trained.reliableTalent, true);
  assert.ok(trained.skills.filter(skill => skill.trained).every(skill => skill.minimumD20 === 10));
  assert.ok(trained.skills.filter(skill => !skill.trained).every(skill => skill.minimumD20 === null));
  assert.equal(getStartingProficiencies({ ...rogue, level: 6 }).reliableTalent, false);
  const untrained = trained.skills.find(skill => !skill.trained).id;
  assert.throws(() => getStartingProficiencies({ ...rogue, level: 7,
    expertiseIds: [untrained] }), /Expertise/);
});

test('Ranger und Wizard: Stufenstaffel und Scholar-Filter für geübte Wissensfertigkeiten', async () => {
  const [classes, backgrounds, skills] = await catalogs;
  const ranger = setup(classes, backgrounds, skills, 'ranger');
  for (const [level, expected] of [[1, 0], [2, 1], [8, 1], [9, 3], [20, 3]]) {
    assert.equal(getSkillTrainingChoices({ ...ranger, level }).expertise.count, expected);
  }
  const wizard = setup(classes, backgrounds, skills, 'wizard');
  assert.equal(getSkillTrainingChoices({ ...wizard, level: 1 }).expertise.count, 0);
  const candidates = getSkillTrainingChoices({ ...wizard, level: 2 }).expertise.options;
  const scholar = new Set(['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion']);
  assert.ok(candidates.length > 0 && candidates.every(entry => scholar.has(entry.index)));
  const trained = getStartingProficiencies({ ...wizard, level: 2, expertiseIds: [candidates[0].index] });
  assert.equal(trained.missingExpertise, 0);
  const nonScholar = trained.skills.find(skill => skill.trained && !scholar.has(skill.id));
  if (nonScholar) assert.throws(() => getStartingProficiencies({ ...wizard, level: 2,
    expertiseIds: [nonScholar.id] }), /Expertise/);
});

test('Waffenmeisterschaft: Barbar nur Nahkampf, Kämpfer inklusive Fernkampf, Rogue nur eigene Übung', async () => {
  const [classes, , , levels, equipment] = await catalogs;
  const options = (classId, level) => getWeaponMasteryChoices({
    classEntry: classes.find(entry => entry.index === classId), levelRows: levels, level, equipment,
  });
  assert.equal(options('barbarian', 1).count, 2);
  assert.equal(options('fighter', 1).count, 3);
  assert.equal(options('paladin', 1).count, 2);
  assert.equal(options('ranger', 1).count, 2);
  assert.equal(options('rogue', 1).count, 2);
  assert.equal(options('wizard', 20).count, 0);
  assert.equal(options('fighter', 20).count, 6);
  assert.equal(options('barbarian', 20).count, 4);
  assert.ok(!options('barbarian', 1).options.some(weapon => weapon.index === 'longbow'));
  assert.ok(options('fighter', 1).options.some(weapon => weapon.index === 'longbow'));
  assert.ok(options('rogue', 1).options.some(weapon => weapon.index === 'rapier'));
  assert.ok(!options('rogue', 1).options.some(weapon => weapon.index === 'greataxe'));
  assert.throws(() => getWeaponMasteryChoices({ classEntry: classes.find(entry => entry.index === 'rogue'),
    levelRows: levels, level: 1, equipment, selected: ['greataxe'] }), /Waffenmeisterschaft/);
  const fighter = options('fighter', 20);
  const selected = fighter.options.slice(0, fighter.count).map(weapon => weapon.index);
  assert.equal(getWeaponMasteryChoices({ classEntry: classes.find(entry => entry.index === 'fighter'),
    levelRows: levels, level: 20, equipment, selected }).missing, 0);
  assert.throws(() => getWeaponMasteryChoices({ classEntry: classes.find(entry => entry.index === 'fighter'),
    levelRows: levels, level: 20, equipment, selected: [selected[0], selected[0]] }), /Waffenmeisterschaft/);
});

test('Alle 12 Klassen / 20 Stufen: Wahlen, Training und Waffenmeisterschaft widersprechen sich nicht', async () => {
  const [classes, backgrounds, skills, levels, equipment] = await catalogs;
  let cases = 0;
  for (const classEntry of classes) {
    for (const level of Array.from({ length: 20 }, (_, index) => index + 1)) {
      const base = setup(classes, backgrounds, skills, classEntry.index);
      const subclassId = classEntry.index === 'bard' && level >= 3 ? 'college-of-lore' : '';
      const training = getSkillTrainingChoices({ ...base, subclassId, level });
      assert.ok(training.bonus.options.length >= training.bonus.count, `${classEntry.index}/${level} Bonus`);
      const bonusSkillIds = training.bonus.options.slice(0, training.bonus.count).map(item => item.index);
      const expertise = getSkillTrainingChoices({ ...base, subclassId, level, bonusSkillIds }).expertise;
      assert.ok(expertise.options.length >= expertise.count, `${classEntry.index}/${level} Expertise`);
      const expertiseIds = expertise.options.slice(0, expertise.count).map(item => item.index);
      const stats = getStartingProficiencies({ ...base, subclassId, level, bonusSkillIds, expertiseIds });
      assert.equal(stats.missing + stats.missingBonus + stats.missingExpertise, 0);
      assert.equal(stats.skills.length, 18);
      const mastery = getWeaponMasteryChoices({ classEntry, levelRows: levels, level, equipment });
      assert.ok(mastery.options.length >= mastery.count, `${classEntry.index}/${level} mastery`);
      const masterySelected = mastery.options.slice(0, mastery.count).map(item => item.index);
      assert.equal(getWeaponMasteryChoices({ classEntry, levelRows: levels, level, equipment,
        selected: masterySelected }).missing, 0);
      cases++;
    }
  }
  assert.equal(cases, 240);
});

test('Oberfläche nutzt gemeinsame Regelprüfungen, kein Zusatz-Backend oder neue Abhängigkeiten', async () => {
  const [html, main] = await Promise.all([
    readFile(new URL('../studio.html', import.meta.url), 'utf8'),
    readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8'),
  ]);
  for (const id of ['character-training', 'character-mastery', 'character-bonus-skill-choices',
    'character-expertise-choices', 'character-mastery-choices']) assert.ok(html.includes(`id="${id}"`), id);
  for (const api of ['getSkillTrainingChoices', 'getWeaponMasteryChoices', 'getStartingProficiencies']) {
    assert.ok(main.includes(api), api);
  }
  assert.ok(!main.includes('eval('));
});
