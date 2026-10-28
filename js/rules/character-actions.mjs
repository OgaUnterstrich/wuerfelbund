/** Gemeinsame 2024-Regeln für lokale und online ausgelöste Zustandsaktionen. */
import { abilityModifier, calculateHitPoints, getClassLevelSummary, getDefenseStats,
  changeResourceTracker, normalizeResourceTracker, restResourceTracker } from './dnd55.mjs';
import { resolveOrigin } from './origins.mjs';
import { getOriginFeatureResources } from './origin-features.mjs';
import { applyVitals, normalizeVitals } from './vitals.mjs';
import { changeInventory, normalizeInventory } from './gear.mjs';
import { applyTypedDamage, changeTurn, normalizeTurn } from './combat.mjs';
import { changeMagicItems, normalizeMagicItems } from './magic-items.mjs';
import { applyEdrasAction } from './edras.mjs';
import { summarizeMulticlass, normalizeLevelHistory } from './multiclass.mjs';
import { getSubclassResources, getClassDecisionEffects } from './class-decisions.mjs';

function getProfile(character) {
  if (character?.profile?.ruleset !== 'srd-5.2.1' || character.profile.level > 20
    || !Number.isInteger(character.level) || character.level < 1 || character.level > 20) {
    throw new Error('Diese Figur besitzt kein gültiges 5.5e-Regelprofil.');
  }
  return { ...character.profile, level: character.level };
}

export function getCharacterTrackerSummary(character, catalog) {
  const profile = getProfile(character);
  const klass = catalog.classes?.find(entry => entry.index === profile.classId);
  if (!klass) throw new Error('Die 5.5e-Klassendaten fehlen.');
  const history = normalizeLevelHistory(profile.classId, profile.level, profile.levelHistory, catalog.classes);
  const classLevels = history.reduce((counts, id) => ({ ...counts, [id]: (counts[id] || 0) + 1 }), {});
  const extra = getSubclassResources({ classLevels,
    subclasses: { [profile.classId]: profile.subclassId, ...profile.secondarySubclasses },
    levels: catalog.levels, attributes: profile.attributes });
  const origin = profile.speciesId && profile.backgroundId
    && catalog.species && catalog.backgrounds && catalog.subspecies && catalog.traits && catalog.feats
    && catalog.skills && catalog.languages && catalog.proficiencies
    ? resolveOrigin({ ...catalog,
      species: catalog.species.find(entry => entry.index === profile.speciesId),
      background: catalog.backgrounds.find(entry => entry.index === profile.backgroundId),
      level: profile.level, choices: profile.originChoices || {}, classSkillIds: profile.classSkillIds || [],
      bonusSkillIds: profile.bonusSkillIds || [] }) : null;
  const originResources = getOriginFeatureResources({ profile, origin, spells: catalog.spells || [] });
  if (new Set(history).size > 1) {
    const multi = summarizeMulticlass({ classId: profile.classId, level: profile.level, history,
      classes: catalog.classes, rows: catalog.levels, attributes: profile.attributes, hitPoints: profile.hitPoints });
    const pact = multi.spellcasting.pactSlots.map(slot => ({ id: `warlock:pact-${slot.level}`,
      name: `Hexenmeister: Paktplatz Grad ${slot.level}`, max: slot.max, shortRest: 'all' }));
    return { spellcasting: { slots: multi.spellcasting.slots }, resources: [...multi.resources, ...pact, ...extra, ...originResources] };
  }
  const base = getClassLevelSummary(catalog.levels, klass, profile.level, profile.attributes);
  return { ...base, resources: [...base.resources, ...extra, ...originResources] };
}

export function getCharacterVitalContext(character, catalog) {
  const profile = getProfile(character);
  const klass = catalog.classes?.find(entry => entry.index === profile.classId);
  if (!klass) throw new Error('Klasse für Trefferpunkte nicht gefunden.');
  const history = normalizeLevelHistory(profile.classId, profile.level, profile.levelHistory, catalog.classes);
  const classLevels = history.reduce((counts, id) => ({ ...counts, [id]: (counts[id] || 0) + 1 }), {});
  const decisionEffects = getClassDecisionEffects({ choices: profile.classFeatures?.decisions || {}, classLevels,
    subclasses: { [profile.classId]: profile.subclassId, ...profile.secondarySubclasses }, levels: catalog.levels });
  const multi = new Set(history).size > 1 ? summarizeMulticlass({ classId: profile.classId,
    level: profile.level, history, classes: catalog.classes, rows: catalog.levels,
    attributes: profile.attributes, hitPoints: profile.hitPoints }) : null;
  const heritage = resolveOrigin({ ...catalog,
    species: catalog.species.find(entry => entry.index === profile.speciesId),
    background: catalog.backgrounds.find(entry => entry.index === profile.backgroundId),
    level: profile.level, choices: profile.originChoices || {},
    classSkillIds: profile.classSkillIds || [], bonusSkillIds: profile.bonusSkillIds || [],
  });
  const defense = getDefenseStats({ classEntry: klass, subclassId: profile.subclassId || '',
    level: multi?.classLevels[profile.classId] || profile.level, levelRows: catalog.levels, attributes: profile.attributes,
    equipment: catalog.equipment, armorId: profile.armorId || '', shield: profile.shield === true,
    speciesSpeed: heritage.speed, fightingStyles: profile.classFeatures?.fightingStyles || [],
    additionalProficiencies: [...(multi?.proficiencies || []), ...decisionEffects.proficiencies] });
  const hp = multi?.hp || calculateHitPoints({ level: profile.level, hitDie: klass.hit_die,
    attributes: profile.attributes, hitPoints: profile.hitPoints });
  if (hp.missing.length) throw new Error('Gespeicherte Trefferwürfe sind unvollständig. Bitte die Figur im Charakterlabor prüfen.');
  return { maxHp: hp.maxHp + defense.maxHpBonus + heritage.hpBonus, level: profile.level,
    hitDie: klass.hit_die, conModifier: abilityModifier(profile.attributes.con),
    ...(multi ? { hitDice: multi.hitDice, manualReview: multi.manualReview } : {}),
    speed: defense.speed, armorClass: defense.armorClass, untrainedArmor: !defense.trained,
    stealthDisadvantage: defense.stealthDisadvantage,
    heroicInspirationOnRest: heritage.heroicInspirationOnRest,
    resistances: heritage.resistances };
}

/** Ausschließlich bestätigte diskrete Aktionen; jede Änderung ist rein und deterministisch. */
export function applyCharacterAction(character, catalog, action) {
  const profile = getProfile(character);
  const next = { ...character, profile: { ...character.profile } };
  const kind = action?.type;
  if (kind === 'resource') {
    const summary = getCharacterTrackerSummary(character, catalog);
    const group = action.group;
    const previous = normalizeResourceTracker(summary, profile.tracker);
    const id = String(action.id);
    if (!['slots', 'resources'].includes(group) || ![-1, 1].includes(action.delta)
      || !Object.hasOwn(previous[group], id)) throw new Error('Ungültige oder unbekannte Ressource.');
    const updated = changeResourceTracker(summary, previous, group, id, action.delta);
    if (updated[group][id] === previous[group][id]) {
      throw new Error(action.delta < 0 ? 'Die Ressource ist bereits verbraucht.' : 'Die Ressource ist bereits voll.');
    }
    next.profile.tracker = updated;
  } else if (kind === 'vitals') {
    const context = getCharacterVitalContext(character, catalog);
    if (!['damage', 'heal', 'temporaryHp', 'hitDie', 'deathSave', 'stabilize'].includes(action.name)) {
      throw new Error('Unzulässige TP-Aktion.');
    }
    next.profile.vitals = applyVitals(context, profile.vitals, action.name,
      ['hitDie', 'deathSave'].includes(action.name) ? { roll: action.roll, die: action.die } : { amount: action.amount });
  } else if (kind === 'inventory') {
    if (![-1, 1].includes(action.delta)) throw new Error('Ungültige Inventaränderung.');
    next.profile.inventory = changeInventory(catalog.equipment, profile.inventory, action.id, action.delta);
  } else if (kind === 'typedDamage') {
    const context = getCharacterVitalContext(character, catalog);
    const result = applyTypedDamage(context, profile.vitals, { amount: action.amount,
      type: action.damageType, resistances: context.resistances,
      immunities: action.immune === true ? [action.damageType] : [],
      vulnerabilities: action.vulnerable === true ? [action.damageType] : [], critical: action.critical === true });
    next.profile.vitals = result.vitals;
  } else if (kind === 'magicItem') {
    next.profile.magicItems = changeMagicItems(catalog.magicItems || [], profile.magicItems, action.operation);
  } else if (kind === 'turn') {
    next.profile.combatTurn = changeTurn(profile.combatTurn, action.key, action.used);
  } else if (kind === 'rest') {
    if (!['short', 'long'].includes(action.name)) throw new Error('Ungültige Rastart.');
    const context = getCharacterVitalContext(character, catalog);
    next.profile.vitals = applyVitals(context, profile.vitals, action.name === 'short' ? 'shortRest' : 'longRest');
    next.profile.tracker = restResourceTracker(getCharacterTrackerSummary(character, catalog), profile.tracker, action.name);
    if (profile.edras) next.profile.edras = applyEdrasAction(
      { level: character.level, constitution: profile.attributes.con }, profile.edras,
      action.name === 'short' ? 'shortRest' : 'longRest', { recovery: '24h' });
  } else if (kind === 'edras') {
    if (!profile.edras || !['spend', 'nextRound'].includes(action.name)) throw new Error('Unzulässige Edras-Aktion.');
    next.profile.edras = applyEdrasAction(
      { level: character.level, constitution: profile.attributes.con }, profile.edras,
      action.name, action.name === 'spend' ? { overdraw: action.overdraw === true } : {});
  } else throw new Error('Unbekannte Cloud-Spielaktion.');
  return next;
}

export function getCharacterCounters(character, catalog) {
  const summary = getCharacterTrackerSummary(character, catalog);
  const vitals = getCharacterVitalContext(character, catalog);
  return { summary, vitals, tracker: normalizeResourceTracker(summary, character.profile.tracker),
    condition: normalizeVitals(vitals, character.profile.vitals),
    inventory: normalizeInventory(catalog.equipment, character.profile.inventory),
    magicItems: normalizeMagicItems(catalog.magicItems || [], character.profile.magicItems),
    combatTurn: normalizeTurn(character.profile.combatTurn) };
}
