/** SRD 5.2.1: noch nicht strukturierte Pflichtwahlen zu realen Klassenmerkmalen. */
import { abilityModifier } from './dnd55.mjs';
const CHOICES = [
  ['cleric-divine-order', 'Göttlicher Orden', [['protector', 'Protector · Kriegswaffen und schwere Rüstung'], ['thaumaturge', 'Thaumaturge · Zaubertrick und Wissensbonus']]],
  ['cleric-blessed-strikes', 'Gesegnete Schläge', [['divine-strike', 'Divine Strike · zusätzlicher Waffenschaden'], ['potent-spellcasting', 'Potent Spellcasting · Zaubertrickschaden']]],
  ['druid-primal-order', 'Ursprünglicher Orden', [['magician', 'Magician · Zaubertrick und Wissensbonus'], ['warden', 'Warden · Kriegswaffen und mittlere Rüstung']]],
  ['druid-elemental-fury', 'Elementare Wut', [['potent-spellcasting', 'Potent Spellcasting · Zaubertrickschaden'], ['primal-strike', 'Primal Strike · Elementarschaden']]],
  ['hunter-hunters-prey', 'Jägerbeute', [['colossus-slayer', 'Colossus Slayer'], ['horde-breaker', 'Horde Breaker']]],
  ['hunter-defensive-tactics', 'Defensive Taktiken', [['escape-the-horde', 'Escape the Horde'], ['multiattack-defense', 'Multiattack Defense']]],
  ['draconic-sorcery-elemental-affinity', 'Drakonische Affinität', ['acid', 'cold', 'fire', 'lightning', 'poison'].map(id => [id, id[0].toUpperCase() + id.slice(1)])],
  ['fiend-patron-fiendish-resilience', 'Unhold-Widerstand', ['acid', 'bludgeoning', 'cold', 'fire', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'].map(id => [id, id[0].toUpperCase() + id.slice(1)])],
];

const isFeatureUnlocked = (levels, classId, subclassId, classLevel, featureId) => levels.some(row =>
  row.class?.index === classId && row.level <= classLevel
  && (!row.subclass || row.subclass.index === subclassId)
  && row.features?.some(feature => feature.index === featureId));

const skillSpells = (spells, classId) => spells.filter(spell => spell.level === 0
  && spell.classes?.some(klass => klass.index === classId))
  .map(spell => ({ id: spell.index, name: spell.name }));

/** Tierformen aus bestehenden SRD-Monstern, keine eigenen Beast-Tabellen. */
export function wildShapeOptions(monsters = [], druidLevel = 0) {
  if (druidLevel < 2) return { count: 0, options: [], maxCr: 0, allowFly: false };
  const count = druidLevel >= 8 ? 8 : druidLevel >= 4 ? 6 : 4;
  const maxCr = druidLevel >= 8 ? 1 : druidLevel >= 4 ? 0.5 : 0.25;
  const allowFly = druidLevel >= 8;
  return { count, maxCr, allowFly,
    options: monsters.filter(monster => monster.type?.toLowerCase() === 'beast'
      && Number.isFinite(monster.challenge_rating) && monster.challenge_rating <= maxCr
      && (allowFly || !monster.speed?.fly))
      .map(monster => ({ id: monster.index, name: `${monster.name} · HG ${monster.challenge_rating}` })) };
}

/** Eine Quelle für Studio und Spielzustand; weitere Textwirkungen ausdrücklich manuell. */
export function classDecisionOptions({ classLevels, subclasses = {}, levels, languages = [], spells = [], monsters = [] }) {
  if (!classLevels || !Array.isArray(levels)) throw new Error('Klassen- und Stufendaten fehlen.');
  const groups = [];
  for (const [classId, classLevel] of Object.entries(classLevels)) {
    const subclassId = subclasses[classId] || '';
    for (const [id, label, options] of CHOICES) {
      if (!isFeatureUnlocked(levels, classId, subclassId, classLevel, id)) continue;
      groups.push({ id, classId, label, options: options.map(([value, name]) => ({ id: value, name })) });
    }
    if (classId === 'rogue' && isFeatureUnlocked(levels, classId, subclassId, classLevel, 'rogue-thieves-cant')) {
      groups.push({ id: 'rogue-thieves-cant-language', classId, label: 'Diebessprache · weitere Sprache',
        // Beide SRD-Sprachtabellen, aber keine geheimen Klassensprachen oder ohnehin bekanntes Common.
        options: languages.filter(language => !['common', 'druidic', 'thieves-cant'].includes(language.index))
          .map(language => ({ id: language.index, name: language.name })) });
    }
    const druidShapes = classId === 'druid' ? wildShapeOptions(monsters, classLevel) : { count: 0 };
    if (druidShapes.count) groups.push({ id: 'druid-wild-shape-forms', classId,
      label: 'Bekannte Tiergestalten', count: druidShapes.count, options: druidShapes.options });
  }
  return groups;
}

/** Validiert zugleich Folgewahlen der beiden Zaubertrick gewährenden Orden. */
export function validateClassDecisions({ classLevels, subclasses = {}, levels, languages = [], spells = [], monsters = [],
  choices = {}, knownLanguages = [], knownCantrips = [], strict = false }) {
  if (choices == null || typeof choices !== 'object' || Array.isArray(choices)) throw new Error('Ungültige Klassenmerkmal-Wahlen.');
  const groups = classDecisionOptions({ classLevels, subclasses, levels, languages, spells, monsters });
  for (const order of [
    ['cleric-divine-order', 'thaumaturge', 'cleric'],
    ['druid-primal-order', 'magician', 'druid'],
  ]) {
    if (choices[order[0]] === order[1] && groups.some(group => group.id === order[0])) {
      groups.push({ id: `${order[0]}-extra-cantrip`, classId: order[2], label: 'Zusätzlicher Zaubertrick',
        options: skillSpells(spells, order[2]).filter(spell => !knownCantrips.includes(spell.id)) });
    }
  }
  const active = new Set(groups.map(group => group.id));
  for (const key of Object.keys(choices)) if (!active.has(key)) {
    throw new Error(`Nicht freigeschaltete Klassenwahl: ${key}.`);
  }
  let missing = 0;
  const completed = {};
  for (const group of groups) {
    const selected = choices[group.id];
    const allowed = new Set(group.options.map(option => option.id));
    if (group.count) {
      const values = selected === undefined ? [] : selected;
      if (!Array.isArray(values) || values.length > group.count || new Set(values).size !== values.length
        || values.some(value => !allowed.has(value))) throw new Error(`${group.label}: ungültige Tierformenwahl.`);
      completed[group.id] = values;
      missing += group.count - values.length;
    } else {
      if (!selected) { missing++; continue; }
      if (typeof selected !== 'string' || !allowed.has(selected)) throw new Error(`${group.label}: ungültige Wahl.`);
      if (group.id === 'rogue-thieves-cant-language' && knownLanguages.includes(selected)) {
        throw new Error('Die zusätzliche Diebessprache muss eine noch nicht bekannte Standardsprache sein.');
      }
      completed[group.id] = selected;
    }
  }
  if (strict && missing) throw new Error(`${missing} Klassenmerkmal-Entscheidung(en) fehlen.`);
  const additionalProficiencies = [
    ...(completed['cleric-divine-order'] === 'protector' ? ['martial-weapons', 'heavy-armor'] : []),
    ...(completed['druid-primal-order'] === 'warden' ? ['martial-weapons', 'medium-armor'] : []),
  ];
  return { groups, missing, choices: completed, additionalProficiencies,
    extraCantrips: [completed['cleric-divine-order-extra-cantrip'], completed['druid-primal-order-extra-cantrip']].filter(Boolean),
    manualReview: groups.filter(group => ['hunter-hunters-prey', 'hunter-defensive-tactics',
      'draconic-sorcery-elemental-affinity', 'fiend-patron-fiendish-resilience', 'druid-wild-shape-forms'].includes(group.id))
      .map(group => `${group.label}: konkrete Ziel-, Rast- oder Formwirkung am Spieltisch prüfen.`) };
}

/** Nur nach Quellenmerkmal gewährte, genau zählbare Unterklassenressourcen. */
export function getSubclassResources({ classLevels, subclasses = {}, levels, attributes = {} }) {
  const known = [
    ['barbarian', 'berserker-intimidating-presence', 'Intimidating Presence', 1],
    ['druid', 'land-natural-recovery', 'Natural Recovery · freier Zauber', 1],
    ['druid', 'land-natural-recovery', 'Natural Recovery · Zauberplätze erholen', 1],
    ['monk', 'open-hand-wholeness-of-body', 'Wholeness of Body', Math.max(1, abilityModifier(attributes.wis))],
    ['paladin', 'devotion-holy-nimbus', 'Holy Nimbus', 1],
    ['sorcerer', 'draconic-sorcery-dragon-companion', 'Dragon Companion', 1],
    ['warlock', 'fiend-patron-dark-ones-own-luck', "Dark One's Own Luck", Math.max(1, abilityModifier(attributes.cha))],
  ];
  return known.filter(([classId, featureId]) => classLevels[classId]
    && isFeatureUnlocked(levels, classId, subclasses[classId], classLevels[classId], featureId))
    .map(([classId, featureId, name, max], index, filtered) => {
      const same = filtered.slice(0, index).filter(row => row[1] === featureId).length;
      const id = `${classId}:${featureId}${same ? `-${same + 1}` : ''}`;
      return { id, name, max, shortRest: 'none' };
    });
}

/** Stufengerechte passive Regelwerte, keine ungeprüften Angaben im Profil vertrauen. */
export function getClassDecisionEffects({ choices = {}, classLevels, subclasses = {}, levels }) {
  const has = (classId, featureId) => (classLevels[classId] || 0) > 0
    && isFeatureUnlocked(levels, classId, subclasses[classId], classLevels[classId], featureId);
  return {
    proficiencies: [
      ...(choices['cleric-divine-order'] === 'protector' && has('cleric', 'cleric-divine-order')
        ? ['martial-weapons', 'heavy-armor'] : []),
      ...(choices['druid-primal-order'] === 'warden' && has('druid', 'druid-primal-order')
        ? ['martial-weapons', 'medium-armor'] : []),
    ],
    savingThrows: has('rogue', 'rogue-slippery-mind') ? ['wis', 'cha'] : [],
    extraCantrips: [
      ...(choices['cleric-divine-order'] === 'thaumaturge' && has('cleric', 'cleric-divine-order')
        ? [choices['cleric-divine-order-extra-cantrip']] : []),
      ...(choices['druid-primal-order'] === 'magician' && has('druid', 'druid-primal-order')
        ? [choices['druid-primal-order-extra-cantrip']] : []),
    ].filter(Boolean),
  };
}
