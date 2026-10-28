/** 2024-Ausrüstung: SRD-Gegenstände, Inventar und verlässliche Grundangriffe. Keine zweite Kampf-Engine. */
import { abilityModifier, basicDndCharacter, isWeaponProficient } from './dnd55.mjs';
import { rollDice } from './engine.mjs';

export const COINS = Object.freeze(['cp', 'sp', 'ep', 'gp', 'pp']);
const MAX_ITEMS = 9999;
const MAX_COINS = 1000000;
const AMMO = Object.freeze({
  longbow: 'arrows', shortbow: 'arrows', 'hand-crossbow': 'bolts',
  'light-crossbow': 'bolts', 'heavy-crossbow': 'bolts', sling: 'bullets-sling',
  blowgun: 'needles', musket: 'bullets-firearm', pistol: 'bullets-firearm',
});

export function normalizeInventory(equipment, previous = {}) {
  if (!Array.isArray(equipment)) throw new Error('Ausrüstungskatalog fehlt.');
  const allowed = new Set(equipment.map(item => item.index));
  const items = {};
  if (previous?.items && typeof previous.items === 'object' && !Array.isArray(previous.items)) {
    for (const [id, value] of Object.entries(previous.items)) {
      if (allowed.has(id) && Number.isSafeInteger(value) && value > 0 && value <= MAX_ITEMS) items[id] = value;
    }
  }
  const coins = {};
  for (const id of COINS) coins[id] = Number.isSafeInteger(previous?.coins?.[id])
    && previous.coins[id] >= 0 && previous.coins[id] <= MAX_COINS ? previous.coins[id] : 0;
  return { items, coins };
}

/** delta in einzelnen Stücken; bei SRD-Munitionspaketen enthält ein Paket mehrere Stücke. */
export function changeInventory(equipment, previous, itemId, delta) {
  const inventory = normalizeInventory(equipment, previous);
  if (!equipment.some(item => item.index === itemId) || !Number.isSafeInteger(delta)
    || delta === 0 || Math.abs(delta) > MAX_ITEMS) throw new Error('Ungültige Ausrüstungsänderung.');
  const next = (inventory.items[itemId] || 0) + delta;
  if (next < 0 || next > MAX_ITEMS) throw new Error('Nicht genug Gegenstände oder Inventarlimit erreicht.');
  if (next === 0) delete inventory.items[itemId];
  else inventory.items[itemId] = next;
  return inventory;
}

export function changeCoins(equipment, previous, denomination, delta) {
  const inventory = normalizeInventory(equipment, previous);
  if (!COINS.includes(denomination) || !Number.isSafeInteger(delta) || delta === 0
    || Math.abs(delta) > MAX_COINS) throw new Error('Ungültige Münzänderung.');
  const next = inventory.coins[denomination] + delta;
  if (next < 0 || next > MAX_COINS) throw new Error('Nicht genug Münzen oder Münzlimit erreicht.');
  inventory.coins[denomination] = next;
  return inventory;
}

export function inventoryLoad(equipment, previous, strength, size = 'medium') {
  if (!Number.isSafeInteger(strength) || strength < 1 || strength > 30) throw new Error('Ungültige Stärke.');
  const inventory = normalizeInventory(equipment, previous);
  let weight = COINS.reduce((sum, id) => sum + inventory.coins[id] / 50, 0);
  const unspecified = [];
  for (const item of equipment) {
    const amount = inventory.items[item.index] || 0;
    if (!amount) continue;
    if (typeof item.weight === 'number' && item.weight >= 0) {
      weight += amount * item.weight / (item.quantity || 1);
    } else unspecified.push(item.index);
  }
  const multiplier = { tiny: .5, small: 1, medium: 1, large: 2, huge: 4, gargantuan: 8 }[size];
  if (!multiplier) throw new Error('Unbekannte Kreaturengröße.');
  return { weight: Math.round(weight * 100) / 100, capacity: strength * 15 * multiplier,
    unspecified, overCapacity: weight > strength * 15 * multiplier };
}

/** Ein Grundangriff; Sonderaktionen, situative Effekte, magische Boni und Zielwirkung bleiben manuell. */
export function getWeaponProfile({ profile, classEntry, equipment, weaponId,
  ability = 'auto', thrown = false, twoHanded = false, additionalProficiencies = [] }) {
  const weapon = equipment.find(entry => entry.index === weaponId);
  const categories = new Set(weapon?.equipment_categories?.map(entry => entry.index) || []);
  if (!categories.has('weapons') || !normalizeInventory(equipment, profile.inventory).items[weaponId]) {
    throw new Error('Diese Waffe gehört nicht zum Inventar.');
  }
  const properties = new Set(weapon.properties?.map(property => property.index) || []);
  const isRangedWeapon = categories.has('ranged-weapons');
  if (thrown && !properties.has('thrown')) throw new Error('Diese Waffe besitzt nicht die Wurfeigenschaft.');
  if (twoHanded && !properties.has('versatile')) throw new Error('Nur vielseitige Waffen haben einen Zweihand-Schadenswürfel.');
  if (profile.shield && (twoHanded || properties.has('two-handed'))) {
    throw new Error('Für diese Waffe müssen beide Hände frei sein; Schild im Charakterlabor ablegen.');
  }
  const ranged = isRangedWeapon || thrown;
  const monkWeapon = profile.classId === 'monk' && !profile.armorId && !profile.shield
    && (categories.has('simple-melee-weapons')
      || categories.has('martial-melee-weapons') && properties.has('light'));
  const possible = properties.has('finesse') || monkWeapon ? ['str', 'dex']
    : [isRangedWeapon ? 'dex' : 'str'];
  const resolved = ability === 'auto' ? possible.reduce((best, next) =>
    abilityModifier(profile.attributes[next]) > abilityModifier(profile.attributes[best]) ? next : best) : ability;
  if (!possible.includes(resolved)) throw new Error('Diese Waffe erlaubt das gewählte Attribut nicht.');
  const trained = isWeaponProficient(classEntry, weapon, additionalProficiencies);
  const proficiencyBonus = basicDndCharacter({ level: profile.level,
    hitDie: classEntry.hit_die, attributes: profile.attributes }).proficiencyBonus;
  const styles = new Set([...(profile.classFeatures?.fightingStyles || []),
    ...(profile.levelChoices || []).filter(entry => entry.kind === 'feat').map(entry => entry.featId)]);
  const archery = styles.has('archery') && isRangedWeapon ? 2 : 0;
  const statModifier = abilityModifier(profile.attributes[resolved]);
  let damageDice = (twoHanded ? weapon.two_handed_damage : weapon.damage)?.damage_dice;
  if (monkWeapon && /^1d\d+$/.test(damageDice)) {
    const monkLevel = Array.isArray(profile.levelHistory)
      ? profile.levelHistory.filter(id => id === 'monk').length : profile.level;
    const monkDie = monkLevel >= 17 ? 12 : monkLevel >= 11 ? 10 : monkLevel >= 5 ? 8 : 6;
    if (monkDie > Number(damageDice.split('d')[1])) damageDice = `1d${monkDie}`;
  }
  if (!/^([1-9]|1\d|20)d(4|6|8|10|12|20|100)$/.test(damageDice) && damageDice !== '1') {
    throw new Error('Für diese Waffe ist kein unterstützter Schadenswürfel vorhanden.');
  }
  const heavyDisadvantage = properties.has('heavy')
    && profile.attributes[isRangedWeapon ? 'dex' : 'str'] < 13;
  const range = thrown ? weapon.throw_range : weapon.range;
  return { id: weapon.index, name: weapon.name, ability: resolved, trained,
    attackBonus: statModifier + (trained ? proficiencyBonus : 0) + archery,
    damageDice, damageBonus: damageDice === '1' ? 0 : statModifier,
    damageType: weapon.damage?.damage_type?.index || 'unbekannt', range,
    heavyDisadvantage, mastery: trained && (profile.weaponMasteryIds || []).includes(weaponId)
      ? weapon.mastery?.index || null : null,
    greatWeaponFighting: styles.has('great-weapon-fighting') && !ranged
      && (twoHanded || properties.has('two-handed')),
    consumeId: properties.has('ammunition') ? AMMO[weaponId] : thrown || isRangedWeapon && properties.has('thrown')
      ? weaponId : null,
    notes: [...properties].filter(property => ['light', 'loading', 'reach', 'two-handed', 'heavy'].includes(property)),
  };
}

export function consumeWeaponAmmo(equipment, previous, weaponProfile) {
  const inventory = normalizeInventory(equipment, previous);
  return weaponProfile.consumeId ? changeInventory(equipment, inventory, weaponProfile.consumeId, -1) : inventory;
}

/** 2024-Krits verdoppeln nur Schadenswürfel; Great Weapon Fighting setzt niedrige Würfel auf 3. */
export function rollWeaponDamage(weapon, { critical = false, roller } = {}) {
  if (typeof critical !== 'boolean') throw new Error('Ungültiger Kritisch-Schalter.');
  if (weapon.damageDice === '1') return { rolls: [], total: 1 };
  const match = /^(\d+)d(\d+)$/.exec(weapon.damageDice || '');
  if (!match) throw new Error('Ungültige Waffen-Schadenswürfel.');
  const formula = `${Number(match[1]) * (critical ? 2 : 1)}d${match[2]}`;
  const rolled = roller ? rollDice(formula, roller) : rollDice(formula);
  const rolls = weapon.greatWeaponFighting ? rolled.rolls.map(value => Math.max(3, value)) : rolled.rolls;
  return { rolls, total: Math.max(0, rolls.reduce((sum, value) => sum + value, weapon.damageBonus)) };
}

/** Startpakete direkt aus den 2024-SRD-Optionen. Kategorie-Referenzen werden auswählbar, nicht erfunden. */
export function getStartingKits(source, equipment) {
  if (!source || !Array.isArray(equipment)) throw new Error('Startausrüstungsquelle fehlt.');
  const records = source.starting_equipment_options || source.equipment_options || [];
  const variants = records[0]?.from?.options || [];
  if (!Array.isArray(variants) || !variants.length) throw new Error('Keine SRD-Startausrüstung gefunden.');
  const catalog = new Map(equipment.map(item => [item.index, item]));
  const byCategory = id => equipment.filter(item => item.equipment_categories?.some(cat => cat.index === id));
  const candidates = option => {
    const from = option?.choice?.from;
    if (from?.option_set_type === 'equipment_category') return byCategory(from.equipment_category.index);
    if (from?.option_set_type === 'options_array') return from.options.flatMap(candidates);
    return [];
  };
  return variants.map((variant, position) => {
    const items = {};
    const coins = {};
    const choices = [];
    const addChoice = (label, available, count = 1) => {
      const options = [...new Map(available.map(item => [item.index, item])).values()];
      if (!options.length) throw new Error(`Auswahl „${label}“ ist im SRD-Katalog nicht auflösbar.`);
      choices.push({ id: `option-${choices.length}`, label, count,
        options: options.map(item => ({ id: item.index, name: item.name })) });
    };
    const components = variant.option_type === 'multiple' ? variant.items : [variant];
    for (const component of components) {
      if (component.option_type === 'money') {
        if (!COINS.includes(component.unit)) throw new Error('Unbekannte Startmünzen.');
        coins[component.unit] = (coins[component.unit] || 0) + component.count;
      } else if (component.option_type === 'counted_reference') {
        const reference = component.of.index;
        if (catalog.has(reference)) items[reference] = (items[reference] || 0) + component.count;
        else addChoice(component.of.name, byCategory(reference), component.count);
      } else if (component.option_type === 'choice') {
        addChoice(component.choice.desc || 'Werkzeugwahl', candidates(component));
      } else throw new Error('Nicht unterstützte SRD-Startausrüstungsoption.');
    }
    // Der gepinnte Import lässt ausgerechnet dieses im 2024-SRD genannte Bardeninstrument aus.
    if (source.index === 'bard' && position === 0) addChoice('Musical Instrument', byCategory('musical-instruments'));
    const names = Object.entries(items).map(([id, count]) => `${count > 1 ? `${count}× ` : ''}${catalog.get(id).name}`);
    const label = `${String.fromCharCode(65 + position)} · ${[
      ...names.slice(0, 3), ...(names.length > 3 ? ['…'] : []),
      ...choices.map(entry => entry.label), ...Object.entries(coins).map(([id, count]) => `${count} ${id.toUpperCase()}`),
    ].join(', ')}`;
    return { id: String(position), label, items, coins, choices };
  });
}

/** Einmalige, validierte Übernahme beider Quellen in genau den vorhandenen Inventarzähler. */
export function grantStartingKits({ classEntry, background, equipment, selection }) {
  if (!selection || typeof selection !== 'object') throw new Error('Startausrüstung nicht gewählt.');
  let inventory = normalizeInventory(equipment);
  for (const [kind, source, index] of [['class', classEntry, selection.classVariant],
    ['background', background, selection.backgroundVariant]]) {
    const variant = getStartingKits(source, equipment).find(item => item.id === index);
    if (!variant) throw new Error('Ungültige Startausrüstungsvariante.');
    for (const [id, count] of Object.entries(variant.items)) {
      inventory = changeInventory(equipment, inventory, id, count);
    }
    for (const choice of variant.choices) {
      const key = `${kind}-${choice.id}`;
      const chosen = selection.choices?.[key];
      if (!choice.options.some(option => option.id === chosen)) throw new Error(`Startausrüstung: ${choice.label} fehlt.`);
      inventory = changeInventory(equipment, inventory, chosen, choice.count);
    }
    for (const [id, count] of Object.entries(variant.coins)) {
      inventory = changeCoins(equipment, inventory, id, count);
    }
  }
  return inventory;
}
