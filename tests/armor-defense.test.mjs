import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCategory } from '../js/rules/catalog.mjs';
import { getDefenseStats } from '../js/rules/dnd55.mjs';

globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')) });
const data = Promise.all(['classes', 'levels', 'equipment'].map(loadCategory));
const attributes = { str: 14, dex: 16, con: 14, int: 12, wis: 10, cha: 14 };

function defense([classes, levels, equipment], classId, opts = {}) {
  return getDefenseStats({ classEntry: classes.find(cls => cls.index === classId), levelRows: levels,
    equipment, attributes, ...opts });
}

test('Rüstung aus SRD: leicht/mittel/schwer, GE-Deckel, STR-Voraussetzung und Schildtraining', async () => {
  const d = await data;
  assert.equal(defense(d, 'fighter', { armorId: 'studded-leather-armor' }).armorClass, 15);
  assert.equal(defense(d, 'fighter', { armorId: 'chain-shirt' }).armorClass, 15);
  assert.equal(defense(d, 'fighter', { armorId: 'plate-armor' }).armorClass, 18);
  const armored = defense(d, 'fighter', { armorId: 'plate-armor', shield: true });
  assert.equal(armored.armorClass, 20);
  assert.equal(armored.speed, 20);
  assert.equal(armored.stealthDisadvantage, true);
  assert.equal(armored.trained, true);
  assert.equal(armored.shieldTrained, true);
  const strong = defense(d, 'fighter', { armorId: 'plate-armor', shield: true,
    attributes: { ...attributes, str: 16 } });
  assert.equal(strong.speed, 30);
  const bard = defense(d, 'bard', { shield: true });
  assert.equal(bard.armorClass, 13);
  assert.equal(bard.shieldTrained, false);
  assert.ok(bard.warnings.some(warning => warning.includes('kein RK-Bonus')));
});

test('Fellrüstung: Quellenabweichung der Importdaten wird als mittelschwer behandelt', async () => {
  const d = await data;
  const [,, equipment] = d;
  assert.ok(equipment.find(item => item.index === 'hide-armor').equipment_categories
    .some(category => category.index === 'light-armor'), 'Import enthält bekanntermaßen falsche Kategorie');
  const bard = defense(d, 'bard', { armorId: 'hide-armor' });
  assert.equal(bard.armorClass, 14);
  assert.equal(bard.trained, false);
  assert.ok(bard.warnings.some(warning => warning.includes('keine Zauber')));
  assert.equal(defense(d, 'ranger', { armorId: 'hide-armor' }).trained, true);
  assert.equal(defense(d, 'druid', { armorId: 'hide-armor', shield: true }).armorClass, 16);
});

test('Ungerüstete Verteidigung: Barbar, Mönch und drakonischer Hexer schließen sich korrekt mit Rüstung aus', async () => {
  const d = await data;
  assert.equal(defense(d, 'barbarian', { level: 5, shield: true }).armorClass, 17);
  assert.equal(defense(d, 'barbarian', { level: 5 }).speed, 40);
  assert.equal(defense(d, 'barbarian', { level: 5, armorId: 'plate-armor' }).speed, 20);
  const monk = defense(d, 'monk', { level: 9 });
  assert.equal(monk.armorClass, 13);
  assert.equal(monk.speed, 45);
  assert.equal(defense(d, 'monk', { level: 9, shield: true }).speed, 30);
  assert.equal(defense(d, 'monk', { level: 9, armorId: 'leather-armor' }).defense, 'Leather Armor');
  const dragon = defense(d, 'sorcerer', { subclassId: 'draconic-sorcery', level: 3 });
  assert.equal(dragon.armorClass, 15);
  assert.equal(dragon.maxHpBonus, 3);
  assert.equal(defense(d, 'sorcerer', { subclassId: 'draconic-sorcery', level: 20 }).maxHpBonus, 20);
  assert.equal(defense(d, 'sorcerer', { subclassId: 'draconic-sorcery', level: 2 }).maxHpBonus, 0);
  assert.equal(defense(d, 'sorcerer', { subclassId: 'draconic-sorcery', level: 3,
    armorId: 'padded-armor' }).armorClass, 14);
});

test('Alle 12 SRD-Klassen × Rüstungen × Stufen: RK, Tempo, Warnungen sind gültig', async () => {
  const d = await data;
  const [classes, , equipment] = d;
  const armorIds = ['', ...equipment.filter(item => item.index !== 'shield'
    && item.equipment_categories?.some(category => category.index === 'armor')).map(item => item.index)];
  let cases = 0;
  for (const cls of classes) for (const level of [1, 3, 5, 9, 20]) for (const armorId of armorIds) {
    for (const shield of [false, true]) {
      const result = defense(d, cls.index, { armorId, shield, level, speciesSpeed: 35,
        subclassId: cls.index === 'sorcerer' ? 'draconic-sorcery' : '' });
      assert.ok(Number.isInteger(result.armorClass) && result.armorClass >= 0);
      assert.ok(Number.isInteger(result.speed) && result.speed >= 0);
      assert.ok(Number.isInteger(result.maxHpBonus) && result.maxHpBonus >= 0);
      assert.ok(result.warnings.every(warning => typeof warning === 'string'));
      cases++;
    }
  }
  assert.ok(cases >= 1500);
  assert.throws(() => defense(d, 'fighter', { armorId: 'shield' }), /Rüstung/);
  assert.throws(() => defense(d, 'fighter', { armorId: '__bogus' }), /Rüstung/);
});

test('Rüstungsauswahl wird in die Website integriert und im Charakterprofil gelesen', async () => {
  const [html, main] = await Promise.all([
    readFile(new URL('../studio.html', import.meta.url), 'utf8'),
    readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8'),
  ]);
  assert.ok(html.includes('id="character-armor"'));
  assert.ok(html.includes('id="character-shield"'));
  assert.ok(main.includes('getDefenseStats({'));
  assert.ok(main.includes('armorId: $(\'#character-armor\').value'));
});
