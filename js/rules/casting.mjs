/** Zauber im Spiel: SRD-Referenzen, vorhandene Klassenressourcen, kein zweiter Zauberzähler. */
import { getAutomaticSpells, getClassLevelSummary, validateCharacterSpells,
  getMagicalDiscoveries, getSpellMastery, getBardMagicalSecrets, getMysticArcanum,
  getSignatureSpells, normalizeResourceTracker, changeResourceTracker } from './dnd55.mjs';
import { normalizeVitals, applyVitals } from './vitals.mjs';
import { validateMagicInitiate } from './origin-features.mjs';
import { parseDice } from './engine.mjs';

const ids = values => Array.isArray(values) ? values.filter(value => typeof value === 'string' && value) : [];

/** Eine Zauberwahl je tatsächlicher Klasse; alte Einzelklassenprofile bleiben unverändert. */
export function classSpellSources(profile) {
  const history = profile.levelHistory || Array(profile.level).fill(profile.classId);
  if (!Array.isArray(history) || history.length !== profile.level || history[0] !== profile.classId
    || history.some(id => typeof id !== 'string' || !id)) throw new Error('Ungültige Stufenchronik für Zauber.');
  const counts = Object.fromEntries([...new Set(history)].map(id => [id, history.filter(entry => entry === id).length]));
  const extra = profile.spellsByClass || {};
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)
    || Object.keys(extra).some(id => id === profile.classId || !counts[id])) {
    throw new Error('Unzulässige zusätzliche Klassenzauber.');
  }
  return Object.entries(counts).map(([id, level]) => ({ id, level,
    subclassId: id === profile.classId ? profile.subclassId || '' : profile.secondarySubclasses?.[id] || '',
    spells: id === profile.classId ? profile.spells || {} : extra[id] || {} }));
}

/** Nur explizit im gepinnten SRD angegebene Würfel verwenden. Upcasting und
 * Cantrip-Skalierung ohne strukturierte Quelle bleiben am Tisch zu prüfen. */
export function getSpellDamageReference({ spell, modeId, characterLevel }) {
  if (!spell || !Number.isInteger(spell.level) || !Number.isInteger(characterLevel)
    || characterLevel < 1 || characterLevel > 20 || typeof modeId !== 'string') {
    throw new Error('Ungültige Schadensreferenz.');
  }
  const dieByLevel = spell.damage?.damage_at_slot_level || {};
  const slot = /^(?:slot|pact):(\d)$/.exec(modeId);
  const exactGrade = spell.level === 0 && modeId === 'cantrip' ? 0
    : slot ? Number(slot[1]) : spell.level;
  if (exactGrade < spell.level || spell.level === 0 && characterLevel >= 5) {
    return { formula: null, type: spell.damage?.damage_type?.name || '', manual: true };
  }
  const formula = dieByLevel[String(exactGrade)];
  if (!formula || typeof formula !== 'string') return { formula: null, type: spell.damage?.damage_type?.name || '', manual: true };
  try { parseDice(formula); } catch { return { formula: null, type: spell.damage?.damage_type?.name || '', manual: true }; }
  return { formula, type: spell.damage?.damage_type?.name || '', manual: false };
}

/** Eine gemeinsame Prüfung für Editor und tatsächliches Wirken; immer nach
 * der echten Klassenstufe. Keine eigene Tabelle für Sonderzauber. */
export function validateClassSpellSource({ classId, classLevel, subclassId = '', land = '', selected = {},
  summary, spellCatalog, levelRows, excludedIds = [] }) {
  const pick = key => selected[key] ?? [];
  const automatic = getAutomaticSpells({ classId, subclassId, level: classLevel,
    land: classId === 'druid' ? land : '', spells: spellCatalog, excludedIds });
  const forbidden = [...excludedIds, ...automatic.granted.map(entry => entry.id)];
  const spellCheck = validateCharacterSpells({ summary, classId, classLevel,
    spells: spellCatalog, cantrips: pick('cantrips'), prepared: pick('prepared'),
    spellbook: pick('spellbook'), secrets: pick('secrets'), excludedIds: forbidden });
  const discoveries = getMagicalDiscoveries({ summary, classId, subclassId, level: classLevel,
    spells: spellCatalog, selected: pick('discoveries'), cantrips: pick('cantrips'),
    prepared: pick('prepared'), excludedIds: forbidden });
  const mastery = getSpellMastery({ classId, level: classLevel, spells: spellCatalog,
    spellbook: pick('spellbook'), mastery: selected.mastery ?? ['', ''],
    prepared: pick('prepared'), excludedIds: forbidden });
  const secrets = getBardMagicalSecrets({ classId, level: classLevel, levelRows, summary,
    spells: spellCatalog, secrets: pick('secrets'), prepared: pick('prepared'), excludedIds: forbidden });
  if (pick('secrets').some(id => pick('discoveries').includes(id))) {
    throw new Error('Magical Secrets und Magical Discoveries dürfen denselben Zauber nicht doppelt gewähren.');
  }
  const arcanum = getMysticArcanum({ classId, level: classLevel, spells: spellCatalog,
    arcanum: selected.arcanum ?? ['', '', '', ''], excludedIds: forbidden });
  const signature = getSignatureSpells({ classId, level: classLevel, spells: spellCatalog,
    spellbook: pick('spellbook'), signature: pick('signature'),
    prepared: pick('prepared'), excludedIds: forbidden });
  return { automatic, spellCheck, discoveries, mastery, secrets, arcanum, signature };
}

/** Bei echten gespeicherten Figuren verhindern dieselben SRD-Prüfer wie im
 * Editor, dass manipulierte Zweitklassenlisten gemeinsame Slots missbrauchen. */
function checkPreparedSources({ profile, sources, spellCatalog, classCatalog, levelRows }) {
  if (!classCatalog && !levelRows) return;
  if (!Array.isArray(classCatalog) || !Array.isArray(levelRows)) throw new Error('Klassenquellen für Zauberprüfung fehlen.');
  for (const source of sources) {
    const klass = classCatalog.find(entry => entry.index === source.id);
    if (!klass) throw new Error('Unbekannte Zauberklasse.');
    const summary = getClassLevelSummary(levelRows, klass, source.level, profile.attributes, profile.level);
    // Weltverbote werden beim Ausspielen gefiltert; ältere Profile sollen
    // deshalb nicht den gesamten Tracker blockieren.
    validateClassSpellSource({ classId: source.id, classLevel: source.level,
      subclassId: source.subclassId, land: profile.land || '', selected: source.spells,
      summary, spellCatalog, levelRows });
  }
}

export function getCastableSpells({ profile, summary, spellCatalog, excludedIds = [], originSpells = [],
  classCatalog, levelRows }) {
  if (!profile?.classId || !Number.isInteger(profile.level) || profile.level < 1 || profile.level > 20
    || !Array.isArray(spellCatalog) || !Array.isArray(excludedIds) || !Array.isArray(originSpells)) throw new Error('Ungültige Zauberdaten.');
  const multiclass = Array.isArray(profile.levelHistory) && new Set(profile.levelHistory).size > 1;
  const sources = classSpellSources(profile);
  checkPreparedSources({ profile, sources, spellCatalog, classCatalog, levelRows });
  const wizard = sources.find(entry => entry.id === 'wizard');
  const warlock = sources.find(entry => entry.id === 'warlock');
  const resourcePrefix = id => multiclass ? `${id}:` : '';
  const blocked = new Set(excludedIds);
  const featGrants = validateMagicInitiate({ profile, spells: spellCatalog }).grants.filter(entry => entry.complete);
  const featSpells = featGrants.map(entry => entry.spellId).filter(Boolean);
  const featCantrips = featGrants.flatMap(entry => entry.cantrips);
  const autoIds = sources.flatMap(source => getAutomaticSpells({ classId: source.id,
    subclassId: source.subclassId, level: source.level,
    land: source.id === 'druid' ? profile.land || '' : '',
    spells: spellCatalog, excludedIds }).granted.map(spell => spell.id));
  // Zusätzliche Zaubertricks der beiden SRD-Orden, ohne eigene Slotlogik.
  const orders = profile.classFeatures?.decisions || {};
  const hasClass = classId => profile.classId === classId || profile.levelHistory?.includes(classId);
  const orderCantrips = [
    ['cleric', 'cleric-divine-order', 'thaumaturge', 'cleric-divine-order-extra-cantrip'],
    ['druid', 'druid-primal-order', 'magician', 'druid-primal-order-extra-cantrip'],
  ].filter(([classId, order, value, choice]) => hasClass(classId) && orders[order] === value
    && spellCatalog.some(spell => spell.index === orders[choice] && spell.level === 0
      && spell.classes?.some(klass => klass.index === classId)))
    .map(([, , , choice]) => orders[choice]);
  const prepared = new Set([...sources.flatMap(source => [
    ...ids(source.spells.prepared), ...ids(source.spells.secrets), ...ids(source.spells.discoveries),
    ...ids(source.spells.mastery), ...ids(source.spells.signature),
  ]), ...autoIds, ...featSpells, ...originSpells]);
  const cantrips = new Set([...sources.flatMap(source => [
    ...ids(source.spells.cantrips), ...ids(source.spells.discoveries),
  ]), ...ids(profile.classFeatures?.styleCantrips), ...orderCantrips, ...autoIds, ...featCantrips, ...originSpells]);
  const book = new Set(ids(wizard?.spells.spellbook));
  const arcanum = Array.isArray(warlock?.spells.arcanum) ? warlock.spells.arcanum : [];
  // Gemeinsame höhere Plätze gestatten Upcasting, nicht das Erlernen höhergradiger Klassensprüche.
  const highestWizardSpell = Math.min(9, Math.ceil((wizard?.level || 0) / 2));
  const all = new Set([...prepared, ...cantrips, ...arcanum, ...book]);
  const tracker = normalizeResourceTracker(summary, profile.tracker);
  return spellCatalog.filter(spell => all.has(spell.index) && !blocked.has(spell.index)).map(spell => {
    const modes = [];
    const add = (id, label, remaining = null) => modes.push({ id, label, available: remaining === null || remaining > 0 });
    if (spell.level === 0 && cantrips.has(spell.index)) add('cantrip', 'Zaubertrick · ohne Platz');
    if (spell.level > 0) {
      if (spell.index === 'speak-with-animals' && originSpells.includes(spell.index)
        && Object.hasOwn(tracker.resources, 'origin:speak-with-animals')) {
        add(`origin:${spell.index}`, 'Waldgnom · kostenlos', tracker.resources['origin:speak-with-animals']);
      }
      if (originSpells.includes(spell.index) && Object.hasOwn(tracker.resources, `origin:spell:${spell.index}`)) {
        add(`origin:${spell.index}`, 'Herkunft · kostenlos', tracker.resources[`origin:spell:${spell.index}`]);
      }
      for (const feat of featGrants) {
        if (feat.spellId === spell.index && Object.hasOwn(tracker.resources, `origin:magic-initiate:${feat.sourceId}`)) {
          add(`feat:${feat.sourceId}`, `Magic Initiate (${feat.list}) · kostenlos`,
            tracker.resources[`origin:magic-initiate:${feat.sourceId}`]);
        }
      }
      if (prepared.has(spell.index)) for (const slot of summary.spellcasting?.slots || []) {
        if (slot.level >= spell.level) add(`slot:${slot.level}`,
          `${!multiclass && summary.spellcasting.pactMagic ? 'Paktplatz' : 'Zauberplatz'} · Grad ${slot.level}`,
          tracker.slots[slot.level]);
      }
      if (prepared.has(spell.index) && multiclass) {
        for (const [id, current] of Object.entries(tracker.resources)) {
          const match = /^warlock:pact-(\d)$/.exec(id);
          if (match && Number(match[1]) >= spell.level) add(`pact:${match[1]}`,
            `Paktplatz · Grad ${match[1]}`, current);
        }
      }
      if (spell.ritual && (prepared.has(spell.index)
        || wizard && book.has(spell.index) && spell.level <= highestWizardSpell)) {
        add('ritual', 'Ritual · zusätzliche 10 Minuten');
      }
      if (wizard && wizard.level >= 18 && Array.isArray(wizard.spells.mastery)
        && wizard.spells.mastery.some((id, index) =>
        id === spell.index && book.has(spell.index) && spell.level === index + 1 && spell.casting_time === 'Action')) {
        add('mastery', 'Spell Mastery · ohne Platz');
      }
      if (wizard && wizard.level >= 20) (Array.isArray(wizard.spells.signature) ? wizard.spells.signature : []).forEach((id, index) => {
        if (id === spell.index && spell.level === 3 && book.has(spell.index)) add(`signature:${index + 1}`, `Signaturzauber ${index + 1} · kostenlos`,
          tracker.resources[`${resourcePrefix('wizard')}signature_${index + 1}`]);
      });
      if (warlock) arcanum.forEach((id, index) => {
        if (id === spell.index && spell.level === index + 6 && warlock.level >= [11, 13, 15, 17][index]
          && spell.classes?.some(entry => entry.index === 'warlock')) add(`arcanum:${index + 6}`, `Mystisches Arkanum · Grad ${index + 6}`,
          tracker.resources[`${resourcePrefix('warlock')}arcanum_${index + 6}`]);
      });
    }
    return { id: spell.index, name: spell.name, level: spell.level, castingTime: spell.casting_time,
      components: spell.components || [], material: spell.material || '',
      duration: spell.duration || '', higherLevel: spell.higher_level || '',
      concentration: spell.concentration === true, ritual: spell.ritual === true, modes };
  }).filter(spell => spell.modes.length > 0);
}

/** Prüfen und beide bereits gespeicherten Zähler gemeinsam aktualisieren; SL bewertet die Wirkung. */
export function castSelectedSpell({ profile, summary, spellCatalog, excludedIds = [], originSpells = [], vitalContext,
  spellId, modeId, classCatalog, levelRows }) {
  const spell = getCastableSpells({ profile, summary, spellCatalog, excludedIds, originSpells,
    classCatalog, levelRows })
    .find(entry => entry.id === spellId);
  const mode = spell?.modes.find(entry => entry.id === modeId);
  if (!mode || !mode.available) throw new Error('Zauber, Wirkart oder verfügbare Ressource nicht gültig.');
  const vitals = normalizeVitals(vitalContext, profile.vitals);
  if (vitals.dead || vitals.hp === 0 || vitalContext.untrainedArmor
    || vitals.conditions.some(id => ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'].includes(id))) {
    throw new Error('Diese Figur kann gerade keinen Zauber wirken.');
  }
  let tracker = normalizeResourceTracker(summary, profile.tracker);
  const slot = /^slot:(\d)$/.exec(modeId);
  const pact = /^pact:(\d)$/.exec(modeId);
  const signature = /^signature:([12])$/.exec(modeId);
  const arcanum = /^arcanum:([6-9])$/.exec(modeId);
  const feat = /^feat:(background|human|warlock|level-\d+)$/.exec(modeId);
  const origin = /^origin:([a-z0-9-]+)$/.exec(modeId);
  const multi = Array.isArray(profile.levelHistory) && new Set(profile.levelHistory).size > 1;
  const prefix = id => multi ? `${id}:` : '';
  if (slot) tracker = changeResourceTracker(summary, tracker, 'slots', slot[1], -1);
  if (pact) tracker = changeResourceTracker(summary, tracker, 'resources', `warlock:pact-${pact[1]}`, -1);
  if (signature) tracker = changeResourceTracker(summary, tracker, 'resources', `${prefix('wizard')}signature_${signature[1]}`, -1);
  if (arcanum) tracker = changeResourceTracker(summary, tracker, 'resources', `${prefix('warlock')}arcanum_${arcanum[1]}`, -1);
  if (feat) tracker = changeResourceTracker(summary, tracker, 'resources', `origin:magic-initiate:${feat[1]}`, -1);
  if (origin) tracker = changeResourceTracker(summary, tracker, 'resources',
    origin[1] === 'speak-with-animals' && summary.resources.some(entry => entry.id === 'origin:speak-with-animals')
      ? 'origin:speak-with-animals' : `origin:spell:${origin[1]}`, -1);
  return { tracker, vitals: spell.concentration
    ? applyVitals(vitalContext, vitals, 'concentration', { active: true }) : vitals,
  spell, mode };
}
