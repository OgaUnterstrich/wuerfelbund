import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAMAGE_TYPES, resolveTypedDamage, applyTypedDamage, resolveTargetAc,
  getWeaponMasteryEffect, normalizeTurn, changeTurn } from '../js/rules/combat.mjs';
import { getWeaponProfile, consumeWeaponAmmo, rollWeaponDamage } from '../js/rules/gear.mjs';

const data = id => JSON.parse(readFileSync(new URL(`../data/srd-5.2.1/en/5e-SRD-${id}.json`, import.meta.url), 'utf8'));
const equipment = data('Equipment');
const fighter = data('Classes').find(entry => entry.index === 'fighter');
const weapons = equipment.filter(item => item.equipment_categories?.some(cat => cat.index === 'weapons'));
const attributes = { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 };
const state = { maxHp: 40, hitDie: 10, level: 5, conModifier: 2 };

test('2024: Widerstand vor Verwundbarkeit, Immunität vor allem und keine Stapelung', () => {
  assert.equal(DAMAGE_TYPES.length, 13);
  assert.deepEqual(resolveTypedDamage({ amount: 23, type: 'fire', resistances: ['fire', 'fire'],
    vulnerabilities: ['fire', 'fire'] }).total, 22);
  assert.equal(resolveTypedDamage({ amount: 7, type: 'cold', resistances: ['cold'] }).total, 3);
  assert.equal(resolveTypedDamage({ amount: 23, type: 'fire', immunities: ['fire'],
    vulnerabilities: ['fire'] }).total, 0);
  assert.equal(resolveTypedDamage({ amount: 9, type: 'fire', vulnerabilities: ['fire'] }).total, 18);
  assert.throws(() => resolveTypedDamage({ amount: -1, type: 'fire' }), /Ungültiger/);
  assert.throws(() => resolveTypedDamage({ amount: 10000, type: 'fire' }), /Ungültiger/);
  assert.throws(() => resolveTypedDamage({ amount: 5, type: 'unknown' }), /Ungültiger/);
  assert.throws(() => resolveTypedDamage({ amount: 5, type: 'fire', resistances: 'fire' }), /Ungültige/);
});

test('2024: Getypter Schaden erzeugt Konzentrations-SG erst nach tatsächlichem Schaden', () => {
  const before = { hp: 40, concentrating: true };
  const immune = applyTypedDamage(state, before, { amount: 24, type: 'fire', immunities: ['fire'] });
  assert.equal(immune.vitals.hp, 40);
  assert.deepEqual(immune.vitals.pendingConcentrationDCs, []);
  const resistant = applyTypedDamage(state, before, { amount: 24, type: 'fire', resistances: ['fire'] });
  assert.equal(resistant.vitals.hp, 28);
  assert.deepEqual(resistant.vitals.pendingConcentrationDCs, [10]);
  const full = applyTypedDamage(state, before, { amount: 24, type: 'cold' });
  assert.deepEqual(full.vitals.pendingConcentrationDCs, [12]);
  assert.equal(before.hp, 40);
});

test('Deckung nur einmal addieren und bei vollständiger Deckung direkte Ziele blockieren', () => {
  assert.deepEqual(resolveTargetAc(15), { blocked: false, ac: 15 });
  assert.equal(resolveTargetAc(15, 'half').ac, 17);
  assert.equal(resolveTargetAc(15, 'three-quarters').ac, 20);
  assert.deepEqual(resolveTargetAc(15, 'total'), { blocked: true, ac: null });
  assert.throws(() => resolveTargetAc(0, 'half'), /Ungültige/);
  assert.throws(() => resolveTargetAc(20, 'double'), /Ungültige/);
});

test('Alle acht SRD-Waffenmeisterschaften besitzen benannte, begrenzte Effekte', () => {
  const known = new Set(data('Weapon-Mastery-Properties').map(item => item.index));
  assert.deepEqual([...known].sort(), ['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex']);
  for (const name of known) {
    const summary = getWeaponMasteryEffect({ mastery: name, damageBonus: 3 }, { hit: true, damageDealt: true, proficiencyBonus: 3 });
    assert.equal(summary.id, name);
    assert.ok(summary.note.length > 15);
  }
  assert.deepEqual(getWeaponMasteryEffect({ mastery: null }, { hit: true }), null);
  assert.equal(getWeaponMasteryEffect({ mastery: 'graze', damageBonus: 3 }, { hit: false }).damage, 3);
  assert.equal(getWeaponMasteryEffect({ mastery: 'graze', damageBonus: -1 }, { hit: false }).damage, 0);
  assert.equal(getWeaponMasteryEffect({ mastery: 'graze', damageBonus: 3 }, { hit: true }).damage, 0);
  assert.equal(getWeaponMasteryEffect({ mastery: 'nick' }, { hit: false }).applied, false,
    'Nick ist kein automatisch angewandter Folgeangriff');
  assert.equal(getWeaponMasteryEffect({ mastery: 'topple', damageBonus: 3 }, { hit: true, proficiencyBonus: 3 }).saveDc, 14);
  assert.equal(getWeaponMasteryEffect({ mastery: 'vex' }, { hit: true }).applied, false);
  assert.equal(getWeaponMasteryEffect({ mastery: 'vex' }, { hit: true, damageDealt: true }).applied, true);
  assert.equal(getWeaponMasteryEffect({ mastery: 'slow' }, { hit: false, damageDealt: true }).applied, false);
  assert.throws(() => getWeaponMasteryEffect({ mastery: 'topple', damageBonus: 3 }, { hit: true }), /Übungsbonus/);
});

test('Masteries hängen an ausgewählter und geübter Waffe; Krit, Munition und Reichweite bleiben gekoppelt', () => {
  const inventory = { items: { longbow: 1, arrows: 1, greatsword: 1 } };
  const profile = { classId: 'fighter', level: 5, attributes, inventory, weaponMasteryIds: ['longbow', 'greatsword'] };
  const bow = getWeaponProfile({ profile, classEntry: fighter, equipment, weaponId: 'longbow' });
  assert.equal(bow.mastery, 'slow');
  assert.equal(bow.range.normal, 150);
  assert.equal(consumeWeaponAmmo(equipment, inventory, bow).items.arrows, undefined);
  assert.throws(() => consumeWeaponAmmo(equipment, { items: { longbow: 1 } }, bow), /Nicht genug/);
  const sword = getWeaponProfile({ profile, classEntry: fighter, equipment, weaponId: 'greatsword' });
  assert.equal(sword.mastery, 'graze');
  const critical = rollWeaponDamage(sword, { critical: true, roller: () => 0 });
  assert.equal(critical.rolls.length, 4);
  assert.equal(weapons.length, 38);
});

test('Aktionsmarker sind reversibel; Reset beeinflusst weder TP noch Klassenressourcen', () => {
  assert.deepEqual(normalizeTurn(), { action: false, bonus: false, reaction: false, nick: false });
  const first = changeTurn(null, 'action', true);
  const second = changeTurn(first, 'reaction', true);
  assert.equal(first.reaction, false);
  assert.deepEqual(changeTurn(second, 'reset'), normalizeTurn());
  assert.equal(changeTurn(second, 'action', false).reaction, true);
  assert.throws(() => changeTurn(second, 'unknown', true), /Ungültiger/);
  assert.throws(() => changeTurn(second, 'action', 'true'), /Ungültiger/);
  assert.equal(normalizeTurn({ action: 1 }).action, false);
});

test('Studio bindet Schaden, Deckung und Merker an den bestehenden Charakterbogen', () => {
  const script = readFileSync(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  assert.match(script, /function updateTypedDamage/);
  assert.match(script, /function updateCombatTurn/);
  assert.match(script, /resolveTargetAc\(targetAc/);
  assert.match(script, /getWeaponMasteryEffect\(weapon/);
  assert.match(script, /options\.cover === 'total'/);
});
