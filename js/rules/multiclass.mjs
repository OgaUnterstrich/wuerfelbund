/** SRD 5.2.1: ein chronologischer Klassenverlauf, keine parallele Regelengine. */
import { abilityModifier, getClassLevelSummary, proficiencyBonus } from './dnd55.mjs';

const DIE_SIZES = [6, 8, 10, 12];
const FULL_CASTERS = new Set(['bard', 'cleric', 'druid', 'sorcerer', 'wizard']);
const HALF_CASTERS = new Set(['paladin', 'ranger']);

export function normalizeLevelHistory(classId, level, history, classes) {
  if (!Array.isArray(classes) || !classes.some(entry => entry.index === classId)
    || !Number.isInteger(level) || level < 1 || level > 20) {
    throw new Error('Ungültige erste Klasse oder Gesamtstufe.');
  }
  const sequence = history == null ? Array(level).fill(classId) : history;
  const allowed = new Set(classes.map(entry => entry.index));
  if (!Array.isArray(sequence) || sequence.length !== level || sequence[0] !== classId
    || sequence.some(id => typeof id !== 'string' || !allowed.has(id))) {
    throw new Error('Die Stufenchronik muss jede Gesamtstufe genau einmal und die erste Klasse zuerst enthalten.');
  }
  return [...sequence];
}

export function classLevelsAt(history) {
  const counts = {};
  return history.map((classId, index) => {
    counts[classId] = (counts[classId] || 0) + 1;
    return { level: index + 1, classId, classLevel: counts[classId] };
  });
}

/** Nur Merkmale der echten erreichten Klassenstufe schalten ASI/Epische Gabe frei. */
export function multiclassImprovementLevels(history, rows) {
  return classLevelsAt(history).filter(step => rows.some(row => row.class?.index === step.classId
    && !row.subclass && row.level === step.classLevel
    && row.features?.some(ref => ['ability-score-improvement', 'epic-boon']
      .includes(ref.index.slice(step.classId.length + 1))))).map(step => step.level);
}

/** Übernimmt die offiziellen 2024-Voraussetzungen unmittelbar aus den SRD-Klassendaten. */
export function multiclassRequirements(history, classes, attributes, entryAttributes = {}) {
  const counts = new Set();
  for (const [index, id] of history.entries()) {
    if (counts.has(id)) continue;
    counts.add(id);
    if (index === 0) continue;
    const scores = entryAttributes[index + 1] || attributes;
    for (const classId of counts) {
      const klass = classes.find(entry => entry.index === classId);
      if (!klass?.multi_classing) throw new Error(`SRD-Multiclass-Daten fehlen: ${classId}.`);
      const data = klass.multi_classing;
      const requirements = data.prerequisites || [];
      const choice = data.prerequisite_options;
      if (requirements.some(item => !Number.isFinite(scores?.[item.ability_score?.index])
        || scores[item.ability_score.index] < item.minimum_score)) {
        throw new Error(`Ab Gesamtstufe ${index + 1} fehlen Attributsvoraussetzungen für ${klass.name}.`);
      }
      if (choice && (!Array.isArray(choice.from?.options) || !choice.from.options.some(item =>
        item.option_type === 'score_prerequisite' && Number.isFinite(scores?.[item.ability_score?.index])
        && scores[item.ability_score.index] >= item.minimum_score))) {
        throw new Error(`Ab Gesamtstufe ${index + 1} fehlen Attributsvoraussetzungen für ${klass.name}.`);
      }
    }
  }
}

export function multiclassHitPoints(history, classes, attributes, hitPoints = {}) {
  const method = hitPoints?.method || 'fixed';
  if (!['fixed', 'rolled'].includes(method)) throw new Error('Ungültige TP-Methode.');
  const rolls = hitPoints?.rolls || [];
  if (!Array.isArray(rolls)) throw new Error('Trefferwürfe müssen als Liste vorliegen.');
  const con = abilityModifier(attributes.con), missing = [], hitDice = {};
  let maxHp = 0;
  for (const [index, id] of history.entries()) {
    const die = classes.find(entry => entry.index === id)?.hit_die;
    if (!DIE_SIZES.includes(die)) throw new Error(`Ungültiger SRD-Trefferwürfel für ${id}.`);
    hitDice[die] = (hitDice[die] || 0) + 1;
    const roll = index === 0 ? die : method === 'fixed' ? Math.floor(die / 2) + 1 : rolls[index - 1];
    if (!Number.isSafeInteger(roll) || roll < 1 || roll > die) { missing.push(index + 1); continue; }
    maxHp += Math.max(1, roll + con);
  }
  return { maxHp: missing.length ? null : maxHp, missing, method, hitDice };
}

/** Gemeinsame Slots aus der Wizard-Klassentabelle, die mit der SRD-Multiclass-Tabelle übereinstimmt. */
export function multiclassSpellcasting(classLevels, classes, rows, attributes) {
  const entries = Object.entries(classLevels).filter(([id]) => id !== 'warlock' && (FULL_CASTERS.has(id) || HALF_CASTERS.has(id)));
  const warlockLevel = classLevels.warlock || 0;
  const characterLevel = Object.values(classLevels).reduce((sum, count) => sum + count, 0);
  const get = (id, level) => {
    const klass = classes.find(entry => entry.index === id);
    return klass && getClassLevelSummary(rows, klass, level, attributes, characterLevel).spellcasting;
  };
  const pact = warlockLevel ? get('warlock', warlockLevel) : null;
  let effectiveLevel = 0, slots = [];
  if (entries.length === 1) {
    const [id, level] = entries[0];
    effectiveLevel = FULL_CASTERS.has(id) ? level : Math.ceil(level / 2);
    slots = get(id, level)?.slots || [];
  } else if (entries.length > 1) {
    effectiveLevel = entries.reduce((sum, [id, level]) => sum + (FULL_CASTERS.has(id) ? level : Math.ceil(level / 2)), 0);
    if (effectiveLevel < 1 || effectiveLevel > 20) throw new Error('Ungültige kombinierte Zauberwirkerstufe.');
    slots = get('wizard', effectiveLevel)?.slots || [];
    if (!slots.length) throw new Error('Die SRD-Mehrklassen-Zauberplatztabelle fehlt.');
  }
  return { effectiveLevel, slots, pactSlots: pact?.slots || [],
    // Klassenbezogene Auswahl und Zauberattribut sind absichtlich getrennt.
    perClass: Object.fromEntries(entries.map(([id, level]) => [id, get(id, level)])),
    ...warlockLevel ? { warlock: pact } : {} };
}

/** Datensatzgesteuerte Zusatzübung – keine vollen Anfangsübungen der Zweitklasse. */
export function validateMulticlassChoices(summary, selected = [], backgroundProficiencies = []) {
  const groups = summary.additionalChoices || [];
  if (!Array.isArray(selected) || !Array.isArray(backgroundProficiencies)
    || selected.length !== groups.reduce((sum, group) => sum + group.count, 0)) {
    throw new Error('Zusätzliche Mehrklassen-Übungen sind noch nicht vollständig gewählt.');
  }
  const trained = new Set([...summary.proficiencies, ...backgroundProficiencies]);
  let position = 0;
  for (const group of groups) {
    for (let i = 0; i < group.count; i++) {
      const id = selected[position++];
      if (!id || !group.options.includes(id) || trained.has(id)) {
        throw new Error('Mehrklassen-Übungen müssen zulässig und eindeutig sein.');
      }
      trained.add(id);
    }
  }
  return selected;
}

/** Regelwerte werden berechnet; unaufgelöste Feature-Entscheidungen ausdrücklich ausgewiesen. */
export function summarizeMulticlass({ classId, level, history, classes, rows, attributes = {}, hitPoints,
  entryAttributes = {} }) {
  const sequence = normalizeLevelHistory(classId, level, history, classes);
  const steps = classLevelsAt(sequence);
  multiclassRequirements(sequence, classes, attributes, entryAttributes);
  const classLevels = Object.fromEntries([...new Set(sequence)].map(id => [id, steps.filter(step => step.classId === id).length]));
  const hp = multiclassHitPoints(sequence, classes, attributes, hitPoints);
  const spells = multiclassSpellcasting(classLevels, classes, rows, attributes);
  const start = classes.find(entry => entry.index === classId);
  const proficiencies = new Set((start.proficiencies || []).map(entry => entry.index));
  const additionalChoices = [];
  for (const id of Object.keys(classLevels).filter(id => id !== classId)) {
    const data = classes.find(entry => entry.index === id).multi_classing;
    for (const prof of data.proficiencies || []) proficiencies.add(prof.index);
    for (const choice of data.proficiency_choices || []) additionalChoices.push({ classId: id, count: choice.choose,
      options: (choice.from?.options || []).map(option => option.item?.index).filter(Boolean) });
  }
  const resources = Object.entries(classLevels).flatMap(([id, count]) =>
    getClassLevelSummary(rows, classes.find(entry => entry.index === id), count, attributes).resources
      .map(resource => ({ ...resource, id: `${id}:${resource.id}`, name: `${classes.find(item => item.index === id).name}: ${resource.name}` })));
  return { history: sequence, steps, classLevels, hp, hitDice: hp.hitDice, proficiencyBonus: proficiencyBonus(level),
    proficiencies: [...proficiencies], additionalChoices, spellcasting: spells, resources,
    manualReview: Object.keys(classLevels).length > 1 ? [
      'Zusätzliche Klassen-Fertigkeits-/Werkzeugwahl und Unterklassenmerkmale einzeln prüfen.',
      'Mehrfacher Zusätzlicher Angriff wird nicht addiert; alternative RK-Formeln einzeln wählen.',
      'Vorbereitete Zauber nach Klassenstufe wählen; höhere gemeinsame Slots schalten keine höheren Zauber frei.',
    ] : [] };
}
