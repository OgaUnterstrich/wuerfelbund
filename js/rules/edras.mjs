/** Öffentliche Edras-Hausregeln als optionaler Aufsatz auf SRD 5.2.1.
 * Keine geheimen Fragebogenwerte oder Kampagnenrechte in diesem Modul.
 */
import { abilityModifier, proficiencyBonus } from './dnd55.mjs';
import { verifyEdrasPublicAssessment } from './edras-questionnaire.mjs';
import { getD20RuleEffects } from './vitals.mjs';

export const EDRAS_ID = 'edras-5.5-v0.1';

/** Explizite Edras-Sperren; andere Welten behalten die vollständige SRD-Auswahl.
 * Mehrdeutige Erkenntnis- und Heilzauber (z. B. Divination, Regenerate)
 * bleiben auswählbar; ihre erzählerischen Grenzen klärt die Spielleitung.
 */
export const EDRAS_FORBIDDEN_SPELLS = Object.freeze([
  'revivify', 'raise-dead', 'resurrection', 'true-resurrection', 'clone',
  'wish', 'plane-shift', 'gate', 'teleport', 'teleportation-circle',
]);

export const EDRAS_TECHNIQUES = Object.freeze([
  { id: 'W', name: 'Standfester Kreis', action: 'Reaktion', effect: '1W4 + Übungsbonus Schaden verhindern (1,5 m).' },
  { id: 'P', name: 'Unbeachteter Schritt', action: 'Bonusaktion', effect: '3 m bewegen, ohne Gelegenheitsangriff eines gewählten Gegners.' },
  { id: 'K', name: 'Schutzmarke', action: 'Aktion', effect: '+2 auf nächsten Rettungswurf gegen Riss/Resonanz (Berührung).' },
  { id: 'R', name: 'Nahtbefund', action: 'Aktion', effect: 'Störungsart in 9 m untersuchen; SL entscheidet über die Auskunft.' },
  { id: 'E', name: 'Zeugeneid', action: 'Reaktion', effect: '+1W4 auf eine Fertigkeitsprobe eines Verbündeten in 9 m mit konkreter Hilfe.' },
  { id: 'L', name: 'Atemversatz', action: 'Reaktion', effect: '+2 auf einen eben misslungenen GE-Rettungswurf.' },
  { id: 'S', name: 'Gemeinsamer Takt', action: 'Bonusaktion', effect: '+1W4 für eine passende Probe einer Kreatur in 9 m.' },
  { id: 'G', name: 'Verdeckter Anker', action: 'Aktion', effect: '10 Minuten Markierung; Vorteil beim Aufspüren einer späteren Liturgiemarke.' },
]);

const clamp = (value, min, max, fallback) => Number.isSafeInteger(value)
  ? Math.max(min, Math.min(max, value)) : fallback;

export function edrasMaximum(level, constitution, potential) {
  if (!Number.isInteger(level) || level < 1 || level > 20 || !Number.isInteger(potential) || potential < 1 || potential > 5) {
    throw new Error('Ungültige Edras-Stufe oder ungültiges Potenzial.');
  }
  return Math.max(3, 2 + proficiencyBonus(level) + abilityModifier(constitution) + (potential >= 4 ? 1 : 0));
}

/** Belastungsfolgen nur für tatsächliche Edras-Technikproben, nie pauschal für D&D-Proben. */
export function edrasTechniqueRules(state) {
  if (!Number.isInteger(state?.stress) || state.stress < 0 || state.stress > 5) {
    throw new Error('Ungültige Edras-Belastung für Technikproben.');
  }
  return { disadvantage: state.stress >= 2, dcPenalty: state.stress >= 4 ? -2 : 0,
    blocked: state.stress === 5 };
}

/** Nur eine explizit angeforderte Technikprobe: alle gewöhnlichen W20-Zustände bleiben wirksam. */
export function getEdrasTechniqueD20Rules(edrasState, vitals, options = {}) {
  const effect = edrasTechniqueRules(edrasState);
  const base = getD20RuleEffects(vitals, { ...options, kind: 'check' });
  const disadvantages = [...base.disadvantages,
    ...(effect.disadvantage ? ['Edras-Belastung ab 2'] : [])];
  return { ...base, disadvantages,
    mode: disadvantages.length && base.advantages.length ? 'normal'
      : disadvantages.length ? 'disadvantage' : base.mode,
    blocked: effect.blocked || base.blocked,
    blockReason: effect.blocked ? 'Edras-Technik bei Belastung 5 gesperrt.' : base.blockReason,
    techniqueDcPenalty: effect.dcPenalty };
}

/** Das Objekt wird nur im Charakterprofil gespeichert, nie im 5.5e-Slot-Tracker. */
export function normalizeEdrasState({ level, constitution }, previous) {
  if (!previous || previous.version !== EDRAS_ID
    || !EDRAS_TECHNIQUES.some(technique => technique.id === previous.techniqueId)) {
    throw new Error('Edras-Regelprofil fehlt oder hat eine unbekannte Version/Technik.');
  }
  // Potenzial ist eine nicht beliebig ersetzbare Charakterentscheidung.
  const potential = Number.isInteger(previous.potential) && previous.potential >= 1 && previous.potential <= 5
    ? previous.potential : NaN;
  const max = edrasMaximum(level, constitution, potential);
  let publicAssessment = null;
  if (previous.publicAssessment != null) {
    const derived = verifyEdrasPublicAssessment(previous.publicAssessment);
    if (derived.potential !== potential || derived.techniqueId !== previous.techniqueId) {
      throw new Error('Edras-Abgleich und gewählte Potenzial-/Technikwerte widersprechen sich.');
    }
    publicAssessment = previous.publicAssessment;
  }
  return {
    version: EDRAS_ID, techniqueId: previous.techniqueId, potential,
    lifeEnergy: clamp(previous.lifeEnergy, 0, max, max),
    stress: clamp(previous.stress, 0, 5, 0),
    shortRecoveryUsed: previous.shortRecoveryUsed === true,
    overdrawUsed: previous.overdrawUsed === true,
    lastEnergyStressUsed: previous.lastEnergyStressUsed === true,
    usedThisRound: previous.usedThisRound === true,
    ...(publicAssessment ? { publicAssessment } : {}),
  };
}

export function makeEdrasState({ level, constitution, potential, techniqueId, publicAssessment = null }) {
  const max = edrasMaximum(level, constitution, potential);
  return normalizeEdrasState({ level, constitution }, {
    version: EDRAS_ID, techniqueId, potential, lifeEnergy: max, publicAssessment,
  });
}

/** Jede Änderung ist deterministisch; Würfe und GM-Freigaben bleiben außerhalb. */
export function applyEdrasAction(context, previous, action, options = {}) {
  const state = normalizeEdrasState(context, previous);
  const max = edrasMaximum(context.level, context.constitution, state.potential);
  switch (action) {
    case 'spend': {
      if (state.stress === 5) throw new Error('Bei Belastung 5 sind LE-Techniken gesperrt.');
      if (state.usedThisRound) throw new Error('Höchstens eine LE-Technik pro Kampfrunde.');
      if (state.lifeEnergy > 0) {
        state.lifeEnergy--;
        if (state.lifeEnergy === 0 && state.potential === 5 && !state.lastEnergyStressUsed) {
          state.stress = Math.min(5, state.stress + 1);
          state.lastEnergyStressUsed = true;
        }
      } else {
        if (!options.overdraw) throw new Error('Keine Lebensenergie mehr verfügbar.');
        if (state.overdrawUsed || state.stress >= 3) throw new Error('Überzug ist derzeit nicht erlaubt.');
        state.overdrawUsed = true;
        state.stress = Math.min(5, state.stress + 2);
      }
      state.usedThisRound = true;
      return state;
    }
    case 'nextRound': state.usedThisRound = false; return state;
    case 'shortRest':
      if (!state.shortRecoveryUsed && state.lifeEnergy < max) {
        state.lifeEnergy = Math.min(max, state.lifeEnergy + 1 + proficiencyBonus(context.level));
        state.shortRecoveryUsed = true;
      }
      state.usedThisRound = false;
      return state;
    case 'longRest':
      state.lifeEnergy = max;
      state.stress = Math.max(0, state.stress - (options.recovery === '24h' ? 2 : options.recovery === 'safe' ? 1 : 0));
      state.shortRecoveryUsed = false;
      state.overdrawUsed = false;
      state.lastEnergyStressUsed = false;
      state.usedThisRound = false;
      return state;
    case 'stress':
      if (![1, -1].includes(options.change)) throw new Error('Belastung nur in Einzelschritten verändern.');
      state.stress = Math.max(0, Math.min(5, state.stress + options.change));
      return state;
    default: throw new Error('Unbekannte Edras-Aktion.');
  }
}
