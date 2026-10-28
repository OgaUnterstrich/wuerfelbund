import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getD20RuleEffects, resolveD20Roll, effectiveSpeed, normalizeVitals } from '../js/rules/vitals.mjs';
import { getStartingProficiencies, basicDndCharacter, getDefenseStats } from '../js/rules/dnd55.mjs';

const state = (conditions = [], exhaustion = 0, hp = 22) => ({ conditions, exhaustion, hp, dead: false });
const rules = (conditions, kind, options = {}) => getD20RuleEffects(state(conditions), { kind, ...options });

test('Erschöpfung 2024: W20-Tests −2/Stufe, Tempo −5 ft./Stufe', () => {
  for (let level = 0; level <= 5; level++) {
    const current = state([], level);
    const effect = getD20RuleEffects(current, { kind: 'save', ability: 'con' });
    assert.equal(resolveD20Roll(effect, [12], { modifier: 5 }).total, 17 - 2 * level);
    assert.equal(effectiveSpeed(35, current), 35 - 5 * level);
  }
});

test('Bewegung 0 bei Greifen, Festsetzen, Lähmung, Versteinerung, Bewusstlosigkeit oder 0 TP', () => {
  for (const condition of ['grappled', 'restrained', 'paralyzed', 'petrified', 'unconscious']) {
    assert.equal(effectiveSpeed(60, state([condition])), 0, condition);
  }
  assert.equal(effectiveSpeed(30, state([], 0, 0)), 0);
  assert.equal(effectiveSpeed(30, state(['prone'])), 30, 'Liegend ist nicht gleich Tempo 0');
  assert.equal(effectiveSpeed(10, state([], 5)), 0, 'Tempo kann nicht negativ sein');
});

test('Vergiftet: Nachteil auf Angriff/Fertigkeitsprobe, nicht auf Rettungswurf', () => {
  assert.equal(rules(['poisoned'], 'attack').mode, 'disadvantage');
  assert.equal(rules(['poisoned'], 'check').mode, 'disadvantage');
  assert.equal(rules(['poisoned'], 'save', { ability: 'dex' }).mode, 'normal');
});

test('Geblendet und liegend: Angriffe Nachteil; geblendete Sichtprobe automatisch gescheitert', () => {
  for (const condition of ['blinded', 'prone']) assert.equal(rules([condition], 'attack').mode, 'disadvantage');
  const sight = rules(['blinded'], 'check', { requiresSight: true });
  assert.equal(resolveD20Roll(sight, [], { dc: 10 }).automaticFailure, true);
  assert.equal(rules(['blinded'], 'check').automaticFailure, false);
});

test('Festgesetzt: nur Geschicklichkeitsrettung im Nachteil', () => {
  assert.equal(rules(['restrained'], 'save', { ability: 'dex' }).mode, 'disadvantage');
  assert.equal(rules(['restrained'], 'save', { ability: 'con' }).mode, 'normal');
  assert.equal(rules(['restrained'], 'attack').mode, 'disadvantage');
});

test('Unsichtbar: Initiative Vorteil, Angriffe nur wenn Ziel den Charakter nicht sehen kann', () => {
  assert.equal(rules(['invisible'], 'initiative').mode, 'advantage');
  assert.equal(rules(['invisible'], 'attack').mode, 'normal');
  assert.equal(rules(['invisible'], 'attack', { unseenByTarget: true }).mode, 'advantage');
});

test('Furcht und Greifen hängen vom konkreten Gegner ab', () => {
  assert.equal(rules(['frightened'], 'check').mode, 'normal');
  assert.equal(rules(['frightened'], 'check', { fearSourceVisible: true }).mode, 'disadvantage');
  assert.equal(rules(['grappled'], 'attack').mode, 'normal');
  assert.equal(rules(['grappled'], 'attack', { targetsOtherThanGrappler: true }).mode, 'disadvantage');
});

test('Gleichzeitiger Vor- und Nachteil neutralisiert sich, Quellen werden angezeigt', () => {
  const effect = rules(['poisoned'], 'check', { circumstance: 'advantage' });
  assert.equal(effect.mode, 'normal');
  assert.equal(effect.advantages.length, 1);
  assert.equal(effect.disadvantages.length, 1);
  const double = rules(['poisoned', 'frightened'], 'check', { fearSourceVisible: true });
  assert.equal(double.mode, 'disadvantage');
  assert.equal(double.disadvantages.length, 2);
  assert.deepEqual(resolveD20Roll(double, [17, 3], { modifier: 2 }).rolls, [17, 3]);
  assert.equal(resolveD20Roll(double, [17, 3], { modifier: 2 }).total, 5);
});

test('Vor-/Nachteil wirkt auf das niedrigere oder höhere der zwei echten W20', () => {
  assert.equal(resolveD20Roll(rules([], 'save', { circumstance: 'advantage' }), [2, 19], { modifier: 4 }).total, 23);
  assert.equal(resolveD20Roll(rules([], 'save', { circumstance: 'disadvantage' }), [2, 19], { modifier: 4 }).total, 6);
  assert.throws(() => resolveD20Roll(rules([], 'save'), [5, 9]), /passen nicht/);
});

test('2024: Natürliche 1/20 sind nur bei Angriffen automatisch Misserfolg/Kritisch', () => {
  const attack = rules([], 'attack');
  assert.deepEqual([resolveD20Roll(attack, [1], { modifier: 15, dc: 10 }).success,
    resolveD20Roll(attack, [20], { modifier: -3, dc: 30 }).success], [false, true]);
  assert.equal(resolveD20Roll(attack, [20], { dc: 35 }).critical, true);
  assert.equal(resolveD20Roll(rules([], 'save'), [1], { modifier: 12, dc: 10 }).success, true);
  assert.equal(resolveD20Roll(rules([], 'check'), [20], { modifier: -5, dc: 25 }).success, false);
});

test('2024: Handlungsunfähigkeit blockiert Angriffe, nicht alle Rettungswürfe', () => {
  assert.throws(() => resolveD20Roll(rules(['incapacitated'], 'attack'), [15]), /nicht möglich/);
  assert.equal(rules(['incapacitated'], 'initiative').mode, 'disadvantage');
  assert.equal(rules(['incapacitated'], 'save', { ability: 'con' }).automaticFailure, false);
  assert.throws(() => resolveD20Roll(rules(['unconscious'], 'check'), [15]), /nicht möglich/);
  assert.throws(() => resolveD20Roll(getD20RuleEffects(state([], 0, 0),
    { kind: 'check', ability: 'wis' }), [15]), /nicht möglich/);
});

test('Automatische STR/DEX-Fehlschläge bei passenden Zuständen, auch bei 0 TP', () => {
  for (const condition of ['paralyzed', 'petrified', 'stunned', 'unconscious']) {
    for (const ability of ['str', 'dex']) assert.equal(rules([condition], 'save', { ability }).automaticFailure, true);
    assert.equal(rules([condition], 'save', { ability: 'con' }).automaticFailure, false);
  }
  assert.equal(getD20RuleEffects(state([], 0, 0), { kind: 'save', ability: 'dex' }).automaticFailure, true);
});

test('Nicht geübte Rüstung sowie laut SRD hinderliche Rüstung: gezielter Nachteil', () => {
  assert.equal(rules([], 'save', { ability: 'str', untrainedArmor: true }).mode, 'disadvantage');
  assert.equal(rules([], 'check', { ability: 'dex', untrainedArmor: true }).mode, 'disadvantage');
  assert.equal(rules([], 'save', { ability: 'con', untrainedArmor: true }).mode, 'normal');
  assert.equal(rules([], 'check', { skillId: 'stealth', stealthDisadvantage: true }).mode, 'disadvantage');
  assert.equal(rules([], 'check', { skillId: 'perception', stealthDisadvantage: true }).mode, 'normal');
  assert.throws(() => resolveD20Roll(rules([], 'attack', { spellAttack: true, untrainedArmor: true }), [10]), /Zauberwirken/);
  assert.equal(rules([], 'attack', { untrainedArmor: true, ability: 'cha' }).blocked, false);
});

test('Schurken-Reliable-Talent ersetzt niedrigen W20 auch bei Nachteil, danach Erschöpfung', () => {
  const effect = getD20RuleEffects(state(['poisoned'], 2), { kind: 'check', ability: 'dex' });
  const result = resolveD20Roll(effect, [2, 19], { modifier: 9, minimumD20: 10, dc: 15 });
  assert.deepEqual([result.chosen, result.kept, result.total, result.success], [2, 10, 15, true]);
});

test('Fehlende oder falsche Würfe, SG und Tempo werden abgewiesen', () => {
  assert.throws(() => getD20RuleEffects(state(), { kind: '__unbekannt' }), /Unbekannte/);
  assert.throws(() => effectiveSpeed(-4, state()), /Ungültige/);
  assert.throws(() => resolveD20Roll(rules([], 'check'), [21]), /W20-Würfe/);
  assert.throws(() => resolveD20Roll(rules([], 'check'), [3], { dc: 900 }), /Ungültiger/);
  assert.equal(normalizeVitals({ maxHp: 20, level: 2 }, { exhaustion: 3 }).exhaustion, 3);
  assert.throws(() => resolveD20Roll(getD20RuleEffects({ ...state(), dead: true },
    { kind: 'save', ability: 'wis' }), [12]), /nicht möglich/);
});

test('Alle 12 Klassen: vorhandene SRD-Rettungsübungen und Grundtempo sind kompatibel', async () => {
  const load = async name => JSON.parse(await readFile(new URL(`../data/srd-5.2.1/en/${name}.json`, import.meta.url), 'utf8'));
  const [classes, backgrounds, skills, levels, equipment] = await Promise.all([
    load('5e-SRD-Classes'), load('5e-SRD-Backgrounds'), load('5e-SRD-Skills'),
    load('5e-SRD-Levels'), load('5e-SRD-Equipment'),
  ]);
  let count = 0;
  for (const klass of classes) for (let level = 1; level <= 20; level++) {
    const attributes = { str: 12, dex: 14, con: 16, int: 10, wis: 12, cha: 10 };
    const training = getStartingProficiencies({ classEntry: klass, background: backgrounds[0],
      skills, attributes, level });
    const defense = getDefenseStats({ classEntry: klass, level, levelRows: levels,
      attributes, equipment });
    const hp = basicDndCharacter({ level, hitDie: klass.hit_die, attributes }).max_hp;
    const vitals = normalizeVitals({ maxHp: hp, level });
    assert.equal(training.savingThrows.length, 6);
    assert.equal(effectiveSpeed(defense.speed, vitals), defense.speed);
    for (const save of training.savingThrows) {
      assert.equal(Number.isInteger(resolveD20Roll(getD20RuleEffects(vitals,
        { kind: 'save', ability: save.id }), [11], { modifier: save.modifier }).total), true);
    }
    count++;
  }
  assert.equal(count, 240);
});

test('W20-Funktion ist in den bestehenden Tracker integriert und erstellt keinen zweiten Speicher', async () => {
  const script = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  const sheet = await readFile(new URL('../js/rules/character-sheet.mjs', import.meta.url), 'utf8');
  assert.match(script, /renderD20Panel\(profile, context, state, sheet\)/);
  assert.match(script, /buildCharacterSheet\(character, characterData\)/);
  assert.match(sheet, /getStartingProficiencies\(/);
  assert.match(script, /getD20RuleEffects\(state/);
  assert.match(script, /resolveD20Roll\(rule/);
  assert.match(script, /profile\.classId === 'monk' && !profile\.armorId && !profile\.shield/);
  assert.match(sheet, /profile\.levelChoices\?\.some\(choice => choice\.kind === 'feat' && choice\.featId === 'alert'\)/);
  assert.doesNotMatch(script, /localStorage\.setItem\(['"]wuerfelbund_d20/);
});

test('Initiative-Übung von Alert stammt aus dem bestätigten SRD-Talent', async () => {
  const feats = JSON.parse(await readFile(new URL('../data/srd-5.2.1/en/5e-SRD-Feats.json', import.meta.url), 'utf8'));
  const alert = feats.find(item => item.index === 'alert');
  assert.equal(alert.type, 'origin');
  assert.match(alert.description, /Initiative Proficiency/);
});
