/**
 * Würfelbund-Regelkern 0.3: bewusst unabhängig von D&D, Edras und Firebase.
 * Regeln sind Daten. Dieser Interpreter führt ausschließlich bekannte Effekte
 * aus; es gibt kein eval(), keine dynamischen JavaScript-Ausdrücke.
 */

export const ABILITY_SCHEMA = 1;
export const ACTIVATIONS = Object.freeze(['passive', 'action', 'bonus_action', 'reaction', 'manual']);
export const EFFECT_TYPES = Object.freeze(['modifier', 'damage', 'healing', 'temporary_hp', 'reduce_damage', 'manual']);
export const MODIFIER_TARGETS = Object.freeze(['armor_class', 'initiative', 'speed', 'max_hp', 'attack_bonus', 'spell_dc']);

const safeInteger = (value, fallback = 0) => Number.isSafeInteger(Number(value)) ? Number(value) : fallback;

export function parseDice(formula) {
  const match = /^([1-9]|1\d|20)d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/.exec(String(formula || '').trim());
  if (!match) throw new Error('Würfelformel: Erlaubt sind z. B. 2d6, 1d20+3 oder 3d8-2.');
  const count = Number(match[1]);
  const faces = Number(match[2]);
  const modifier = Number(match[3] || 0);
  if (modifier < -100 || modifier > 100) throw new Error('Würfelmodifikator außerhalb des erlaubten Bereichs.');
  return { count, faces, modifier };
}

function randomInt(max) {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    const limit = Math.floor(4294967296 / max) * max;
    do { globalThis.crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function rollDice(formula, roller = randomInt) {
  const { count, faces, modifier } = parseDice(formula);
  const rolls = Array.from({ length: count }, () => roller(faces) + 1);
  return { formula, rolls, modifier, total: rolls.reduce((sum, die) => sum + die, modifier) };
}

export function validateAbility(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['Ungültiges Fähigkeitsobjekt.'];
  if (input.schemaVersion !== ABILITY_SCHEMA) errors.push('Nicht unterstützte Schemaversion.');
  if (!/^hb\.[a-z0-9][a-z0-9.-]{3,79}$/.test(String(input.id || ''))) errors.push('Ungültige Fähigkeits-ID.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 90) errors.push('Name fehlt oder ist zu lang.');
  if (typeof input.description !== 'string' || input.description.length > 2500) errors.push('Beschreibung zu lang.');
  if (!ACTIVATIONS.includes(input.activation)) errors.push('Unbekannter Aktivierungstyp.');
  if (!Number.isInteger(input.minLevel) || input.minLevel < 1 || input.minLevel > 20) errors.push('Mindeststufe muss zwischen 1 und 20 liegen.');
  if (!Number.isInteger(input.version) || input.version < 1 || input.version > 9999) errors.push('Ungültige Versionsnummer.');
  if (typeof input.resource !== 'string' || input.resource.length > 48 || !/^[a-z0-9_.-]*$/.test(input.resource)) errors.push('Ungültiger Ressourcenname.');
  if (!Number.isInteger(input.cost) || input.cost < 0 || input.cost > 1000) errors.push('Ungültige Ressourcenkosten.');
  if (input.cost > 0 && !input.resource) errors.push('Bei Kosten muss eine Ressource angegeben werden.');
  if (!Array.isArray(input.effects) || input.effects.length < 1 || input.effects.length > 8) errors.push('Es sind 1 bis 8 Effekte erforderlich.');
  for (const effect of (Array.isArray(input.effects) ? input.effects : []).slice(0, 9)) {
    if (!effect || !EFFECT_TYPES.includes(effect.type)) { errors.push('Unbekannter Effekt.'); continue; }
    if (effect.type === 'modifier') {
      if (!MODIFIER_TARGETS.includes(effect.target)) errors.push('Unbekanntes Attribut für Modifikator.');
      if (!Number.isInteger(effect.value) || Math.abs(effect.value) > 100) errors.push('Modifikator muss eine ganze Zahl von -100 bis 100 sein.');
    } else if (effect.type !== 'manual') {
      try { parseDice(effect.dice); } catch { errors.push('Ungültige Würfelformel im Effekt.'); }
    } else if (typeof effect.note !== 'string' || effect.note.length > 2500) {
      errors.push('Manueller Effekt benötigt einen gültigen Hinweis.');
    }
  }
  return errors;
}

export function validatePack(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['Ungültiges Regelpaket.'];
  if (input.schemaVersion !== 1) errors.push('Nicht unterstützte Paketversion.');
  if (!/^pack\.[a-z0-9][a-z0-9.-]{3,79}$/.test(String(input.id || ''))) errors.push('Ungültige Paket-ID.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 90) errors.push('Paketname fehlt oder ist zu lang.');
  if (!Number.isInteger(input.version) || input.version < 1 || input.version > 9999) errors.push('Ungültige Paketversion.');
  if (!Array.isArray(input.abilities) || input.abilities.length > 100) errors.push('Zu viele Fähigkeiten.');
  const seen = new Set();
  for (const ability of (Array.isArray(input.abilities) ? input.abilities : []).slice(0, 101)) {
    errors.push(...validateAbility(ability).map(message => `${String(ability?.name || 'Fähigkeit').slice(0, 90)}: ${message}`));
    if (seen.has(ability?.id)) errors.push('Doppelte Fähigkeits-ID.');
    seen.add(ability?.id);
  }
  return errors;
}

/** Nur bekannte passive Zahlenmodifikatoren; andere Effekte bleiben regelgerecht getrennt. */
export function applyPassiveModifiers(base, abilities = []) {
  const result = { ...base };
  for (const ability of abilities) {
    if (ability.activation !== 'passive' || base.level < ability.minLevel) continue;
    for (const effect of ability.effects || []) {
      if (effect.type === 'modifier' && MODIFIER_TARGETS.includes(effect.target) && Number.isInteger(effect.value)) {
        const key = effect.target;
        if (Number.isFinite(result[key])) result[key] += effect.value;
      }
    }
  }
  return result;
}

/**
 * Führt unterstützte Aktionen isoliert aus und gibt einen neuen Zustand sowie
 * Ereignisse zurück. Schadensziele, Reichweite, Rettungswürfe und Gelegenheits-
 * reaktionen werden absichtlich nicht geraten; die Spielleitung entscheidet.
 */
export function activateAbility(ability, character, roller = randomInt) {
  const errors = validateAbility(ability);
  if (errors.length) throw new Error(errors[0]);
  if (ability.activation === 'passive') throw new Error('Passive Fähigkeiten werden nicht aktiviert.');
  const level = safeInteger(character?.level, 1);
  if (level < ability.minLevel) throw new Error('Die erforderliche Stufe wurde nicht erreicht.');
  const resources = { ...(character?.resources || {}) };
  if (ability.cost > 0) {
    const available = safeInteger(resources[ability.resource], 0);
    if (available < ability.cost) throw new Error(`Nicht genügend ${ability.resource} vorhanden.`);
    resources[ability.resource] = available - ability.cost;
  }
  const events = [];
  const state = { ...character, resources };
  for (const effect of ability.effects) {
    if (effect.type === 'manual') { events.push({ type: 'manual', note: effect.note }); continue; }
    if (effect.type === 'modifier') { events.push({ type: 'modifier', target: effect.target, value: effect.value, pending: true }); continue; }
    const rolled = rollDice(effect.dice, roller);
    if (effect.type === 'healing') state.hp = Math.min(safeInteger(character?.maxHp, Infinity), safeInteger(state.hp) + Math.max(0, rolled.total));
    if (effect.type === 'temporary_hp') state.temporaryHp = Math.max(safeInteger(state.temporaryHp), Math.max(0, rolled.total));
    events.push({ type: effect.type, dice: rolled, amount: Math.max(0, rolled.total), pending: !['healing', 'temporary_hp'].includes(effect.type) });
  }
  return { character: state, events };
}
