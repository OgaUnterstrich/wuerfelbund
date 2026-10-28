import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyLevelImprovements, getAbilityImprovementLevels } from '../js/rules/dnd55.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../data/srd-5.2.1/en/5e-SRD-${name}.json`, import.meta.url), 'utf8'));
const sources = Promise.all([load('Classes'), load('Levels'), load('Feats')]);
const attributes = { str: 20, dex: 16, con: 16, int: 14, wis: 14, cha: 10 };

test('Alle zwölf SRD-Klassen bieten ihre Epische Gabe genau auf Stufe 19 an', async () => {
  const [classes, levels] = await sources;
  for (const klass of classes) {
    assert.equal(getAbilityImprovementLevels(levels, klass.index, 18).includes(19), false);
    const milestones = getAbilityImprovementLevels(levels, klass.index, 20);
    assert.equal(milestones.filter(level => level === 19).length, 1, klass.index);
    assert.ok(levels.some(row => row.class?.index === klass.index && row.level === 19
      && row.features?.some(feature => feature.index === `${klass.index}-epic-boon`)));
  }
});

test('Sieben SRD-Epische Gaben erhöhen ein beliebiges Attribut um +1, maximal 30', async () => {
  const [classes, levels, feats] = await sources;
  const [wizard, fighter] = [classes.find(entry => entry.index === 'wizard'), classes.find(entry => entry.index === 'fighter')];
  assert.equal(feats.filter(feat => feat.type === 'epic-boon').length, 7);
  for (const feat of feats.filter(entry => entry.type === 'epic-boon')) {
    const klass = feat.prerequisites?.feature_named === 'Spellcasting' ? wizard : fighter;
    const levelsOf = getAbilityImprovementLevels(levels, klass.index, 20);
    const out = applyLevelImprovements(attributes, levelsOf,
      [{ level: 19, kind: 'feat', featId: feat.index, primary: 'str' }],
      { classId: klass.index, levelRows: levels, feats });
    assert.equal(out.attributes.str, 21, feat.index);
    assert.ok(out.selectedFeats.some(chosen => chosen.id === feat.index));
  }
  const ofWizard = getAbilityImprovementLevels(levels, 'wizard', 20);
  const high = applyLevelImprovements({ ...attributes, str: 29 }, ofWizard,
    [{ level: 19, kind: 'feat', featId: 'boon-of-fate', primary: 'str' }],
    { classId: 'wizard', levelRows: levels, feats });
  assert.equal(high.attributes.str, 30);
});

test('Gaben sind auf niedrigen Stufen oder ohne Voraussetzung nicht zulässig', async () => {
  const [, levels, feats] = await sources;
  const fighter = getAbilityImprovementLevels(levels, 'fighter', 20);
  const opts = { classId: 'fighter', levelRows: levels, feats };
  assert.throws(() => applyLevelImprovements(attributes, fighter,
    [{ level: 4, kind: 'feat', featId: 'boon-of-fate', primary: 'wis' }], opts), /Stufe 19/);
  assert.throws(() => applyLevelImprovements(attributes, fighter,
    [{ level: 19, kind: 'feat', featId: 'boon-of-spell-recall', primary: 'wis' }], opts), /Spellcasting/);
  assert.throws(() => applyLevelImprovements(attributes, fighter,
    [{ level: 19, kind: 'feat', featId: 'boon-of-fate' }], opts), /benötigt ein Attribut/);
  assert.throws(() => applyLevelImprovements({ ...attributes, str: 30 }, fighter,
    [{ level: 19, kind: 'feat', featId: 'boon-of-fate', primary: 'str' }], opts), /über 30/);
});

test('Stufe 19 erlaubt weiterhin ein reguläres Talent statt der Epischen Gabe', async () => {
  const [, levels, feats] = await sources;
  const opts = { classId: 'fighter', levelRows: levels, feats };
  const result = applyLevelImprovements(attributes, getAbilityImprovementLevels(levels, 'fighter', 20),
    [{ level: 19, kind: 'feat', featId: 'grappler', primary: 'dex' }], opts);
  assert.equal(result.attributes.dex, 17);
});
