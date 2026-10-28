/**
 * Regeladapter SRD 5.2.1 / D&D 2024 (5.5e).
 * Die Zahlenformeln liegen bewusst nicht im universellen Würfelbund-Kern.
 */
const intOr = (value, fallback = 0) => Number.isSafeInteger(Number(value)) ? Number(value) : fallback;
export const abilityModifier = score => Math.floor((intOr(score, 10) - 10) / 2);
export const proficiencyBonus = level => 2 + Math.floor((Math.max(1, intOr(level, 1)) - 1) / 4);

const ATTRIBUTES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

/**
 * SRD-5.2.1-Startwerte: Standardwerte, 27-Punkte-Kauf oder frei gewürfelte
 * Werte. Die drei von einem Hintergrund erlaubten Attribute stehen direkt
 * in den importierten 2024-SRD-Daten – keine zweite Zuordnungstabelle.
 */
export function buildOriginAttributes({ baseAttributes, method, background, bonus }) {
  if (!background || !Array.isArray(background.ability_scores)) throw new Error('Ein gültiger SRD-Hintergrund ist erforderlich.');
  const allowed = background.ability_scores.map(entry => entry.index);
  if (allowed.length !== 3 || new Set(allowed).size !== 3 || allowed.some(id => !ATTRIBUTES.includes(id))) {
    throw new Error('Der Hintergrund besitzt ungültige Attributsregeln.');
  }
  const base = Object.fromEntries(ATTRIBUTES.map(id => [id, baseAttributes?.[id]]));
  const values = Object.values(base);
  if (values.some(value => !Number.isInteger(value) || value < 3 || value > 20)) {
    throw new Error('Grundattribute müssen ganze Zahlen zwischen 3 und 20 sein.');
  }
  let pointsSpent = null;
  if (method === 'standard') {
    if (values.slice().sort((a, b) => b - a).some((value, index) => value !== STANDARD_ARRAY[index])) {
      throw new Error('Für die Standardwerte müssen 15, 14, 13, 12, 10 und 8 jeweils genau einmal vergeben werden.');
    }
  } else if (method === 'point-buy') {
    if (values.some(value => POINT_COST[value] === undefined)) {
      throw new Error('Beim Punktekauf sind nur Grundwerte zwischen 8 und 15 erlaubt.');
    }
    pointsSpent = values.reduce((sum, value) => sum + POINT_COST[value], 0);
    if (pointsSpent > 27) throw new Error(`Punktekauf überschritten: ${pointsSpent} von 27 Punkten.`);
  } else if (method !== 'rolled') {
    throw new Error('Unbekannte Methode zur Attributsvergabe.');
  }
  const adjustments = Object.fromEntries(ATTRIBUTES.map(id => [id, 0]));
  if (bonus?.mode === 'all-one') {
    for (const id of allowed) adjustments[id] = 1;
  } else if (bonus?.mode === 'two-one') {
    if (!allowed.includes(bonus.primary) || !allowed.includes(bonus.secondary) || bonus.primary === bonus.secondary) {
      throw new Error('Wähle zwei unterschiedliche, vom Hintergrund erlaubte Attribute für +2 und +1.');
    }
    adjustments[bonus.primary] = 2;
    adjustments[bonus.secondary] = 1;
  } else {
    throw new Error('Ungültige Verteilung der Hintergrundboni.');
  }
  const attributes = Object.fromEntries(ATTRIBUTES.map(id => [id, base[id] + adjustments[id]]));
  if (Object.values(attributes).some(value => value > 20)) {
    throw new Error('Hintergrundboni dürfen kein Attribut über 20 anheben.');
  }
  return { attributes, pointsSpent, adjustments };
}

/** Die 2024-Klasse liefert die tatsächlich erlaubten Fertigkeitswahlen. */
export function getClassSkillChoice(classEntry) {
  const skillGroups = (classEntry?.proficiency_choices || []).filter(group =>
    group.type === 'proficiencies' && group.from?.option_set_type === 'options_array'
    && group.from.options?.length && group.from.options.every(option =>
      option.option_type === 'reference' && option.item?.index?.startsWith('skill-')));
  if (skillGroups.length !== 1) throw new Error('Klassen-Fertigkeitswahl fehlt in den 2024-SRD-Daten.');
  const group = skillGroups[0];
  return { count: group.choose, options: group.from.options.map(option => ({
    index: option.item.index.slice(6), name: option.item.name.replace(/^Skill:\s*/, ''),
  })) };
}

/** Zusätzliche Fertigkeiten und Expertise verwenden dieselben 18 SRD-Fertigkeiten.
 * Die Klassenstufen sind additive Kapazitäten, keine zweite Fertigkeitsliste.
 */
export function getSkillTrainingChoices({ classEntry, background, skills, classSkillIds = [],
  bonusSkillIds = [], extraSkillIds = [], subclassId = '', level = 1, classLevel = level }) {
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new Error('Fertigkeitsstufe muss zwischen 1 und 20 liegen.');
  const classId = classEntry?.index;
  const classOptions = getClassSkillChoice(classEntry).options;
  const fixed = new Set((background?.proficiencies || []).filter(entry => entry.index.startsWith('skill-'))
    .map(entry => entry.index.slice(6)));
  const trained = new Set([...fixed, ...classSkillIds, ...extraSkillIds]);
  const bonusCount = classId === 'bard' && subclassId === 'college-of-lore' && classLevel >= 3 ? 3
    : classId === 'barbarian' && classLevel >= 3 ? 1 : 0;
  const bonusOptions = (classId === 'barbarian' ? classOptions : skills.map(skill => ({ index: skill.index, name: skill.name })))
    .filter(skill => !trained.has(skill.index));
  const expertiseCount = classId === 'rogue' ? (classLevel >= 6 ? 4 : 2)
    : classId === 'bard' ? (classLevel >= 9 ? 4 : classLevel >= 2 ? 2 : 0)
    : classId === 'ranger' ? (classLevel >= 9 ? 3 : classLevel >= 2 ? 1 : 0)
    : classId === 'wizard' && classLevel >= 2 ? 1 : 0;
  const scholar = new Set(['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion']);
  const expertiseOptions = skills.filter(skill => (trained.has(skill.index) || bonusSkillIds.includes(skill.index))
    && (classId !== 'wizard' || scholar.has(skill.index)))
    .map(skill => ({ index: skill.index, name: skill.name }));
  return { bonus: { count: bonusCount, options: bonusOptions },
    expertise: { count: expertiseCount, options: expertiseOptions } };
}

/** Fertigkeiten: Grundübungen, Barbar/Wissensbarde, Expertise, Jack of All Trades und Reliable Talent. */
export function getStartingProficiencies({ classEntry, background, skills, classSkillIds = [],
  bonusSkillIds = [], extraSkillIds = [], expertiseIds = [], subclassId = '', attributes = {}, level = 1,
  classLevel = level, additionalSavingThrows = [] }) {
  if (!Array.isArray(skills) || skills.length !== 18 || !Array.isArray(background?.proficiencies)) {
    throw new Error('Die SRD-Fertigkeitsdaten sind unvollständig.');
  }
  const choice = getClassSkillChoice(classEntry);
  const fixed = new Set([...background.proficiencies, ...(classEntry.proficiencies || [])]
    .filter(entry => entry.index.startsWith('skill-')).map(entry => entry.index.slice(6)));
  const allowed = new Set(choice.options.map(option => option.index).filter(id => !fixed.has(id)));
  if (allowed.size < choice.count || !Array.isArray(classSkillIds) || classSkillIds.length > choice.count
    || new Set(classSkillIds).size !== classSkillIds.length || classSkillIds.some(id => !allowed.has(id))) {
    throw new Error('Klassenfertigkeiten müssen eindeutig sein und dürfen sich nicht mit dem Hintergrund überschneiden.');
  }
  if (!Array.isArray(bonusSkillIds) || !Array.isArray(expertiseIds)) throw new Error('Ungültige Fertigkeitszusatzwahl.');
  const training = getSkillTrainingChoices({ classEntry, background, skills, classSkillIds,
    bonusSkillIds, extraSkillIds, subclassId, level, classLevel });
  const bonusAllowed = new Set(training.bonus.options.map(item => item.index));
  if (bonusSkillIds.length > training.bonus.count || new Set(bonusSkillIds).size !== bonusSkillIds.length
    || bonusSkillIds.some(id => !bonusAllowed.has(id))) throw new Error('Ungültige oder doppelte Bonusfertigkeiten.');
  const trained = new Set([...fixed, ...classSkillIds, ...bonusSkillIds, ...extraSkillIds]);
  const expertiseAllowed = new Set(training.expertise.options.map(item => item.index));
  if (expertiseIds.length > training.expertise.count || new Set(expertiseIds).size !== expertiseIds.length
    || expertiseIds.some(id => !expertiseAllowed.has(id))) {
    throw new Error('Expertise erfordert eine passende geübte Fertigkeit und darf nicht doppelt gewählt werden.');
  }
  const expertise = new Set(expertiseIds);
  const bonus = proficiencyBonus(level);
  const halfBonus = classEntry.index === 'bard' && classLevel >= 2 ? Math.floor(bonus / 2) : 0;
  const reliableTalent = classEntry.index === 'rogue' && classLevel >= 7;
  if (!Array.isArray(additionalSavingThrows) || additionalSavingThrows.some(id => !ATTRIBUTES.includes(id))) {
    throw new Error('Ungültige zusätzliche Rettungswurfübungen.');
  }
  const saves = new Set((classEntry.saving_throws || []).map(entry => entry.index));
  if (saves.size !== 2 || [...saves].some(id => !ATTRIBUTES.includes(id))) {
    throw new Error('Die Rettungswurfübungen der Klasse sind ungültig.');
  }
  for (const id of additionalSavingThrows) saves.add(id);
  const savingThrows = ATTRIBUTES.map(id => ({
    id, trained: saves.has(id), modifier: abilityModifier(attributes[id]) + (saves.has(id) ? bonus : 0),
  }));
  const skillBonuses = skills.map(skill => {
    const id = skill.index;
    const attr = skill.ability_score?.index;
    if (!ATTRIBUTES.includes(attr)) throw new Error('Ungültige SRD-Fertigkeitszuordnung.');
    return { id, name: skill.name, ability: attr, trained: trained.has(id), expertise: expertise.has(id),
      minimumD20: reliableTalent && trained.has(id) ? 10 : null,
      modifier: abilityModifier(attributes[attr]) + (expertise.has(id) ? 2 * bonus : trained.has(id) ? bonus : halfBonus) };
  });
  return {
    savingThrows, skills: skillBonuses, missing: choice.count - classSkillIds.length,
    missingBonus: training.bonus.count - bonusSkillIds.length,
    missingExpertise: training.expertise.count - expertiseIds.length,
    jackOfAllTrades: halfBonus > 0, reliableTalent,
    passivePerception: 10 + skillBonuses.find(skill => skill.id === 'perception').modifier,
  };
}

/** Eine SRD-Waffe gegen die tatsächlichen Klassenübungen prüfen; auch für Würfe nutzbar. */
export function isWeaponProficient(classEntry, weapon, additionalProficiencies = []) {
  const types = new Set(weapon?.equipment_categories?.map(entry => entry.index) || []);
  if (!types.has('weapons')) return false;
  const proficiencies = new Set((classEntry?.proficiencies || []).map(entry => entry.index));
  for (const id of additionalProficiencies) proficiencies.add(id);
  return proficiencies.has('martial-weapons') && types.has('martial-weapons')
    || proficiencies.has('simple-weapons') && types.has('simple-weapons')
    || proficiencies.has(`${weapon.index}s`);
}

/** Waffenmeisterschaft: fünf SRD-Klassen, Kapazitäten aus Klassentabelle / Klassenmerkmal. */
export function getWeaponMasteryChoices({ classEntry, levelRows, level, equipment, selected = [] }) {
  if (!Array.isArray(equipment) || !Array.isArray(levelRows) || !Array.isArray(selected)
    || !Number.isInteger(level) || level < 1 || level > 20) throw new Error('Ungültige Waffenmeisterschaftsdaten.');
  const classId = classEntry?.index;
  const row = levelRows.find(entry => entry.class?.index === classId && entry.level === level && !entry.subclass);
  if (!row) throw new Error('Die Klassenstufe für Waffenmeisterschaft fehlt.');
  const start = levelRows.find(entry => entry.class?.index === classId && entry.level === 1 && !entry.subclass);
  const hasFeature = start?.features?.some(feature => feature.index === `${classId}-weapon-mastery`);
  const count = hasFeature ? (row.class_specific?.weapon_mastery ?? 2) : 0;
  const options = count ? equipment.filter(weapon => {
    if (!weapon.mastery?.index || !weapon.equipment_categories?.some(entry => entry.index === 'weapons')) return false;
    const types = new Set(weapon.equipment_categories.map(entry => entry.index));
    if (classId === 'barbarian' && !types.has('melee-weapons')) return false;
    return isWeaponProficient(classEntry, weapon);
  }).map(weapon => ({ index: weapon.index, name: weapon.name, mastery: weapon.mastery.index })) : [];
  const allowed = new Set(options.map(weapon => weapon.index));
  if (selected.length > count || new Set(selected).size !== selected.length || selected.some(id => !allowed.has(id))) {
    throw new Error('Ungültige oder doppelte Waffenmeisterschaft; die Waffe muss beherrscht werden.');
  }
  return { count, options, selected: selected.map(id => options.find(entry => entry.index === id)), missing: count - selected.length };
}

// Nur Metadaten, die der SRD-Import nicht maschinenlesbar bereitstellt.
// Beschreibungen und Effekte werden weiterhin aus den offiziellen Regeln konsultiert.
const INVOCATIONS = [
  ['agonizing-blast', 'Agonizing Blast', 2, '', 'damage'],
  ['armor-of-shadows', 'Armor of Shadows', 1],
  ['ascendant-step', 'Ascendant Step', 5],
  ['devils-sight', "Devil’s Sight", 2],
  ['devouring-blade', 'Devouring Blade', 12, 'thirsting-blade'],
  ['eldritch-mind', 'Eldritch Mind', 1],
  ['eldritch-smite', 'Eldritch Smite', 5, 'pact-of-the-blade'],
  ['eldritch-spear', 'Eldritch Spear', 2, '', 'ranged-damage'],
  ['fiendish-vigor', 'Fiendish Vigor', 2],
  ['gaze-of-two-minds', 'Gaze of Two Minds', 5],
  ['gift-of-the-depths', 'Gift of the Depths', 5],
  ['gift-of-the-protectors', 'Gift of the Protectors', 9, 'pact-of-the-tome'],
  ['investment-of-the-chain-master', 'Investment of the Chain Master', 5, 'pact-of-the-chain'],
  ['lessons-of-the-first-ones', 'Lessons of the First Ones', 2, '', 'origin'],
  ['lifedrinker', 'Lifedrinker', 9, 'pact-of-the-blade'],
  ['mask-of-many-faces', 'Mask of Many Faces', 2],
  ['master-of-myriad-forms', 'Master of Myriad Forms', 5],
  ['misty-visions', 'Misty Visions', 2],
  ['one-with-shadows', 'One with Shadows', 5],
  ['otherworldly-leap', 'Otherworldly Leap', 2],
  ['pact-of-the-blade', 'Pact of the Blade', 1],
  ['pact-of-the-chain', 'Pact of the Chain', 1],
  ['pact-of-the-tome', 'Pact of the Tome', 1],
  ['repelling-blast', 'Repelling Blast', 2, '', 'attack'],
  ['thirsting-blade', 'Thirsting Blade', 5, 'pact-of-the-blade'],
  ['visions-of-distant-realms', 'Visions of Distant Realms', 9],
  ['whispers-of-the-grave', 'Whispers of the Grave', 7],
  ['witch-sight', 'Witch Sight', 15],
];

const METAMAGIC = [
  ['careful-spell', 'Careful Spell', 1], ['distant-spell', 'Distant Spell', 1],
  ['empowered-spell', 'Empowered Spell', 1], ['extended-spell', 'Extended Spell', 1],
  ['heightened-spell', 'Heightened Spell', 2], ['quickened-spell', 'Quickened Spell', 2],
  ['seeking-spell', 'Seeking Spell', 1], ['subtle-spell', 'Subtle Spell', 1],
  ['transmuted-spell', 'Transmuted Spell', 1], ['twinned-spell', 'Twinned Spell', 1],
];

/** Anrufungen ab Warlock 1: SRD-Klassenkapazität, echte Mindeststufen,
 * Abhängigkeiten und bei wiederholbaren Optionen eindeutige Ziele.
 */
export function getWarlockInvocationChoices({ classId, level, levelRows, spells = [],
  cantrips = [], feats = [], backgroundFeatId = '', selected = [] }) {
  if (!Number.isInteger(level) || level < 1 || level > 20 || !Array.isArray(levelRows)
    || !Array.isArray(spells) || !Array.isArray(cantrips) || !Array.isArray(feats) || !Array.isArray(selected)) {
    throw new Error('Ungültige Daten für Anrufungen.');
  }
  const row = levelRows.find(entry => entry.class?.index === classId && entry.level === level && !entry.subclass);
  if (!row) throw new Error('Anrufungen: SRD-Klassenstufe fehlt.');
  const count = classId === 'warlock' ? row.class_specific?.eldritch_invocations : 0;
  if (!Number.isInteger(count) || count < 0) throw new Error('Anrufungen: Klassentabelle ungültig.');
  const learned = new Set(cantrips);
  const damaging = spells.filter(spell => spell.level === 0 && learned.has(spell.index)
    && spell.classes?.some(entry => entry.index === 'warlock') && (spell.damage || spell.index === 'true-strike'));
  const originFeats = feats.filter(feat => ['alert', 'magic-initiate', 'savage-attacker', 'skilled'].includes(feat.index)
    && feat.index !== backgroundFeatId);
  const hasBase = id => selected.some(token => token === id || token.startsWith(`${id}:`));
  const options = [];
  if (count) for (const [id, name, minimum, requires, repeat] of INVOCATIONS) {
    if (level < minimum || requires && !hasBase(requires)) continue;
    if (repeat === 'origin') {
      for (const feat of originFeats) options.push({ index: `${id}:${feat.index}`, name: `${name} · ${feat.name}`, baseId: id });
    } else if (repeat) {
      for (const spell of damaging) {
        const range = Number(spell.range?.match(/^(\d+) feet/)?.[1] || 0);
        if (repeat === 'ranged-damage' && range < 10
          || repeat === 'attack' && !spell.attack_type && spell.index !== 'true-strike') continue;
        options.push({ index: `${id}:${spell.index}`, name: `${name} · ${spell.name}`, baseId: id });
      }
    } else options.push({ index: id, name, baseId: id });
  }
  const allowed = new Set(options.map(item => item.index));
  if (selected.length > count || new Set(selected).size !== selected.length
    || selected.some(id => !allowed.has(id))) {
    throw new Error('Unzulässige, doppelte oder voraussetzungslose Anrufung.');
  }
  return { count, options, chosen: selected.map(id => options.find(item => item.index === id)),
    missing: count - selected.length };
}

/** Die zehn 2024-Metamagie-Optionen bleiben eine reine Charakterwahl;
 * ihre Zauberwirkungen werden erst beim konkreten Wirken aufgelöst.
 */
export function getMetamagicChoices({ classId, level, selected = [] }) {
  if (!Number.isInteger(level) || level < 1 || level > 20 || !Array.isArray(selected)) {
    throw new Error('Ungültige Metamagie-Stufe.');
  }
  const count = classId === 'sorcerer' ? level >= 17 ? 6 : level >= 10 ? 4 : level >= 2 ? 2 : 0 : 0;
  const options = METAMAGIC.map(([index, name, cost]) => ({ index, name, cost }));
  const allowed = new Set(options.map(item => item.index));
  if (selected.length > count || new Set(selected).size !== selected.length
    || selected.some(id => !allowed.has(id))) throw new Error('Ungültige oder doppelte Metamagie-Option.');
  return { count, options: count ? options : [], chosen: selected.map(id => options.find(item => item.index === id)),
    missing: count - selected.length };
}

/** Kampfstile aus den vier wirklich vorhandenen SRD-Fighting-Style-Talenten.
 * Geweihter/Naturkrieger erhalten zusätzlich zwei fremde Zaubertricks.
 */
export function getFightingStyleChoices({ classId, subclassId = '', level, feats = [], spells = [],
  selected = [], bonusCantrips = [], extraFeats = [] }) {
  if (!Number.isInteger(level) || level < 1 || level > 20 || !Array.isArray(feats)
    || !Array.isArray(spells) || !Array.isArray(selected) || !Array.isArray(bonusCantrips)
    || !Array.isArray(extraFeats)) {
    throw new Error('Ungültige Kampfstildaten.');
  }
  const count = classId === 'fighter' ? 1 + Number(level >= 7 && subclassId === 'champion')
    : ['ranger', 'paladin'].includes(classId) && level >= 2 ? 1 : 0;
  const options = count ? feats.filter(feat => feat.prerequisites?.feature_named === 'Fighting Style'
    && !extraFeats.includes(feat.index))
    .map(feat => ({ index: feat.index, name: feat.name })) : [];
  if (count && classId === 'ranger') options.push({ index: 'druidic-warrior', name: 'Druidic Warrior' });
  if (count && classId === 'paladin') options.push({ index: 'blessed-warrior', name: 'Blessed Warrior' });
  const allowed = new Set(options.map(item => item.index));
  if (selected.length > count || new Set(selected).size !== selected.length || selected.some(id => !allowed.has(id))) {
    throw new Error('Ungültiger oder doppelter Kampfstil (auch durch Stufentalente).');
  }
  const source = selected.includes('druidic-warrior') ? 'druid' : selected.includes('blessed-warrior') ? 'cleric' : '';
  const cantripOptions = source ? spells.filter(spell => spell.level === 0
    && spell.classes?.some(entry => entry.index === source)).map(spell => ({ index: spell.index, name: spell.name })) : [];
  const cantripAllowed = new Set(cantripOptions.map(item => item.index));
  if (bonusCantrips.length > (source ? 2 : 0) || new Set(bonusCantrips).size !== bonusCantrips.length
    || bonusCantrips.some(id => !cantripAllowed.has(id))) throw new Error('Ungültige Kampfstil-Zaubertricks.');
  return { count, options, chosen: selected.map(id => options.find(item => item.index === id)),
    cantripOptions, cantripCount: source ? 2 : 0, source,
    missing: count - selected.length, missingCantrips: (source ? 2 : 0) - bonusCantrips.length };
}

/** 2024-Rüstung, Schild und Klassenverteidigung – die importierte SRD-Ausrüstung
 * stellt Grund-RK, maximale GE und Stärkevoraussetzungen bereits bereit.
 */
export function getDefenseStats({ classEntry, subclassId = '', level = 1, levelRows = [],
  attributes = {}, equipment = [], armorId = '', shield = false, speciesSpeed = 30,
  fightingStyles = [], additionalProficiencies = [] }) {
  if (!classEntry?.index || !Number.isInteger(level) || level < 1 || level > 20
    || !Array.isArray(equipment) || !Array.isArray(levelRows) || typeof shield !== 'boolean'
    || !Number.isFinite(speciesSpeed) || speciesSpeed < 0) throw new Error('Ungültige Verteidigungsdaten.');
  const armor = armorId ? equipment.find(item => item.index === armorId) : null;
  if (armorId && (!armor || armor.index === 'shield' || !armor.equipment_categories?.some(entry => entry.index === 'armor'))) {
    throw new Error('Die ausgewählte Rüstung existiert in der SRD nicht.');
  }
  const categories = new Set(armor?.equipment_categories?.map(item => item.index) || []);
  // Der gepinnte 5e-bits-Datensatz bezeichnet Hide Armor irrtümlich als leicht;
  // im offiziellen SRD-5.2.1-Rüstungstableau ist sie mittelschwer.
  const type = armor?.index === 'hide-armor' ? 'medium'
    : categories.has('heavy-armor') ? 'heavy' : categories.has('medium-armor') ? 'medium'
    : armor ? 'light' : '';
  const proficiencies = new Set((classEntry.proficiencies || []).map(item => item.index));
  for (const id of additionalProficiencies) proficiencies.add(id);
  const trained = !armor || proficiencies.has('all-armor') || proficiencies.has(`${type}-armor`);
  const shieldTrained = proficiencies.has('shields');
  const dex = abilityModifier(attributes.dex);
  let armorClass = 10 + dex;
  let defense = 'Ohne Rüstung';
  if (armor) {
    if (!armor.armor_class || !Number.isInteger(armor.armor_class.base)) throw new Error('Rüstungswerte fehlen.');
    const cap = Number.isInteger(armor.armor_class.max_bonus) ? armor.armor_class.max_bonus : Infinity;
    armorClass = armor.armor_class.base + (armor.armor_class.dex_bonus ? Math.min(dex, cap) : 0);
    defense = armor.name;
  } else if (classEntry.index === 'barbarian') {
    armorClass = 10 + dex + abilityModifier(attributes.con);
    defense = 'Ungerüstete Verteidigung (Barbar)';
  } else if (classEntry.index === 'monk' && !shield) {
    armorClass = 10 + dex + abilityModifier(attributes.wis);
    defense = 'Ungerüstete Verteidigung (Mönch)';
  } else if (classEntry.index === 'sorcerer' && subclassId === 'draconic-sorcery' && level >= 3) {
    armorClass = 10 + dex + abilityModifier(attributes.cha);
    defense = 'Drakonische Widerstandskraft';
  }
  if (shield && shieldTrained) armorClass += 2;
  if (armor && fightingStyles.includes('defense')) armorClass += 1;
  const speedPenalty = armor && type === 'heavy' && attributes.str < (armor.str_minimum || 0) ? 10 : 0;
  const row = levelRows.find(entry => entry.class?.index === classEntry.index && entry.level === level && !entry.subclass);
  if (!row) throw new Error('Klassentabelle für Bewegung fehlt.');
  const speedBonus = classEntry.index === 'monk' && !armor && !shield
    ? row.class_specific?.unarmored_movement_bonus || 0
    : classEntry.index === 'barbarian' && level >= 5 && type !== 'heavy' ? 10 : 0;
  const warnings = [];
  if (!trained) warnings.push('Rüstung ohne Übung: Nachteil auf STR-/DEX-W20-Tests und keine Zauber möglich.');
  if (shield && !shieldTrained) warnings.push('Schild ohne Übung: kein RK-Bonus.');
  if (speedPenalty) warnings.push(`Stärke unter ${armor.str_minimum}: Bewegungsrate −10 ft.`);
  if (armor?.stealth_disadvantage) warnings.push('Rüstung: Nachteil auf Heimlichkeitsproben.');
  return { armorClass, defense, trained, shieldTrained, speed: Math.max(0, speciesSpeed + speedBonus - speedPenalty),
    speedBonus, speedPenalty, stealthDisadvantage: Boolean(armor?.stealth_disadvantage),
    maxHpBonus: classEntry.index === 'sorcerer' && subclassId === 'draconic-sorcery' && level >= 3 ? level : 0,
    warnings };
}

/** SRD-Klassenstufen: ASI- und Epische-Gabe-Wahlen (19) auf einer gemeinsamen Zeitleiste. */
export function getAbilityImprovementLevels(levelRows, classId, level = 20) {
  return levelRows
    .filter(row => row.class?.index === classId && row.level <= level
      && row.features?.some(feature => feature.index === `${classId}-ability-score-improvement`
        || feature.index === `${classId}-epic-boon`))
    .map(row => row.level).sort((a, b) => a - b);
}

/** Offene Talentwirkungen werden vermerkt, aber nicht fälschlich berechnet. */
export function applyLevelImprovements(originAttributes, levels, choices = [], options = {}) {
  const attributes = { ...originAttributes };
  const known = new Set(levels);
  const seen = new Set();
  for (const choice of choices) {
    if (!known.has(choice.level) || seen.has(choice.level)) throw new Error('Ungültige oder doppelte Stufenentscheidung.');
    seen.add(choice.level);
  }
  const unresolved = [];
  const selectedFeats = [];
  const taken = new Set([options.originFeatId, ...(options.originFeatIds || [])].filter(Boolean));
  for (const level of levels) {
    const choice = choices.find(item => item.level === level) || { kind: 'pending' };
    if (choice.kind === 'pending') {
      unresolved.push(level);
      continue;
    }
    if (choice.kind === 'feat') {
      if (!choice.featId) { unresolved.push(level); continue; }
      const feat = options.feats?.find(item => item.index === choice.featId);
      if (!feat || feat.index === 'ability-score-improvement') throw new Error(`Stufe ${level}: Unbekanntes oder hier nicht auswählbares Talent.`);
      const pre = feat.prerequisites || {};
      if (pre.minimum_level && level < pre.minimum_level) throw new Error(`Stufe ${level}: ${feat.name} erfordert mindestens Stufe ${pre.minimum_level}.`);
      if (pre.feature_named) {
        const slug = pre.feature_named.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const classesAtLevel = options.history ? options.history.slice(0, level).reduce((acc, id) =>
          ({ ...acc, [id]: (acc[id] || 0) + 1 }), {}) : { [options.classId]: level };
        const found = options.levelRows?.some(row => row.level <= (classesAtLevel[row.class?.index] || 0)
          && row.features?.some(ref => ref.index === `${row.class?.index}-${slug}`));
        if (!found) throw new Error(`Stufe ${level}: ${feat.name} erfordert das Merkmal ${pre.feature_named}.`);
      }
      const requirement = feat.prerequisite_options;
      if (requirement) {
        const tests = requirement.from?.options;
        if (requirement.type !== 'ability-scores' || !Array.isArray(tests) ||
            !tests.some(test => test.option_type === 'score_prerequisite' &&
              attributes[test.ability_score?.index] >= test.minimum_score)) {
          throw new Error(`Stufe ${level}: Die Attributsvoraussetzungen von ${feat.name} sind nicht erfüllt.`);
        }
      }
      if (taken.has(feat.index) && !feat.repeatable) throw new Error(`${feat.name} darf nur einmal gewählt werden.`);
      taken.add(feat.index);
      // Attributsboni aus den sieben SRD-Epischen Gaben (+1 bis 30) und Grappler (+1 bis 20).
      // Alle weiteren Talentwirkungen bleiben explizite manuelle Entscheidungen.
      if (feat.index === 'grappler') {
        if (!['str', 'dex'].includes(choice.primary)) throw new Error('Grappler erhöht nur STR oder DEX.');
        attributes[choice.primary] += 1;
        if (attributes[choice.primary] > 20) throw new Error('Grappler darf kein Attribut über 20 erhöhen.');
      } else if (feat.type === 'epic-boon') {
        if (!ATTRIBUTES.includes(choice.primary)) throw new Error('Epische Gabe benötigt ein Attribut für +1.');
        attributes[choice.primary] += 1;
        if (attributes[choice.primary] > 30) throw new Error('Epische Gabe darf kein Attribut über 30 erhöhen.');
      }
      selectedFeats.push({ level, id: feat.index, name: feat.name });
      unresolved.push(level);
      continue;
    }
    if (!ATTRIBUTES.includes(choice.primary)) throw new Error(`Stufe ${level}: Ungültiges Attribut.`);
    if (choice.kind === 'one') {
      attributes[choice.primary] += 2;
    } else if (choice.kind === 'split') {
      if (!ATTRIBUTES.includes(choice.secondary) || choice.primary === choice.secondary) {
        throw new Error(`Stufe ${level}: Für +1/+1 sind zwei unterschiedliche Attribute nötig.`);
      }
      attributes[choice.primary] += 1;
      attributes[choice.secondary] += 1;
    } else {
      throw new Error(`Stufe ${level}: Unbekannte Entscheidung.`);
    }
    if (Object.values(attributes).some(value => !Number.isInteger(value) || value > 20)) {
      throw new Error(`Stufe ${level}: Attributsverbesserungen dürfen den Wert 20 nicht überschreiten.`);
    }
  }
  return { attributes, unresolved, selectedFeats };
}

/** Kapazitäten direkt aus der 2024-Klassenstufe, ohne einen zweiten Stufenplan. */
export function getClassLevelSummary(levelRows, classEntry, level, attributes = {}, characterLevel = level) {
  const row = levelRows.find(entry => entry.class?.index === classEntry?.index
    && !entry.subclass && entry.level === level);
  if (!row) throw new Error('Keine gültige SRD-Klassenstufe gefunden.');
  const spellData = row.spellcasting;
  let spellcasting = null;
  if (spellData) {
    const ability = classEntry.spellcasting?.spellcasting_ability?.index;
    if (!ATTRIBUTES.includes(ability)) throw new Error('Zauberattribut in den SRD-Daten fehlt.');
    const slots = [];
    for (let spellLevel = 1; spellLevel <= 9; spellLevel++) {
      const count = spellData[`spell_slots_level_${spellLevel}`];
      if (!Number.isInteger(count) || count < 0) throw new Error('Ungültige SRD-Zauberplatztabelle.');
      if (count > 0) slots.push({ level: spellLevel, max: count });
    }
    const bonus = proficiencyBonus(characterLevel) + abilityModifier(attributes[ability]);
    spellcasting = {
      slots, cantripsKnown: spellData.cantrips_known,
      preparedSpells: spellData.prepared_spells,
      saveDC: 8 + bonus, attackBonus: bonus,
      pactMagic: classEntry.index === 'warlock',
    };
  }
  const columns = {
    rage_count: 'Raserei', second_wind_uses: 'Second Wind',
    channel_divinity_charges: 'Göttliche Macht', wild_shape_uses: 'Tiergestalt',
    focus_points: 'Fokuspunkte', sorcery_points: 'Zaubereipunkte',
    favored_enemies: 'Freie Hunter’s-Mark-Anwendungen',
  };
  const resources = Object.entries(columns)
    .filter(([key]) => Number.isInteger(row.class_specific?.[key]) && row.class_specific[key] > 0)
    .map(([key, name]) => ({
      id: key, name, max: row.class_specific[key],
      // SRD 5.2.1: genau eine Nutzung, alle Nutzungen oder keine auf kurze Rast.
      shortRest: ['rage_count', 'second_wind_uses', 'channel_divinity_charges', 'wild_shape_uses'].includes(key)
        ? 'one' : key === 'focus_points' ? 'all' : 'none',
    }));
  // Bardic Inspiration hat im SRD eine CHArisma-basierte Nutzungszahl.
  if (classEntry.index === 'bard') resources.push({
    id: 'bardic_inspiration', name: 'Bardische Inspiration',
    max: Math.max(1, abilityModifier(attributes.cha)),
    shortRest: level >= 5 ? 'all' : 'none',
  });
  const grant = (id, name, max, shortRest = 'none') => resources.push({ id, name, max, shortRest });
  if (classEntry.index === 'fighter') {
    if (level >= 2) grant('action_surge', 'Action Surge', level >= 17 ? 2 : 1, 'all');
    if (level >= 9) grant('indomitable', 'Indomitable', level >= 17 ? 3 : level >= 13 ? 2 : 1);
  }
  if (classEntry.index === 'paladin') {
    grant('lay_on_hands', 'Handauflegen · Heilpunkte', 5 * level);
    if (level >= 2) grant('paladins_smite', 'Freier Divine Smite', 1);
  }
  if (classEntry.index === 'sorcerer') {
    grant('innate_sorcery', 'Innate Sorcery', 2);
    if (level >= 5) grant('sorcerous_restoration', 'Sorcerous Restoration', 1);
  }
  if (classEntry.index === 'wizard') grant('arcane_recovery', 'Arcane Recovery', 1);
  if (classEntry.index === 'warlock') {
    if (level >= 2) grant('magical_cunning', 'Magical Cunning', 1);
    for (const [unlockedAt, grade] of [[11, 6], [13, 7], [15, 8], [17, 9]]) {
      if (level >= unlockedAt) resources.push({ id: `arcanum_${grade}`, name: `Mystisches Arkanum · Grad ${grade}`, max: 1, shortRest: 'none' });
    }
  }
  if (classEntry.index === 'wizard' && level >= 20) {
    for (let index = 1; index <= 2; index++) resources.push({ id: `signature_${index}`, name: `Signaturzauber ${index}`, max: 1, shortRest: 'all' });
  }
  return { spellcasting, resources };
}

/** 2024-Zauberwahl aus den gepinnten Klassenzuordnungen und Stufenobergrenzen.
 * Nur die normalen Klassen-Zaubertricks und vorbereiteten Zauber; geschenkte,
 * unterklassenspezifische und ersetzende Features bleiben separate Entscheidungen.
 */
export function getClassSpellChoices(summary, classId, spells, excludedIds = []) {
  if (!Array.isArray(spells) || !Array.isArray(excludedIds)) throw new Error('Ungültige Zauber-Datenquelle.');
  if (!summary?.spellcasting) return { cantrips: [], prepared: [], cantripLimit: 0, preparedLimit: 0, highestSlot: 0 };
  const casting = summary.spellcasting;
  const highestSlot = Math.max(0, ...casting.slots.map(slot => slot.level));
  const excluded = new Set(excludedIds);
  const eligible = spells.filter(spell => spell?.index && Number.isInteger(spell.level)
    && Array.isArray(spell.classes) && spell.classes.some(entry => entry.index === classId)
    && !excluded.has(spell.index));
  const byName = (a, b) => a.name.localeCompare(b.name, 'en');
  return {
    cantrips: eligible.filter(spell => spell.level === 0).sort(byName),
    prepared: eligible.filter(spell => spell.level > 0 && spell.level <= highestSlot).sort(byName),
    cantripLimit: casting.cantripsKnown || 0,
    preparedLimit: casting.preparedSpells || 0,
    highestSlot,
  };
}

/** College of Lore (2024): exakt zwei zusätzlich vorbereitete Zauber ab Bard 6.
 * Auch Zaubertricks sind zulässig; beide zählen nicht gegen Bard-Tabellenlimits.
 */
export function getMagicalDiscoveries({ summary, classId, subclassId = '', level,
  spells, selected = [], cantrips = [], prepared = [], excludedIds = [] }) {
  if (!Array.isArray(spells) || !Array.isArray(excludedIds) || !Number.isInteger(level) || level < 1 || level > 20) {
    throw new Error('Ungültige Daten für Magical Discoveries.');
  }
  const limit = classId === 'bard' && subclassId === 'college-of-lore' && level >= 6 ? 2 : 0;
  const highestSlot = Math.max(0, ...(summary?.spellcasting?.slots || []).map(slot => slot.level));
  const excluded = new Set(excludedIds);
  const sources = new Set(['cleric', 'druid', 'wizard']);
  const available = limit ? spells.filter(spell => spell?.index && Number.isInteger(spell.level)
    && spell.level >= 0 && spell.level <= highestSlot
    && spell.classes?.some(entry => sources.has(entry.index)) && !excluded.has(spell.index))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'en')) : [];
  const valid = new Set(available.map(spell => spell.index));
  if (!Array.isArray(selected) || selected.length > limit || new Set(selected).size !== selected.length
    || selected.some(id => !valid.has(id))) {
    throw new Error('Magical Discoveries: Auswahl enthält zu viele, doppelte oder unzulässige Zauber.');
  }
  if (!Array.isArray(cantrips) || !Array.isArray(prepared)
    || selected.some(id => cantrips.includes(id) || prepared.includes(id))) {
    throw new Error('Magical Discoveries: Zusätzlich gewährte Zauber dürfen nicht doppelt als normale Bard-Zauber gewählt werden.');
  }
  return { available, chosen: selected.map(id => available.find(spell => spell.index === id)), missing: limit - selected.length };
}

/** Wizard 18 (2024): je ein Aktionszauber Grad 1 und 2 aus dem eigenen Buch.
 * Beide sind zusätzlich vorbereitet und auf niedrigstem Grad ohne Platz wirkbar.
 */
export function getSpellMastery({ classId, level, spells, spellbook = [],
  mastery = ['', ''], prepared = [], excludedIds = [] }) {
  if (!Number.isInteger(level) || level < 1 || level > 20 || !Array.isArray(spells)
    || !Array.isArray(spellbook) || !Array.isArray(prepared) || !Array.isArray(excludedIds)
    || !Array.isArray(mastery) || mastery.length !== 2) {
    throw new Error('Ungültige Spell-Mastery-Daten.');
  }
  const active = classId === 'wizard' && level >= 18;
  const book = new Set(spellbook);
  const forbidden = new Set(excludedIds);
  const eligible = active ? spells.filter(spell => spell?.classes?.some(entry => entry.index === 'wizard')
    && [1, 2].includes(spell.level) && spell.casting_time === 'Action'
    && book.has(spell.index) && !forbidden.has(spell.index)) : [];
  const available = {
    1: eligible.filter(spell => spell.level === 1),
    2: eligible.filter(spell => spell.level === 2),
  };
  const chosen = mastery.map((id, index) => {
    if (typeof id !== 'string' || (id && !available[index + 1].some(spell => spell.index === id))) {
      throw new Error('Spell Mastery: Zauber muss im Buch, ein Aktionszauber des richtigen Grades und für diese Welt erlaubt sein.');
    }
    if (id && prepared.includes(id)) throw new Error('Spell Mastery: Dieser Zauber ist bereits regulär vorbereitet.');
    return id ? eligible.find(spell => spell.index === id) : null;
  });
  return { available, chosen, missing: active ? chosen.filter(spell => !spell).length : 0 };
}

/** Bard 10: nur fremde Listen-Zauber werden separat gewählt; sie BELEGEN
 * reguläre Vorbereitungsplätze. Die maximal mögliche Zahl berücksichtigt
 * neue Vorbereitungen und genau einen Austausch pro Bard-Stufenaufstieg.
 */
export function getBardMagicalSecrets({ classId, level, levelRows, summary, spells,
  secrets = [], prepared = [], excludedIds = [] }) {
  if (!Number.isInteger(level) || level < 1 || level > 20 || !Array.isArray(levelRows)
    || !Array.isArray(spells) || !Array.isArray(secrets) || !Array.isArray(prepared) || !Array.isArray(excludedIds)) {
    throw new Error('Ungültige Magical-Secrets-Daten.');
  }
  const active = classId === 'bard' && level >= 10;
  const rows = active ? levelRows.filter(row => row.class?.index === 'bard' && !row.subclass
    && row.level >= 9 && row.level <= level).sort((a, b) => a.level - b.level) : [];
  if (active && (rows.length !== level - 8 || rows[0]?.level !== 9)) throw new Error('Barden-Stufentabelle ist unvollständig.');
  const opportunities = Array.from({ length: 10 }, () => 0);
  for (let i = 1; i < rows.length; i++) {
    const current = rows[i].spellcasting;
    const previous = rows[i - 1].spellcasting;
    const count = 1 + Math.max(0, current.prepared_spells - previous.prepared_spells);
    for (let grade = 1; grade <= 9; grade++) {
      if (current[`spell_slots_level_${grade}`] > 0) opportunities[grade] += count;
    }
  }
  const highestSlot = Math.max(0, ...(summary?.spellcasting?.slots || []).map(slot => slot.level));
  const foreign = new Set(['cleric', 'druid', 'wizard']);
  const excluded = new Set(excludedIds);
  const available = active ? spells.filter(spell => spell?.index && spell.level >= 1 && spell.level <= highestSlot
    && spell.classes?.some(entry => foreign.has(entry.index))
    && !spell.classes.some(entry => entry.index === 'bard') && !excluded.has(spell.index)) : [];
  const byId = new Map(available.map(spell => [spell.index, spell]));
  if (secrets.length > opportunities[1] || new Set(secrets).size !== secrets.length
    || secrets.some(id => !byId.has(id)) || secrets.length + prepared.length > (summary?.spellcasting?.preparedSpells || 0)) {
    throw new Error('Magical Secrets: zu viele oder unzulässige fremde Zauber oder Vorbereitungsplätze überschritten.');
  }
  for (let grade = 2; grade <= 9; grade++) {
    if (secrets.filter(id => byId.get(id).level >= grade).length > opportunities[grade]) {
      throw new Error('Magical Secrets: zu viele hochgradige Zauber für die verfügbaren Stufenaufstiege.');
    }
  }
  return { available, chosen: secrets.map(id => byId.get(id)), maxForeign: opportunities[1],
    remainingPrepared: (summary?.spellcasting?.preparedSpells || 0) - secrets.length };
}

/** Warlock 11/13/15/17: Arkanum Grad 6–9, je einmal ohne Platz pro langer Rast. */
export function getMysticArcanum({ classId, level, spells, arcanum = ['', '', '', ''], excludedIds = [] }) {
  if (!Number.isInteger(level) || level < 1 || level > 20 || !Array.isArray(spells)
    || !Array.isArray(excludedIds) || !Array.isArray(arcanum) || arcanum.length !== 4) {
    throw new Error('Ungültige Mystic-Arcanum-Daten.');
  }
  const byId = new Map(spells.map(spell => [spell.index, spell]));
  const forbidden = new Set(excludedIds);
  const available = {}; const chosen = [];
  let missing = 0;
  for (let grade = 6; grade <= 9; grade++) {
    const active = classId === 'warlock' && level >= 11 + (grade - 6) * 2;
    available[grade] = active ? spells.filter(spell => spell.level === grade
      && spell.classes?.some(entry => entry.index === 'warlock') && !forbidden.has(spell.index)) : [];
    const id = arcanum[grade - 6];
    const spell = id && byId.get(id);
    if (typeof id !== 'string' || (id && !available[grade].some(entry => entry.index === id))) {
      throw new Error(`Mystic Arcanum: Grad ${grade} ist noch nicht verfügbar oder der Zauber ist unzulässig.`);
    }
    chosen.push(spell || null);
    if (active && !id) missing++;
  }
  return { available, chosen, missing };
}

/** Wizard 20: genau zwei verschiedene Grad-3-Zauber aus dem Buch, je einmal
 * ohne Platz pro kurzer oder langer Rast. Keine Aktionszeit-Beschränkung.
 */
export function getSignatureSpells({ classId, level, spells, spellbook = [],
  signature = [], prepared = [], excludedIds = [] }) {
  if (!Number.isInteger(level) || level < 1 || level > 20 || !Array.isArray(spells)
    || !Array.isArray(spellbook) || !Array.isArray(signature)
    || !Array.isArray(prepared) || !Array.isArray(excludedIds)) throw new Error('Ungültige Signaturzauber-Daten.');
  const active = classId === 'wizard' && level >= 20;
  const book = new Set(spellbook); const forbidden = new Set(excludedIds);
  const available = active ? spells.filter(spell => spell.level === 3
    && spell.classes?.some(entry => entry.index === 'wizard')
    && book.has(spell.index) && !forbidden.has(spell.index)) : [];
  const byId = new Map(available.map(spell => [spell.index, spell]));
  if (signature.length > (active ? 2 : 0) || new Set(signature).size !== signature.length
    || signature.some(id => !byId.has(id) || prepared.includes(id))) {
    throw new Error('Signature Spells: zwei unterschiedliche, zusätzliche Grad-3-Zauber aus dem Magierbuch wählen.');
  }
  return { available, chosen: signature.map(id => byId.get(id)), missing: (active ? 2 : 0) - signature.length };
}

/** SRD-5.2.1-Merkmale, die Zauber ohne Verbrauch eines Vorbereitungsslots gewähren.
 * Die Listen kommen aus den gepinnten SRD-Klassen-/Unterklassenmerkmalen;
 * fehlerhafte Schreibweisen im Quell-Fließtext werden nicht maschinell geparst.
 */
const ALWAYS_PREPARED = {
  bard: [[20, 'power-word-heal', 'power-word-kill']],
  druid: [[1, 'speak-with-animals']],
  paladin: [[2, 'divine-smite']],
  ranger: [[1, 'hunters-mark']],
  'life-domain': [
    [3, 'aid', 'bless', 'cure-wounds', 'lesser-restoration'],
    [5, 'mass-healing-word', 'revivify'],
    [7, 'aura-of-life', 'death-ward'],
    [9, 'greater-restoration', 'mass-cure-wounds'],
  ],
  'oath-of-devotion': [
    [3, 'protection-from-evil-and-good', 'shield-of-faith'],
    [5, 'aid', 'zone-of-truth'],
    [9, 'beacon-of-hope', 'dispel-magic'],
    [13, 'freedom-of-movement', 'guardian-of-faith'],
    [17, 'commune', 'flame-strike'],
  ],
  'draconic-sorcery': [
    [3, 'alter-self', 'chromatic-orb', 'command', 'dragons-breath'],
    [5, 'fear', 'fly'],
    [7, 'arcane-eye', 'charm-monster'],
    [9, 'legend-lore', 'summon-dragon'],
  ],
  'fiend-patron': [
    [3, 'burning-hands', 'command', 'scorching-ray', 'suggestion'],
    [5, 'fireball', 'stinking-cloud'],
    [7, 'fire-shield', 'wall-of-fire'],
    [9, 'geas', 'insect-plague'],
  ],
};

const LAND_SPELLS = Object.freeze({
  arid: [[3, 'blur', 'burning-hands', 'fire-bolt'], [5, 'fireball'], [7, 'blight'], [9, 'wall-of-stone']],
  polar: [[3, 'fog-cloud', 'hold-person'], [5, 'sleet-storm'], [7, 'ice-storm'], [9, 'cone-of-cold']],
  temperate: [[3, 'misty-step'], [5, 'lightning-bolt'], [7, 'freedom-of-movement'], [9, 'tree-stride']],
  tropical: [[3, 'acid-splash', 'ray-of-sickness', 'web'], [5, 'stinking-cloud'], [7, 'polymorph'], [9, 'insect-plague']],
});
export const LAND_CHOICES = Object.freeze(Object.keys(LAND_SPELLS));

/** Unzulässige Weltzauber werden sichtbar blockiert, niemals heimlich gewährt. */
export function getAutomaticSpells({ classId, subclassId = '', level, spells, excludedIds = [], land = '' }) {
  if (!Number.isInteger(level) || level < 1 || level > 20 || !Array.isArray(spells)) {
    throw new Error('Ungültige Klasse, Stufe oder Zauberdaten.');
  }
  const granted = []; const blocked = []; const pending = [];
  const byId = new Map(spells.map(spell => [spell.index, spell]));
  const forbidden = new Set(excludedIds);
  const families = [[classId, ALWAYS_PREPARED[classId] || []]];
  if (subclassId) families.push([subclassId, ALWAYS_PREPARED[subclassId] || []]);
  if (subclassId === 'circle-of-the-land' && level >= 3) {
    if (!LAND_CHOICES.includes(land)) pending.push('Gelände des Zirkels wählen');
    else families.push([`land:${land}`, LAND_SPELLS[land]]);
  }
  if (subclassId === 'college-of-lore' && level >= 6) pending.push('Zwei Zauber aus Magical Discoveries wählen');
  if (classId === 'wizard' && level >= 18) pending.push('Spell Mastery: zwei Zauber aus dem Buch wählen');
  const seen = new Set();
  for (const [source, rows] of families) {
    for (const [unlockedAt, ...ids] of rows) {
      if (unlockedAt > level) continue;
      for (const id of ids) {
        const spell = byId.get(id);
        if (!spell) throw new Error(`SRD-Zauber des Merkmals ${source} fehlt: ${id}.`);
        if (seen.has(id)) continue;
        seen.add(id);
        (forbidden.has(id) ? blocked : granted).push({ id, name: spell.name, source, unlockedAt, level: spell.level });
      }
    }
  }
  return { granted, blocked, pending };
}

/** Strenge SRD-Zugehörigkeit und Levelprüfung; unvollständige Entwürfe bleiben zulässig. */
export function validateCharacterSpells({ summary, classId, classLevel = 1, spells,
  cantrips = [], prepared = [], spellbook = [], secrets = [], excludedIds = [] }) {
  const options = getClassSpellChoices(summary, classId, spells, excludedIds);
  const verify = (selected, available, limit, type) => {
    if (!Array.isArray(selected) || selected.length > limit || new Set(selected).size !== selected.length
      || selected.some(id => typeof id !== 'string' || !available.some(entry => entry.index === id))) {
      throw new Error(`${type}: Auswahl überschreitet die Grenze, enthält Duplikate oder unzulässige SRD-Zauber.`);
    }
    return limit - selected.length;
  };
  const missingSpellbook = classId === 'wizard' ? Math.max(0, 6 + 2 * (classLevel - 1) - spellbook.length) : 0;
  if (classId === 'wizard' && (!Number.isInteger(classLevel) || classLevel < 1 || classLevel > 20)) {
    throw new Error('Ungültige Magierstufe.');
  }
  const missingCantrips = verify(cantrips, options.cantrips, options.cantripLimit, 'Zaubertricks');
  if (!Array.isArray(secrets) || prepared.length + secrets.length > options.preparedLimit) {
    throw new Error('Vorbereitete Zauber: Magical Secrets zählen gegen das normale Vorbereitungslimit.');
  }
  if (secrets.length && (classId !== 'bard' || classLevel < 10)) {
    throw new Error('Magical Secrets ist nur für Barden ab Stufe 10 verfügbar.');
  }
  const missingPrepared = verify(prepared, options.prepared, options.preparedLimit, 'Vorbereitete Zauber') - secrets.length;
  verify(spellbook, classId === 'wizard' ? options.prepared : [], options.prepared.length, 'Zauberbuch');
  if (classId === 'wizard' && prepared.some(id => !spellbook.includes(id))) {
    throw new Error('Magier können nur Zauber aus ihrem Zauberbuch vorbereiten.');
  }
  return {
    ...options,
    missingCantrips, missingPrepared,
    missingSpellbook,
  };
}

/** Nur bekannte Kapazitäten übernehmen; alte und beschädigte Werte begrenzen. */
export function normalizeResourceTracker(summary, previous = {}) {
  const count = (value, max) => Number.isSafeInteger(value) ? Math.max(0, Math.min(max, value)) : max;
  return {
    slots: Object.fromEntries((summary.spellcasting?.slots || []).map(slot => [
      slot.level, count(previous?.slots?.[slot.level], slot.max),
    ])),
    resources: Object.fromEntries(summary.resources.map(resource => [
      resource.id, count(previous?.resources?.[resource.id], resource.max),
    ])),
  };
}

/** Manuelle Änderung, bewusst ohne automatische Zauber-/Fähigkeitsaktivierung. */
export function changeResourceTracker(summary, previous, kind, id, amount) {
  if (!['slots', 'resources'].includes(kind) || ![-1, 1].includes(amount)) throw new Error('Ungültige Ressourcenänderung.');
  const state = normalizeResourceTracker(summary, previous);
  if (!Object.hasOwn(state[kind], id)) throw new Error('Unbekannte Ressource.');
  const maxima = kind === 'slots' ? summary.spellcasting?.slots.map(slot => ({ id: String(slot.level), max: slot.max })) : summary.resources;
  const max = maxima.find(entry => String(entry.id) === String(id)).max;
  state[kind][id] = Math.max(0, Math.min(max, state[kind][id] + amount));
  return state;
}

/** 2024-Standardrasten; besondere Klassenaktionen bleiben frei steuerbar. */
export function restResourceTracker(summary, previous, kind) {
  if (!['short', 'long'].includes(kind)) throw new Error('Unbekannte Rastart.');
  if (kind === 'long') return normalizeResourceTracker(summary);
  const state = normalizeResourceTracker(summary, previous);
  if (summary.spellcasting?.pactMagic) {
    for (const slot of summary.spellcasting.slots) state.slots[slot.level] = slot.max;
  }
  for (const resource of summary.resources) {
    if (resource.shortRest === 'all') state.resources[resource.id] = resource.max;
    if (resource.shortRest === 'one') state.resources[resource.id] = Math.min(resource.max, state.resources[resource.id] + 1);
  }
  return state;
}

/** 2024-Trefferpunkte: erster Trefferwürfel maximal, danach fest oder einzeln gewürfelt. */
export function calculateHitPoints({ level, hitDie, attributes = {}, hitPoints = {} }) {
  const lv = Math.min(20, Math.max(1, intOr(level, 1)));
  const die = [6, 8, 10, 12].includes(hitDie) ? hitDie : 8;
  const con = abilityModifier(attributes.con);
  const method = hitPoints?.method || 'fixed';
  if (!['fixed', 'rolled'].includes(method)) throw new Error('Unbekannte Trefferpunktmethode.');
  const rolls = hitPoints?.rolls ?? [];
  if (method === 'rolled' && !Array.isArray(rolls)) throw new Error('Trefferwürfe müssen als Liste vorliegen.');
  let hp = Math.max(1, die + con);
  const missing = [];
  for (let current = 2; current <= lv; current++) {
    const value = method === 'fixed' ? Math.floor(die / 2) + 1 : rolls[current - 2];
    if (!Number.isSafeInteger(value) || value < 1 || value > die) { missing.push(current); continue; }
    hp += Math.max(1, value + con);
  }
  return { maxHp: missing.length ? null : hp, missing, method, hitDie: die };
}

/** Grundwertberechnung: mit übergebenen Hintergrundboni, ohne Ausrüstung. */
export function basicDndCharacter({ level, hitDie, attributes = {}, hitPoints }) {
  const lv = Math.min(20, Math.max(1, intOr(level, 1)));
  const dex = abilityModifier(attributes.dex);
  const hp = calculateHitPoints({ level: lv, hitDie, attributes, hitPoints });
  // AC gilt nur ohne Rüstung. Angriffsbonus und Zauber-SG hängen von
  // konkreter Waffe, Übung und Zauberattribut ab und bleiben deshalb offen.
  return { level: lv, proficiencyBonus: proficiencyBonus(lv), max_hp: hp.maxHp, armor_class: 10 + dex, initiative: dex };
}
