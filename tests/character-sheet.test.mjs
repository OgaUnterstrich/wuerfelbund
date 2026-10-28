import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCharacterSheet } from '../js/rules/character-sheet.mjs';
import { getCharacterVitalContext } from '../js/rules/character-actions.mjs';
import { getStartingProficiencies, proficiencyBonus, abilityModifier } from '../js/rules/dnd55.mjs';
import { applyVitals } from '../js/rules/vitals.mjs';

const root = new URL('../data/srd-5.2.1/en/', import.meta.url);
const categories = { classes: 'Classes', species: 'Species', backgrounds: 'Backgrounds',
  subclasses: 'Subclasses', subspecies: 'Subspecies', levels: 'Levels', feats: 'Feats',
  traits: 'Traits', skills: 'Skills', spells: 'Spells', languages: 'Languages',
  proficiencies: 'Proficiencies', equipment: 'Equipment', features: 'Features' };
const catalog = Promise.all(Object.entries(categories).map(async ([id, file]) => [id,
  JSON.parse(await readFile(new URL(`5e-SRD-${file}.json`, root), 'utf8'))]))
  .then(Object.fromEntries);
const attributes = { str: 16, dex: 14, con: 14, int: 16, wis: 16, cha: 16 };
function hero(classId, level, history) {
  return { name: `${classId} ${level}`, id: 'sheet-test', level, profile: {
    ruleset: 'srd-5.2.1', classId, speciesId: 'human', backgroundId: 'criminal',
    originChoices: { languages: ['elvish', 'dwarvish'] }, attributes,
    ...(history ? { levelHistory: history } : {}),
  } };
}

test('B11: Kampffigur, Vollzauberer und Halbzauberer auf Stufe 1/8/20 zeigen autoritative TP und Modifikatoren', async () => {
  const data = await catalog;
  for (const classId of ['fighter', 'wizard', 'paladin']) for (const level of [1, 8, 20]) {
    const character = hero(classId, level);
    const sheet = buildCharacterSheet(character, data);
    const context = getCharacterVitalContext(character, data);
    const klass = data.classes.find(entry => entry.index === classId);
    const background = data.backgrounds.find(entry => entry.index === 'criminal');
    const training = getStartingProficiencies({ classEntry: klass, background, skills: data.skills,
      attributes, level });
    assert.equal(sheet.maxHp, context.maxHp, `${classId} ${level} TP`);
    assert.equal(sheet.armorClass, context.armorClass);
    assert.equal(sheet.speed, context.speed);
    assert.equal(sheet.proficiencyBonus, proficiencyBonus(level));
    assert.equal(sheet.initiative, abilityModifier(attributes.dex) + proficiencyBonus(level), 'Criminal: Alert');
    assert.deepEqual(sheet.skills, training.skills);
    assert.deepEqual(sheet.savingThrows, training.savingThrows);
    assert.equal(sheet.attributes.length, 6);
    assert.equal(sheet.skills.length, 18);
    assert.equal(sheet.savingThrows.length, 6);
    assert.ok(sheet.features.length >= 1);
    assert.ok(sheet.features.some(feature => feature.description), 'SRD-Klassenmerkmale haben Regeltext');
    assert.equal(sheet.classNames[0].level, level);
    assert.equal(sheet.spellcasting.length, classId === 'fighter' ? 0 : 1,
      '2024-Paladin erhält Zauberwirken bereits auf Stufe 1');
    if (sheet.spellcasting.length) {
      const spell = sheet.spellcasting[0];
      assert.equal(spell.saveDC, spell.attackBonus + 8);
    }
  }
});

test('B11: jede der zwölf SRD-Klassen Stufe 1/8/20 hat konsistenten und lesbaren Spielbogen', async () => {
  const data = await catalog;
  let count = 0;
  for (const klass of data.classes) for (const level of [1, 8, 20]) {
    const character = hero(klass.index, level);
    const sheet = buildCharacterSheet(character, data);
    assert.equal(sheet.maxHp, getCharacterVitalContext(character, data).maxHp);
    assert.equal(sheet.skills.length, 18);
    assert.ok(sheet.ancestry.length >= 1);
    assert.ok(sheet.chosenFeats.some(feat => feat.id === 'alert' && feat.source === 'Herkunft'));
    assert.ok(sheet.warnings.every(message => typeof message === 'string'));
    count++;
  }
  assert.equal(count, 36);
});

test('B11: Multiclass zeigt beide echte Klassenstufen, getrennte Zauberangriffe und nur Startklassen-Rettungen', async () => {
  const data = await catalog;
  const history = ['wizard', 'wizard', 'paladin', 'paladin', 'paladin', 'paladin', 'fighter', 'fighter'];
  const character = hero('wizard', 8, history);
  const sheet = buildCharacterSheet(character, data);
  assert.deepEqual(sheet.classNames.map(row => [row.id, row.level]), [['wizard', 2], ['paladin', 4], ['fighter', 2]]);
  assert.deepEqual(sheet.spellcasting.map(row => row.classId), ['wizard', 'paladin']);
  assert.equal(sheet.spellcasting[0].level, 2);
  assert.equal(sheet.spellcasting[1].level, 4);
  assert.equal(sheet.maxHp, getCharacterVitalContext(character, data).maxHp);
  const wizardSaves = data.classes.find(entry => entry.index === 'wizard').saving_throws.map(item => item.index);
  assert.deepEqual(sheet.savingThrows.filter(item => item.trained).map(item => item.id).sort(), wizardSaves.sort());
  assert.ok(sheet.features.some(feature => feature.source === 'Wizard'));
  assert.ok(sheet.features.some(feature => feature.source === 'Paladin'));
});

test('B11: Schaden, Zustandsmalus, Speicherung und Herkunftswechsel spiegeln sich im Lesemodell', async () => {
  const data = await catalog;
  const old = hero('fighter', 8);
  const initial = buildCharacterSheet(old, data);
  const context = getCharacterVitalContext(old, data);
  const injured = applyVitals(context, {}, 'damage', { amount: 7 });
  const updated = { ...old, profile: { ...old.profile, vitals: { ...injured, exhaustion: 2 } } };
  const restored = JSON.parse(JSON.stringify(updated));
  const changed = buildCharacterSheet(restored, data);
  assert.equal(changed.hp, initial.maxHp - 7);
  assert.equal(changed.passivePerception, initial.passivePerception - 4);
  assert.equal(changed.maxHp, initial.maxHp);
  const other = { ...old, profile: { ...old.profile, backgroundId: 'soldier' } };
  const soldier = buildCharacterSheet(other, data);
  assert.equal(soldier.initiative, abilityModifier(attributes.dex), 'kein Alert vom alten Hintergrund');
  const edras = buildCharacterSheet({ ...old, profile: { ...old.profile,
    edras: { potential: 3, techniqueId: 'projectile' } } }, data);
  assert.equal(edras.world, 'Edras (optional)');
  assert.deepEqual(edras.savingThrows, initial.savingThrows, 'Edras überschreibt keine D&D-Rettungswürfe');
  assert.equal(edras.maxHp, initial.maxHp);
});

test('B11: ungültige Regelbasis, fehlende Quellen und kaputte Klassenchronik werden nicht als Echtwerte dargestellt', async () => {
  const data = await catalog;
  assert.throws(() => buildCharacterSheet({}, data), /gültig/);
  assert.throws(() => buildCharacterSheet({ ...hero('fighter', 1), profile: {
    ...hero('fighter', 1).profile, ruleset: 'other' } }, data), /gültig/);
  assert.throws(() => buildCharacterSheet(hero('invented', 1), data), /Klasse/);
  assert.throws(() => buildCharacterSheet(hero('fighter', 3, ['fighter', 'wizard']), data), /Stufenchronik/);
});

test('B11: Erstellen und Spielen sind echte getrennte Ansichten ohne doppelte IDs und mit Fokus-/Mobilregeln', async () => {
  const html = await readFile(new URL('../studio.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../studio.css', import.meta.url), 'utf8');
  const main = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'statische IDs eindeutig');
  for (const id of ['character-design', 'character-play', 'character-mode-build', 'character-mode-play',
    'tracker-sheet', 'tracker-vitals', 'tracker-casting', 'tracker-inventory', 'tracker-list']) assert.ok(ids.includes(id));
  assert.match(html, /id="character-play"[^>]*hidden/);
  assert.match(main, /setCharacterMode\('play', \{ focus: true \}\)/);
  assert.match(main, /setCharacterMode\('build', \{ focus: true \}\)/);
  assert.match(css, /@media\(max-width:370px\)/);
  assert.match(css, /\.character-mode-button:focus-visible/);
  assert.match(css, /\.tracker-pane \.tracker-row button\{min-width:44px\}/);
});
