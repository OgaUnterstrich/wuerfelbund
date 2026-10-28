/** Lesemodell für den Spielbogen: Werte aus den bestehenden 2024-SRD-Regeln, kein eigener Regelkern. */
import { abilityModifier, proficiencyBonus, getStartingProficiencies,
  getClassLevelSummary } from './dnd55.mjs';
import { normalizeLevelHistory } from './multiclass.mjs';
import { resolveOrigin } from './origins.mjs';
import { validateAdditionalSkilled } from './origin-features.mjs';
import { getClassDecisionEffects } from './class-decisions.mjs';
import { classSpellSources } from './casting.mjs';
import { getCharacterVitalContext } from './character-actions.mjs';
import { normalizeVitals, getD20RuleEffects } from './vitals.mjs';

export const ABILITY_NAMES = Object.freeze({ str: 'Stärke', dex: 'Geschicklichkeit',
  con: 'Konstitution', int: 'Intelligenz', wis: 'Weisheit', cha: 'Charisma' });
const ABILITIES = Object.keys(ABILITY_NAMES);

/** Reiner Profil-Snapshot auch bei noch nicht abgeschlossenen Wahlfeldern. */
export function buildCharacterSheet(character, catalog) {
  const profile = character?.profile;
  if (!profile || profile.ruleset !== 'srd-5.2.1' || !Array.isArray(catalog?.classes)) {
    throw new Error('Es liegt kein gültiger SRD-5.2.1-Charakter vor.');
  }
  const level = character.level;
  const primary = catalog.classes.find(entry => entry.index === profile.classId);
  const species = catalog.species?.find(entry => entry.index === profile.speciesId);
  const background = catalog.backgrounds?.find(entry => entry.index === profile.backgroundId);
  if (!primary || !species || !background || !profile.attributes) {
    throw new Error('Klasse, Spezies, Hintergrund oder Attribute fehlen.');
  }
  const history = normalizeLevelHistory(profile.classId, level, profile.levelHistory, catalog.classes);
  const classLevels = history.reduce((counts, id) => {
    counts[id] = (counts[id] || 0) + 1;
    return counts;
  }, {});
  const origin = resolveOrigin({ ...catalog, species, background, level, choices: profile.originChoices || {},
    classSkillIds: profile.classSkillIds || [], bonusSkillIds: profile.bonusSkillIds || [] });
  const basicSkills = (background.proficiencies || []).filter(entry => entry.index.startsWith('skill-'))
    .map(entry => entry.index.slice(6));
  const basicTools = (background.proficiencies || []).filter(entry => !entry.index.startsWith('skill-'))
    .map(entry => entry.index);
  const skilled = validateAdditionalSkilled({ profile, skills: catalog.skills, proficiencies: catalog.proficiencies,
    baseSkills: [...(profile.classSkillIds || []), ...(profile.bonusSkillIds || []),
      ...origin.skillIds, ...basicSkills], baseTools: [...origin.toolIds, ...basicTools] });
  const decisions = getClassDecisionEffects({ choices: profile.classFeatures?.decisions || {}, classLevels,
    subclasses: { [profile.classId]: profile.subclassId, ...profile.secondarySubclasses }, levels: catalog.levels });
  const training = getStartingProficiencies({ classEntry: primary, background, skills: catalog.skills,
    classSkillIds: profile.classSkillIds || [], bonusSkillIds: profile.bonusSkillIds || [],
    expertiseIds: profile.expertiseIds || [], extraSkillIds: [...origin.skillIds, ...skilled.skills,
      ...(profile.multiclassProficiencyIds || []).filter(id => id.startsWith('skill-')).map(id => id.slice(6))],
    subclassId: profile.subclassId || '', attributes: profile.attributes, level,
    classLevel: classLevels[profile.classId], additionalSavingThrows: decisions.savingThrows });
  const context = getCharacterVitalContext(character, catalog);
  const vitals = normalizeVitals(context, profile.vitals);
  const bonus = proficiencyBonus(level);
  const hasAlert = background.feat?.index === 'alert'
    || profile.originChoices?.versatileFeatId === 'alert'
    || profile.levelChoices?.some(choice => choice.kind === 'feat' && choice.featId === 'alert')
    || profile.classFeatures?.invocations?.includes('lessons-of-the-first-ones:alert');
  const initiative = abilityModifier(profile.attributes.dex) + (hasAlert ? bonus : 0);
  const perceptionRules = getD20RuleEffects(vitals, { kind: 'check', ability: 'wis', skillId: 'perception' });
  const passivePerception = training.passivePerception + perceptionRules.penalty
    + (perceptionRules.mode === 'advantage' ? 5 : perceptionRules.mode === 'disadvantage' ? -5 : 0);
  const spellcasting = classSpellSources({ ...profile, level }).flatMap(source => {
    const sourceClass = catalog.classes.find(entry => entry.index === source.id);
    if (!sourceClass) throw new Error('Nicht vorhandene Zauberklasse in der Stufenchronik.');
    const magic = getClassLevelSummary(catalog.levels, sourceClass, source.level,
      profile.attributes, level).spellcasting;
    return magic ? [{ classId: source.id, className: sourceClass.name,
      level: source.level, attackBonus: magic.attackBonus, saveDC: magic.saveDC }] : [];
  });
  const features = [];
  for (const [classId, count] of Object.entries(classLevels)) {
    const className = catalog.classes.find(entry => entry.index === classId)?.name || classId;
    for (const row of catalog.levels.filter(entry => entry.class?.index === classId
      && !entry.subclass && entry.level <= count)) {
      for (const feature of row.features || []) features.push({ id: `${feature.index}@${row.level}`,
        name: feature.name, level: row.level, source: className,
        description: catalog.features?.find(item => item.index === feature.index)?.description || '' });
    }
    const subclassId = classId === profile.classId ? profile.subclassId : profile.secondarySubclasses?.[classId];
    const subclass = catalog.subclasses?.find(entry => entry.index === subclassId && entry.class?.index === classId);
    for (const feature of subclass?.features || []) if (feature.level <= count) {
      features.push({ id: `${classId}:${subclass.index}:${feature.level}:${feature.name}`,
        name: feature.name, level: feature.level, source: subclass.name, description: feature.description || '' });
    }
  }
  const chosenFeats = [
    ...origin.featIds.map(id => ({ id, source: 'Herkunft' })),
    ...(profile.levelChoices || []).filter(choice => choice.kind === 'feat')
      .map(choice => ({ id: choice.featId, source: `Gesamtstufe ${choice.level}` })),
  ].map(({ id, source }) => ({ id, source,
    name: catalog.feats?.find(feat => feat.index === id)?.name || id }));
  const ancestry = [...new Map(origin.activeTraits.map(ref => [ref.index, {
    id: ref.index, level: ref.level,
    name: catalog.traits?.find(trait => trait.index === ref.index)?.name || ref.name || ref.index,
    description: catalog.traits?.find(trait => trait.index === ref.index)?.description || '',
  }])).values()];
  const classChoices = [
    ...(profile.classFeatures?.fightingStyles || []).map(id => ({ name: 'Kampfstil', value: id })),
    ...(profile.classFeatures?.metamagic || []).map(id => ({ name: 'Metamagie', value: id })),
    ...(profile.classFeatures?.invocations || []).map(id => ({ name: 'Anrufung', value: id })),
    ...Object.entries(profile.classFeatures?.decisions || {}).filter(([, value]) => Boolean(value))
      .map(([name, value]) => ({ name, value: Array.isArray(value) ? value.join(', ') : value })),
  ];
  const warnings = [
    ...(origin.missing ? [`Herkunft: ${origin.missing} Wahl(en) offen.`] : []),
    ...(skilled.missing ? [`Skilled: ${skilled.missing} Zusatzübung(en) offen.`] : []),
    ...(training.missing + training.missingBonus + training.missingExpertise
      ? ['Fertigkeits- und Expertise-Wahlen noch nicht vollständig.'] : []),
    ...Object.entries(classLevels).filter(([id, count]) => count >= 3
      && !((id === profile.classId ? profile.subclassId : profile.secondarySubclasses?.[id]) || '')
      && catalog.subclasses?.some(item => item.class?.index === id))
      .map(([id]) => `Unterklasse für ${catalog.classes.find(item => item.index === id)?.name || id} noch nicht gewählt.`),
    ...(context.untrainedArmor ? ['Getragene Rüstung ist ungeübt; Angriffe und einige Würfe eingeschränkt.'] : []),
    ...(context.manualReview || []).map(note => `Mehrklassen-SL-Prüfung: ${note}`),
  ];
  const classNames = Object.entries(classLevels).map(([id, count]) => ({ id,
    name: catalog.classes.find(entry => entry.index === id)?.name || id, level: count }));
  return {
    name: character.name, level, classNames, species: species.name,
    background: background.name, subclass: catalog.subclasses?.find(entry => entry.index === profile.subclassId)?.name || '',
    attributes: ABILITIES.map(id => ({ id, name: ABILITY_NAMES[id], score: profile.attributes[id],
      modifier: abilityModifier(profile.attributes[id]) })),
    proficiencyBonus: bonus, initiative, passivePerception,
    armorClass: context.armorClass, speed: context.speed, maxHp: context.maxHp,
    hp: vitals.hp, tempHp: vitals.tempHp,
    savingThrows: training.savingThrows, skills: training.skills,
    spellcasting, features, chosenFeats, ancestry, classChoices,
    languages: origin.languages, resistances: origin.resistances,
    tools: [...new Set([...origin.toolIds, ...skilled.tools])],
    armor: catalog.equipment?.find(item => item.index === profile.armorId)?.name || 'Keine',
    shield: profile.shield === true, world: profile.edras ? 'Edras (optional)' : 'Nur SRD 5.2.1',
    warnings,
  };
}
