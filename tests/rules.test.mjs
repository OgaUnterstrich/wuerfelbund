import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  parseDice, rollDice,
  validateAbility, applyPassiveModifiers, activateAbility,
} from '../js/rules/engine.mjs';
import {
  abilityModifier, proficiencyBonus, basicDndCharacter,
  buildOriginAttributes, getAbilityImprovementLevels, applyLevelImprovements,
  getClassLevelSummary, normalizeResourceTracker, changeResourceTracker, restResourceTracker,
  getClassSkillChoice, getStartingProficiencies,
} from '../js/rules/dnd55.mjs';
import { CATEGORIES, loadCategory, listClassFeatures } from '../js/rules/catalog.mjs';
import { makePack, saveLocalPacks, loadLocalPacks, importPackJson } from '../js/rules/packs.mjs';
import { SAVE_KEY, emptyGame, readGame } from '../js/rules/characters.mjs';

const example = {
  schemaVersion: 1, id: 'hb.fadenschild001', version: 1,
  name: 'Fadenschild', description: 'Magischer Schutz', activation: 'reaction',
  minLevel: 8, resource: 'fokus', cost: 2,
  effects: [{ type: 'reduce_damage', dice: '2d6' }],
};

// Der produktive Katalog verwendet fetch(). Für reine Node-Regressionstests
// lesen wir dieselben gepinnten Dateien ohne lokalen Webserver.
globalThis.fetch = async url => {
  const content = await readFile(fileURLToPath(url), 'utf8');
  return { ok: true, json: async () => JSON.parse(content) };
};

test('D&D 5.5e: Grundattribute, Übungsbonus und Stufe 8', () => {
  assert.equal(abilityModifier(13), 1);
  assert.equal(abilityModifier(8), -1);
  assert.equal(proficiencyBonus(8), 3);
  assert.equal(proficiencyBonus(17), 6);
  const sheet = basicDndCharacter({ level: 8, hitDie: 10, attributes: { con: 13, dex: 14 } });
  assert.equal(sheet.max_hp, 60);
  assert.equal(sheet.armor_class, 12);
  assert.equal(sheet.proficiencyBonus, 3);
  assert.equal(basicDndCharacter({ level: 8, hitDie: 6, attributes: { con: 3 } }).max_hp, 9);
  assert.equal('spell_dc' in sheet, false);
});

test('SRD 5.2.1: Standardwerte, +2/+1 und Hintergrundtalent ohne Sondertabellen', async () => {
  const backgrounds = await loadCategory('backgrounds');
  const soldier = backgrounds.find(entry => entry.index === 'soldier');
  assert.equal(soldier.feat.index, 'savage-attacker');
  const baseAttributes = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  const result = buildOriginAttributes({
    baseAttributes, method: 'standard', background: soldier,
    bonus: { mode: 'two-one', primary: 'str', secondary: 'con' },
  });
  assert.equal(result.attributes.str, 17);
  assert.equal(result.attributes.con, 14);
  assert.equal(baseAttributes.str, 15);
  assert.deepEqual(Object.values(result.adjustments).reduce((sum, value) => sum + value, 0), 3);
  assert.throws(() => buildOriginAttributes({
    baseAttributes, method: 'standard', background: soldier,
    bonus: { mode: 'two-one', primary: 'cha', secondary: 'con' },
  }), /erlaubte Attribute/);
});

test('SRD 5.2.1: Punktekauf und +1/+1/+1 werden korrekt begrenzt', async () => {
  const backgrounds = await loadCategory('backgrounds');
  const sage = backgrounds.find(entry => entry.index === 'sage');
  const baseAttributes = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };
  const result = buildOriginAttributes({ baseAttributes, method: 'point-buy', background: sage, bonus: { mode: 'all-one' } });
  assert.equal(result.pointsSpent, 27);
  assert.equal(result.attributes.int, 16);
  assert.equal(result.attributes.wis, 13);
  assert.throws(() => buildOriginAttributes({
    baseAttributes: { ...baseAttributes, str: 15 }, method: 'point-buy', background: sage, bonus: { mode: 'all-one' },
  }), /überschritten/);
  assert.throws(() => buildOriginAttributes({
    baseAttributes: { ...baseAttributes, int: 20 }, method: 'rolled', background: sage,
    bonus: { mode: 'two-one', primary: 'int', secondary: 'wis' },
  }), /über 20/);
  assert.throws(() => buildOriginAttributes({
    baseAttributes: { str: 15, dex: 15, con: 13, int: 12, wis: 10, cha: 8 },
    method: 'standard', background: sage, bonus: { mode: 'all-one' },
  }), /Standardwerte/);
});

test('5.5e-Startübungen: alle SRD-Klassen und -Hintergründe, ohne Werkzeugoptionen zu verwechseln', async () => {
  const [classes, backgrounds, skills] = await Promise.all([
    loadCategory('classes'), loadCategory('backgrounds'), loadCategory('skills'),
  ]);
  const attributes = { str: 16, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  let cases = 0;
  for (const classEntry of classes) {
    const choice = getClassSkillChoice(classEntry);
    assert.ok(Number.isInteger(choice.count) && choice.count >= 2 && choice.count <= 4);
    assert.ok(choice.options.every(item => skills.some(skill => skill.index === item.index)));
    for (const background of backgrounds) {
      const backgroundSkills = background.proficiencies.filter(item => item.index.startsWith('skill-'))
        .map(item => item.index.slice(6));
      const possible = choice.options.filter(item => !backgroundSkills.includes(item.index));
      assert.ok(possible.length >= choice.count, `${classEntry.index}/${background.index} hat nicht genug Fertigkeiten`);
      const classSkillIds = possible.slice(0, choice.count).map(item => item.index);
      for (const level of [1, 8, 20]) {
        const result = getStartingProficiencies({ classEntry, background, skills, classSkillIds, attributes, level });
        assert.equal(result.missing, 0);
        assert.equal(result.savingThrows.length, 6);
        assert.equal(result.savingThrows.filter(item => item.trained).length, 2);
        assert.equal(result.skills.length, 18);
        assert.ok(classSkillIds.every(id => result.skills.find(item => item.id === id)?.trained));
        assert.ok(backgroundSkills.every(id => result.skills.find(item => item.id === id)?.trained));
        for (const skill of result.skills) {
          const expected = abilityModifier(attributes[skill.ability])
            + (skill.trained ? proficiencyBonus(level)
              : classEntry.index === 'bard' && level >= 2 ? Math.floor(proficiencyBonus(level) / 2) : 0);
          assert.equal(skill.modifier, expected, `${classEntry.index}/${background.index}/${skill.id}`);
        }
        assert.equal(result.passivePerception, 10 + result.skills.find(item => item.id === 'perception').modifier);
        cases++;
      }
      const incomplete = getStartingProficiencies({ classEntry, background, skills, classSkillIds: [], attributes, level: 8 });
      assert.equal(incomplete.missing, choice.count);
      assert.throws(() => getStartingProficiencies({ classEntry, background, skills,
        classSkillIds: [classSkillIds[0], classSkillIds[0]], attributes, level: 8 }), /eindeutig/);
      assert.throws(() => getStartingProficiencies({ classEntry, background, skills,
        classSkillIds: [backgroundSkills[0]], attributes, level: 8 }), /überschneiden/);
    }
  }
  assert.equal(cases, 12 * backgrounds.length * 3);
  assert.equal(getClassSkillChoice(classes.find(item => item.index === 'bard')).count, 3);
  assert.equal(getClassSkillChoice(classes.find(item => item.index === 'monk')).count, 2);
  assert.equal(getClassSkillChoice(classes.find(item => item.index === 'rogue')).count, 4);
});

test('SRD 5.2.1: Kämpfer erhält auf Stufe 8 drei Verbesserungen, Magier nur zwei', async () => {
  const rows = await loadCategory('levels');
  assert.deepEqual(getAbilityImprovementLevels(rows, 'fighter', 8), [4, 6, 8]);
  assert.deepEqual(getAbilityImprovementLevels(rows, 'fighter', 20), [4, 6, 8, 12, 14, 16, 19]);
  assert.deepEqual(getAbilityImprovementLevels(rows, 'wizard', 8), [4, 8]);
  assert.deepEqual(getAbilityImprovementLevels(rows, 'rogue', 12), [4, 8, 10, 12]);
});

test('Attributssteigerungen wirken in Stufenfolge, offene Talente bleiben offen', async () => {
  const levels = getAbilityImprovementLevels(await loadCategory('levels'), 'fighter', 8);
  const origin = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 };
  const results = applyLevelImprovements(origin, levels, [
    { level: 4, kind: 'one', primary: 'str' },
    { level: 6, kind: 'split', primary: 'str', secondary: 'con' },
    { level: 8, kind: 'feat' },
  ]);
  assert.equal(results.attributes.str, 19);
  assert.equal(results.attributes.con, 15);
  assert.deepEqual(results.unresolved, [8]);
  assert.equal(origin.str, 16);
  assert.throws(() => applyLevelImprovements({ ...origin, str: 20 }, levels,
    [{ level: 4, kind: 'one', primary: 'str' }]), /Wert 20/);
  assert.throws(() => applyLevelImprovements(origin, levels,
    [{ level: 4, kind: 'split', primary: 'str', secondary: 'str' }]), /unterschiedliche/);
  assert.throws(() => applyLevelImprovements(origin, levels,
    [{ level: 5, kind: 'one', primary: 'str' }]), /Stufenentscheidung/);
});

test('5.5e-Talente: Grappler-Prüfung, +1-Bonus, Einmaligkeit und Klassenmerkmale', async () => {
  const [levels, feats] = await Promise.all([loadCategory('levels'), loadCategory('feats')]);
  const fighter = getAbilityImprovementLevels(levels, 'fighter', 8);
  const wizard = getAbilityImprovementLevels(levels, 'wizard', 8);
  const base = { str: 12, dex: 13, con: 14, int: 15, wis: 10, cha: 8 };
  const opts = { feats, levelRows: levels, classId: 'fighter', originFeatId: 'savage-attacker' };
  const result = applyLevelImprovements(base, fighter, [
    { level: 4, kind: 'feat', featId: 'grappler', primary: 'str' },
    { level: 6, kind: 'one', primary: 'int' },
  ], opts);
  assert.equal(result.attributes.str, 13);
  assert.equal(result.attributes.int, 17);
  assert.deepEqual(result.selectedFeats, [{ level: 4, id: 'grappler', name: 'Grappler' }]);
  assert.deepEqual(result.unresolved, [4, 8]);
  assert.throws(() => applyLevelImprovements({ ...base, dex: 12 }, fighter,
    [{ level: 4, kind: 'feat', featId: 'grappler', primary: 'str' }], opts), /Attributsvoraussetzungen/);
  assert.throws(() => applyLevelImprovements(base, fighter,
    [{ level: 4, kind: 'feat', featId: 'grappler', primary: 'str' },
      { level: 6, kind: 'feat', featId: 'grappler', primary: 'dex' }], opts), /nur einmal/);
  assert.throws(() => applyLevelImprovements(base, fighter,
    [{ level: 4, kind: 'feat', featId: 'savage-attacker' }], opts), /nur einmal/);
  assert.throws(() => applyLevelImprovements(base, wizard,
    [{ level: 4, kind: 'feat', featId: 'archery' }], { ...opts, classId: 'wizard' }), /Fighting Style/);
  assert.doesNotThrow(() => applyLevelImprovements(base, fighter,
    [{ level: 4, kind: 'feat', featId: 'archery' }], opts));
  assert.throws(() => applyLevelImprovements(base, fighter,
    [{ level: 4, kind: 'feat', featId: 'boon-of-fate' }], opts), /Stufe 19/);
});

test('Eigene Fähigkeit: validiert Kosten, Effekt und keine ausführbaren Ausdrücke', () => {
  assert.deepEqual(validateAbility(example), []);
  assert.ok(validateAbility({ ...example, effects: [{ type: 'arbitraryJavascript', code: 'alert(1)' }] }).length);
  assert.ok(validateAbility({ ...example, cost: -1 }).length);
  assert.ok(validateAbility({ ...example, minLevel: 21 }).length);
  assert.throws(() => parseDice('2d6 + eval()'));
  assert.deepEqual(parseDice('2d6+3'), { count: 2, faces: 6, modifier: 3 });
});

test('Aktive Fähigkeit verbraucht Ressourcen nur bei ausreichendem Vorrat', () => {
  const character = { level: 8, resources: { fokus: 3 }, hp: 15, maxHp: 40 };
  const result = activateAbility(example, character, () => 0);
  assert.equal(result.character.resources.fokus, 1);
  assert.equal(character.resources.fokus, 3); // Originaldaten bleiben unverändert
  assert.equal(result.events[0].amount, 2);
  assert.equal(result.events[0].pending, true); // Ziel/Schaden entscheidet Spielleitung
  assert.throws(() => activateAbility(example, { ...character, resources: { fokus: 1 } }), /Nicht genügend/);
});

test('Passive Fähigkeit und Würfelberechnung', () => {
  const passive = {
    ...example, id: 'hb.passivtest001', activation: 'passive', cost: 0, resource: '',
    effects: [{ type: 'modifier', target: 'armor_class', value: 2 }],
  };
  const result = applyPassiveModifiers({ level: 8, armor_class: 14 }, [passive]);
  assert.equal(result.armor_class, 16);
  assert.equal(rollDice('2d6+3', () => 0).total, 5);
});

test('Mehrere persönliche Regelpakete lassen sich ohne Skriptausführung exportieren', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const pack = makePack('Eigene Welt', 'festeste1234');
  pack.abilities.push(example);
  saveLocalPacks([pack], storage);
  assert.equal(loadLocalPacks(storage)[0].abilities[0].name, 'Fadenschild');
  assert.equal(importPackJson(JSON.stringify(pack)).id, pack.id);
  assert.throws(() => importPackJson(JSON.stringify({ ...pack, abilities: [{ ...example, effects: [{ type: 'javascript' }] }] })));
});

test('0.8-Migration: alte Regelprofile bleiben erhalten und haben nur einen aktiven Speicherort', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const oldGame = { ...emptyGame(), characters: [
    { id: 'a', name: 'Alte Heldin', className: 'Wizard', race: 'Elf', level: 8 },
    { id: 'b', name: 'Freie Figur', className: 'Bard', race: 'Human', level: 2 },
  ] };
  data.set(SAVE_KEY, JSON.stringify(oldGame));
  data.set('wuerfelbund-ruleprofiles-v1', JSON.stringify({
    a: { ruleset: 'srd-5.2.1', classId: 'wizard', name: 'Veralteter Name', level: 7,
      attributes: { int: 18 }, tracker: { slots: { 4: 0 } } },
    ghost: { ruleset: 'srd-5.2.1', classId: 'fighter' },
  }));
  const converted = readGame(storage);
  assert.equal(converted.characters[0].name, 'Alte Heldin');
  assert.equal(converted.characters[0].level, 8);
  assert.equal(converted.characters[0].profile.classId, 'wizard');
  assert.equal(converted.characters[0].profile.tracker.slots[4], 0);
  assert.equal('name' in converted.characters[0].profile, false);
  assert.equal('level' in converted.characters[0].profile, false);
  assert.equal(converted.characters[1].profile, undefined);
  assert.deepEqual(readGame(storage), converted, 'Mehrfaches Lesen verändert den Spielstand nicht');
  assert.ok(data.get('wuerfelbund-ruleprofiles-v1'), 'Altes Backup bleibt unberührt');

  // Einzige aktive Quelle: Entfernen, Zurücksetzen und JSON-Export erfassen das Regelprofil mit.
  const exported = JSON.stringify(converted);
  assert.equal(JSON.parse(exported).characters[0].profile.classId, 'wizard');
  converted.characters = converted.characters.filter(entry => entry.id !== 'a');
  storage.setItem(SAVE_KEY, JSON.stringify(converted));
  assert.equal(readGame(storage).characters.find(entry => entry.id === 'a'), undefined);
  storage.setItem(SAVE_KEY, JSON.stringify(emptyGame()));
  assert.deepEqual(readGame(storage).characters, [], 'Ein Reset holt alte Profile nicht zurück');
});

test('Charakter-Speicher bewahrt neue Profile und verkraftet fehlerhafte Backups', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const game = emptyGame();
  game.characters.push({ id: 'a', name: 'Neu', level: 12, profile: { ruleset: 'srd-5.2.1', classId: 'warlock', tracker: { slots: { 5: 1 } } } });
  storage.setItem(SAVE_KEY, JSON.stringify(game));
  storage.setItem('wuerfelbund-ruleprofiles-v1', JSON.stringify({ a: { ruleset: 'srd-5.2.1', classId: 'wizard' } }));
  assert.equal(readGame(storage).characters[0].profile.classId, 'warlock', 'Ein neues Profil darf nicht überschrieben werden');
  storage.setItem('wuerfelbund-ruleprofiles-v1', '{kaputt');
  assert.deepEqual(readGame(storage), game);
  storage.setItem(SAVE_KEY, '{kaputt');
  assert.deepEqual(readGame(storage), emptyGame());
});

test('SRD 2024 ist tatsächlich enthalten und liefert Klasseneinträge bis Stufe 8', async () => {
  const [classes, spells, subclasses, feats, levels, species] = await Promise.all([
    loadCategory('classes'), loadCategory('spells'), loadCategory('subclasses'),
    loadCategory('feats'), loadCategory('levels'), loadCategory('species'),
  ]);
  assert.equal(classes.length, 12);
  assert.equal(subclasses.length, 12);
  assert.ok(spells.length >= 330);
  assert.ok(feats.length >= 15);
  assert.equal(species.length, 9);
  assert.ok(species.every(entry => entry.index && Number.isInteger(entry.speed) && entry.speed > 0));
  assert.ok(levels.some(lv => lv.class?.index === 'fighter' && lv.level === 8));
  const features = await listClassFeatures('fighter', 8, 'champion');
  assert.ok(features.some(item => item.name === 'Action Surge'));
  assert.ok(features.some(item => item.name === 'Improved Critical'));
  assert.ok(features.some(item => item.unlockedAt === 8));
  assert.ok(Object.keys(CATEGORIES).length >= 14);
  assert.equal(Object.keys(CATEGORIES).length, 25);
  for (const category of Object.keys(CATEGORIES)) {
    assert.ok(Array.isArray(await loadCategory(category)), `SRD-Kategorie ${category} fehlt`);
  }
});

test('12 Klassen × 20 Stufen: Zaubertabellen und Ressourcen bleiben konsistent', async () => {
  const [classes, levels] = await Promise.all([loadCategory('classes'), loadCategory('levels')]);
  const attributes = { str: 14, dex: 12, con: 13, int: 18, wis: 16, cha: 16 };
  let examined = 0;
  for (const entry of classes) {
    for (let level = 1; level <= 20; level++) {
      const summary = getClassLevelSummary(levels, entry, level, attributes);
      const source = levels.find(row => row.class?.index === entry.index && row.level === level && !row.subclass);
      assert.ok(source, `${entry.index} Stufe ${level} fehlt`);
      if (source.spellcasting) {
        assert.ok(summary.spellcasting, `${entry.index} Stufe ${level} ohne Zaubertabelle`);
        const slots = summary.spellcasting.slots;
        assert.deepEqual(slots, Array.from({ length: 9 }, (_, index) => ({
          level: index + 1, max: source.spellcasting[`spell_slots_level_${index + 1}`],
        })).filter(slot => slot.max > 0));
        assert.ok(slots.every(slot => Number.isInteger(slot.max) && slot.max >= 1 && slot.level <= 9));
        assert.ok(Number.isInteger(summary.spellcasting.saveDC));
        assert.ok(Number.isInteger(summary.spellcasting.attackBonus));
      } else assert.equal(summary.spellcasting, null);
      assert.ok(summary.resources.every(resource => Number.isInteger(resource.max) && resource.max > 0));
      assert.equal(new Set(summary.resources.map(resource => resource.id)).size, summary.resources.length);
      examined++;
    }
  }
  assert.equal(examined, 240);
});

test('5.5e-Fallmatrix: 12 Klassen × 20 Stufen × alle Hintergründe × 3 Methoden × 2 Boni', async () => {
  const [classes, levels, backgrounds] = await Promise.all([
    loadCategory('classes'), loadCategory('levels'), loadCategory('backgrounds'),
  ]);
  const baseAttributes = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  let examined = 0;
  for (const background of backgrounds) {
    const [first, second] = background.ability_scores.map(score => score.index);
    for (const method of ['standard', 'point-buy', 'rolled']) {
      for (const bonus of [{ mode: 'two-one', primary: first, secondary: second }, { mode: 'all-one' }]) {
        const origin = buildOriginAttributes({ baseAttributes, method, background, bonus });
        for (const classEntry of classes) {
          for (let level = 1; level <= 20; level++) {
            const improvementLevels = getAbilityImprovementLevels(levels, classEntry.index, level);
            const scores = applyLevelImprovements(origin.attributes, improvementLevels).attributes;
            const basic = basicDndCharacter({ level, hitDie: classEntry.hit_die, attributes: scores });
            const summary = getClassLevelSummary(levels, classEntry, level, scores);
            assert.ok(basic.max_hp >= level);
            assert.equal(basic.proficiencyBonus, 2 + Math.floor((level - 1) / 4));
            assert.ok(Object.values(scores).every(score => score <= 20));
            assert.equal(new Set(summary.resources.map(resource => resource.id)).size, summary.resources.length);
            assert.ok(summary.resources.every(resource => Number.isInteger(resource.max) && resource.max > 0));
            examined++;
          }
        }
      }
    }
  }
  assert.equal(examined, classes.length * backgrounds.length * 20 * 3 * 2);
  assert.ok(examined >= 5760);
});

test('Alle 2024-Klassenstufen akzeptieren die beiden ASI-Verteilungen in Stufenfolge', async () => {
  const [classes, levels] = await Promise.all([loadCategory('classes'), loadCategory('levels')]);
  const base = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
  for (const entry of classes) {
    for (let level = 1; level <= 20; level++) {
      // Epische Gaben (19) sind eine andere Feature-Vergabe und werden separat geprüft.
      const slots = getAbilityImprovementLevels(levels, entry.index, level).filter(lv => lv !== 19);
      const plusTwo = applyLevelImprovements(base, slots,
        slots.map(lv => ({ level: lv, kind: 'one', primary: 'str' })));
      const split = applyLevelImprovements(base, slots,
        slots.map(lv => ({ level: lv, kind: 'split', primary: 'str', secondary: 'dex' })));
      assert.equal(plusTwo.attributes.str, 8 + slots.length * 2);
      assert.equal(split.attributes.str, 8 + slots.length);
      assert.equal(split.attributes.dex, 8 + slots.length);
      assert.deepEqual(plusTwo.unresolved, []);
    }
  }
});

test('Stufe-8-Vergleich: Magier, Hexenmeister und ressourcenbasierte Klassen', async () => {
  const [classes, rows] = await Promise.all([loadCategory('classes'), loadCategory('levels')]);
  const summary = (id, level, attributes = { cha: 16, int: 18, wis: 16 }) => getClassLevelSummary(
    rows, classes.find(entry => entry.index === id), level, attributes,
  );
  assert.deepEqual(summary('wizard', 8).spellcasting.slots,
    [{ level: 1, max: 4 }, { level: 2, max: 3 }, { level: 3, max: 3 }, { level: 4, max: 2 }]);
  assert.equal(summary('wizard', 8).spellcasting.saveDC, 15);
  assert.deepEqual(summary('warlock', 8).spellcasting.slots, [{ level: 4, max: 2 }]);
  assert.equal(summary('warlock', 8).spellcasting.pactMagic, true);
  assert.equal(summary('paladin', 1).spellcasting.slots[0].max, 2);
  assert.equal(summary('fighter', 8).spellcasting, null);
  assert.deepEqual(summary('fighter', 8).resources.map(r => r.max), [3, 1]);
  assert.deepEqual(summary('barbarian', 8).resources.map(r => r.max), [4]);
  assert.deepEqual(summary('monk', 8).resources.map(r => r.max), [8]);
  assert.deepEqual(summary('sorcerer', 8).resources.map(r => r.max), [8, 2, 1]);
  assert.deepEqual(summary('druid', 8).resources.map(r => r.max), [3]);
  assert.deepEqual(summary('ranger', 8).resources.map(r => r.max), [3]);
  assert.deepEqual(summary('bard', 8).resources.map(r => r.max), [3]);
  assert.equal(summary('bard', 8, { cha: 8 }).resources[0].max, 1);
  assert.equal(summary('wizard', 20).spellcasting.slots.find(s => s.level === 9).max, 1);
  assert.deepEqual(summary('warlock', 20).spellcasting.slots, [{ level: 5, max: 4 }]);
  assert.throws(() => summary('wizard', 21), /Keine gültige/);
});

test('2024-Rasten: normale Zauberplätze bleiben kurz verbraucht, Paktplätze regenerieren vollständig', async () => {
  const [classes, rows] = await Promise.all([loadCategory('classes'), loadCategory('levels')]);
  const get = (id, level) => getClassLevelSummary(rows, classes.find(item => item.index === id), level, { cha: 16, int: 18 });
  const wizard = get('wizard', 8);
  const spentWizard = changeResourceTracker(wizard, normalizeResourceTracker(wizard), 'slots', '4', -1);
  assert.equal(spentWizard.slots[4], 1);
  assert.equal(restResourceTracker(wizard, spentWizard, 'short').slots[4], 1);
  assert.equal(restResourceTracker(wizard, spentWizard, 'long').slots[4], 2);
  const warlock = get('warlock', 8);
  const spentWarlock = changeResourceTracker(warlock, normalizeResourceTracker(warlock), 'slots', '4', -1);
  assert.equal(restResourceTracker(warlock, spentWarlock, 'short').slots[4], 2);
  assert.deepEqual(warlock.spellcasting.slots, [{ level: 4, max: 2 }]);
  // Fremde Daten erzeugen weder weitere Paktplätze noch versteckte Ressourcen.
  assert.deepEqual(normalizeResourceTracker(warlock, { slots: { '4': 999, '9': 9 }, resources: { cheat: 300 } }),
    { slots: { '4': 2 }, resources: { magical_cunning: 1 } });
});

test('2024-Klassenressourcen: kurze Rast nach offiziellen Klassenregeln', async () => {
  const [classes, rows] = await Promise.all([loadCategory('classes'), loadCategory('levels')]);
  const get = (id, level) => getClassLevelSummary(rows, classes.find(item => item.index === id), level, { cha: 16 });
  const cases = [
    ['barbarian', 8, 'rage_count', 'one'], ['fighter', 8, 'second_wind_uses', 'one'],
    ['cleric', 8, 'channel_divinity_charges', 'one'], ['paladin', 8, 'channel_divinity_charges', 'one'],
    ['druid', 8, 'wild_shape_uses', 'one'], ['monk', 8, 'focus_points', 'all'],
    ['sorcerer', 8, 'sorcery_points', 'none'], ['ranger', 8, 'favored_enemies', 'none'],
    ['bard', 4, 'bardic_inspiration', 'none'], ['bard', 5, 'bardic_inspiration', 'all'],
  ];
  for (const [classId, level, id, expected] of cases) {
    const summary = get(classId, level);
    const resource = summary.resources.find(item => item.id === id);
    assert.equal(resource?.shortRest, expected, `${classId} Stufe ${level}`);
    const depleted = { ...normalizeResourceTracker(summary), resources: { [id]: 0 } };
    const afterShort = restResourceTracker(summary, depleted, 'short');
    assert.equal(afterShort.resources[id], expected === 'one' ? 1 : expected === 'all' ? resource.max : 0);
    assert.equal(restResourceTracker(summary, depleted, 'long').resources[id], resource.max);
  }
});

test('Ressourcentracker: alle 240 Klassentabellen, Leerstände, Grenzen und Speicherrunden', async () => {
  const [classes, rows] = await Promise.all([loadCategory('classes'), loadCategory('levels')]);
  let cases = 0;
  for (const cls of classes) for (let level = 1; level <= 20; level++) {
    const summary = getClassLevelSummary(rows, cls, level, { cha: 20, int: 18, wis: 16 });
    const initial = normalizeResourceTracker(summary);
    assert.deepEqual(restResourceTracker(summary, initial, 'short'), initial);
    assert.deepEqual(restResourceTracker(summary, initial, 'long'), initial);
    for (const [kind, list] of [['slots', summary.spellcasting?.slots?.map(slot => ({ id: String(slot.level), max: slot.max })) || []], ['resources', summary.resources]]) {
      for (const entry of list) {
        const spent = changeResourceTracker(summary, initial, kind, entry.id, -1);
        assert.equal(spent[kind][entry.id], entry.max - 1);
        const short = restResourceTracker(summary, spent, 'short');
        const recharge = kind === 'slots' ? (summary.spellcasting.pactMagic ? 'all' : 'none')
          : entry.shortRest;
        assert.equal(short[kind][entry.id], recharge === 'none' ? entry.max - 1 : entry.max);
        assert.equal(changeResourceTracker(summary, spent, kind, entry.id, 1)[kind][entry.id], entry.max);
        assert.equal(changeResourceTracker(summary, initial, kind, entry.id, 1)[kind][entry.id], entry.max);
        let empty = initial;
        for (let i = 0; i < entry.max + 2; i++) empty = changeResourceTracker(summary, empty, kind, entry.id, -1);
        assert.equal(empty[kind][entry.id], 0);
        const fromEmpty = restResourceTracker(summary, empty, 'short');
        assert.equal(fromEmpty[kind][entry.id], recharge === 'all' ? entry.max : recharge === 'one' ? 1 : 0);
        const decoded = JSON.parse(JSON.stringify(empty));
        assert.deepEqual(normalizeResourceTracker(summary, decoded), empty);
        assert.equal(restResourceTracker(summary, empty, 'long')[kind][entry.id], entry.max);
        assert.equal(initial[kind][entry.id], entry.max, 'Originalzustand darf nicht geändert werden');
        cases++;
      }
    }
  }
  assert.ok(cases >= 420, `Nur ${cases} Ressourcen-/Zauberplatzbeispiele geprüft`);
  const fighter = getClassLevelSummary(rows, classes.find(item => item.index === 'fighter'), 8);
  assert.deepEqual(normalizeResourceTracker(fighter, { resources: { second_wind_uses: -8, unknown: 10 } }).resources,
    { second_wind_uses: 0, action_surge: 1 });
  assert.throws(() => changeResourceTracker(fighter, {}, 'resources', 'unknown', -1), /Unbekannte Ressource/);
  assert.throws(() => changeResourceTracker(fighter, {}, 'resources', 'second_wind_uses', -2), /Ungültige/);
  assert.throws(() => changeResourceTracker(fighter, {}, 'slots', '1', -1), /Unbekannte Ressource/);
  assert.throws(() => restResourceTracker(fighter, {}, 'instant'), /Unbekannte Rastart/);
});

test('Studio-Verknüpfungen: referenzierte Elemente und GitHub-Pages-Einstieg existieren', async () => {
  const sourceDir = new URL('../', import.meta.url);
  const [html, javascript, homepage] = await Promise.all([
    readFile(new URL('studio.html', sourceDir), 'utf8'),
    readFile(new URL('js/studio/main.mjs', sourceDir), 'utf8'),
    readFile(new URL('index.html', sourceDir), 'utf8'),
  ]);
  const ids = [...new Set([...javascript.matchAll(/\$\(['"]#([a-zA-Z0-9_-]+)['"]\)/g)].map(match => match[1]))];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`) || javascript.includes(`.id = '${id}'`),
    `Oberflächenelement ${id} fehlt`);
  assert.ok(homepage.includes('href="studio.html#characters"'));
  assert.ok(ids.length >= 40);
  assert.match(homepage, /import \{ SAVE_KEY, IMPORT_BACKUP_KEY, emptyGame, readGame, validateGameImport,/);
  assert.match(homepage, /saveImportedGame, restoreImportedGame, resetSavedGame, inspectGameStorage, saveGame/);
  assert.ok(homepage.includes('profile:x.profile'), 'Die Hauptseite muss eingebettete Regelprofile behalten');
  assert.ok(javascript.includes('character.profile.tracker = action'), 'Tracker muss dieselben Charakterdaten aktualisieren');
  assert.ok(!javascript.includes('wuerfelbund-ruleprofiles-v1'), 'Studio darf nicht mehr in den alten Speicher schreiben');
  assert.ok(javascript.includes("if (target === 'characters') initCharacters();"));
  assert.ok(javascript.includes("if (target === 'packs') initCloud();"));
  assert.ok(!javascript.includes('initCatalog(); initCharacters(); initCloud();'), 'Unnötiges Initialisieren beim Start');
});
