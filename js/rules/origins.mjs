/** 2024-Charakterherkunft aus dem gepinnten SRD; keine zweite Spezies-/Hintergrunddatenbank. */
import { proficiencyBonus } from './dnd55.mjs';

// Die importierte Sprachliste markiert Druidisch irrtümlich als gewöhnlich.
const STANDARD = new Set(['common-sign-language', 'draconic', 'dwarvish', 'elvish', 'giant',
  'gnomish', 'goblin', 'halfling', 'orc']);
export const standardLanguageOptions = languages => languages.filter(entry => STANDARD.has(entry.index))
  .map(entry => ({ index: entry.index, name: entry.name }));
const TOOL_TYPES = new Set(["Artisan's Tools", 'Tools', 'Musical Instruments', 'Other']);
const selectedId = value => typeof value === 'string' ? value : '';

export function originOptions({ species, background, subspecies, traits, feats, skills, languages, proficiencies }) {
  if (!species?.index || !background?.index || !Array.isArray(subspecies) || !Array.isArray(traits)
    || !Array.isArray(feats) || !Array.isArray(skills) || !Array.isArray(languages)
    || !Array.isArray(proficiencies)) throw new Error('SRD-Herkunftsdaten fehlen.');
  const lineages = subspecies.filter(entry => entry.species?.index === species.index)
    .map(entry => ({ index: entry.index, name: entry.name }));
  // Der gepinnte Import verengt Menschen fälschlich auf Medium; das offizielle SRD erlaubt auch Small.
  const sizeOptions = species.index === 'human' ? ['small', 'medium']
    : species.size_options?.from?.options?.map(entry => entry.size.toLowerCase())
      || [species.size?.toLowerCase()];
  const languageOptions = standardLanguageOptions(languages);
  const traitSkill = (species.traits || []).map(ref => traits.find(entry => entry.index === ref.index))
    .find(entry => entry?.proficiency_choices);
  const getGroup = group => (group?.from?.options || []).map(option => option.item)
    .filter(entry => entry?.index).map(entry => ({ index: entry.index, name: entry.name }));
  const traitSkillOptions = getGroup(traitSkill?.proficiency_choices);
  const backgroundToolOptions = getGroup(background.proficiency_choices?.[0]);
  const versatileOptions = species.index === 'human'
    ? feats.filter(entry => entry.type === 'origin' && (entry.index !== background.feat?.index || entry.repeatable))
      .map(entry => ({ index: entry.index, name: entry.name })) : [];
  const skilledOptions = [
    ...skills.map(entry => ({ index: `skill:${entry.index}`, name: `Fertigkeit · ${entry.name}` })),
    ...proficiencies.filter(entry => TOOL_TYPES.has(entry.type))
      .map(entry => ({ index: `tool:${entry.index}`, name: `Werkzeug · ${entry.name.replace(/^Tool: /, '')}` })),
  ];
  return { lineages, sizeOptions, languageOptions, traitSkillOptions, backgroundToolOptions,
    versatileOptions, skilledOptions };
}

/** Unfertige Wahlen sind in einer Vorschau zulässig, inkonsistente hingegen niemals. */
export function resolveOrigin({ species, background, subspecies, traits, feats, skills, languages,
  proficiencies, spells = [], level, choices = {}, classSkillIds = [], bonusSkillIds = [] }) {
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new Error('Ungültige Herkunftsstufe.');
  const options = originOptions({ species, background, subspecies, traits, feats, skills, languages, proficiencies });
  const lineageId = selectedId(choices.lineageId);
  const lineage = subspecies.find(entry => entry.index === lineageId && entry.species?.index === species.index);
  if (lineageId && !lineage || !options.lineages.length && lineageId) throw new Error('Unzulässige Spezies-Abstammung.');
  const lineageSpellAbility = selectedId(choices.lineageSpellAbility);
  const hasLineageSpells = ['elf', 'gnome', 'tiefling'].includes(species.index) && !!lineage;
  if (lineageSpellAbility && (!hasLineageSpells || !['int', 'wis', 'cha'].includes(lineageSpellAbility))) {
    throw new Error('Herkunftszauber: ungültiges Zauberattribut.');
  }
  const isHighElf = lineageId === 'elven-lineage-high-elf';
  const highElfCantripId = selectedId(choices.highElfCantripId) || 'prestidigitation';
  if (choices.highElfCantripId && (!isHighElf || !spells.some(spell => spell.index === highElfCantripId
    && spell.level === 0 && spell.classes?.some(entry => entry.index === 'wizard')))) {
    throw new Error('Hoch elfischer Zaubertrick muss aus der Magierliste stammen.');
  }
  const size = selectedId(choices.size) || (options.sizeOptions.length === 1 ? options.sizeOptions[0] : '');
  if (size && !options.sizeOptions.includes(size)) throw new Error('Unzulässige Speziesgröße.');
  const chosenLanguages = choices.languages || [];
  if (!Array.isArray(chosenLanguages) || chosenLanguages.length > 2
    || new Set(chosenLanguages.filter(Boolean)).size !== chosenLanguages.filter(Boolean).length
    || chosenLanguages.some(id => id && !options.languageOptions.some(entry => entry.index === id))) {
    throw new Error('Wähle zwei unterschiedliche gewöhnliche Sprachen zusätzlich zu Common.');
  }
  const speciesSkillId = selectedId(choices.speciesSkillId);
  if (speciesSkillId && !options.traitSkillOptions.some(entry => entry.index === speciesSkillId)) {
    throw new Error('Diese Spezies erlaubt die gewählte Zusatzfertigkeit nicht.');
  }
  const backgroundToolId = selectedId(choices.backgroundToolId);
  if (backgroundToolId && !options.backgroundToolOptions.some(entry => entry.index === backgroundToolId)) {
    throw new Error('Dieser Hintergrund erlaubt das gewählte Werkzeug nicht.');
  }
  const versatileFeatId = selectedId(choices.versatileFeatId);
  if (versatileFeatId && !options.versatileOptions.some(entry => entry.index === versatileFeatId)) {
    throw new Error('Unzulässiges zusätzliches menschliches Herkunftstalent.');
  }
  const skilledCount = 3 * (Number(background.feat?.index === 'skilled') + Number(versatileFeatId === 'skilled'));
  const skilledIds = choices.skilledIds || [];
  const skilledAllowed = new Set(options.skilledOptions.map(entry => entry.index));
  if (!Array.isArray(skilledIds) || skilledIds.length > skilledCount
    || new Set(skilledIds.filter(Boolean)).size !== skilledIds.filter(Boolean).length
    || skilledIds.some(id => id && !skilledAllowed.has(id))) throw new Error('Ungültige Skilled-Wahl.');

  const baseSkill = [...(background.proficiencies || []), ...classSkillIds.map(id => ({ index: `skill-${id}` })),
    ...bonusSkillIds.map(id => ({ index: `skill-${id}` }))]
    .filter(entry => entry.index.startsWith('skill-')).map(entry => entry.index.slice(6));
  const extraSkills = [speciesSkillId, ...skilledIds.filter(id => id.startsWith('skill:')).map(id => id.slice(6))]
    .filter(Boolean);
  if (new Set([...baseSkill, ...extraSkills]).size !== baseSkill.length + extraSkills.length) {
    throw new Error('Doppelte Fertigkeitsübung: Wähle für Herkunft und Skilled unterschiedliche Fertigkeiten.');
  }
  const baseTools = (background.proficiencies || []).filter(entry => !entry.index.startsWith('skill-'))
    .map(entry => entry.index);
  const extraTools = [backgroundToolId, ...skilledIds.filter(id => id.startsWith('tool:')).map(id => id.slice(5))]
    .filter(Boolean);
  if (new Set([...baseTools, ...extraTools]).size !== baseTools.length + extraTools.length) {
    throw new Error('Doppelte Werkzeugübung: Wähle ein anderes Werkzeug.');
  }
  const activeTraits = [...(species.traits || []).map(entry => ({ ...entry, level: 1 })),
    ...(lineage?.traits || []).filter(entry => entry.level <= level)]
    .filter((entry, position, entries) => entries.findIndex(candidate => candidate.index === entry.index) === position);
  const effectiveSpeed = Math.max(species.speed || 0, ...activeTraits.map(entry =>
    traits.find(trait => trait.index === entry.index)?.speed || 0));
  const featIds = [background.feat?.index, versatileFeatId].filter(Boolean);
  const missing = 2 - chosenLanguages.filter(Boolean).length
    + Number(options.lineages.length > 0 && !lineageId)
    + Number(hasLineageSpells && !lineageSpellAbility)
    + Number(options.sizeOptions.length > 1 && !size)
    + Number(options.traitSkillOptions.length > 0 && !speciesSkillId)
    + Number(options.backgroundToolOptions.length > 0 && !backgroundToolId)
    + Number(options.versatileOptions.length > 0 && !versatileFeatId)
    + skilledCount - skilledIds.filter(Boolean).length;
  const originSpells = activeTraits.flatMap(ref => traits.find(trait => trait.index === ref.index)?.spells || [])
    .map(item => item.spell?.index).filter(Boolean);
  if (isHighElf) {
    const replace = originSpells.indexOf('prestidigitation');
    if (replace >= 0) originSpells[replace] = highElfCantripId;
  }
  const resistances = activeTraits.map(ref => /^(?:draconic-damage-resistance|lineage-resistance)-(.+)$/.exec(ref.index)?.[1])
    .filter(Boolean);
  return { options, lineage, lineageSpellAbility, highElfCantripId: isHighElf ? highElfCantripId : '',
    size, languages: ['common', ...chosenLanguages.filter(Boolean)],
    featIds, skillIds: extraSkills, toolIds: [...baseTools, ...extraTools],
    activeTraits, originSpells, resistances, speed: effectiveSpeed,
    hpBonus: species.index === 'dwarf' ? level : 0,
    initiativeBonus: featIds.includes('alert') ? proficiencyBonus(level) : 0,
    heroicInspirationOnRest: species.index === 'human', missing };
}
