import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCategory } from '../js/rules/catalog.mjs';
import {
  getClassLevelSummary, getWarlockInvocationChoices, getMetamagicChoices,
  getFightingStyleChoices, getDefenseStats, normalizeResourceTracker,
  changeResourceTracker, restResourceTracker,
} from '../js/rules/dnd55.mjs';

globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')) });
const catalogs = Promise.all(['classes', 'backgrounds', 'levels', 'feats', 'spells', 'equipment'].map(loadCategory));
const ability = { str: 14, dex: 16, con: 14, int: 12, wis: 14, cha: 16 };

const pool = (d, classId, level, opts = {}) => getWarlockInvocationChoices({ classId, level,
  levelRows: d[2], feats: d[3], spells: d[4], backgroundFeatId: 'alert', ...opts });
const styles = (d, classId, level, opts = {}) => getFightingStyleChoices({ classId, level,
  feats: d[3], spells: d[4], ...opts });

test('Warlock 1–20: Anrufungskapazität aus offizieller 2024-Tabelle', async () => {
  const d = await catalogs;
  for (const [level, count] of [[1, 1], [2, 3], [3, 3], [5, 5], [9, 7], [17, 9], [20, 10]]) {
    assert.equal(pool(d, 'warlock', level).count, count);
  }
  const first = pool(d, 'warlock', 1);
  assert.ok(first.options.some(option => option.index === 'pact-of-the-tome'));
  assert.ok(!first.options.some(option => option.index === 'agonizing-blast:eldritch-blast'));
  assert.equal(pool(d, 'wizard', 20).count, 0);
});

test('Anrufungen prüfen Stufen, Pakt-Abhängigkeiten und Zauberziel bei Wiederholungen', async () => {
  const d = await catalogs;
  const at5 = pool(d, 'warlock', 5, { cantrips: ['eldritch-blast'] });
  assert.ok(at5.options.some(option => option.index === 'agonizing-blast:eldritch-blast'));
  assert.ok(!at5.options.some(option => option.index === 'thirsting-blade'));
  assert.throws(() => pool(d, 'warlock', 5, { selected: ['thirsting-blade'] }), /Anrufung/);
  const selections = ['pact-of-the-blade', 'thirsting-blade', 'eldritch-smite', 'agonizing-blast:eldritch-blast'];
  const valid = pool(d, 'warlock', 5, { selected: selections, cantrips: ['eldritch-blast'] });
  assert.equal(valid.missing, 1);
  assert.throws(() => pool(d, 'warlock', 4, { selected: selections, cantrips: ['eldritch-blast'] }), /Anrufung/);
  assert.throws(() => pool(d, 'warlock', 5, { selected: selections, cantrips: [] }), /Anrufung/);
  assert.throws(() => pool(d, 'warlock', 5, { selected: ['pact-of-the-blade', 'pact-of-the-blade'] }), /Anrufung/);
  assert.throws(() => pool(d, 'warlock', 12, { selected: ['devouring-blade'] }), /Anrufung/);
  assert.equal(pool(d, 'warlock', 12, { selected: ['pact-of-the-blade', 'thirsting-blade', 'devouring-blade'] }).missing, 5);
  assert.ok(!pool(d, 'warlock', 2, { cantrips: ['mage-hand'] }).options
    .some(option => option.index === 'agonizing-blast:mage-hand'));
});

test('Anrufungen: Zauberangriff, Reichweite und Lessons of the First Ones', async () => {
  const d = await catalogs;
  const chosen = pool(d, 'warlock', 2, { cantrips: ['chill-touch', 'poison-spray', 'eldritch-blast'] });
  assert.ok(!chosen.options.some(option => option.index === 'eldritch-spear:chill-touch'));
  assert.ok(chosen.options.some(option => option.index === 'eldritch-spear:poison-spray'));
  assert.ok(chosen.options.some(option => option.index === 'repelling-blast:chill-touch'));
  const trueStrike = pool(d, 'warlock', 2, { cantrips: ['true-strike'] });
  assert.ok(trueStrike.options.some(option => option.index === 'agonizing-blast:true-strike'));
  assert.ok(trueStrike.options.some(option => option.index === 'repelling-blast:true-strike'));
  assert.ok(!trueStrike.options.some(option => option.index === 'eldritch-spear:true-strike'));
  assert.ok(!chosen.options.some(option => option.index === 'lessons-of-the-first-ones:alert'));
  assert.ok(chosen.options.some(option => option.index === 'lessons-of-the-first-ones:skilled'));
  const feats = ['lessons-of-the-first-ones:skilled', 'lessons-of-the-first-ones:savage-attacker'];
  assert.equal(pool(d, 'warlock', 2, { selected: feats }).missing, 1);
  assert.throws(() => pool(d, 'warlock', 2, { selected: [...feats, feats[0]] }), /Anrufung/);
});

test('Sorcerer: zehn 2024-Metamagien, Wahl auf 2/10/17 und korrekte Kosten', () => {
  for (const [level, expected] of [[1, 0], [2, 2], [9, 2], [10, 4], [16, 4], [17, 6], [20, 6]]) {
    assert.equal(getMetamagicChoices({ classId: 'sorcerer', level }).count, expected);
  }
  const full = getMetamagicChoices({ classId: 'sorcerer', level: 20 });
  assert.equal(full.options.length, 10);
  assert.equal(full.options.find(option => option.index === 'heightened-spell').cost, 2);
  assert.equal(full.options.find(option => option.index === 'twinned-spell').cost, 1);
  const chosen = full.options.slice(0, 6).map(item => item.index);
  assert.equal(getMetamagicChoices({ classId: 'sorcerer', level: 20, selected: chosen }).missing, 0);
  assert.throws(() => getMetamagicChoices({ classId: 'sorcerer', level: 2, selected: chosen }), /Metamagie/);
  assert.throws(() => getMetamagicChoices({ classId: 'sorcerer', level: 10,
    selected: [chosen[0], chosen[0]] }), /Metamagie/);
  assert.equal(getMetamagicChoices({ classId: 'fighter', level: 20 }).count, 0);
});

test('Fighting Styles: SRD-Feats, Champion 7 und geweiht/naturverbunden mit zwei Tricks', async () => {
  const d = await catalogs;
  assert.equal(styles(d, 'fighter', 1).count, 1);
  assert.equal(styles(d, 'fighter', 7, { subclassId: 'champion' }).count, 2);
  assert.equal(styles(d, 'fighter', 7).count, 1);
  assert.equal(styles(d, 'ranger', 1).count, 0);
  assert.equal(styles(d, 'ranger', 2).count, 1);
  assert.equal(styles(d, 'paladin', 2).count, 1);
  const combat = styles(d, 'fighter', 7, { subclassId: 'champion', selected: ['archery', 'defense'] });
  assert.equal(combat.missing, 0);
  assert.ok(combat.options.every(item => d[3].some(feat => feat.index === item.index)));
  assert.throws(() => styles(d, 'fighter', 7, { selected: ['archery', 'defense'] }), /Kampfstil/);
  assert.throws(() => styles(d, 'fighter', 7, { subclassId: 'champion',
    selected: ['archery', 'archery'] }), /Kampfstil/);
  assert.throws(() => styles(d, 'fighter', 7, { subclassId: 'champion',
    selected: ['archery', 'defense'], extraFeats: ['defense'] }), /Kampfstil/);
  assert.ok(!styles(d, 'fighter', 7, { extraFeats: ['defense'] }).options
    .some(entry => entry.index === 'defense'));
  const ranger = styles(d, 'ranger', 2, { selected: ['druidic-warrior'] });
  assert.equal(ranger.cantripCount, 2);
  assert.ok(ranger.cantripOptions.every(entry => d[4].find(spell => spell.index === entry.index)?.classes
    .some(cls => cls.index === 'druid')));
  const druidTricks = ranger.cantripOptions.slice(0, 2).map(item => item.index);
  assert.equal(styles(d, 'ranger', 2, { selected: ['druidic-warrior'], bonusCantrips: druidTricks }).missingCantrips, 0);
  assert.throws(() => styles(d, 'ranger', 2, { selected: ['druidic-warrior'],
    bonusCantrips: [druidTricks[0], druidTricks[0]] }), /Zaubertricks/);
  assert.equal(styles(d, 'paladin', 2, { selected: ['blessed-warrior'] }).cantripCount, 2);
  assert.throws(() => styles(d, 'fighter', 1, { selected: ['blessed-warrior'] }), /Kampfstil/);
});

test('Defense-Kampfstil verbessert RK nur in Rüstung', async () => {
  const [classes,,, , , equipment] = await catalogs;
  const levelRows = (await catalogs)[2];
  const fighter = classes.find(entry => entry.index === 'fighter');
  const opts = { classEntry: fighter, levelRows, equipment, attributes: ability, level: 7, armorId: 'chain-shirt' };
  assert.equal(getDefenseStats(opts).armorClass, 15);
  assert.equal(getDefenseStats({ ...opts, fightingStyles: ['defense'] }).armorClass, 16);
  assert.equal(getDefenseStats({ ...opts, armorId: '', fightingStyles: ['defense'] }).armorClass, 13);
});

test('Bestätigte Ressourcen: Action Surge, Innate Sorcery, Handauflegen und weitere Rasten', async () => {
  const [classes,, levels] = await catalogs;
  const summary = (id, level) => getClassLevelSummary(levels, classes.find(entry => entry.index === id), level, ability);
  const cases = [
    ['fighter', 1, 'action_surge', 0, 'all'], ['fighter', 2, 'action_surge', 1, 'all'],
    ['fighter', 17, 'action_surge', 2, 'all'], ['fighter', 9, 'indomitable', 1, 'none'],
    ['fighter', 13, 'indomitable', 2, 'none'], ['fighter', 17, 'indomitable', 3, 'none'],
    ['sorcerer', 1, 'innate_sorcery', 2, 'none'], ['sorcerer', 5, 'sorcerous_restoration', 1, 'none'],
    ['paladin', 1, 'lay_on_hands', 5, 'none'], ['paladin', 20, 'lay_on_hands', 100, 'none'],
    ['paladin', 2, 'paladins_smite', 1, 'none'], ['warlock', 2, 'magical_cunning', 1, 'none'],
    ['wizard', 1, 'arcane_recovery', 1, 'none'],
  ];
  for (const [classId, level, id, max, shortRest] of cases) {
    const state = summary(classId, level);
    const resource = state.resources.find(item => item.id === id);
    assert.equal(resource?.max || 0, max, `${classId}${level} ${id}`);
    if (!max) continue;
    assert.equal(resource.shortRest, shortRest);
    const spent = changeResourceTracker(state, normalizeResourceTracker(state), 'resources', id, -1);
    assert.equal(restResourceTracker(state, spent, 'short').resources[id], shortRest === 'all' ? max : max - 1);
    assert.equal(restResourceTracker(state, spent, 'long').resources[id], max);
  }
});

test('12 Klassen × 20 Stufen: zusätzliche Klassenwahlen bleiben in ihrem Regelfenster', async () => {
  const d = await catalogs;
  let cases = 0;
  for (const cls of d[0]) for (let level = 1; level <= 20; level++) {
    const invocation = pool(d, cls.index, level);
    const metamagic = getMetamagicChoices({ classId: cls.index, level });
    const style = styles(d, cls.index, level);
    assert.ok(invocation.options.length >= invocation.count, `${cls.index}/${level} Anrufung`);
    assert.ok(metamagic.options.length >= metamagic.count, `${cls.index}/${level} Metamagie`);
    assert.ok(style.options.length >= style.count, `${cls.index}/${level} Kampfstil`);
    if (cls.index !== 'warlock') assert.equal(invocation.count, 0);
    if (cls.index !== 'sorcerer') assert.equal(metamagic.count, 0);
    if (!['fighter', 'ranger', 'paladin'].includes(cls.index)) assert.equal(style.count, 0);
    cases++;
  }
  assert.equal(cases, 240);
});

test('Oberfläche nutzt vorhandenes Charakterlabor und speichert konkrete Klassenwahlen', async () => {
  const [html, js] = await Promise.all([
    readFile(new URL('../studio.html', import.meta.url), 'utf8'),
    readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8'),
  ]);
  for (const id of ['character-class-options', 'character-style-choices',
    'character-style-cantrips', 'character-metamagic-choices', 'character-invocation-choices']) {
    assert.ok(html.includes(`id="${id}"`));
  }
  for (const name of ['getWarlockInvocationChoices', 'getMetamagicChoices', 'getFightingStyleChoices',
    'classFeatures: getClassFeatureSelection()', 'checkClassFeatureChoices(values)']) assert.ok(js.includes(name));
});
