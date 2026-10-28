import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCategory } from '../js/rules/catalog.mjs';
import { normalizeLevelHistory, classLevelsAt, multiclassImprovementLevels,
  multiclassRequirements, multiclassHitPoints, multiclassSpellcasting, summarizeMulticlass } from '../js/rules/multiclass.mjs';
import { applyVitals, normalizeVitals } from '../js/rules/vitals.mjs';
import { getCharacterTrackerSummary, getCharacterVitalContext, applyCharacterAction } from '../js/rules/character-actions.mjs';
import { getCastableSpells, castSelectedSpell } from '../js/rules/casting.mjs';
import { getAbilityImprovementLevels } from '../js/rules/dnd55.mjs';
import { emptyGame, validateGameImport, saveImportedGame, readGame } from '../js/rules/characters.mjs';
import { prepareCloudCharacter, mergeCloudCharacter } from '../js/rules/cloud-characters.mjs';

globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')) });
const catalog = Promise.all(['classes', 'levels'].map(loadCategory));
const stats = { str: 16, dex: 15, con: 14, int: 14, wis: 16, cha: 16 };
const repeat = (id, count) => Array(count).fill(id);

test('B06: Historie 1–20 und rückwärtskompatible reine Klasse', async () => {
  const [classes] = await catalog;
  for (const level of [1, 3, 5, 8, 11, 17, 20]) {
    assert.deepEqual(normalizeLevelHistory('fighter', level, undefined, classes), repeat('fighter', level));
    const history = normalizeLevelHistory('fighter', level,
      [ ...repeat('fighter', Math.max(1, level - 1)), ...(level > 1 ? ['rogue'] : []) ], classes);
    assert.equal(history.length, level);
    if (level > 1) assert.equal(classLevelsAt(history).at(-1).classLevel, 1);
  }
  assert.throws(() => normalizeLevelHistory('fighter', 3, ['rogue', 'fighter', 'rogue'], classes), /erste Klasse/);
  assert.throws(() => normalizeLevelHistory('fighter', 3, ['fighter', 'rogue'], classes), /Stufenchronik/);
  assert.throws(() => normalizeLevelHistory('fighter', 21, undefined, classes), /Gesamtstufe/);
});

test('B06: alle zwölf Klassen als Erst- und Zweitklasse; offizielle 13er-Voraussetzungen', async () => {
  const [classes] = await catalog;
  assert.equal(classes.length, 12);
  for (const start of classes) for (const next of classes) {
    if (start.index === next.index) continue;
    assert.doesNotThrow(() => multiclassRequirements([start.index, next.index], classes, stats));
  }
  const low = { ...stats, str: 12, dex: 12, wis: 12 };
  assert.throws(() => multiclassRequirements(['fighter', 'monk'], classes, low), /Attributsvoraussetzungen/);
  assert.throws(() => multiclassRequirements(['monk', 'fighter'], classes, low), /Attributsvoraussetzungen/);
  assert.doesNotThrow(() => multiclassRequirements(['fighter', 'wizard'], classes, { ...stats, str: 12, dex: 14 }));
  assert.throws(() => multiclassRequirements(['fighter', 'wizard'], classes, stats,
    { 2: { ...stats, int: 12 } }), /Gesamtstufe 2/);
});

test('B06: nur die tatsächlich genommenen Klassenstufen gewähren Verbesserungen', async () => {
  const [classes, rows] = await catalog;
  for (const klass of classes) {
    assert.deepEqual(multiclassImprovementLevels(repeat(klass.index, 20), rows),
      getAbilityImprovementLevels(rows, klass.index, 20));
  }
  assert.deepEqual(multiclassImprovementLevels(['fighter', 'fighter', 'fighter', 'fighter', 'rogue', 'rogue', 'rogue', 'rogue'], rows), [4, 8]);
  assert.deepEqual(multiclassImprovementLevels(['fighter', 'fighter', 'rogue', 'rogue', 'fighter', 'fighter', 'fighter', 'fighter'], rows), [6, 8]);
  assert.deepEqual(multiclassImprovementLevels(repeat('fighter', 20), rows), [4, 6, 8, 12, 14, 16, 19]);
});

test('B06: TP erster Gesamtstufe maximal; spätere Klasse je W; KON rückwirkend; Rollengrenzen', async () => {
  const [classes] = await catalog;
  const hist = ['fighter', 'fighter', 'wizard', 'wizard', 'barbarian'];
  const hp = multiclassHitPoints(hist, classes, stats);
  assert.deepEqual(hp.hitDice, { 6: 2, 10: 2, 12: 1 });
  assert.equal(hp.maxHp, (10 + 2) + (6 + 2) + (4 + 2) + (4 + 2) + (7 + 2));
  assert.equal(multiclassHitPoints(hist, classes, { ...stats, con: 16 }).maxHp, hp.maxHp + 5);
  const partial = multiclassHitPoints(hist, classes, stats, { method: 'rolled', rolls: [1, 6, 3, 12] });
  assert.equal(partial.missing.length, 0);
  assert.equal(partial.maxHp, 12 + 3 + 8 + 5 + 14);
  assert.deepEqual(multiclassHitPoints(hist, classes, stats, { method: 'rolled', rolls: [11] }).missing, [2, 3, 4, 5]);
});

test('B06: Voll-/Halbzauberer und Paktmagie getrennt, Multiclass-Wirkerstufe nach SRD', async () => {
  const [classes, rows] = await catalog;
  const spells = count => multiclassSpellcasting(count, classes, rows, stats);
  const rangerSorcerer = spells({ ranger: 4, sorcerer: 3 });
  assert.equal(rangerSorcerer.effectiveLevel, 5);
  assert.deepEqual(rangerSorcerer.slots, [{ level: 1, max: 4 }, { level: 2, max: 3 }, { level: 3, max: 2 }]);
  const paladinWizard = spells({ paladin: 1, wizard: 3 });
  assert.equal(paladinWizard.effectiveLevel, 4);
  assert.deepEqual(paladinWizard.slots.map(slot => slot.max), [4, 3]);
  const highLevelDip = spells({ fighter: 17, wizard: 1 });
  assert.equal(highLevelDip.perClass.wizard.saveDC, 8 + 6 + 2);
  const pact = spells({ warlock: 5, cleric: 3 });
  assert.deepEqual(pact.slots.map(slot => slot.max), [4, 2]);
  assert.deepEqual(pact.pactSlots, [{ level: 3, max: 2 }]);
  assert.equal(spells({ warlock: 5, fighter: 4 }).slots.length, 0);
  assert.deepEqual(spells({ ranger: 3, fighter: 4 }).slots, [{ level: 1, max: 3 }]);
  assert.deepEqual(spells({ wizard: 20 }).slots.at(-1), { level: 9, max: 1 });
});

test('B06: Zweitklasse erhält nur Multiclass-Übungen, nicht neue Rettungswürfe; Ressourcen je Klasse', async () => {
  const [classes, rows] = await catalog;
  const summary = summarizeMulticlass({ classId: 'wizard', level: 5,
    history: ['wizard', 'fighter', 'fighter', 'rogue', 'wizard'], classes, rows, attributes: stats });
  assert.deepEqual(summary.classLevels, { wizard: 2, fighter: 2, rogue: 1 });
  assert.equal(summary.proficiencyBonus, 3);
  assert.ok(summary.proficiencies.includes('saving-throw-int'));
  assert.ok(!summary.proficiencies.includes('saving-throw-str'));
  assert.ok(summary.proficiencies.includes('medium-armor'));
  assert.ok(summary.additionalChoices.some(x => x.classId === 'rogue'));
  assert.ok(summary.resources.some(x => x.id === 'fighter:action_surge'));
  assert.ok(summary.resources.every(x => !x.id.includes('wizard:action_surge')));
});

test('B06: Trefferwürfel werden je Würfeltyp verbraucht, nicht beliebig aus einem falschen Pool', () => {
  const ctx = { maxHp: 60, level: 5, hitDie: 10, hitDice: { 10: 2, 6: 3 }, conModifier: 2 };
  let state = normalizeVitals(ctx, { hp: 25 });
  assert.deepEqual(state.hitDiceSpentByDie, { 6: 0, 10: 0 });
  for (let i = 0; i < 2; i++) state = applyVitals(ctx, state, 'hitDie', { die: 10, roll: 3 });
  assert.deepEqual(state.hitDiceSpentByDie, { 6: 0, 10: 2 });
  assert.throws(() => applyVitals(ctx, state, 'hitDie', { die: 10, roll: 4 }), /keine Trefferwürfel/);
  state = applyVitals(ctx, state, 'hitDie', { die: 6, roll: 4 });
  assert.equal(state.hitDiceSpent, 3);
  assert.deepEqual(applyVitals(ctx, state, 'longRest').hitDiceSpentByDie, { 6: 0, 10: 0 });
});

test('B06: Charakteraktion mit Gruppenressourcen bleibt von falschen Einzelklassenwerten isoliert', async () => {
  const [classes, levels] = await catalog;
  const character = { id: 'c', name: 'Mehrklassenfigur', level: 5, profile: {
    ruleset: 'srd-5.2.1', classId: 'wizard', attributes: stats,
    levelHistory: ['wizard', 'wizard', 'fighter', 'fighter', 'fighter'], hitPoints: { method: 'fixed' },
  } };
  const summary = getCharacterTrackerSummary(character, { classes, levels });
  assert.deepEqual(summary.spellcasting.slots, [{ level: 1, max: 3 }]);
  assert.ok(summary.resources.some(item => item.id === 'fighter:action_surge'));
  const next = applyCharacterAction(character, { classes, levels },
    { type: 'resource', group: 'resources', id: 'fighter:action_surge', delta: -1 });
  assert.equal(next.profile.tracker.resources['fighter:action_surge'], 0);
  assert.equal(character.profile.tracker, undefined);
});

test('B06: lokale Trefferwürfelkontexte verwenden gemischte Klassen statt die W der Startklasse', async () => {
  const [classes, levels] = await catalog;
  const [races, backgrounds, equipment, subspecies, traits, feats, skills, languages, proficiencies] = await Promise.all(
    ['species', 'backgrounds', 'equipment', 'subspecies', 'traits', 'feats', 'skills', 'languages', 'proficiencies'].map(loadCategory));
  const character = { id: 'c', name: 'Chronik', level: 2, profile: {
    ruleset: 'srd-5.2.1', classId: 'fighter', levelHistory: ['fighter', 'wizard'],
    attributes: stats, speciesId: 'human', backgroundId: 'acolyte',
    hitPoints: { method: 'fixed' },
    originChoices: { languages: ['elvish', 'dwarvish'], versatileFeatId: 'skilled' },
  } };
  const ctx = getCharacterVitalContext(character, { classes, levels, species: races, backgrounds, equipment,
    subspecies, traits, feats, skills, languages, proficiencies });
  assert.deepEqual(ctx.hitDice, { 10: 1, 6: 1 });
  assert.equal(ctx.hitDie, 10);
  assert.equal(ctx.level, 2);
});

test('B06: Warlock-Paktplätze mit Zweitklasse bleiben spielbar und getrennt verbrauchbar', async () => {
  const [classes, levels] = await catalog;
  const spells = await loadCategory('spells');
  const profile = { ruleset: 'srd-5.2.1', classId: 'warlock', level: 5,
    levelHistory: ['warlock', 'warlock', 'warlock', 'cleric', 'cleric'],
    attributes: stats, spells: { prepared: ['hex'] } };
  const character = { id: 'cast', name: 'Paktmagie', level: 5, profile };
  const summary = getCharacterTrackerSummary(character, { classes, levels });
  assert.deepEqual(summary.spellcasting.slots, [{ level: 1, max: 3 }]);
  assert.ok(summary.resources.some(item => item.id === 'warlock:pact-2' && item.max === 2));
  const available = getCastableSpells({ profile, summary, spellCatalog: spells });
  const hex = available.find(entry => entry.id === 'hex');
  assert.ok(hex.modes.some(mode => mode.id === 'pact:2'));
  assert.ok(hex.modes.some(mode => mode.id === 'slot:1'));
  const next = castSelectedSpell({ profile, summary, spellCatalog: spells,
    vitalContext: { maxHp: 20, level: 5, hitDie: 8 }, spellId: 'hex', modeId: 'pact:2' });
  assert.equal(next.tracker.resources['warlock:pact-2'], 1);
  assert.equal(next.tracker.slots[1], 3);
  assert.equal(next.vitals.concentrating, true);
});

test('B06: nur Klassenniveau schaltet Magier-Unterklassen, Zauberbuch-Rituale und Arkanum frei', async () => {
  const [classes, levels] = await catalog;
  const spells = await loadCategory('spells');
  const profile = { ruleset: 'srd-5.2.1', classId: 'wizard', level: 20,
    levelHistory: ['wizard', ...repeat('cleric', 19)],
    attributes: stats, subclassId: 'evoker', spells: { spellbook: ['wish'] } };
  const summary = getCharacterTrackerSummary({ level: 20, profile }, { classes, levels });
  const available = getCastableSpells({ profile, summary, spellCatalog: spells });
  assert.ok(!available.some(entry => entry.id === 'wish'));
  assert.ok(!available.some(entry => entry.modes.some(mode => mode.id.startsWith('signature:'))));
});

test('B06: Mehrklassen- und Trefferwürfeldaten überleben Export/Import und Cloud-Roundtrip', async () => {
  const [classes, levels] = await catalog;
  const profile = { ruleset: 'srd-5.2.1', classId: 'fighter', levelHistory: ['fighter', 'wizard', 'fighter'],
    multiclassProficiencyIds: [], attributes: stats, hitPoints: { method: 'fixed' },
    vitals: { hp: 15, hitDiceSpentByDie: { 6: 1, 10: 0 }, hitDiceSpent: 1 } };
  const character = { id: 'roundtrip', name: 'Chronikexport', level: 3, profile };
  const raw = JSON.stringify({ ...emptyGame(), characters: [character] });
  assert.equal(validateGameImport(JSON.parse(raw)).characters[0].profile.levelHistory[1], 'wizard');
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null,
    setItem: (key, val) => entries.set(key, val), removeItem: key => entries.delete(key) };
  saveImportedGame(JSON.parse(raw), storage);
  assert.deepEqual(readGame(storage).characters[0].profile, profile);
  const cloud = prepareCloudCharacter(character);
  const merged = mergeCloudCharacter(emptyGame(), { schemaVersion: 1, ownerId: 'user', character: cloud });
  assert.deepEqual(merged.characters[0].profile, profile);
  const tracker = getCharacterTrackerSummary(cloud, { classes, levels });
  assert.ok(tracker.resources.some(item => item.id === 'fighter:second_wind_uses'));
});
