/** Kleine 2024-Kampfentscheidungen, keine taktische Simulation. */
import { applyVitals, normalizeVitals } from './vitals.mjs';

export const DAMAGE_TYPES = Object.freeze([
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
]);

export function resolveTypedDamage({ amount, type, resistances = [], immunities = [], vulnerabilities = [] }) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 9999 || !DAMAGE_TYPES.includes(type)) {
    throw new Error('Ungültiger Schaden oder Schadensart.');
  }
  const lists = [resistances, immunities, vulnerabilities];
  if (lists.some(list => !Array.isArray(list) || list.length > 30 || list.some(id => !DAMAGE_TYPES.includes(id)))) {
    throw new Error('Ungültige Schadensresistenz oder -immunität.');
  }
  const immune = immunities.includes(type);
  const resistant = resistances.includes(type);
  const vulnerable = vulnerabilities.includes(type);
  // SRD 2024: Widerstand vor Verwundbarkeit, pro Art jeweils höchstens einmal.
  const afterResistance = resistant ? Math.floor(amount / 2) : amount;
  return { original: amount, type, immune, resistant, vulnerable,
    total: immune ? 0 : vulnerable ? afterResistance * 2 : afterResistance };
}

export function applyTypedDamage(context, previous, options) {
  const damage = resolveTypedDamage(options);
  return { damage, vitals: damage.total ? applyVitals(context, previous, 'damage', { amount: damage.total,
    critical: options.critical === true }) : normalizeVitals(context, previous) };
}

export const COVER = Object.freeze(['none', 'half', 'three-quarters', 'total']);
export function resolveTargetAc(baseAc, cover = 'none') {
  if (!Number.isSafeInteger(baseAc) || baseAc < 1 || baseAc > 99 || !COVER.includes(cover)) {
    throw new Error('Ungültige Rüstungsklasse oder Deckung.');
  }
  return { blocked: cover === 'total', ac: cover === 'total' ? null
    : baseAc + (cover === 'half' ? 2 : cover === 'three-quarters' ? 5 : 0) };
}

/** Ergebnis nach einem bestätigten Treffer/Fehlschlag; nicht strukturierte Ziele bleiben bei der SL. */
export function getWeaponMasteryEffect(weapon, { hit = null, damageDealt = false, proficiencyBonus = null } = {}) {
  if (!weapon?.mastery) return null;
  if (hit !== null && typeof hit !== 'boolean' || typeof damageDealt !== 'boolean') {
    throw new Error('Ungültiges Waffenmeisterschaftsergebnis.');
  }
  const id = weapon.mastery;
  if (!['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex'].includes(id)) {
    throw new Error('Unbekannte Waffenmeisterschaft.');
  }
  if (hit === null) return { id, applied: false, note: `${id}: Treffer und Ziele manuell prüfen.` };
  if (id === 'graze') return { id, applied: !hit, damage: hit ? 0 : Math.max(0, weapon.damageBonus),
    note: hit ? 'Graze greift nur beim Fehlschlag.' : 'Graze: Schaden = Angriffsattributsmodifikator, kein weiterer Angriff.' };
  if (id === 'nick') return { id, applied: false,
    note: 'Nick: Zusatzangriff mit anderer leichter Waffe in der Angriffsaktion, einmal pro Zug; Bedingungen und Merker prüfen.' };
  if (id === 'topple') {
    if (hit && (!Number.isSafeInteger(proficiencyBonus) || proficiencyBonus < 2 || proficiencyBonus > 6)) {
      throw new Error('Für Topple fehlt der gültige Übungsbonus.');
    }
    return { id, applied: hit, saveDc: hit ? 8 + weapon.damageBonus + proficiencyBonus : null,
      note: hit ? 'Ziel: KON-Rettungswurf; bei Misserfolg liegend.' : 'Topple erfordert einen Treffer.' };
  }
  const requiresDamage = ['slow', 'vex'].includes(id);
  const applied = hit && (!requiresDamage || damageDealt);
  const notes = {
    cleave: 'Cleave: möglicher weiterer Nahkampfangriff auf zweites benachbartes Ziel; einmal pro Zug prüfen.',
    nick: 'Nick: Extraangriff mit leichter Waffe in der Angriffsaktion, höchstens einmal pro Zug.',
    push: 'Push: Ziel bis Größe Groß bis zu 10 ft wegstoßen; freiwillige SL-Entscheidung.',
    sap: 'Sap: Nachteil auf nächsten Angriff des Ziels bis zum nächsten Zug.',
    slow: 'Slow: Tempo des Ziels −10 ft bis zum Beginn deines nächsten Zuges; nicht kumulativ.',
    vex: 'Vex: Vorteil auf deinen nächsten Angriff gegen dieses Ziel bis zum Ende deines nächsten Zuges.',
  };
  return { id, applied, note: applied ? notes[id] : requiresDamage && hit
    ? `${id}: erst nach nachweisbarem Schaden.` : `${id}: Voraussetzungen noch nicht erfüllt.` };
}

export function normalizeTurn(previous = {}) {
  return { action: previous?.action === true, bonus: previous?.bonus === true,
    reaction: previous?.reaction === true, nick: previous?.nick === true };
}

/** Manuelle Merker, keine automatische Sperre von Extra Attack, Action Surge oder Triggern. */
export function changeTurn(previous, key, used) {
  if (key === 'reset') return normalizeTurn();
  if (!['action', 'bonus', 'reaction', 'nick'].includes(key) || typeof used !== 'boolean') {
    throw new Error('Ungültiger Aktionsmarker.');
  }
  return { ...normalizeTurn(previous), [key]: used };
}
