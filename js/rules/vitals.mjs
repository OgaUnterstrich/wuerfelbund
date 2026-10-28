/** Laufender 2024-Charakterzustand. Weltmodule/Zauberplätze bleiben unabhängig. */
export const CONDITIONS = Object.freeze([
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated',
  'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained',
  'stunned', 'unconscious',
]);
const BREAKS_CONCENTRATION = new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']);
const clamp = (value, min, max, fallback) => Number.isSafeInteger(value)
  ? Math.max(min, Math.min(max, value)) : fallback;
const validOr = (value, min, max, fallback) => Number.isSafeInteger(value) && value >= min && value <= max
  ? value : fallback;

export function normalizeVitals({ maxHp, level, hitDice }, previous = {}) {
  if (!Number.isSafeInteger(maxHp) || maxHp < 1 || !Number.isInteger(level) || level < 1 || level > 20) {
    throw new Error('Ungültige Lebenspunkte oder Klassenstufe.');
  }
  const hp = clamp(previous?.hp, 0, maxHp, maxHp);
  // Ungültige gespeicherte Werte dürfen weder Tod (Erschöpfung 6) noch riesige Temp-TP erzeugen.
  const exhaustion = validOr(previous?.exhaustion, 0, 6, 0);
  const conditions = [...new Set(Array.isArray(previous?.conditions)
    ? previous.conditions.filter(id => CONDITIONS.includes(id)) : [])];
  const dead = previous?.dead === true || exhaustion === 6 || hp === 0 && previous?.deathSaves?.failures >= 3;
  const stable = hp === 0 && !dead && previous?.stable === true;
  const concentrating = !dead && hp > 0 && !conditions.some(id => BREAKS_CONCENTRATION.has(id))
    && previous?.concentrating === true;
  const dicePool = hitDice;
  const tracked = dicePool && typeof dicePool === 'object' && !Array.isArray(dicePool);
  const spentByDie = tracked ? Object.fromEntries(Object.entries(dicePool)
    .filter(([die, count]) => [6, 8, 10, 12].includes(Number(die)) && Number.isInteger(count) && count > 0)
    .map(([die, count]) => [die, clamp(previous?.hitDiceSpentByDie?.[die], 0, count,
      Object.keys(dicePool).length === 1 ? clamp(previous?.hitDiceSpent, 0, count, 0) : 0)])) : null;
  return {
    hp, tempHp: validOr(previous?.tempHp, 0, 9999, 0),
    hitDiceSpent: tracked ? Object.values(spentByDie).reduce((sum, count) => sum + count, 0)
      : clamp(previous?.hitDiceSpent, 0, level, 0),
    ...(tracked ? { hitDiceSpentByDie: spentByDie } : {}),
    deathSaves: hp && !dead || stable ? { successes: 0, failures: 0 } : {
      successes: clamp(previous?.deathSaves?.successes, 0, 2, 0),
      failures: clamp(previous?.deathSaves?.failures, 0, 3, 0),
    },
    stable, dead, exhaustion, conditions,
    concentrating,
    pendingConcentrationDCs: concentrating && Array.isArray(previous?.pendingConcentrationDCs)
      ? previous.pendingConcentrationDCs.filter(dc => Number.isInteger(dc) && dc >= 10 && dc <= 30).slice(0, 30) : [],
    heroicInspiration: previous?.heroicInspiration === true,
  };
}

/** Der Wurf selbst erfolgt mit der vorhandenen Würfelfunktion; hier nur Regelentscheidungen. */
export function applyVitals(context, previous, action, options = {}) {
  const state = normalizeVitals(context, previous);
  const amount = options.amount;
  const requirePositive = () => {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 9999) throw new Error('Betrag muss zwischen 1 und 9999 liegen.');
  };
  switch (action) {
    case 'damage': {
      requirePositive();
      if (state.dead) throw new Error('Verstorbene Figuren erhalten keinen regulären Schaden.');
      const remaining = Math.max(0, amount - state.tempHp);
      state.tempHp = Math.max(0, state.tempHp - amount);
      if (state.hp === 0) {
        state.stable = false;
        state.deathSaves.failures = Math.min(3, state.deathSaves.failures + (options.critical ? 2 : 1));
        state.dead = amount >= context.maxHp || state.deathSaves.failures >= 3;
      } else {
        const excess = Math.max(0, remaining - state.hp);
        state.hp = Math.max(0, state.hp - remaining);
        if (state.hp === 0) {
          state.dead = excess >= context.maxHp;
          state.deathSaves = { successes: 0, failures: 0 };
        }
      }
      if (state.hp === 0) { state.concentrating = false; state.pendingConcentrationDCs = []; }
      else if (state.concentrating) state.pendingConcentrationDCs.push(Math.min(30, Math.max(10, Math.floor(amount / 2))));
      break;
    }
    case 'heal':
      requirePositive();
      if (state.dead) throw new Error('Verstorbene Figuren benötigen einen eigenen Wiederbelebungseffekt.');
      state.hp = Math.min(context.maxHp, state.hp + amount);
      if (state.hp > 0) { state.stable = false; state.deathSaves = { successes: 0, failures: 0 }; }
      break;
    case 'temporaryHp':
      requirePositive();
      if (state.dead) throw new Error('Verstorbene Figuren können keine temporären TP erhalten.');
      state.tempHp = Math.max(state.tempHp, amount); // 2024: nicht addieren
      break;
    case 'deathSave': {
      const roll = options.roll;
      if (!Number.isInteger(roll) || roll < 1 || roll > 20) throw new Error('Todesrettungswurf muss W20 sein.');
      if (state.hp > 0 || state.stable || state.dead) throw new Error('Momentan ist kein Todesrettungswurf nötig.');
      if (roll === 20) state.hp = 1;
      else if (roll >= 10) state.deathSaves.successes++;
      else state.deathSaves.failures += roll === 1 ? 2 : 1;
      if (state.deathSaves.successes >= 3) state.stable = true;
      if (state.deathSaves.failures >= 3) state.dead = true;
      break;
    }
    case 'stabilize':
      if (state.hp !== 0 || state.dead) throw new Error('Nur lebende Figuren bei 0 TP können stabilisiert werden.');
      state.stable = true;
      break;
    case 'hitDie': {
      const roll = options.roll;
      const die = options.die || context.hitDie;
      if (!Number.isSafeInteger(roll) || roll < 1 || ![6, 8, 10, 12].includes(die) || roll > die
        || !Number.isInteger(context.conModifier) || context.conModifier < -5 || context.conModifier > 15) {
        throw new Error('Ungültiger Trefferwürfel oder Konstitutionsmodifikator.');
      }
      if (state.hp === 0 || state.dead || state.hitDiceSpent >= context.level) throw new Error('Trefferwürfel können gerade nicht ausgegeben werden.');
      if (state.hitDiceSpentByDie) {
        if (!Object.hasOwn(state.hitDiceSpentByDie, die)
          || state.hitDiceSpentByDie[die] >= context.hitDice[die]) throw new Error('Für diesen Würfeltyp sind keine Trefferwürfel mehr übrig.');
        state.hitDiceSpentByDie[die]++;
      }
      state.hitDiceSpent++;
      state.hp = Math.min(context.maxHp, state.hp + Math.max(1, roll + context.conModifier));
      break;
    }
    case 'exhaustion':
      if (![-1, 1].includes(options.change)) throw new Error('Erschöpfung nur um eine Stufe ändern.');
      if (state.dead) throw new Error('Der Zustand einer verstorbenen Figur kann nicht regulär verändert werden.');
      state.exhaustion = Math.min(6, Math.max(0, state.exhaustion + options.change));
      if (state.exhaustion === 6) { state.dead = true; state.concentrating = false; state.pendingConcentrationDCs = []; }
      break;
    case 'condition': {
      const id = options.id;
      if (!CONDITIONS.includes(id)) throw new Error('Unbekannter 2024-Zustand.');
      if (state.dead) throw new Error('Der Zustand einer verstorbenen Figur kann nicht regulär verändert werden.');
      state.conditions = state.conditions.includes(id)
        ? state.conditions.filter(entry => entry !== id) : [...state.conditions, id];
      if (state.conditions.some(entry => BREAKS_CONCENTRATION.has(entry))) { state.concentrating = false; state.pendingConcentrationDCs = []; }
      break;
    }
    case 'concentration':
      if (options.active && (state.dead || state.hp === 0 || state.conditions.some(id => BREAKS_CONCENTRATION.has(id)))) {
        throw new Error('In diesem Zustand ist Konzentration nicht möglich.');
      }
      state.concentrating = options.active === true;
      state.pendingConcentrationDCs = [];
      break;
    case 'concentrationSave':
      if (!state.concentrating || !state.pendingConcentrationDCs.length || typeof options.success !== 'boolean') {
        throw new Error('Kein offener Konzentrationsrettungswurf oder ungültiges Ergebnis.');
      }
      if (options.success) state.pendingConcentrationDCs.shift();
      else { state.concentrating = false; state.pendingConcentrationDCs = []; }
      break;
    case 'inspiration': state.heroicInspiration = options.active === true; break;
    case 'longRest':
      if (state.dead || state.hp === 0) throw new Error('Eine lange Rast kann nur mit mindestens 1 TP begonnen werden.');
      state.hp = context.maxHp;
      state.tempHp = 0;
      state.hitDiceSpent = 0;
      if (state.hitDiceSpentByDie) for (const die of Object.keys(state.hitDiceSpentByDie)) state.hitDiceSpentByDie[die] = 0;
      state.exhaustion = Math.max(0, state.exhaustion - 1);
      state.concentrating = false;
      state.pendingConcentrationDCs = [];
      state.deathSaves = { successes: 0, failures: 0 };
      if (context.heroicInspirationOnRest === true) state.heroicInspiration = true;
      break;
    case 'shortRest':
      if (state.dead || state.hp === 0) throw new Error('Eine kurze Rast kann nur mit mindestens 1 TP begonnen werden.');
      break; // Heilung ausschließlich durch einzeln ausgegebene Trefferwürfel.
    default: throw new Error('Unbekannte Charakterzustandsaktion.');
  }
  return normalizeVitals(context, state);
}

/** 2024-Bewegung: Erschöpfung senkt das Tempo, bestimmte Zustände setzen es auf 0. */
export function effectiveSpeed(baseSpeed, state) {
  if (!Number.isSafeInteger(baseSpeed) || baseSpeed < 0) throw new Error('Ungültige Grundbewegung.');
  const conditions = new Set(state?.conditions || []);
  if (state?.dead || state?.hp === 0 || ['grappled', 'restrained', 'paralyzed', 'petrified', 'unconscious']
    .some(id => conditions.has(id))) return 0;
  return Math.max(0, baseSpeed - 5 * (state?.exhaustion || 0));
}

/** Nur sichere 2024-W20-Folgen; Sichtlinie, Greifer und weitere Umstände bleiben explizite Angaben. */
export function getD20RuleEffects(state, options = {}) {
  const { kind, ability = '', skillId = '', circumstance = 'normal',
    fearSourceVisible = false, targetsOtherThanGrappler = false,
    unseenByTarget = false, requiresSight = false,
    untrainedArmor = false, stealthDisadvantage = false, spellAttack = false,
    heavyWeaponDisadvantage = false, longRange = false } = options;
  if (!['check', 'save', 'attack', 'initiative'].includes(kind)
    || !['normal', 'advantage', 'disadvantage'].includes(circumstance)) throw new Error('Unbekannte W20-Probe.');
  const conditions = new Set(state?.conditions || []);
  if (state?.hp === 0) conditions.add('unconscious');
  const incapacitated = state?.dead || ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']
    .some(id => conditions.has(id));
  const isCheck = kind === 'check' || kind === 'initiative';
  const attack = kind === 'attack';
  const advantages = [];
  const disadvantages = [];
  if (circumstance === 'advantage') advantages.push('Situativer Vorteil');
  if (circumstance === 'disadvantage') disadvantages.push('Situativer Nachteil');
  if ((attack && unseenByTarget || kind === 'initiative') && conditions.has('invisible')) advantages.push('Unsichtbar');
  if (attack && ['blinded', 'prone', 'restrained'].some(id => conditions.has(id))) disadvantages.push('Zustand (Angriff)');
  if (attack && heavyWeaponDisadvantage) disadvantages.push('Schwere Waffe: Attribut unter 13');
  if (attack && longRange) disadvantages.push('Lange Waffenreichweite');
  if (attack && conditions.has('grappled') && targetsOtherThanGrappler) disadvantages.push('Angriff nicht gegen Greifer');
  if ((attack || isCheck) && conditions.has('poisoned')) disadvantages.push('Vergiftet');
  if ((attack || isCheck) && conditions.has('frightened') && fearSourceVisible) disadvantages.push('Furchtquelle sichtbar');
  if (kind === 'save' && ability === 'dex' && conditions.has('restrained')) disadvantages.push('Festgesetzt (GE-Rettung)');
  if (kind === 'initiative' && incapacitated) disadvantages.push('Handlungsunfähig bei Initiative');
  if ((kind === 'check' || kind === 'save' || attack || kind === 'initiative')
    && ['str', 'dex'].includes(ability) && untrainedArmor) disadvantages.push('Rüstung ohne Übung');
  if (kind === 'check' && skillId === 'stealth' && stealthDisadvantage) disadvantages.push('Rüstung: Heimlichkeit');
  const automaticFailure = (kind === 'save' && ['str', 'dex'].includes(ability)
      && ['paralyzed', 'petrified', 'stunned', 'unconscious'].some(id => conditions.has(id)))
    || (kind === 'check' && requiresSight && conditions.has('blinded'));
  return {
    kind,
    mode: advantages.length && !disadvantages.length ? 'advantage'
      : disadvantages.length && !advantages.length ? 'disadvantage' : 'normal',
    advantages, disadvantages,
    penalty: -2 * (Number.isInteger(state?.exhaustion) ? Math.max(0, Math.min(6, state.exhaustion)) : 0),
    automaticFailure, blocked: state?.dead === true
      || kind === 'check' && (conditions.has('unconscious') || conditions.has('petrified'))
      || attack && (incapacitated || spellAttack && untrainedArmor),
    blockReason: spellAttack && untrainedArmor ? 'Zauberwirken in ungeübter Rüstung ist nicht möglich.' : null,
  };
}

/** Bereits geworfene W20 aus der gemeinsamen Würfel-Engine auswerten, ohne selbst Zufall zu erzeugen. */
export function resolveD20Roll(rules, rolls, { modifier = 0, minimumD20 = null, dc = null } = {}) {
  if (rules.blocked) throw new Error(rules.blockReason || 'In diesem Zustand ist diese W20-Probe nicht möglich.');
  if (!Number.isSafeInteger(modifier) || Math.abs(modifier) > 100
    || minimumD20 !== null && (!Number.isInteger(minimumD20) || minimumD20 < 1 || minimumD20 > 20)
    || dc !== null && (!Number.isInteger(dc) || dc < 1 || dc > 99)) throw new Error('Ungültiger W20-Modifikator oder SG.');
  if (rules.automaticFailure) return { automaticFailure: true, success: dc === null ? null : false };
  if (!Array.isArray(rolls) || rolls.length !== (rules.mode === 'normal' ? 1 : 2)
    || rolls.some(value => !Number.isInteger(value) || value < 1 || value > 20)) {
    throw new Error('W20-Würfe passen nicht zum Vor-/Nachteil.');
  }
  const chosen = rules.mode === 'advantage' ? Math.max(...rolls)
    : rules.mode === 'disadvantage' ? Math.min(...rolls) : rolls[0];
  const kept = Math.max(chosen, minimumD20 || 1);
  const total = kept + modifier + rules.penalty;
  const critical = rules.kind === 'attack' && chosen === 20;
  const automaticMiss = rules.kind === 'attack' && chosen === 1;
  return { rolls, chosen, kept, total, automaticFailure: false,
    critical, automaticMiss,
    success: dc === null ? null : critical || !automaticMiss && total >= dc };
}
