/** SRD 5.2.1: zusätzliche Herkunfts-/Talentzauber und eindeutig begrenzte Nutzungen. */
import { proficiencyBonus } from './dnd55.mjs';

const MAGIC_LISTS = ['cleric', 'druid', 'wizard'];
// Die gepinnte Sage-Quelle enthält anders als Acolyte keine `feat.note`.
const FIXED_BACKGROUND_LISTS = { acolyte: 'cleric', sage: 'wizard' };

/** Stabile Quell-IDs statt doppelter Herkunftstalent-Einträge. */
export function magicInitiateSources(profile = {}) {
  const sources = [];
  if (FIXED_BACKGROUND_LISTS[profile.backgroundId]) sources.push({ id: 'background',
    label: `Hintergrund · Magic Initiate (${FIXED_BACKGROUND_LISTS[profile.backgroundId]})`,
    fixedList: FIXED_BACKGROUND_LISTS[profile.backgroundId] });
  if (profile.originChoices?.versatileFeatId === 'magic-initiate') sources.push({ id: 'human',
    label: 'Mensch · Magic Initiate' });
  for (const choice of profile.levelChoices || []) {
    if (choice.kind === 'feat' && choice.featId === 'magic-initiate') {
      sources.push({ id: `level-${choice.level}`, label: `Gesamtstufe ${choice.level} · Magic Initiate` });
    }
  }
  if (profile.classFeatures?.invocations?.includes('lessons-of-the-first-ones:magic-initiate')) {
    sources.push({ id: 'warlock', label: 'Lessons of the First Ones · Magic Initiate' });
  }
  return sources;
}

/** Skilled aus Stufenaufstiegen und Paktanrufungen ergänzt die bisherigen Herkunftswahlen. */
export function additionalSkilledSources(profile = {}) {
  const sources = (profile.levelChoices || [])
    .filter(choice => choice.kind === 'feat' && choice.featId === 'skilled')
    .map(choice => ({ id: `level-${choice.level}`, label: `Gesamtstufe ${choice.level} · Skilled` }));
  if (profile.classFeatures?.invocations?.includes('lessons-of-the-first-ones:skilled')) {
    sources.push({ id: 'warlock', label: 'Lessons of the First Ones · Skilled' });
  }
  return sources;
}

export function validateAdditionalSkilled({ profile, skills, proficiencies, baseSkills = [], baseTools = [], strict = false }) {
  const sources = additionalSkilledSources(profile);
  const chosen = profile.additionalSkilled || {};
  if (!chosen || typeof chosen !== 'object' || Array.isArray(chosen)) throw new Error('Skilled: ungültige Auswahl.');
  if (Object.keys(chosen).some(id => !sources.some(source => source.id === id))) throw new Error('Skilled: Talentquelle nicht mehr gültig.');
  const valid = new Set([
    ...skills.map(skill => `skill:${skill.index}`),
    ...proficiencies.filter(entry => ["Artisan's Tools", 'Tools', 'Musical Instruments', 'Other'].includes(entry.type))
      .map(entry => `tool:${entry.index}`),
  ]);
  const seen = new Set([
    ...baseSkills.map(id => `skill:${id}`),
    ...baseTools.map(id => `tool:${id}`),
  ]);
  let missing = 0;
  for (const source of sources) {
    const ids = chosen[source.id] || [];
    if (!Array.isArray(ids) || ids.length > 3) throw new Error('Skilled: pro Talent höchstens drei Übungen.');
    for (const id of ids.filter(Boolean)) {
      if (!valid.has(id)) throw new Error('Skilled: ungültige Fertigkeit oder ungültiges Werkzeug.');
      if (seen.has(id)) throw new Error('Skilled: eine Fertigkeit oder ein Werkzeug wurde doppelt gewählt.');
      seen.add(id);
    }
    missing += 3 - ids.filter(Boolean).length;
  }
  if (strict && missing) throw new Error(`Skilled: ${missing} Übung(en) fehlen.`);
  return { sources, missing, skills: [...seen].filter(id => id.startsWith('skill:')).map(id => id.slice(6)),
    tools: [...seen].filter(id => id.startsWith('tool:')).map(id => id.slice(5)) };
}

/** Die gleichen SRD-Zauberoptionen für Formular, Vorschau und Spielzustand. */
export function magicInitiateOptions(spells, list) {
  if (!Array.isArray(spells) || !MAGIC_LISTS.includes(list)) return { cantrips: [], spells: [] };
  const ofClass = spells.filter(spell => spell.classes?.some(entry => entry.index === list));
  return { cantrips: ofClass.filter(spell => spell.level === 0).map(spell => ({ id: spell.index, name: spell.name })),
    spells: ofClass.filter(spell => spell.level === 1).map(spell => ({ id: spell.index, name: spell.name })) };
}

/** Unfertige Eingaben sind für die Vorschau möglich, illegale werden abgewiesen. */
export function validateMagicInitiate({ profile, spells, strict = false }) {
  if (!Array.isArray(spells)) throw new Error('SRD-Zauber für Magic Initiate fehlen.');
  const sources = magicInitiateSources(profile);
  const chosen = profile.magicInitiate || {};
  if (!chosen || typeof chosen !== 'object' || Array.isArray(chosen)) throw new Error('Ungültige Magic-Initiate-Wahl.');
  if (Object.keys(chosen).some(id => !sources.some(source => source.id === id))) {
    throw new Error('Magic Initiate: nicht mehr gültige Talentquelle.');
  }
  const used = new Set();
  const grants = [];
  let missing = 0;
  for (const source of sources) {
    const entry = chosen[source.id] || {};
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Ungültige Magic-Initiate-Quelle.');
    const list = source.fixedList || entry.list || '';
    if (entry.list && entry.list !== list || list && !MAGIC_LISTS.includes(list)) {
      throw new Error('Magic Initiate: unzulässige Zauberliste.');
    }
    if (list) {
      if (used.has(list)) throw new Error('Magic Initiate: jede Zauberliste darf nur einmal gewählt werden.');
      used.add(list);
    } else { missing += 5; continue; }
    const ability = entry.ability || '';
    if (ability && !['int', 'wis', 'cha'].includes(ability)) throw new Error('Magic Initiate: ungültiges Zauberattribut.');
    if (!ability) missing++;
    const cantrips = entry.cantrips || [];
    if (!Array.isArray(cantrips) || cantrips.length > 2 || new Set(cantrips.filter(Boolean)).size !== cantrips.filter(Boolean).length) {
      throw new Error('Magic Initiate: Zaubertricks müssen eindeutig sein.');
    }
    const opts = magicInitiateOptions(spells, list);
    if (cantrips.some(id => id && !opts.cantrips.some(spell => spell.id === id))) {
      throw new Error('Magic Initiate: Zaubertrick gehört nicht zur gewählten Liste.');
    }
    missing += 2 - cantrips.filter(Boolean).length;
    const spellId = entry.spellId || '';
    if (spellId && !opts.spells.some(spell => spell.id === spellId)) {
      throw new Error('Magic Initiate: der Grad-1-Zauber gehört nicht zur gewählten Liste.');
    }
    if (!spellId) missing++;
    grants.push({ sourceId: source.id, list, ability, cantrips: cantrips.filter(Boolean), spellId,
      complete: !!ability && cantrips.filter(Boolean).length === 2 && !!spellId });
  }
  if (strict && missing) throw new Error(`Magic Initiate: ${missing} Entscheidung(en) fehlen.`);
  return { sources, grants, missing };
}

/** Nur nach SRD genau gezählte Nutzungen; Wirkungen in taktischen Situationen bleiben manuell. */
export function getOriginFeatureResources({ profile, origin = null, spells = [] }) {
  const level = profile.level;
  const pb = proficiencyBonus(level);
  const active = new Set((origin?.activeTraits || []).map(trait => trait.index));
  const resources = [];
  const grant = (id, name, max, shortRest = 'none') => resources.push({ id: `origin:${id}`, name, max, shortRest });
  const breath = [...active].find(id => id.startsWith('draconic-breath-weapon-'));
  if (breath) grant('breath', `Drachenodem · ${breath.split('-').at(-1)}`, pb);
  if (active.has('draconic-flight') && level >= 5) grant('flight', 'Drakonischer Flug', 1);
  if (active.has('stonecunning')) grant('stonecunning', 'Steingespür', pb);
  if (active.has('adrenaline-rush')) grant('adrenaline-rush', 'Adrenaline Rush', pb, 'all');
  if (active.has('relentless-endurance')) grant('relentless-endurance', 'Relentless Endurance', 1);
  if (active.has('large-form') && level >= 5) grant('large-form', 'Großform', 1);
  const giant = [...active].find(id => id.startsWith('giant-ancestry-'));
  if (giant) grant('giant-ancestry', `Riesenerbe · ${giant.slice('giant-ancestry-'.length)}`, pb);
  if (active.has('gnomish-lineage-forest-gnome')) grant('speak-with-animals', 'Speak with Animals (Waldgnom)', pb);
  // Freie Stufe-1+-Abstammungszauber sind je einmal pro langer Rast nutzbar.
  for (const id of origin?.originSpells || []) {
    if (id === 'speak-with-animals' && active.has('gnomish-lineage-forest-gnome')) continue;
    const spell = spells.find(entry => entry.index === id);
    if (spell?.level > 0) grant(`spell:${id}`, `${spell.name} · Herkunft`, 1);
  }
  const magic = validateMagicInitiate({ profile, spells });
  for (const choice of magic.grants) if (choice.complete) {
    grant(`magic-initiate:${choice.sourceId}`, `Magic Initiate · ${choice.list}`, 1);
  }
  if (profile.levelChoices?.some(choice => choice.kind === 'feat' && choice.featId === 'boon-of-fate')) {
    grant('boon-of-fate', 'Boon of Fate · bis Initiative/kurze Rast', 1, 'all');
  }
  return resources;
}
