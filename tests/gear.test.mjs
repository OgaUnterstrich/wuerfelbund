import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isWeaponProficient } from '../js/rules/dnd55.mjs';
import { getD20RuleEffects } from '../js/rules/vitals.mjs';
import { normalizeInventory, changeInventory, changeCoins, inventoryLoad,
  getWeaponProfile, consumeWeaponAmmo, rollWeaponDamage } from '../js/rules/gear.mjs';

const load = async category => JSON.parse(await readFile(new URL(`../data/srd-5.2.1/en/5e-SRD-${category}.json`, import.meta.url), 'utf8'));
const fixtures = Promise.all([load('Classes'), load('Equipment')]);
const stats = { str: 16, dex: 18, con: 14, int: 12, wis: 12, cha: 10 };
async function character(classId, weaponId, props = {}) {
  const [classes, equipment] = await fixtures;
  const klass = classes.find(entry => entry.index === classId);
  const profile = { classId, level: 5, attributes: stats, inventory: { items: { [weaponId]: 1 } }, ...props };
  const describe = (weaponIdValue = weaponId, options = {}) => getWeaponProfile({ profile,
    classEntry: klass, equipment, weaponId: weaponIdValue, ...options });
  return { klass, equipment, profile, describe };
}

test('Inventar normalisiert alte, beschädigte und fremde Gegenstände ohne Nebenspeicher', async () => {
  const [, equipment] = await fixtures;
  assert.deepEqual(normalizeInventory(equipment), { items: {}, coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } });
  const normal = normalizeInventory(equipment, { items: { dagger: 2, wish: 99, longsword: -1,
    arrows: 1.5 }, coins: { gp: 10, pp: -999, sp: 1000001 } });
  assert.deepEqual(normal.items, { dagger: 2 });
  assert.equal(normal.coins.gp, 10);
  assert.equal(normal.coins.pp, 0);
  assert.equal(normal.coins.sp, 0);
});

test('Ausrüstung und Münzen ändern sich atomar, nie unter 0 oder über dem Limit', async () => {
  const [, equipment] = await fixtures;
  const first = changeInventory(equipment, null, 'longsword', 1);
  const next = changeInventory(equipment, first, 'longsword', -1);
  assert.deepEqual(next.items, {});
  assert.deepEqual(first.items, { longsword: 1 }, 'Original bleibt unverändert');
  assert.throws(() => changeInventory(equipment, next, 'longsword', -1), /Nicht genug/);
  assert.throws(() => changeInventory(equipment, next, 'unknown', 1), /Ungültige/);
  const coins = changeCoins(equipment, next, 'gp', 51);
  assert.equal(changeCoins(equipment, coins, 'gp', -50).coins.gp, 1);
  assert.throws(() => changeCoins(equipment, coins, 'gp', -52), /Nicht genug/);
  assert.throws(() => changeCoins(equipment, coins, 'xp', 1), /Ungültige/);
});

test('Gewicht: 2024-Traglast, Münzen und SRD-Munitionspaket pro Stück', async () => {
  const [, equipment] = await fixtures;
  const inventory = { items: { dagger: 1, arrows: 20, longsword: 1 }, coins: { gp: 50 } };
  const load = inventoryLoad(equipment, inventory, 10);
  assert.equal(load.weight, 6, 'Dagger 1 lb + 20 Pfeile 1 lb + Longsword 3 lb + 50 Münzen 1 lb');
  assert.equal(load.capacity, 150);
  assert.equal(inventoryLoad(equipment, inventory, 10, 'tiny').capacity, 75);
  assert.equal(inventoryLoad(equipment, inventory, 10, 'large').capacity, 300);
  assert.equal(inventoryLoad(equipment, { items: { 'chain-mail': 5 } }, 10).overCapacity, true);
  assert.throws(() => inventoryLoad(equipment, inventory, 0), /Stärke/);
});

test('Waffenattribute: geübter Kämpfer, ungeübter Magier und Schurken-Finesse', async () => {
  const fighter = await character('fighter', 'longsword');
  assert.equal(fighter.describe().trained, true);
  assert.equal(fighter.describe().attackBonus, 6, 'STR +3 plus Übung +3 auf Stufe 5');
  assert.equal(fighter.describe().damageBonus, 3);
  assert.equal(fighter.describe().damageDice, '1d8');
  assert.equal(fighter.describe('longsword', { twoHanded: true }).damageDice, '1d10');
  const wizard = await character('wizard', 'longsword');
  assert.equal(wizard.describe().trained, false);
  assert.equal(wizard.describe().attackBonus, 3);
  const rogue = await character('rogue', 'rapier');
  assert.equal(rogue.describe().ability, 'dex');
  assert.equal(rogue.describe().attackBonus, 7);
  assert.equal(rogue.describe('rapier', { ability: 'str' }).attackBonus, 6);
  assert.throws(() => fighter.describe('longsword', { ability: 'dex' }), /gewählte Attribut/);
});

test('Mönch benutzt DEX und den größeren Martial-Arts-Würfel nur ohne Rüstung/Schild', async () => {
  const monk = await character('monk', 'quarterstaff', { level: 17 });
  assert.equal(monk.describe().ability, 'dex');
  assert.equal(monk.describe().damageDice, '1d12');
  const armored = await character('monk', 'quarterstaff', { level: 17, armorId: 'leather-armor' });
  assert.equal(armored.describe().ability, 'str');
  assert.equal(armored.describe().damageDice, '1d6');
  const longbow = await character('monk', 'longbow', { level: 17 });
  assert.equal(longbow.describe().damageDice, '1d8');
});

test('2024 Heavy, Fernkampf und Archery: echte Nachteile, eigene Klassenstile', async () => {
  const ranger = await character('ranger', 'longbow', { attributes: { ...stats, dex: 12 },
    classFeatures: { fightingStyles: ['archery'] } });
  const attack = ranger.describe();
  assert.equal(attack.trained, true);
  assert.equal(attack.attackBonus, 6, 'DEX +1, Übung +3, Archery +2');
  assert.equal(attack.heavyDisadvantage, true);
  assert.equal(attack.consumeId, 'arrows');
  const combined = getD20RuleEffects({ hp: 10 }, { kind: 'attack', ability: 'dex',
    circumstance: 'advantage', heavyWeaponDisadvantage: true, longRange: true });
  assert.equal(combined.mode, 'normal', 'Vorteil und mehrere Nachteile heben sich vollständig auf');
  assert.equal(combined.disadvantages.length, 2);
});

test('Werfen nutzt Stärke für Nahkampfwaffen und entfernt die geworfene Waffe', async () => {
  const barbarian = await character('barbarian', 'javelin', { inventory: { items: { javelin: 3 } } });
  const attack = barbarian.describe('javelin', { thrown: true });
  assert.equal(attack.ability, 'str');
  assert.equal(attack.range.normal, 30);
  assert.equal(attack.consumeId, 'javelin');
  assert.equal(consumeWeaponAmmo(barbarian.equipment, barbarian.profile.inventory, attack).items.javelin, 2);
  assert.throws(() => barbarian.describe('javelin', { twoHanded: true }), /vielseitige/);
  assert.throws(() => barbarian.describe('javelin', { thrown: true, ability: 'dex' }), /Attribut/);
});

test('Munition pro Schuss: Bogen, Armbrust und Pistole werden nicht als endlos behandelt', async () => {
  for (const [weaponId, ammoId] of [['longbow', 'arrows'], ['hand-crossbow', 'bolts'],
    ['sling', 'bullets-sling'], ['pistol', 'bullets-firearm'], ['blowgun', 'needles']]) {
    const c = await character('fighter', weaponId, { inventory: { items: { [weaponId]: 1, [ammoId]: 1 } } });
    const attack = c.describe();
    assert.equal(attack.consumeId, ammoId);
    const spent = consumeWeaponAmmo(c.equipment, c.profile.inventory, attack);
    assert.equal(spent.items[ammoId], undefined);
    assert.equal(spent.items[weaponId], 1);
    assert.throws(() => consumeWeaponAmmo(c.equipment, spent, attack), /Nicht genug/);
  }
  const blowgun = await character('rogue', 'blowgun');
  assert.equal(blowgun.describe().damageDice, '1');
  assert.equal(blowgun.describe().damageBonus, 0);
});

test('Zweihand und Schild schließen sich aus, Meisterschaft stammt aus gültiger Charakterwahl', async () => {
  const withShield = await character('fighter', 'greatsword', { shield: true });
  assert.throws(() => withShield.describe(), /beide Hände/);
  const fighter = await character('fighter', 'greatsword', {
    weaponMasteryIds: ['greatsword'], classFeatures: { fightingStyles: ['great-weapon-fighting'] },
  });
  assert.equal(fighter.describe().mastery, 'graze');
  assert.equal(fighter.describe().greatWeaponFighting, true);
  assert.equal(fighter.describe().damageDice, '2d6');
});

test('Schaden: Kritisch verdoppelt nur Würfel, Great Weapon Fighting behandelt Einsen als Drei', async () => {
  const sword = await character('fighter', 'greatsword', { classFeatures: { fightingStyles: ['great-weapon-fighting'] } });
  assert.deepEqual(rollWeaponDamage(sword.describe(), { roller: () => 0 }), { rolls: [3, 3], total: 9 });
  assert.deepEqual(rollWeaponDamage(sword.describe(), { critical: true, roller: () => 0 }),
    { rolls: [3, 3, 3, 3], total: 15 });
  const rapier = await character('rogue', 'rapier');
  assert.equal(rollWeaponDamage(rapier.describe(), { critical: true, roller: () => 0 }).total, 6);
  const blowgun = await character('fighter', 'blowgun');
  assert.equal(rollWeaponDamage(blowgun.describe(), { critical: true }).total, 1);
  assert.throws(() => rollWeaponDamage(rapier.describe(), { critical: 1 }), /Schalter/);
});

test('Datenmatrix: 38 SRD-Waffen lassen sich für 12 Klassen ohne eigene Waffenliste auswerten', async () => {
  const [classes, equipment] = await fixtures;
  const weapons = equipment.filter(item => item.equipment_categories?.some(category => category.index === 'weapons'));
  let count = 0;
  for (const klass of classes) for (const weapon of weapons) {
    const profile = { classId: klass.index, level: 5, attributes: stats, inventory: { items: { [weapon.index]: 1 } } };
    const attack = getWeaponProfile({ profile, classEntry: klass, equipment, weaponId: weapon.index });
    assert.equal(attack.trained, isWeaponProficient(klass, weapon));
    assert.ok(Number.isSafeInteger(attack.attackBonus));
    assert.ok(attack.damageDice === '1' || /\d+d\d+/.test(attack.damageDice));
    count++;
  }
  assert.equal(count, 456);
});

test('Inventar, Ausrüstung und Waffenwürfe sind im bestehenden Charakterbereich verbunden', async () => {
  const ui = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../studio.html', import.meta.url), 'utf8');
  assert.match(html, /id="tracker-inventory"/);
  assert.match(ui, /function renderInventory\(profile\)/);
  assert.match(ui, /character\.profile\.inventory = nextInventory/);
  assert.match(ui, /character\.profile\.inventory = kind === 'coins'/);
  assert.match(ui, /renderInventory\(profile\)/);
});
