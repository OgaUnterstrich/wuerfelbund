import { RULESET, CATEGORIES, loadCategory, listClassFeatures } from '../rules/catalog.mjs';
import { applyPassiveModifiers, activateAbility, validateAbility, rollDice } from '../rules/engine.mjs';
import {
  abilityModifier, basicDndCharacter, calculateHitPoints, buildOriginAttributes,
  getAbilityImprovementLevels, applyLevelImprovements, getClassLevelSummary,
  getClassSpellChoices, getAutomaticSpells, getMagicalDiscoveries, getSpellMastery,
  getBardMagicalSecrets, getMysticArcanum, getSignatureSpells,
  normalizeResourceTracker, changeResourceTracker, restResourceTracker,
  getClassSkillChoice, getSkillTrainingChoices, getStartingProficiencies, getWeaponMasteryChoices, getDefenseStats,
  getWarlockInvocationChoices, getMetamagicChoices, getFightingStyleChoices,
} from '../rules/dnd55.mjs';
import { loadLocalPacks, saveLocalPacks, importPackJson, makePack } from '../rules/packs.mjs';
import { readGame, saveGame, inspectGameStorage, upsertCharacter } from '../rules/characters.mjs';
import { getCharacterTrackerSummary, getCharacterVitalContext } from '../rules/character-actions.mjs';
import { CONDITIONS, normalizeVitals, applyVitals, effectiveSpeed, getD20RuleEffects, resolveD20Roll } from '../rules/vitals.mjs';
import { getCastableSpells, castSelectedSpell, getSpellDamageReference,
  validateClassSpellSource } from '../rules/casting.mjs';
import { COINS, normalizeInventory, changeInventory, changeCoins, inventoryLoad,
  getWeaponProfile, consumeWeaponAmmo, rollWeaponDamage, getStartingKits, grantStartingKits } from '../rules/gear.mjs';
import { DAMAGE_TYPES, resolveTargetAc, getWeaponMasteryEffect, applyTypedDamage,
  normalizeTurn, changeTurn } from '../rules/combat.mjs';
import { normalizeMagicItems, changeMagicItems } from '../rules/magic-items.mjs';
import { EDRAS_ID, EDRAS_TECHNIQUES, EDRAS_FORBIDDEN_SPELLS, edrasMaximum, makeEdrasState,
  normalizeEdrasState, applyEdrasAction, edrasTechniqueRules, getEdrasTechniqueD20Rules } from '../rules/edras.mjs';
import { initEdrasQuestionnaire, invalidateEdrasQuestionnaire,
  getAppliedEdrasAssessment, restoreEdrasQuestionnaire } from './edras-questionnaire.mjs';
import { originOptions, resolveOrigin } from '../rules/origins.mjs';
import { magicInitiateSources, magicInitiateOptions, validateMagicInitiate,
  additionalSkilledSources, validateAdditionalSkilled, getOriginFeatureResources } from '../rules/origin-features.mjs';
import { normalizeLevelHistory, classLevelsAt, multiclassImprovementLevels,
  summarizeMulticlass, validateMulticlassChoices } from '../rules/multiclass.mjs';
import { classDecisionOptions, validateClassDecisions, getClassDecisionEffects } from '../rules/class-decisions.mjs';
import { buildCharacterSheet } from '../rules/character-sheet.mjs';
import { renderCharacterSheet } from './character-sheet.mjs';
import { matchesSearch, searchFeedback } from '../rules/ux.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));
const ATTRIBUTES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const CHARACTER_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const ACTIVATION_NAMES = { passive: 'Passiv', action: 'Aktion', bonus_action: 'Bonusaktion', reaction: 'Reaktion', manual: 'Manuell' };

function refreshStorageWarning() {
  const warning = $('#studio-storage-alert');
  const health = inspectGameStorage();
  warning.hidden = !health.message;
  warning.textContent = health.message;
}

let packs = loadLocalPacks();
if (!packs.length) {
  packs = [makePack('Meine Hausregeln')];
  try { saveLocalPacks(packs); } catch { /* Hinweis erscheint erst beim Speichern */ }
}
let activePackId = packs[0].id;
let library = [];
let selectedCatalogId = '';
let catalogRequest = 0;
let characterRequest = 0;
let characterData = null;
let beastCatalog = [];
let beastRequest = null;
let advancementClassId = '';
let advancementChoiceCache = new Map();
let editingCharacterId = '';
let characterMode = 'build';

function setCharacterMode(mode, { focus = false } = {}) {
  if (!['build', 'play'].includes(mode)) throw new Error('Ungültige Charakteransicht.');
  characterMode = mode;
  $('#character-design').hidden = mode !== 'build';
  $('#character-play').hidden = mode !== 'play';
  $('#character-mode-build').setAttribute('aria-pressed', String(mode === 'build'));
  $('#character-mode-play').setAttribute('aria-pressed', String(mode === 'play'));
  if (focus) $(`#character-mode-${mode}`).focus();
}

$('#character-mode-build').addEventListener('click', () => setCharacterMode('build'));
$('#character-mode-play').addEventListener('click', () => setCharacterMode('play'));
let cloud = null;
let noticeTimer;
const initializedTabs = new Set();

function currentLevelHistory() {
  const classId = $('#character-class').value;
  const level = Number($('#character-level').value);
  if (!characterData || !Number.isInteger(level) || level < 1 || level > 20) return [];
  const choices = $('#character-multiclass-enabled').checked
    ? [classId, ...$$('#character-level-history select').slice(0, level - 1).map(item => item.value)] : undefined;
  if ($('#character-multiclass-enabled').checked && choices.length !== level) {
    throw new Error('Die Mehrklassen-Stufenchronik ist unvollständig.');
  }
  return normalizeLevelHistory(classId, level, choices, characterData.classes);
}

function primaryClassLevel() {
  return currentLevelHistory().filter(id => id === $('#character-class').value).length;
}

function classLevelsNow() {
  return currentLevelHistory().reduce((levels, id) => ({ ...levels, [id]: (levels[id] || 0) + 1 }), {});
}

function selectedSubclasses() {
  return { ...Object.fromEntries($$('#character-secondary-subclass-list select')
    .map(select => [select.dataset.subclassClass, select.value])),
    [$('#character-class').value]: $('#character-subclass').value };
}

function refreshSecondarySubclasses() {
  if (!characterData) return;
  const box = $('#character-secondary-subclass-list');
  const old = selectedSubclasses();
  box.replaceChildren();
  const primary = $('#character-class').value;
  for (const [id, level] of Object.entries(classLevelsNow())) {
    if (id === primary || level < 3) continue;
    const wrap = node('label', `${characterData.classes.find(item => item.index === id)?.name || id} · ab Klassenstufe 3`);
    const select = document.createElement('select'); select.dataset.subclassClass = id;
    const options = characterData.subclasses.filter(entry => entry.class?.index === id);
    inputOptions(select, [{ index: '', name: '– Unterklasse wählen –' }, ...options]);
    if (options.some(option => option.index === old[id])) select.value = old[id];
    wrap.append(select); box.append(wrap);
  }
  $('#character-secondary-subclasses').hidden = !box.children.length;
}

function readSourceDecisions() {
  return Object.fromEntries($$('#character-source-decision-list [data-decision-id]').map(wrap => {
    const values = [...wrap.querySelectorAll('select')].map(select => select.value).filter(Boolean);
    return [wrap.dataset.decisionId, wrap.dataset.multiple === 'true' ? values : values[0] || ''];
  }).filter(([, value]) => Array.isArray(value) ? value.length : !!value));
}

function refreshSourceDecisions() {
  if (!characterData) return;
  const previous = readSourceDecisions();
  const levels = classLevelsNow();
  if (levels.druid >= 2 && !beastCatalog.length && !beastRequest) {
    beastRequest = loadCategory('monsters').then(rows => {
      beastCatalog = rows; refreshSourceDecisions();
    }).catch(error => notice(`Tierformen konnten nicht geladen werden: ${error.message}`))
      .finally(() => { beastRequest = null; });
  }
  const args = { classLevels: levels, subclasses: selectedSubclasses(),
    levels: characterData.levels, languages: characterData.languages,
    spells: characterData.spells, monsters: beastCatalog };
  const baseIds = new Set(classDecisionOptions(args).map(group => group.id));
  const kept = Object.fromEntries(Object.entries(previous).filter(([id]) => baseIds.has(id)));
  // Während der Eingabe sind doppelte/offene Tierformen erlaubt; erst Speichern validiert.
  const orders = Object.fromEntries(Object.entries(kept).filter(([id]) =>
    id === 'cleric-divine-order' || id === 'druid-primal-order'));
  const choices = validateClassDecisions({ ...args, choices: orders,
    knownCantrips: getSpellSelection().cantrips }).groups;
  const box = $('#character-source-decision-list'); box.replaceChildren();
  for (const group of choices) {
    const wrap = node('div', '', 'source-decision');
    wrap.dataset.decisionId = group.id;
    if (group.count) wrap.dataset.multiple = 'true';
    const klass = characterData.classes.find(item => item.index === group.classId);
    wrap.append(node('strong', `${klass?.name || group.classId} · ${group.label}`));
    for (let i = 0; i < (group.count || 1); i++) {
      const label = node('label', group.count ? `Form ${i + 1}` : 'Auswahl');
      const select = document.createElement('select');
      const old = group.count ? previous[group.id]?.[i] : previous[group.id];
      inputOptions(select, [{ index: '', name: group.options.length ? '– Bitte wählen –' : '– Tierdaten werden geladen –' },
        ...group.options.map(option => ({ index: option.id, name: option.name }))]);
      if (group.options.some(option => option.id === old)) select.value = old;
      label.append(select); wrap.append(label);
    }
    box.append(wrap);
  }
  $('#character-source-decisions').hidden = !choices.length;
  $('#character-source-decision-count').textContent = `· ${choices.reduce((sum, item) => sum + (item.count || 1), 0)} Wahlen`;
}

function refreshMulticlassOptions() {
  if (!characterData) return;
  const panel = $('#character-history-panel');
  const enabled = $('#character-multiclass-enabled').checked;
  panel.hidden = !enabled;
  const box = $('#character-level-history');
  if (!enabled) {
    $('#character-multiclass-count').textContent = '';
    $('#character-multiclass-skills').replaceChildren();
    return;
  }
  const level = Number($('#character-level').value);
  const previous = $$('#character-level-history select').map(item => item.value);
  box.replaceChildren();
  if (!Number.isInteger(level) || level < 1 || level > 20) return;
  let last = $('#character-class').value;
  for (let current = 2; current <= level; current++) {
    const wrap = node('label', `Gesamtstufe ${current}`);
    const select = document.createElement('select');
    select.dataset.historyLevel = String(current);
    inputOptions(select, characterData.classes);
    const desired = previous[current - 2];
    select.value = characterData.classes.some(item => item.index === desired) ? desired : last;
    last = select.value;
    wrap.append(select); box.append(wrap);
  }
  const count = new Set(currentLevelHistory()).size;
  $('#character-multiclass-count').textContent = count > 1 ? `· ${count} Klassen` : '· bisher eine Klasse';
  refreshMulticlassSkillOptions();
}

function refreshMulticlassSkillOptions() {
  const box = $('#character-multiclass-skills');
  const old = $$('#character-multiclass-skills select').map(item => item.value);
  box.replaceChildren();
  if (!$('#character-multiclass-enabled').checked) return;
  const known = new Set(characterData.classes.find(item => item.index === $('#character-class').value)
    ?.proficiencies?.map(item => item.index) || []);
  const background = characterData.backgrounds.find(item => item.index === $('#character-background').value);
  for (const item of background?.proficiencies || []) known.add(item.index);
  let index = 0;
  for (const id of [...new Set(currentLevelHistory())].slice(1)) {
    const entry = characterData.classes.find(item => item.index === id);
    for (const prof of entry?.multi_classing?.proficiencies || []) known.add(prof.index);
    for (const group of entry?.multi_classing?.proficiency_choices || []) {
      for (let position = 0; position < group.choose; position++) {
        const wrap = node('label', `${entry.name} · Zusatzübung ${position + 1}`);
        const select = document.createElement('select'); select.dataset.multiProficiency = '';
        const options = (group.from?.options || []).filter(option => option.item && !known.has(option.item.index))
          .map(option => ({ index: option.item.index, name: option.item.name }));
        inputOptions(select, [{ index: '', name: '– Bitte wählen –' }, ...options]);
        if (options.some(option => option.index === old[index])) select.value = old[index];
        if (select.value) known.add(select.value);
        wrap.append(select); box.append(wrap); index++;
      }
    }
  }
}

function notice(message) {
  const el = $('#studio-notice');
  el.textContent = String(message);
  el.classList.add('visible');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => el.classList.remove('visible'), 5000);
}
function clearCharacterIssues() {
  const box = $('#character-errors');
  box.hidden = true;
  box.replaceChildren();
}
function characterFormError(message, target) {
  const error = new Error(message);
  error.issues = [{ message, target }];
  return error;
}
function checkCharacterSection(target, operation) {
  try { return operation(); }
  catch (error) { throw characterFormError(error.message, target); }
}
function showCharacterIssues(issues) {
  const box = $('#character-errors');
  box.replaceChildren();
  box.append(node('strong', issues.length === 1 ? 'Eine Entscheidung muss noch geprüft werden:'
    : `${issues.length} Entscheidungen müssen noch geprüft werden:`));
  box.append(node('p', 'Wähle einen Hinweis, um direkt zur betreffenden Stelle zu springen.'));
  const list = node('ul');
  for (const { message, target } of issues) {
    const item = node('li');
    const link = button(message, () => {
      const field = $(target) || $('#character-name');
      const details = field.matches('details') ? field : field.closest('details');
      if (details) details.open = true;
      const focusTarget = field.matches('details') ? field.querySelector('summary')
        : field.matches('input,select,textarea,button,summary') ? field
          : field.querySelector('input,select,textarea,button,summary') || field;
      focusTarget.scrollIntoView({ block: 'center', behavior: 'auto' });
      if (!focusTarget.matches('input,select,textarea,button,summary,a')) focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    });
    link.className = 'error-link';
    item.append(link);
    list.append(item);
  }
  box.append(list);
  box.hidden = false;
  box.focus({ preventScroll: true });
  box.scrollIntoView({ block: 'start', behavior: 'auto' });
}
function node(tag, text = '', className = '') {
  const element = document.createElement(tag);
  element.textContent = String(text ?? '');
  if (className) element.className = className;
  return element;
}
function button(label, onClick) {
  const el = node('button', label);
  el.type = 'button';
  el.addEventListener('click', onClick);
  return el;
}
function inputOptions(select, data) {
  select.replaceChildren();
  for (const entry of data) {
    const option = node('option', entry.name);
    option.value = entry.index;
    select.append(option);
  }
}
function switchTab(name, preserveHash = false) {
  const tabs = ['catalog', 'characters', 'abilities', 'packs'];
  const target = tabs.includes(name) ? name : 'catalog';
  for (const tab of $$('[data-tab]')) {
    const active = tab.dataset.tab === target;
    tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  for (const panel of $$('[data-panel]')) panel.classList.toggle('active', panel.dataset.panel === target);
  if (!preserveHash && location.hash !== `#${target}`) history.replaceState(null, '', `#${target}`);
  if (!initializedTabs.has(target)) {
    initializedTabs.add(target);
    if (target === 'catalog') initCatalog();
    if (target === 'characters') initCharacters();
    if (target === 'packs') initCloud();
  }
}
$$('[data-tab]').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
function navigateStudioHash() {
  const fragment = location.hash.slice(1);
  if (fragment === 'studio-main') return;
  if (fragment.startsWith('tracker-') && document.getElementById(fragment)) {
    switchTab('characters', true);
    document.getElementById(fragment).scrollIntoView();
    return;
  }
  switchTab(fragment);
}
window.addEventListener('hashchange', navigateStudioHash);

function catalogDetail(item) {
  const box = $('#catalog-detail');
  box.replaceChildren();
  box.append(node('p', `SRD 5.2.1 · ${CATEGORIES[$('#catalog-category').value].label}`, 'eyebrow'));
  box.append(node('h3', item.name || item.index));
  const paragraphs = [];
  for (const key of ['description', 'desc', 'summary', 'type']) {
    const value = item[key];
    if (typeof value === 'string') paragraphs.push(value);
    if (Array.isArray(value) && value.every(part => typeof part === 'string')) paragraphs.push(value.join('\n'));
  }
  if (paragraphs.length) box.append(node('div', paragraphs.join('\n\n').slice(0, 17000), 'detail-copy'));
  else box.append(node('p', 'Dieser Eintrag ist als strukturierter Regelwert verfügbar.', 'placeholder'));
  const toggle = button('Strukturierte Daten anzeigen', () => {
    if (box.querySelector('pre')) { box.querySelector('pre').remove(); return; }
    box.append(node('pre', JSON.stringify(item, null, 2).slice(0, 24000)));
  });
  toggle.className = 'button-secondary';
  toggle.style.marginTop = '18px';
  box.append(toggle);
}

function renderLibrary() {
  const results = $('#catalog-list');
  results.replaceChildren();
  const term = $('#catalog-search').value.trim().toLocaleLowerCase('de');
  const filtered = library.filter(entry => String(entry.name || entry.index).toLocaleLowerCase('de').includes(term));
  $('#catalog-count').textContent = `${filtered.length} Einträge`;
  for (const entry of filtered.slice(0, 80)) {
    const row = button('', () => {
      selectedCatalogId = entry.index;
      catalogDetail(entry);
      renderLibrary();
    });
    row.className = `item-btn${entry.index === selectedCatalogId ? ' selected' : ''}`;
    row.append(node('span', entry.name || entry.index));
    row.append(node('small', 'Ansehen ↗'));
    results.append(row);
  }
  if (!filtered.length) results.append(node('p', 'Keine passenden Einträge gefunden.', 'placeholder'));
  if (filtered.length > 80) results.append(node('p', `Erste 80 von ${filtered.length} Ergebnissen. Bitte die Suche verfeinern.`, 'placeholder'));
}
async function changeCatalog() {
  const request = ++catalogRequest;
  const category = $('#catalog-category').value;
  $('#catalog-list').textContent = 'Regeldaten werden geladen …';
  try {
    const data = await loadCategory(category);
    if (request !== catalogRequest) return;
    library = data;
    selectedCatalogId = '';
    $('#catalog-detail').textContent = 'Wähle einen Eintrag links.';
    renderLibrary();
  } catch (error) {
    if (request === catalogRequest) $('#catalog-list').textContent = error.message;
  }
}

async function initCatalog() {
  const options = Object.entries(CATEGORIES).map(([index, category]) => ({ index, name: category.label }));
  inputOptions($('#catalog-category'), options);
  $('#catalog-category').addEventListener('change', changeCatalog);
  $('#catalog-search').addEventListener('input', renderLibrary);
  await changeCatalog();
}

async function initCharacters() {
  try {
    const [classes, species, backgrounds, subclasses, levels, feats, skills, spells, equipment,
      subspecies, traits, languages, proficiencies, magicItems, features] = await Promise.all([
      loadCategory('classes'), loadCategory('species'), loadCategory('backgrounds'),
      loadCategory('subclasses'), loadCategory('levels'), loadCategory('feats'), loadCategory('skills'), loadCategory('spells'), loadCategory('equipment'),
      loadCategory('subspecies'), loadCategory('traits'), loadCategory('languages'), loadCategory('proficiencies'),
      loadCategory('magicItems'), loadCategory('features'),
    ]);
    characterData = { classes, species, backgrounds, subclasses, levels, feats, skills, spells, equipment,
      subspecies, traits, languages, proficiencies, magicItems, features };
    inputOptions($('#character-class'), classes);
    inputOptions($('#character-species'), species);
    inputOptions($('#character-background'), backgrounds);
    refreshMulticlassOptions();
    refreshHitPointChoices({ reset: true });
    inputOptions($('#character-armor'), [{ index: '', name: 'Keine Rüstung' }, ...equipment
      .filter(item => item.index !== 'shield' && item.equipment_categories?.some(category => category.index === 'armor'))]);
    inputOptions($('#character-edras-technique'), EDRAS_TECHNIQUES.map(technique => ({
      index: technique.id, name: technique.name,
    })));
    initEdrasQuestionnaire(() => previewCharacter());
    refreshOriginOptions();
    refreshHeritageOptions();
    refreshStartingKits();
    refreshSkillOptions();
    refreshSubclassOptions();
    refreshSecondarySubclasses();
    refreshTrainingOptions();
    refreshWeaponMasteryOptions();
    refreshLandOptions();
    refreshAdvancementOptions();
    refreshSpellOptions();
    refreshClassFeatureOptions();
    refreshSourceDecisions();
    refreshOriginFeatChoices();
    $('#character-form').addEventListener('input', event => {
      if (event.target.id === 'character-level') {
        refreshMulticlassOptions();
        refreshAdvancementOptions(); refreshSpellOptions(); refreshTrainingOptions(); refreshWeaponMasteryOptions(); refreshClassFeatureOptions();
        refreshHitPointChoices();
        refreshSecondarySubclasses(); refreshSourceDecisions(); refreshLandOptions();
      }
      if (event.target.matches('[data-hp-level]')) refreshHitPointChoices();
      if (event.target.matches('[data-ability], [data-hp-level], #character-level')) previewCharacter();
    });
    $('#character-form').addEventListener('change', event => {
      if (event.target.id === 'character-multiclass-enabled'
        || event.target.id === 'character-class' || event.target.matches('[data-history-level]')) {
        if (event.target.id === 'character-class') advancementChoiceCache = new Map();
        refreshMulticlassOptions(); refreshHitPointChoices(); refreshAdvancementOptions();
        refreshSubclassOptions(); refreshTrainingOptions(); refreshWeaponMasteryOptions();
        refreshSpellOptions(); refreshClassFeatureOptions();
        refreshSecondarySubclasses(); refreshSourceDecisions(); refreshLandOptions();
      }
      if (event.target.id === 'character-subclass' || event.target.matches('[data-subclass-class]')) {
        refreshSourceDecisions(); refreshLandOptions();
        if (event.target.matches('[data-subclass-class]')) refreshSpellOptions();
      }
      if (event.target.closest('#character-source-decision-list')) refreshSourceDecisions();
      if (event.target.matches('[data-spell-kind]')) refreshSourceDecisions();
      if (event.target.id === 'character-background' || event.target.matches('[data-multi-proficiency]')) {
        refreshMulticlassSkillOptions();
      }
      if (event.target.id === 'character-world') {
        $('#character-edras-options').hidden = event.target.value !== EDRAS_ID;
        if (event.target.value !== EDRAS_ID) invalidateEdrasQuestionnaire({ keepInputs: false });
      }
      if (['character-edras-potential', 'character-edras-technique'].includes(event.target.id)) {
        invalidateEdrasQuestionnaire();
      }
      if (event.target.id === 'character-background') refreshOriginOptions();
      if (['character-species', 'character-background'].includes(event.target.id)
        || ['versatileFeatId', 'lineageId'].includes(event.target.dataset.originKey)) refreshHeritageOptions();
      if (['character-class', 'character-background'].includes(event.target.id)) refreshStartingKits(event.target.id);
      if (['character-kit-class', 'character-kit-background'].includes(event.target.id)) refreshStartingKitChoices();
      if (['character-background', 'character-class'].includes(event.target.id)) refreshSkillOptions();
      if (event.target.id === 'character-class' || event.target.id === 'character-level') refreshSubclassOptions();
      if (['character-class', 'character-level', 'character-hp-method'].includes(event.target.id)) refreshHitPointChoices();
      if (['character-background', 'character-class', 'character-level', 'character-subclass'].includes(event.target.id)
        || event.target.matches('[data-class-skill], [data-bonus-skill], [data-origin-key], [data-skilled-source] select')) refreshTrainingOptions();
      if (['character-class', 'character-level'].includes(event.target.id)) refreshWeaponMasteryOptions();
      if (['character-class', 'character-level', 'character-subclass'].includes(event.target.id)) refreshLandOptions();
      if (event.target.id === 'character-class' || event.target.id === 'character-level') refreshAdvancementOptions();
      if (['character-class', 'character-level', 'character-world', 'character-subclass', 'character-land'].includes(event.target.id)) {
        refreshSpellOptions(event.target.id === 'character-class');
      }
      if (['character-class', 'character-level', 'character-subclass', 'character-background', 'character-world'].includes(event.target.id)
        || event.target.matches('[data-style], [data-invocation]')) refreshClassFeatureOptions();
      if (['character-class', 'character-level', 'character-background', 'character-species'].includes(event.target.id)
        || event.target.matches('[data-asi-kind], [data-asi-feat], [data-origin-key], [data-invocation], [data-magic-key="list"]')) {
        refreshOriginFeatChoices();
      }
      $('#character-bonus-choices').hidden = $('#character-bonus-mode').value === 'all-one';
      previewCharacter();
    });
    $('#character-spell-search').addEventListener('input', filterSpells);
    $('#character-secondary-spell-search').addEventListener('input', filterSpells);
    $('#character-spell-options').addEventListener('change', event => {
      if (!event.target.matches('[data-spell-kind]')) return;
      const choices = getSpellSelection();
      const kind = event.target.dataset.spellKind;
      if (event.target.checked && (kind === 'discoveries'
        ? choices.discoveries.length > 2 || [...choices.cantrips, ...choices.prepared, ...choices.secrets].includes(event.target.value)
        : kind !== 'spellbook' && choices.discoveries.includes(event.target.value))) {
        event.target.checked = false;
        notice('Dieser Zauber ist bereits gewählt oder die beiden Magical Discoveries sind voll.');
        updateSpellCount();
        return;
      }
      if (event.target.checked && ((kind === 'prepared' && choices.mastery.includes(event.target.value))
        || (['mastery1', 'mastery2'].includes(kind)
          && (choices.prepared.includes(event.target.value)
            || $$(`#character-spell-options [data-spell-kind="${kind}"]:checked`).length > 1)))) {
        event.target.checked = false;
        notice('Spell Mastery benötigt pro Grad genau einen Zauber, der nicht regulär vorbereitet ist.');
        updateSpellCount();
        return;
      }
      if (event.target.checked && ((kind === 'signature'
        && (choices.signature.length > 2 || choices.prepared.includes(event.target.value)))
        || (kind === 'prepared' && choices.signature.includes(event.target.value))
        || (kind.startsWith('arcanum')
          && $$(`#character-spell-options [data-spell-kind="${kind}"]:checked`).length > 1))) {
        event.target.checked = false;
        notice('Sonderzauber: Auswahlgröße überschritten oder Zauber bereits vorbereitet.');
        updateSpellCount();
        return;
      }
      const level = primaryClassLevel();
      const chosen = characterData.classes.find(entry => entry.index === $('#character-class').value);
      const summary = getClassLevelSummary(characterData.levels, chosen, level);
      const limits = getClassSpellChoices(summary, chosen.index, characterData.spells, selectedSpellExclusions());
      if (event.target.checked && kind === 'secrets') {
        try {
          getBardMagicalSecrets({ classId: chosen.index, level, summary,
            levelRows: characterData.levels, spells: characterData.spells,
            secrets: choices.secrets, prepared: choices.prepared, excludedIds: selectedSpellExclusions() });
        } catch (error) {
          event.target.checked = false;
          notice(error.message);
          updateSpellCount();
          return;
        }
      }
      if ((kind === 'cantrips' && choices.cantrips.length > limits.cantripLimit)
        || (['prepared', 'secrets'].includes(kind)
          && (choices.prepared.length + choices.secrets.length > limits.preparedLimit
            || choices.secrets.length > Number($('#character-spells').dataset.secretsLimit || 0)))) {
        event.target.checked = false;
        notice('Die Zauberobergrenze für diese Klassenstufe ist erreicht.');
      }
      if (kind === 'spellbook') refreshSpellOptions();
      updateSpellCount();
      filterSpells();
      if (kind === 'cantrips') refreshClassFeatureOptions();
    });
    $('#character-secondary-spell-panels').addEventListener('change', event => {
      if (!event.target.matches('[data-spell-kind]')) return;
      const input = event.target;
      const limit = Number(input.dataset.spellLimit);
      const group = input.closest('[data-secondary-spell-class]');
      if (input.checked && Number.isFinite(limit) &&
        group.querySelectorAll(`[data-spell-kind="${input.dataset.spellKind}"]:checked`).length > limit) {
        input.checked = false;
        notice('Für diese Klassenstufe ist die Zauberwahl bereits voll.');
      }
      if (input.dataset.spellKind === 'spellbook') {
        const classId = group.dataset.secondarySpellClass, value = input.value;
        renderSecondarySpellOptions();
        const restored = $$('#character-secondary-spell-panels [data-spell-kind="spellbook"]')
          .find(entry => entry.value === value && entry.closest('[data-secondary-spell-class]').dataset.secondarySpellClass === classId);
        restored?.focus();
      }
      filterSpells();
      previewCharacter();
    });
    $('#character-improvements').addEventListener('change', event => {
      if (event.target.matches('[data-asi-kind], [data-asi-feat]')) syncAdvancementInputs();
      previewCharacter();
    });
    $('#tracker-character').addEventListener('change', renderTracker);
    $('#tracker-edit').addEventListener('click', loadSelectedCharacter);
    $('#character-cancel-edit').addEventListener('click', resetCharacterEditor);
    renderTrackerOptions();
    await previewCharacter();
  } catch (error) { $('#character-preview').textContent = `Charakterdaten konnten nicht geladen werden: ${error.message}`; }
}

function refreshSkillOptions() {
  const chosen = characterData.classes.find(entry => entry.index === $('#character-class').value);
  const background = characterData.backgrounds.find(entry => entry.index === $('#character-background').value);
  if (!chosen || !background) return;
  const choice = getClassSkillChoice(chosen);
  const fixed = new Set((background.proficiencies || []).filter(entry => entry.index.startsWith('skill-'))
    .map(entry => entry.index.slice(6)));
  const available = choice.options.filter(entry => !fixed.has(entry.index));
  const previous = $$('#character-skill-choices select').map(select => select.value);
  const box = $('#character-skill-choices'); box.replaceChildren();
  for (let position = 0; position < choice.count; position++) {
    const wrapper = node('label', `Fertigkeit ${position + 1}`);
    const select = document.createElement('select');
    select.dataset.classSkill = '';
    inputOptions(select, [{ index: '', name: '– Bitte wählen –' }, ...available]);
    if (previous[position] && available.some(entry => entry.index === previous[position])) select.value = previous[position];
    wrapper.append(select); box.append(wrapper);
  }
  $('#character-skill-count').textContent = `· ${choice.count} wählen`;
}

function renderChoiceSelects(selector, dataKey, label, count, options) {
  const box = $(selector);
  const previous = $$(`${selector} select`).map(select => select.value);
  box.replaceChildren();
  for (let index = 0; index < count; index++) {
    const wrap = node('label', `${label} ${index + 1}`);
    const select = document.createElement('select');
    select.dataset[dataKey] = '';
    inputOptions(select, [{ index: '', name: '– Bitte wählen –' }, ...options]);
    if (options.some(option => option.index === previous[index])) select.value = previous[index];
    wrap.append(select);
    box.append(wrap);
  }
}

function refreshTrainingOptions() {
  const level = primaryClassLevel();
  if (!Number.isInteger(level) || level < 1 || level > 20) return;
  const classEntry = characterData.classes.find(entry => entry.index === $('#character-class').value);
  const background = characterData.backgrounds.find(entry => entry.index === $('#character-background').value);
  if (!classEntry || !background) return;
  const settings = {
    classEntry, background, skills: characterData.skills,
    classSkillIds: $$('#character-skill-choices select').map(select => select.value).filter(Boolean),
    bonusSkillIds: $$('#character-bonus-skill-choices select').map(select => select.value).filter(Boolean),
    extraSkillIds: (() => {
      try { return [...resolveCharacterOrigin({ speciesId: $('#character-species').value,
        backgroundId: $('#character-background').value, level,
        classSkillIds: $$('#character-skill-choices select').map(select => select.value).filter(Boolean),
        bonusSkillIds: [], originChoices: readHeritageChoices() }).skillIds,
        ...Object.values(readAdditionalSkilledChoices()).flat().filter(id => id.startsWith('skill:'))
          .map(id => id.slice(6))]; } catch { return []; }
    })(),
    subclassId: level >= 3 ? $('#character-subclass').value : '',
    level: Number($('#character-level').value), classLevel: level,
  };
  const choice = getSkillTrainingChoices(settings);
  renderChoiceSelects('#character-bonus-skill-choices', 'bonusSkill', 'Zusatzfertigkeit', choice.bonus.count, choice.bonus.options);
  // Expertise wird erst nach einer eventuellen neuen Zusatzwahl neu ermittelt.
  const next = getSkillTrainingChoices({ ...settings,
    bonusSkillIds: $$('#character-bonus-skill-choices select').map(select => select.value).filter(Boolean) });
  renderChoiceSelects('#character-expertise-choices', 'expertise', 'Expertise', next.expertise.count, next.expertise.options);
  $('#character-training').hidden = !(choice.bonus.count || next.expertise.count);
  $('#character-training-count').textContent = `· ${choice.bonus.count + next.expertise.count} Wahlen`;
}

function refreshWeaponMasteryOptions() {
  const level = primaryClassLevel();
  if (!Number.isInteger(level) || level < 1 || level > 20) return;
  const classEntry = characterData.classes.find(entry => entry.index === $('#character-class').value);
  if (!classEntry) return;
  const choice = getWeaponMasteryChoices({ classEntry, levelRows: characterData.levels,
    level, equipment: characterData.equipment });
  renderChoiceSelects('#character-mastery-choices', 'mastery', 'Waffe', choice.count,
    choice.options.map(weapon => ({ index: weapon.index, name: `${weapon.name} · ${weapon.mastery}` })));
  $('#character-mastery').hidden = !choice.count;
  $('#character-mastery-count').textContent = `· ${choice.count} Waffen`;
}

function getClassFeatureSelection() {
  const decisions = readSourceDecisions();
  return {
    fightingStyles: $$('#character-style-choices select').map(select => select.value).filter(Boolean),
    styleCantrips: $$('#character-style-cantrips select').map(select => select.value).filter(Boolean),
    metamagic: $$('#character-metamagic-choices select').map(select => select.value).filter(Boolean),
    invocations: $$('#character-invocation-choices select').map(select => select.value).filter(Boolean),
    ...(Object.keys(decisions).length ? { decisions } : {}),
  };
}

function checkClassFeatureChoices(values) {
  const styleFeats = values.levelChoices.filter(choice => choice.kind === 'feat'
    && characterData.feats.some(feat => feat.index === choice.featId
      && feat.prerequisites?.feature_named === 'Fighting Style')).map(choice => choice.featId);
  return {
    styles: getFightingStyleChoices({ classId: values.classId, subclassId: values.subclassId,
      level: values.classLevel, feats: characterData.feats, spells: characterData.spells,
      selected: values.classFeatures.fightingStyles, bonusCantrips: values.classFeatures.styleCantrips,
      extraFeats: styleFeats }),
    effectiveStyles: [...values.classFeatures.fightingStyles, ...styleFeats],
    metamagic: getMetamagicChoices({ classId: values.classId, level: values.classLevel,
      selected: values.classFeatures.metamagic }),
    invocations: getWarlockInvocationChoices({ classId: values.classId, level: values.classLevel,
      levelRows: characterData.levels, spells: characterData.spells, feats: characterData.feats,
      backgroundFeatId: characterData.backgrounds.find(item => item.index === values.backgroundId)?.feat?.index,
      cantrips: values.spells.cantrips, selected: values.classFeatures.invocations }),
  };
}

function refreshClassFeatureOptions() {
  const level = primaryClassLevel();
  if (!characterData || !Number.isInteger(level) || level < 1 || level > 20) return;
  const classId = $('#character-class').value;
  const subclassId = level >= 3 ? $('#character-subclass').value : '';
  const previous = getClassFeatureSelection();
  const base = { classId, subclassId, level, feats: characterData.feats, spells: characterData.spells };
  let styles;
  try { styles = getFightingStyleChoices({ ...base, selected: previous.fightingStyles }); }
  catch { styles = getFightingStyleChoices(base); }
  renderChoiceSelects('#character-style-choices', 'style', 'Kampfstil', styles.count, styles.options);
  const active = getFightingStyleChoices({ ...base,
    selected: $$('#character-style-choices select').map(item => item.value).filter(Boolean) });
  renderChoiceSelects('#character-style-cantrips', 'styleCantrip', 'Zusatzzaubertrick',
    active.cantripCount, active.cantripOptions);
  const magic = getMetamagicChoices({ classId, level });
  renderChoiceSelects('#character-metamagic-choices', 'metamagic', 'Metamagie', magic.count, magic.options);
  const invocationArgs = { classId, level, levelRows: characterData.levels,
    spells: characterData.spells, feats: characterData.feats, cantrips: getSpellSelection().cantrips,
    backgroundFeatId: characterData.backgrounds.find(item => item.index === $('#character-background').value)?.feat?.index };
  let invocations;
  try { invocations = getWarlockInvocationChoices({ ...invocationArgs, selected: previous.invocations }); }
  catch (error) {
    if (classId === 'warlock' && previous.invocations.length) {
      notice(`${error.message} Bitte die abhängige Anrufung korrigieren.`);
      return;
    }
    invocations = getWarlockInvocationChoices(invocationArgs);
  }
  renderChoiceSelects('#character-invocation-choices', 'invocation', 'Anrufung', invocations.count, invocations.options);
  const count = styles.count + magic.count + invocations.count;
  $('#character-class-options').hidden = !count;
  $('#character-class-option-count').textContent = `· ${count} Wahlen`;
}

function refreshOriginOptions() {
  const background = characterData.backgrounds.find(entry => entry.index === $('#character-background').value);
  const options = (background?.ability_scores || []).map(entry => ({ index: entry.index, name: entry.name }));
  for (const [id, fallback] of [['#character-plus-two', 0], ['#character-plus-one', 1]]) {
    const select = $(id);
    const previous = select.value;
    inputOptions(select, options);
    select.value = options.some(entry => entry.index === previous) ? previous : options[fallback]?.index || '';
  }
}

function readHeritageChoices() {
  const values = Object.fromEntries($$('#character-heritage-choices [data-origin-key]')
    .map(select => [select.dataset.originKey, select.value]));
  const choices = {
    lineageId: values.lineageId || '', size: values.size || '',
    languages: [values.language0 || '', values.language1 || ''],
    speciesSkillId: values.speciesSkillId || '', backgroundToolId: values.backgroundToolId || '',
    versatileFeatId: values.versatileFeatId || '',
    skilledIds: Object.keys(values).filter(key => /^skilled\d+$/.test(key))
      .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7))).map(key => values[key]),
  };
  if (Object.hasOwn(values, 'lineageSpellAbility')) choices.lineageSpellAbility = values.lineageSpellAbility;
  if (Object.hasOwn(values, 'highElfCantripId')) choices.highElfCantripId = values.highElfCantripId;
  return choices;
}

function refreshHeritageOptions() {
  const species = characterData.species.find(entry => entry.index === $('#character-species').value);
  const background = characterData.backgrounds.find(entry => entry.index === $('#character-background').value);
  if (!species || !background) return;
  const available = originOptions({ ...characterData, species, background });
  const previous = Object.fromEntries($$('#character-heritage-choices [data-origin-key]')
    .map(select => [select.dataset.originKey, select.value]));
  const box = $('#character-heritage-choices'); box.replaceChildren();
  const choice = (key, label, options, initial = '') => {
    const wrap = node('label', label);
    const select = document.createElement('select'); select.dataset.originKey = key;
    inputOptions(select, [{ index: '', name: '– Bitte wählen –' }, ...options]);
    const wanted = previous[key] || initial;
    if (options.some(option => option.index === wanted)) select.value = wanted;
    wrap.append(select); box.append(wrap);
  };
  choice('language0', 'Weitere Sprache 1', available.languageOptions);
  choice('language1', 'Weitere Sprache 2', available.languageOptions);
  if (available.lineages.length) choice('lineageId', 'Abstammung / Erbe', available.lineages);
  const lineageId = $('#character-heritage-choices [data-origin-key="lineageId"]')?.value || '';
  if (lineageId && ['elf', 'gnome', 'tiefling'].includes(species.index)) {
    choice('lineageSpellAbility', 'Zauberattribut der Abstammung', [
      { index: 'int', name: 'Intelligenz' }, { index: 'wis', name: 'Weisheit' },
      { index: 'cha', name: 'Charisma' },
    ]);
  }
  if (lineageId === 'elven-lineage-high-elf') {
    choice('highElfCantripId', 'Hochelfen-Zaubertrick (nach langer Rast wechselbar)',
      magicInitiateOptions(characterData.spells, 'wizard').cantrips
        .map(spell => ({ index: spell.id, name: spell.name })), 'prestidigitation');
  }
  if (available.sizeOptions.length > 1) choice('size', 'Körpergröße', available.sizeOptions
    .map(id => ({ index: id, name: id === 'small' ? 'Klein' : 'Mittelgroß' })));
  if (available.traitSkillOptions.length) choice('speciesSkillId', 'Speziesfertigkeit', available.traitSkillOptions);
  if (available.backgroundToolOptions.length) choice('backgroundToolId', 'Werkzeug des Hintergrunds', available.backgroundToolOptions);
  if (available.versatileOptions.length) choice('versatileFeatId', 'Mensch: Zusätzliches Herkunftstalent', available.versatileOptions);
  const skilledCount = 3 * (Number(background.feat?.index === 'skilled')
    + Number(available.versatileOptions.length > 0 && $('#character-heritage-choices [data-origin-key="versatileFeatId"]')?.value === 'skilled'));
  for (let i = 0; i < skilledCount; i++) choice(`skilled${i}`, `Skilled: Fertigkeit oder Werkzeug ${i + 1}`, available.skilledOptions);
  $('#character-heritage-count').textContent = `· ${box.querySelectorAll('select').length} Wahlen`;
}

function resolveCharacterOrigin(values) {
  return resolveOrigin({ ...characterData,
    species: characterData.species.find(entry => entry.index === values.speciesId),
    background: characterData.backgrounds.find(entry => entry.index === values.backgroundId),
    level: values.level, choices: values.originChoices,
    classSkillIds: values.classSkillIds, bonusSkillIds: values.bonusSkillIds });
}

function readMagicInitiateChoices() {
  const choices = {};
  for (const group of $$('#character-origin-feat-choices [data-magic-source]')) {
    const values = Object.fromEntries([...group.querySelectorAll('[data-magic-key]')]
      .map(select => [select.dataset.magicKey, select.value]));
    choices[group.dataset.magicSource] = { list: values.list || '', ability: values.ability || '',
      cantrips: [values.cantrip0 || '', values.cantrip1 || ''], spellId: values.spellId || '' };
  }
  return choices;
}

function readAdditionalSkilledChoices() {
  return Object.fromEntries($$('#character-origin-feat-choices [data-skilled-source]').map(group => [
    group.dataset.skilledSource,
    [...group.querySelectorAll('select')].map(select => select.value),
  ]));
}

function currentOriginFeatProfile() {
  return { backgroundId: $('#character-background').value, originChoices: readHeritageChoices(),
    levelChoices: $$('#character-improvements [data-asi-level]').map(row => ({
      level: Number(row.dataset.asiLevel), kind: row.querySelector('[data-asi-kind]')?.value,
      featId: row.querySelector('[data-asi-feat]')?.value,
    })),
    classFeatures: getClassFeatureSelection() };
}

/** Gemeinsame UI für alle Talentquellen, keine hartcodierte Zauber-/Talentkopie. */
function refreshOriginFeatChoices(savedMagic = null, savedSkilled = null) {
  if (!characterData) return;
  const profile = currentOriginFeatProfile();
  const previousMagic = savedMagic || readMagicInitiateChoices();
  const previousSkilled = savedSkilled || readAdditionalSkilledChoices();
  const magicSources = magicInitiateSources(profile);
  const skilledSources = additionalSkilledSources(profile);
  const box = $('#character-origin-feat-choices'); box.replaceChildren();
  const selectChoice = (parent, label, options, value, key = '') => {
    const wrap = node('label', label);
    const select = document.createElement('select');
    if (key) select.dataset.magicKey = key;
    inputOptions(select, [{ index: '', name: '– Bitte wählen –' }, ...options]);
    if (options.some(option => option.index === value)) select.value = value;
    wrap.append(select); parent.append(wrap);
    return select;
  };
  for (const source of magicSources) {
    const group = node('fieldset', '', 'choice-panel'); group.dataset.magicSource = source.id;
    group.append(node('legend', source.label));
    const fields = node('div', '', 'pair');
    const values = previousMagic[source.id] || {};
    const list = source.fixedList || values.list || '';
    const listSelect = selectChoice(fields, 'Zauberliste', ['cleric', 'druid', 'wizard']
      .map(index => ({ index, name: index === 'cleric' ? 'Cleric' : index === 'druid' ? 'Druid' : 'Wizard' })), list, 'list');
    listSelect.disabled = !!source.fixedList;
    selectChoice(fields, 'Zauberattribut', [
      { index: 'int', name: 'Intelligenz' }, { index: 'wis', name: 'Weisheit' },
      { index: 'cha', name: 'Charisma' },
    ], values.ability || '', 'ability');
    const options = magicInitiateOptions(characterData.spells, list);
    for (let index = 0; index < 2; index++) {
      selectChoice(fields, `Zaubertrick ${index + 1}`, options.cantrips.map(spell => ({ index: spell.id, name: spell.name })),
        values.cantrips?.[index] || '', `cantrip${index}`);
    }
    selectChoice(fields, 'Zauber des 1. Grades', options.spells.map(spell => ({ index: spell.id, name: spell.name })),
      values.spellId || '', 'spellId');
    group.append(fields); box.append(group);
  }
  const skilledOptions = [
    ...characterData.skills.map(item => ({ index: `skill:${item.index}`, name: `Fertigkeit · ${item.name}` })),
    ...characterData.proficiencies.filter(item => ["Artisan's Tools", 'Tools', 'Musical Instruments', 'Other'].includes(item.type))
      .map(item => ({ index: `tool:${item.index}`, name: `Werkzeug · ${item.name.replace(/^Tool: /, '')}` })),
  ];
  for (const source of skilledSources) {
    const group = node('fieldset', '', 'choice-panel'); group.dataset.skilledSource = source.id;
    group.append(node('legend', source.label));
    const fields = node('div', '', 'pair');
    for (let index = 0; index < 3; index++) {
      selectChoice(fields, `Übung ${index + 1}`, skilledOptions, previousSkilled[source.id]?.[index] || '');
    }
    group.append(fields); box.append(group);
  }
  $('#character-origin-feats').hidden = !box.children.length;
  $('#character-origin-feat-count').textContent = `· ${magicSources.length} Magic Initiate, ${skilledSources.length} Skilled`;
}

function refreshStartingKits(changed = '') {
  for (const [kind, elementId, source] of [
    ['class', '#character-kit-class', characterData.classes.find(entry => entry.index === $('#character-class').value)],
    ['background', '#character-kit-background', characterData.backgrounds.find(entry => entry.index === $('#character-background').value)],
  ]) {
    const select = $(elementId);
    const previous = changed === `character-${kind}` ? '' : select.value;
    const kits = getStartingKits(source, characterData.equipment);
    inputOptions(select, [{ index: '', name: 'Bitte Startausrüstung wählen' },
      ...kits.map(kit => ({ index: kit.id, name: kit.label }))]);
    select.value = kits.some(kit => kit.id === previous) ? previous : '';
  }
  refreshStartingKitChoices();
}

function refreshStartingKitChoices() {
  const container = $('#character-kit-choices');
  const previous = Object.fromEntries($$('#character-kit-choices select').map(select => [select.dataset.kitOption, select.value]));
  container.replaceChildren();
  for (const [kind, source, variantId] of [
    ['class', characterData.classes.find(entry => entry.index === $('#character-class').value), $('#character-kit-class').value],
    ['background', characterData.backgrounds.find(entry => entry.index === $('#character-background').value), $('#character-kit-background').value],
  ]) {
    const variant = getStartingKits(source, characterData.equipment).find(entry => entry.id === variantId);
    for (const choice of variant?.choices || []) {
      const key = `${kind}-${choice.id}`;
      const select = document.createElement('select'); select.dataset.kitOption = key;
      inputOptions(select, [{ index: '', name: 'Bitte wählen' },
        ...choice.options.map(entry => ({ index: entry.id, name: entry.name }))]);
      if (choice.options.some(entry => entry.id === previous[key])) select.value = previous[key];
      const label = document.createElement('label');
      label.append(node('span', `${kind === 'class' ? 'Klasse' : 'Hintergrund'} · ${choice.label}`), select);
      container.append(label);
    }
  }
}

function readStartingKitSelection() {
  return { classVariant: $('#character-kit-class').value, backgroundVariant: $('#character-kit-background').value,
    choices: Object.fromEntries($$('#character-kit-choices select').map(select => [select.dataset.kitOption, select.value])) };
}

function refreshSubclassOptions() {
  const level = primaryClassLevel();
  const select = $('#character-subclass');
  const previous = select.value;
  const options = [{ index: '', name: '– Noch nicht gewählt –' },
    ...characterData.subclasses.filter(entry => entry.class?.index === $('#character-class').value)];
  inputOptions(select, options);
  select.value = options.some(entry => entry.index === previous) ? previous : '';
  $('#character-subclass-wrap').hidden = level < 3;
}

function refreshLandOptions() {
  $('#character-land-wrap').hidden = selectedSubclasses().druid !== 'circle-of-the-land'
    || (classLevelsNow().druid || 0) < 3;
}

function currentAutomaticSpells() {
  const level = primaryClassLevel();
  const classId = $('#character-class').value;
  const subclassId = level >= 3 ? $('#character-subclass').value : '';
  return getAutomaticSpells({ classId, subclassId, level, spells: characterData.spells,
    land: subclassId === 'circle-of-the-land' ? $('#character-land').value : '',
    excludedIds: $('#character-world').value === EDRAS_ID ? EDRAS_FORBIDDEN_SPELLS : [] });
}

function selectedSpellExclusions() {
  return [...($('#character-world').value === EDRAS_ID ? EDRAS_FORBIDDEN_SPELLS : []),
    ...currentAutomaticSpells().granted.map(spell => spell.id)];
}

function getSpellSelectionFor(root) {
  const checked = kind => [...root.querySelectorAll(`[data-spell-kind="${kind}"]:checked`)].map(input => input.value);
  return {
    cantrips: checked('cantrips'), prepared: checked('prepared'),
    spellbook: checked('spellbook'), discoveries: checked('discoveries'),
    mastery: [1, 2].map(grade => checked(`mastery${grade}`)[0] || ''),
    secrets: checked('secrets'), signature: checked('signature'),
    arcanum: [6, 7, 8, 9].map(grade => checked(`arcanum${grade}`)[0] || ''),
  };
}
function getSpellSelection() { return getSpellSelectionFor($('#character-spell-options')); }

function readSecondarySpellSelections() {
  return Object.fromEntries($$('#character-secondary-spell-panels [data-secondary-spell-class]').map(panel => [
    panel.dataset.secondarySpellClass, getSpellSelectionFor(panel),
  ]));
}

function filterSpells() {
  for (const [searchId, rootId, statusId] of [
    ['#character-spell-search', '#character-spell-options', '#character-spell-search-status'],
    ['#character-secondary-spell-search', '#character-secondary-spell-panels', '#character-secondary-spell-search-status'],
  ]) {
    const query = $(searchId).value;
    const rows = $$(`${rootId} .spell-option`);
    let matches = 0, pinned = 0;
    for (const row of rows) {
      const found = matchesSearch(row.textContent, query);
      const checked = !!row.querySelector('input:checked');
      row.hidden = !found && !checked;
      if (found) matches++;
      else if (checked) pinned++;
    }
    if (rootId === '#character-secondary-spell-panels') {
      for (const panel of $$('#character-secondary-spell-panels [data-secondary-spell-class]')) {
        if (query.trim()) {
          if (!('searchWasOpen' in panel.dataset)) panel.dataset.searchWasOpen = panel.open ? '1' : '0';
          if (panel.querySelector('.spell-option:not([hidden])')) panel.open = true;
        } else if ('searchWasOpen' in panel.dataset) {
          panel.open = panel.dataset.searchWasOpen === '1';
          delete panel.dataset.searchWasOpen;
        }
      }
    }
    $(statusId).textContent = searchFeedback({ matches, total: rows.length, pinned });
  }
}

function renderSecondarySpellOptions(clear = false, restored = null) {
  if (!characterData) return;
  const previous = restored || (clear ? {} : readSecondarySpellSelections());
  const existingPanels = $$('#character-secondary-spell-panels [data-secondary-spell-class]');
  const openPanels = new Set(existingPanels.filter(panel => panel.dataset.searchWasOpen === '1'
    || (panel.open && !('searchWasOpen' in panel.dataset))).map(panel => panel.dataset.secondarySpellClass));
  const outer = $('#character-secondary-spell-panels'); outer.replaceChildren();
  const levels = classLevelsNow();
  const chosenSubclasses = selectedSubclasses();
  const denied = $('#character-world').value === EDRAS_ID ? EDRAS_FORBIDDEN_SPELLS : [];
  const makeGroup = (panel, kind, title, spells, limit, values) => {
    if (!limit || !spells.length) return;
    panel.append(node('h4', `${title} · ${values.filter(Boolean).length}/${Number.isFinite(limit) ? limit : '∞'}`));
    for (const spell of spells) {
      const label = node('label', '', 'spell-option');
      const input = document.createElement('input'); input.type = 'checkbox';
      input.dataset.spellKind = kind; input.value = spell.index;
      if (Number.isFinite(limit)) input.dataset.spellLimit = String(limit);
      input.checked = values.includes(spell.index);
      label.append(input, node('span', `${spell.name} · ${spell.level ? `Grad ${spell.level}` : 'Trick'}${spell.ritual ? ' · Ritual' : ''}`));
      panel.append(label);
    }
  };
  for (const [id, level] of Object.entries(levels)) {
    if (id === $('#character-class').value) continue;
    const klass = characterData.classes.find(entry => entry.index === id);
    const summary = getClassLevelSummary(characterData.levels, klass, level);
    if (!summary.spellcasting) continue;
    const section = node('details', '', 'choice-panel'); section.dataset.secondarySpellClass = id;
    section.open = openPanels.has(id) || !existingPanels.length && !outer.children.length;
    section.append(node('summary', `${klass.name} · Klassenstufe ${level} · eigene Zauberwahl`));
    const subclassId = chosenSubclasses[id] || '';
    const automatic = getAutomaticSpells({ classId: id, subclassId, level, land: id === 'druid' ? $('#character-land').value : '',
      spells: characterData.spells, excludedIds: denied });
    const excludedIds = [...denied, ...automatic.granted.map(spell => spell.id)];
    const options = getClassSpellChoices(summary, id, characterData.spells, excludedIds);
    const old = previous[id] || {};
    const previousValues = kind => Array.isArray(old[kind]) ? old[kind] : [];
    const spellsById = rows => new Set(rows.map(spell => spell.index));
    const keep = (kind, rows, limit) => previousValues(kind).filter(spell => spellsById(rows).has(spell)).slice(0, limit);
    const cantrips = keep('cantrips', options.cantrips, options.cantripLimit);
    const wizard = id === 'wizard';
    const book = wizard ? keep('spellbook', options.prepared, Infinity) : [];
    const secrets = getBardMagicalSecrets({ classId: id, level, levelRows: characterData.levels,
      summary, spells: characterData.spells, excludedIds });
    const secretIds = keep('secrets', secrets.available, secrets.maxForeign);
    const preparedOptions = wizard ? options.prepared.filter(spell => book.includes(spell.index)) : options.prepared;
    const prepared = keep('prepared', preparedOptions, options.preparedLimit - secretIds.length);
    const discovery = getMagicalDiscoveries({ classId: id, level, summary, subclassId,
      spells: characterData.spells, excludedIds });
    const mastered = getSpellMastery({ classId: id, level, spells: characterData.spells,
      spellbook: book, excludedIds });
    const signature = getSignatureSpells({ classId: id, level, spells: characterData.spells,
      spellbook: book, excludedIds });
    const arcanum = getMysticArcanum({ classId: id, level, spells: characterData.spells, excludedIds });
    makeGroup(section, 'cantrips', 'Zaubertricks', options.cantrips, options.cantripLimit, cantrips);
    if (wizard) makeGroup(section, 'spellbook', 'Magier-Zauberbuch', options.prepared, Infinity, book);
    makeGroup(section, 'prepared', 'Vorbereitete Zauber', preparedOptions,
      options.preparedLimit - secretIds.length, prepared);
    makeGroup(section, 'discoveries', 'Magical Discoveries', discovery.available, 2,
      keep('discoveries', discovery.available, 2));
    makeGroup(section, 'secrets', 'Magical Secrets', secrets.available, secrets.maxForeign, secretIds);
    for (let grade = 1; grade <= 2; grade++) makeGroup(section, `mastery${grade}`, `Spell Mastery · Grad ${grade}`,
      mastered.available[grade], wizard && level >= 18 ? 1 : 0,
      (old.mastery || []).filter((spell, index) => index === grade - 1 && mastered.available[grade].some(entry => entry.index === spell)));
    makeGroup(section, 'signature', 'Signaturzauber', signature.available, wizard && level >= 20 ? 2 : 0,
      keep('signature', signature.available, 2));
    for (let grade = 6; grade <= 9; grade++) makeGroup(section, `arcanum${grade}`, `Mystisches Arkanum · Grad ${grade}`,
      arcanum.available[grade], arcanum.available[grade].length ? 1 : 0,
      (old.arcanum || []).filter((spell, index) => index === grade - 6 && arcanum.available[grade].some(entry => entry.index === spell)));
    outer.append(section);
  }
  $('#character-secondary-spells').hidden = !outer.children.length;
  $('#character-secondary-spells-count').textContent = `· ${outer.children.length} Klassen`;
  filterSpells();
}

function updateSpellCount() {
  const selected = getSpellSelection();
  const group = $('#character-spells');
  const limitCantrips = Number(group.dataset.cantripLimit || 0);
  const limitPrepared = Number(group.dataset.preparedLimit || 0);
  const wizard = $('#character-class').value === 'wizard';
  const level = primaryClassLevel();
  const book = wizard ? `, Zauberbuch ${selected.spellbook.length}/${6 + 2 * (level - 1)} min.` : '';
  const discoveries = $('#character-subclass').value === 'college-of-lore' && level >= 6
    ? `, Magical Discoveries ${selected.discoveries.length}/2` : '';
  const mastery = wizard && level >= 18
    ? `, Spell Mastery ${selected.mastery.filter(Boolean).length}/2` : '';
  const extra = $('#character-class').value === 'bard' && level >= 10
    ? `, Magical Secrets ${selected.secrets.length}/${Number(group.dataset.secretsLimit || 0)}`
    : $('#character-class').value === 'warlock' && level >= 11
      ? `, Arkanum ${selected.arcanum.filter(Boolean).length}` : wizard && level >= 20
        ? `, Signaturzauber ${selected.signature.length}/2` : '';
  $('#character-spells-count').textContent = `· ${selected.cantrips.length}/${limitCantrips} Tricks, ${selected.prepared.length + selected.secrets.length}/${limitPrepared} Zauber${book}${discoveries}${mastery}${extra}`;
}

/** Nur die bereits vorhandenen 2024-Klassenlisten verwenden; keine neue Zaubertabelle. */
function refreshSpellOptions(clear = false) {
  if (!characterData) return;
  const previous = clear ? { cantrips: [], prepared: [], spellbook: [], discoveries: [], mastery: ['', ''], secrets: [], signature: [], arcanum: ['', '', '', ''] } : getSpellSelection();
  const chosen = characterData.classes.find(entry => entry.index === $('#character-class').value);
  const level = primaryClassLevel();
  const wrapper = $('#character-spells');
  if (!chosen || !Number.isInteger(level) || level < 1 || level > 20) { wrapper.hidden = true; renderSecondarySpellOptions(clear); return; }
  const summary = getClassLevelSummary(characterData.levels, chosen, level);
  wrapper.hidden = !summary.spellcasting;
  const list = $('#character-spell-options'); list.replaceChildren();
  if (!summary.spellcasting) { renderSecondarySpellOptions(clear); return; }
  const excludedIds = selectedSpellExclusions();
  const options = getClassSpellChoices(summary, chosen.index, characterData.spells, excludedIds);
  wrapper.dataset.cantripLimit = options.cantripLimit;
  wrapper.dataset.preparedLimit = options.preparedLimit;
  const wizard = chosen.index === 'wizard';
  const secrets = getBardMagicalSecrets({ classId: chosen.index, level, levelRows: characterData.levels,
    summary, spells: characterData.spells, excludedIds });
  const validSecrets = new Set(secrets.available.map(spell => spell.index));
  const keptSecrets = previous.secrets.filter(id => validSecrets.has(id)).slice(0, secrets.maxForeign);
  wrapper.dataset.secretsLimit = secrets.maxForeign;
  const discoveries = getMagicalDiscoveries({ summary, classId: chosen.index,
    subclassId: level >= 3 ? $('#character-subclass').value : '', level,
    spells: characterData.spells, excludedIds });
  const spellbookAvailable = new Set(options.prepared.map(spell => spell.index));
  const spellbook = new Set(previous.spellbook.filter(id => spellbookAvailable.has(id)));
  const mastery = getSpellMastery({ classId: chosen.index, level, spells: characterData.spells,
    spellbook: [...spellbook], excludedIds });
  const signature = getSignatureSpells({ classId: chosen.index, level,
    spells: characterData.spells, spellbook: [...spellbook], excludedIds });
  const arcanum = getMysticArcanum({ classId: chosen.index, level, spells: characterData.spells, excludedIds });
  for (const [kind, label, rows, limit] of [
    ['cantrips', 'Zaubertricks', options.cantrips, options.cantripLimit],
    ...(wizard ? [['spellbook', 'Magier-Zauberbuch (mindestens 6 + 2 je weitere Stufe)', options.prepared, Infinity]] : []),
    ['prepared', wizard ? 'Aus dem Zauberbuch vorbereiten' : 'Vorbereitete Zauber',
      wizard ? options.prepared.filter(spell => spellbook.has(spell.index)) : options.prepared,
      options.preparedLimit - keptSecrets.length],
    ...(discoveries.available.length ? [['discoveries', 'Magical Discoveries · zwei zusätzliche Zauber aus Kleriker, Druide oder Magier', discoveries.available, 2]] : []),
    ...(secrets.available.length ? [['secrets', 'Magical Secrets · andere Klassenlisten (zählen zur normalen Vorbereitung)', secrets.available, secrets.maxForeign]] : []),
    ...(wizard && level >= 18 ? [
      ['mastery1', 'Spell Mastery · Zauber Grad 1 (Aktion)', mastery.available[1], 1],
      ['mastery2', 'Spell Mastery · Zauber Grad 2 (Aktion)', mastery.available[2], 1],
    ] : []),
    ...(signature.available.length ? [['signature', 'Signature Spells · zwei Grad-3-Zauber aus dem Buch', signature.available, 2]] : []),
    ...[6, 7, 8, 9].filter(grade => arcanum.available[grade].length).map(grade => [
      `arcanum${grade}`, `Mystisches Arkanum · Grad ${grade} (1 × pro langer Rast)`, arcanum.available[grade], 1,
    ]),
  ]) {
    if (!limit) continue;
    list.append(node('h4', label));
    const legal = new Set(rows.map(spell => spell.index));
    const previousIds = kind.startsWith('mastery') ? [previous.mastery[Number(kind.at(-1)) - 1]]
      : kind.startsWith('arcanum') ? [previous.arcanum[Number(kind.slice(-1)) - 6]] : previous[kind];
    const kept = new Set(previousIds.filter(id => legal.has(id)).slice(0, limit));
    for (const spell of rows) {
      const item = node('label', '', 'spell-option');
      const input = document.createElement('input');
      input.type = 'checkbox'; input.value = spell.index; input.dataset.spellKind = kind;
      input.checked = kept.has(spell.index);
      item.append(input, node('span', `${spell.name} · ${spell.level === 0 ? 'Trick' : `Grad ${spell.level}`}${spell.ritual ? ' · Ritual' : ''}${spell.concentration ? ' · Konzentration' : ''}`));
      list.append(item);
    }
  }
  filterSpells();
  updateSpellCount();
  renderSecondarySpellOptions(clear);
}

function syncAdvancementInputs() {
  for (const row of $$('#character-improvements [data-asi-level]')) {
    const kind = row.querySelector('[data-asi-kind]').value;
    const feat = row.querySelector('[data-asi-feat]');
    const grappler = kind === 'feat' && feat.value === 'grappler';
    const epic = kind === 'feat' && characterData.feats.some(entry => entry.index === feat.value && entry.type === 'epic-boon');
    feat.hidden = kind !== 'feat';
    const primary = row.querySelector('[data-asi-primary]');
    primary.hidden = !['one', 'split'].includes(kind) && !grappler && !epic;
    for (const option of primary.options) option.disabled = grappler && !['str', 'dex'].includes(option.value);
    if (grappler && !['str', 'dex'].includes(primary.value)) primary.value = 'str';
    row.querySelector('[data-asi-secondary]').hidden = kind !== 'split';
  }
}

function refreshAdvancementOptions() {
  const classId = $('#character-class').value;
  const box = $('#character-improvements');
  const history = currentLevelHistory();
  if (!history.length) return;
  const improvementLevels = multiclassImprovementLevels(history, characterData.levels);
  const signature = history.join('|');
  if (advancementClassId !== signature) {
    for (const row of $$('#character-improvements [data-asi-level]')) {
      advancementChoiceCache.set(Number(row.dataset.asiLevel), Object.fromEntries(['kind', 'primary', 'secondary', 'feat']
        .map(key => [key, row.querySelector(`[data-asi-${key}]`).value])));
    }
    advancementClassId = signature;
    box.replaceChildren();
    const choices = [
      { index: 'pending', name: 'Offen lassen' },
      { index: 'one', name: 'Ein Attribut +2' },
      { index: 'split', name: 'Zwei Attribute +1' },
      { index: 'feat', name: 'Talent wählen' },
    ];
    for (const level of improvementLevels) {
      const row = node('div', '', 'advancement-line');
      row.dataset.asiLevel = String(level);
      row.append(node('span', `St. ${level}`));
      for (const [id, options] of [
        ['kind', choices], ['primary', ATTRIBUTES.map(index => ({ index, name: index.toUpperCase() }))],
        ['secondary', ATTRIBUTES.map(index => ({ index, name: index.toUpperCase() }))],
      ]) {
        const select = document.createElement('select');
        select.dataset[`asi${id[0].toUpperCase()}${id.slice(1)}`] = '';
        select.setAttribute('aria-label', `Stufe ${level}: ${id === 'kind' ? 'Wahl' : id === 'primary' ? 'erstes Attribut' : 'zweites Attribut'}`);
        inputOptions(select, options);
        if (id === 'secondary') select.value = 'dex';
        row.append(select);
      }
      const featSelect = document.createElement('select');
      featSelect.dataset.asiFeat = '';
      featSelect.setAttribute('aria-label', `Stufe ${level}: Talent`);
      const levels = Object.fromEntries([...new Set(history.slice(0, level))]
        .map(id => [id, history.slice(0, level).filter(value => value === id).length]));
      const eligible = characterData.feats.filter(feat => feat.index !== 'ability-score-improvement'
        && (!feat.prerequisites?.minimum_level || feat.prerequisites.minimum_level <= level)
        && (!feat.prerequisites?.feature_named || characterData.levels.some(step => step.level <= (levels[step.class?.index] || 0)
          && step.features?.some(ref => ref.index === `${step.class?.index}-${feat.prerequisites.feature_named.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`))));
      inputOptions(featSelect, [{ index: '', name: '– Talent wählen –' }, ...eligible]);
      row.append(featSelect);
      const kept = advancementChoiceCache.get(level);
      if (kept) for (const [field, value] of Object.entries(kept)) {
        const control = row.querySelector(`[data-asi-${field}]`);
        if (control && [...control.options].some(option => option.value === value)) control.value = value;
      }
      box.append(row);
    }
    syncAdvancementInputs();
  }
  const visible = improvementLevels.length;
  $('#character-advancement').hidden = !visible;
  $('#character-advancement-count').textContent = `· ${visible} Wahl${visible === 1 ? '' : 'en'}`;
}

function refreshHitPointChoices({ reset = false } = {}) {
  const box = $('#character-hp-rolls');
  if (reset || !box.children.length) {
    const cached = reset ? [] : $$('[data-hp-level]').map(input => input.value);
    box.replaceChildren();
    for (let level = 2; level <= 20; level++) {
      const label = node('label', `Stufe ${level}`);
      const input = node('input');
      // Die eigene gebündelte Fehlerliste prüft den Zahlenbereich und fehlende Würfe.
      input.type = 'number'; input.step = 'any';
      input.dataset.hpLevel = String(level);
      input.value = cached[level - 2] ?? '';
      label.append(input);
      box.append(label);
    }
  }
  const history = currentLevelHistory();
  const level = history.length || 1;
  const rolled = $('#character-hp-method').value === 'rolled';
  const values = $$('[data-hp-level]');
  let missing = 0;
  for (const input of values) {
    const current = Number(input.dataset.hpLevel);
    const die = characterData.classes.find(entry => entry.index === history[current - 1])?.hit_die || 8;
    const active = current <= level;
    input.dataset.hpDie = String(die);
    input.placeholder = `W${die}`;
    input.parentElement.firstChild.textContent = `Stufe ${current} · W${die}`;
    input.parentElement.hidden = !active;
    input.disabled = !active || !rolled;
    if (active && (!input.value || !Number.isSafeInteger(Number(input.value))
      || Number(input.value) < 1 || Number(input.value) > die)) missing++;
  }
  $('#character-hp-roll-panel').hidden = !rolled || level < 2;
  $('#character-hp-count').textContent = rolled && level > 1
    ? `· ${Math.max(0, level - 1 - missing)}/${level - 1} Würfe`
    : '· fester Klassenwert';
}

function readHitPointChoices() {
  const method = $('#character-hp-method').value;
  const level = Number($('#character-level').value) || 1;
  return { method, rolls: method === 'rolled'
    ? $$('[data-hp-level]').slice(0, Math.max(0, level - 1)).map(input => input.value ? Number(input.value) : null)
    : [] };
}

$('#character-hp-roll-missing').addEventListener('click', () => {
  const level = Number($('#character-level').value);
  for (const input of $$('[data-hp-level]')) {
    const die = Number(input.dataset.hpDie);
    if (Number(input.dataset.hpLevel) > level) continue;
    if (!input.value || !Number.isSafeInteger(Number(input.value)) || Number(input.value) < 1 || Number(input.value) > die) {
      input.value = String(rollDice(`1d${die}`).total);
    }
  }
  refreshHitPointChoices();
  previewCharacter();
});

function readCharacterForm() {
  const baseAttributes = Object.fromEntries($$('[data-ability]').map(input => [input.dataset.ability, Number(input.value)]));
  const level = Number($('#character-level').value);
  if (!Number.isInteger(level) || level < 1 || level > 20) throw characterFormError('Stufe muss zwischen 1 und 20 liegen.', '#character-level');
  const backgroundId = $('#character-background').value;
  const background = characterData?.backgrounds.find(entry => entry.index === backgroundId);
  const attributeMethod = $('#character-method').value;
  const mode = $('#character-bonus-mode').value;
  const backgroundBonus = mode === 'all-one' ? { mode } : {
    mode, primary: $('#character-plus-two').value, secondary: $('#character-plus-one').value,
  };
  const origin = checkCharacterSection('#character-attributes', () => buildOriginAttributes({ baseAttributes, method: attributeMethod, background, bonus: backgroundBonus }));
  const originChoices = readHeritageChoices();
  const history = currentLevelHistory();
  const isMulti = new Set(history).size > 1;
  const improvementLevels = multiclassImprovementLevels(history, characterData.levels);
  const levelChoices = improvementLevels.map(unlockedAt => {
    const row = $(`#character-improvements [data-asi-level="${unlockedAt}"]`);
    return { level: unlockedAt, kind: row.querySelector('[data-asi-kind]').value,
      primary: row.querySelector('[data-asi-primary]').value,
      secondary: row.querySelector('[data-asi-secondary]').value,
      featId: row.querySelector('[data-asi-feat]').value };
  });
  const progress = checkCharacterSection('#character-advancement', () => applyLevelImprovements(origin.attributes, improvementLevels, levelChoices, {
    feats: characterData.feats, levelRows: characterData.levels,
    classId: $('#character-class').value, originFeatId: background.feat?.index,
    originFeatIds: [originChoices.versatileFeatId], history,
  }));
  const classLevel = primaryClassLevel();
  const subclassId = classLevel >= 3 ? $('#character-subclass').value : '';
  if (subclassId && !characterData.subclasses.some(entry => entry.index === subclassId && entry.class?.index === $('#character-class').value)) {
    throw characterFormError('Diese Unterklasse gehört nicht zur ausgewählten Klasse.', '#character-subclass');
  }
  const secondarySubclasses = Object.fromEntries(Object.entries(selectedSubclasses())
    .filter(([id, selected]) => id !== $('#character-class').value && selected));
  const edras = $('#character-world').value === EDRAS_ID ? {
    potential: Number($('#character-edras-potential').value),
    techniqueId: $('#character-edras-technique').value,
    publicAssessment: getAppliedEdrasAssessment(),
  } : null;
  if (edras) {
    if ($('#character-species').value !== 'human') throw characterFormError('In Edras sind im normalen Kampagnenmodus nur menschliche Spielfiguren vorgesehen.', '#character-species');
    if (history.some(id => !['fighter', 'rogue', 'cleric', 'wizard', 'paladin', 'monk', 'bard', 'warlock'].includes(id))) {
      throw characterFormError('Dieser Edras-Entwurf unterstützt nur die acht vorgesehenen Klassenpfade.', '#character-class');
    }
    checkCharacterSection('#character-edras-potential', () => edrasMaximum(level, progress.attributes.con, edras.potential));
  }
  $('#character-origin-help').textContent = origin.pointsSpent === null
    ? 'Grundwerte vor Hintergrundboni und späteren Stufensteigerungen.'
    : `Punktekauf: ${origin.pointsSpent} von 27 Punkten verwendet. Hintergrundboni werden danach addiert.`;
  return {
    classId: $('#character-class').value, speciesId: $('#character-species').value,
    backgroundId, subclassId, level, classLevel, baseAttributes, originAttributes: origin.attributes,
    attributes: progress.attributes, attributeMethod, backgroundBonus, levelChoices,
    ...(isMulti ? { levelHistory: history,
      multiclassProficiencyIds: $$('#character-multiclass-skills select').map(item => item.value) } : {}),
    ...(Object.keys(secondarySubclasses).length ? { secondarySubclasses } : {}),
    hitPoints: readHitPointChoices(),
    originChoices,
    magicInitiate: readMagicInitiateChoices(),
    additionalSkilled: readAdditionalSkilledChoices(),
    classSkillIds: $$('#character-skill-choices select').map(select => select.value).filter(Boolean),
    bonusSkillIds: $$('#character-bonus-skill-choices select').map(select => select.value).filter(Boolean),
    expertiseIds: $$('#character-expertise-choices select').map(select => select.value).filter(Boolean),
    weaponMasteryIds: $$('#character-mastery-choices select').map(select => select.value).filter(Boolean),
    classFeatures: getClassFeatureSelection(),
    armorId: $('#character-armor').value, shield: $('#character-shield').value === 'yes',
    spells: getSpellSelection(),
    ...(isMulti ? { spellsByClass: readSecondarySpellSelections() } : {}),
    ...(selectedSubclasses().druid === 'circle-of-the-land' ? { land: $('#character-land').value } : {}),
    edras,
  };
}

/** Voraussetzungen gelten beim tatsächlichen Klassenbeitritt, vor späteren ASI. */
function entryAttributesFor(values) {
  const history = normalizeLevelHistory(values.classId, values.level, values.levelHistory, characterData.classes);
  const improvements = multiclassImprovementLevels(history, characterData.levels);
  const background = characterData.backgrounds.find(item => item.index === values.backgroundId);
  const entries = {};
  for (const step of classLevelsAt(history)) {
    if (step.level === 1 || step.classLevel !== 1) continue;
    const prior = improvements.filter(level => level < step.level);
    entries[step.level] = applyLevelImprovements(values.originAttributes, prior,
      values.levelChoices.filter(choice => choice.level < step.level), {
        feats: characterData.feats, levelRows: characterData.levels, classId: values.classId,
        history, originFeatId: background.feat?.index,
        originFeatIds: [values.originChoices.versatileFeatId],
      }).attributes;
  }
  return entries;
}

/** Eine gemeinsame, weltabhängige Prüfung für Vorschau und Speicherung. */
function checkCharacterSpells(values, summary) {
  return validateClassSpellSource({ classId: values.classId, classLevel: values.classLevel,
    subclassId: values.subclassId, land: values.land || '', selected: values.spells,
    summary, spellCatalog: characterData.spells, levelRows: characterData.levels,
    excludedIds: values.edras ? EDRAS_FORBIDDEN_SPELLS : [] });
}

function checkSecondaryCharacterSpells(values) {
  if (!values.levelHistory) return [];
  const counts = values.levelHistory.reduce((result, id) => ({ ...result, [id]: (result[id] || 0) + 1 }), {});
  const results = [];
  for (const [classId, level] of Object.entries(counts)) {
    if (classId === values.classId) continue;
    const klass = characterData.classes.find(entry => entry.index === classId);
    const summary = getClassLevelSummary(characterData.levels, klass, level, values.attributes, values.level);
    if (!summary.spellcasting) continue;
    const spells = values.spellsByClass?.[classId] || { cantrips: [], prepared: [], spellbook: [],
      discoveries: [], mastery: ['', ''], secrets: [], signature: [], arcanum: ['', '', '', ''] };
    const decisions = checkCharacterSpells({ ...values, classId, classLevel: level,
      subclassId: values.secondarySubclasses?.[classId] || '', spells }, summary);
    const missing = decisions.spellCheck.missingCantrips + decisions.spellCheck.missingPrepared
      + decisions.spellCheck.missingSpellbook + decisions.discoveries.missing + decisions.mastery.missing
      + decisions.arcanum.missing + decisions.signature.missing;
    results.push({ classId, level, missing, decisions });
  }
  return results;
}

async function previewCharacter() {
  const request = ++characterRequest;
  const box = $('#character-preview');
  try {
    const values = readCharacterForm();
    const chosen = characterData.classes.find(c => c.index === values.classId);
    if (!chosen) return;
    const species = characterData.species.find(c => c.index === values.speciesId);
    const background = characterData.backgrounds.find(c => c.index === values.backgroundId);
    const subclass = characterData.subclasses.find(s => s.index === values.subclassId);
    const features = await listClassFeatures(values.classId, values.classLevel, values.subclassId);
    if (request !== characterRequest) return;
    const multi = values.levelHistory ? summarizeMulticlass({ classId: values.classId,
      level: values.level, history: values.levelHistory, classes: characterData.classes,
      rows: characterData.levels, attributes: values.attributes, hitPoints: values.hitPoints }) : null;
    const hpProgress = multi?.hp || calculateHitPoints({ level: values.level, hitDie: chosen.hit_die,
      attributes: values.attributes, hitPoints: values.hitPoints });
    const stat = { ...basicDndCharacter({ level: values.level, hitDie: chosen.hit_die,
      attributes: values.attributes, hitPoints: values.hitPoints }), max_hp: hpProgress.maxHp };
    const heritage = resolveCharacterOrigin(values);
    const magic = validateMagicInitiate({ profile: values, spells: characterData.spells });
    const backgroundProficiencies = (background?.proficiencies || []).map(entry => entry.index);
    const skilled = validateAdditionalSkilled({ profile: values, skills: characterData.skills,
      proficiencies: characterData.proficiencies,
      baseSkills: [...values.classSkillIds, ...values.bonusSkillIds, ...heritage.skillIds,
        ...backgroundProficiencies.filter(id => id.startsWith('skill-')).map(id => id.slice(6))],
      baseTools: [...heritage.toolIds, ...backgroundProficiencies.filter(id => !id.startsWith('skill-'))] });
    const classFeatures = checkClassFeatureChoices(values);
    const classLevels = values.levelHistory ? classLevelsAt(values.levelHistory)
      .reduce((acc, step) => ({ ...acc, [step.classId]: step.classLevel }), {})
      : { [values.classId]: values.level };
    const effects = getClassDecisionEffects({ choices: values.classFeatures.decisions || {}, classLevels,
      subclasses: { [values.classId]: values.subclassId, ...values.secondarySubclasses }, levels: characterData.levels });
    const decisions = validateClassDecisions({ classLevels,
      subclasses: { [values.classId]: values.subclassId, ...values.secondarySubclasses },
      levels: characterData.levels, languages: characterData.languages, spells: characterData.spells,
      monsters: beastCatalog, choices: values.classFeatures.decisions || {},
      knownLanguages: heritage.languages, knownCantrips: values.spells.cantrips });
    const defense = getDefenseStats({ classEntry: chosen, subclassId: values.subclassId,
      level: values.classLevel, levelRows: characterData.levels, attributes: values.attributes,
      equipment: characterData.equipment, armorId: values.armorId, shield: values.shield,
      speciesSpeed: heritage.speed, fightingStyles: classFeatures.effectiveStyles,
      additionalProficiencies: [...(multi?.proficiencies || []), ...effects.proficiencies] });
    const classSummary = getClassLevelSummary(characterData.levels, chosen, values.classLevel, values.attributes, values.level);
    const { automatic, spellCheck, discoveries, mastery, secrets, arcanum, signature } = checkCharacterSpells(values, classSummary);
    const secondarySpellChecks = checkSecondaryCharacterSpells(values);
    const proficient = getStartingProficiencies({ classEntry: chosen, background,
      skills: characterData.skills, classSkillIds: values.classSkillIds, bonusSkillIds: values.bonusSkillIds,
      extraSkillIds: [...heritage.skillIds, ...skilled.skills, ...(values.multiclassProficiencyIds || [])
        .filter(id => id.startsWith('skill-')).map(id => id.slice(6))],
      expertiseIds: values.expertiseIds, subclassId: values.subclassId,
      attributes: values.attributes, level: values.level, classLevel: values.classLevel,
      additionalSavingThrows: effects.savingThrows });
    const weaponMastery = getWeaponMasteryChoices({ classEntry: chosen, levelRows: characterData.levels,
      level: values.classLevel, equipment: characterData.equipment, selected: values.weaponMasteryIds });
    box.replaceChildren();
    box.append(node('p', 'SRD-5.2.1-Herkunft und Talente · Spielvorschau', 'eyebrow'));
    box.append(node('h3', `${chosen.name} · Stufe ${values.level}`));
    if (multi) {
      box.append(node('p', `Stufenverlauf: ${Object.entries(multi.classLevels).map(([id, count]) =>
        `${characterData.classes.find(item => item.index === id)?.name || id} ${count}`).join(' · ')}. Trefferwürfel: ${Object.entries(multi.hitDice).map(([die, count]) => `${count}W${die}`).join(', ')}.`, 'form-hint'));
      box.append(node('p', `Gemeinsame Zauberplätze: ${multi.spellcasting.slots.map(slot => `${slot.max}× Grad ${slot.level}`).join(', ') || 'keine'}; Paktmagie separat: ${multi.spellcasting.pactSlots.map(slot => `${slot.max}× Grad ${slot.level}`).join(', ') || 'keine'}.`, 'form-hint'));
      for (const warning of multi.manualReview) box.append(node('p', `Spielleitung: ${warning}`, 'form-hint'));
    }
    const grid = node('div', '', 'stat-grid summary-grid');
    for (const [label, value] of [['Trefferpunkte¹', stat.max_hp === null ? '—' : stat.max_hp + defense.maxHpBonus + heritage.hpBonus], ['Rüstungsklasse', defense.armorClass], ['Übungsbonus', `+${stat.proficiencyBonus}`], ['Bewegung', `${defense.speed} ft.`]]) {
      const card = node('div', '', 'stat'); card.append(node('strong', value)); card.append(node('span', label)); grid.append(card);
    }
    box.append(grid);
    box.append(node('p', hpProgress.missing.length
      ? `Trefferpunkte noch offen: Würfe für Stufe ${hpProgress.missing.join(', ')} fehlen oder sind ungültig. Der TP-Höchstwert wird erst danach berechnet.`
      : `Trefferpunkte: ${hpProgress.method === 'rolled' ? 'gespeicherte Einzelwürfe' : 'fester Klassenwert'} · KON über alle Stufen berücksichtigt.`, 'form-hint'));
    box.append(node('p', `Verteidigung: ${defense.defense}${values.shield ? defense.shieldTrained ? ' · Schild +2' : ' · untrainierter Schild' : ''}.${defense.maxHpBonus ? ` Drakonische Widerstandskraft: +${defense.maxHpBonus} maximale Trefferpunkte.` : ''}`, 'form-hint'));
    box.append(node('p', `Herkunft: Größe ${heritage.size || 'noch offen'} · Sprachen ${heritage.languages.join(', ')} · Werkzeuge ${[...new Set([...heritage.toolIds, ...skilled.tools])].join(', ') || 'keine'}. ${heritage.missing} Herkunftswahlen offen.${heritage.hpBonus ? ` Zwergische Zähigkeit: +${heritage.hpBonus} TP.` : ''}${heritage.initiativeBonus ? ` Alert: +${heritage.initiativeBonus} Initiative.` : ''}${heritage.heroicInspirationOnRest ? ' Mensch: Inspiration nach langer Rast.' : ''}`, 'form-hint'));
    if (heritage.lineage) box.append(node('p', `Abstammung: ${heritage.lineage.name}. Freigeschaltete Merkmale: ${heritage.activeTraits.map(trait => trait.name).join(', ')}`, 'form-hint'));
    if (heritage.resistances.length) box.append(node('p', `Resistenzen: ${heritage.resistances.join(', ')}. Anwendungsfälle prüft die Spielleitung.`, 'form-hint'));
    if (heritage.originSpells.length) box.append(node('p', `Spezieszauber: ${heritage.originSpells.join(', ')} (kostenlose Wirkart mit Rastzähler; Effekt am Tisch).`, 'form-hint'));
    if (secondarySpellChecks.length) box.append(node('p', `Zusätzliche Zauberklassen: ${secondarySpellChecks.map(entry => `${characterData.classes.find(item => item.index === entry.classId)?.name || entry.classId} ${entry.level}${entry.missing ? ` · ${entry.missing} Wahl(en) offen` : ' · vollständig'}`).join(' · ')}. Zaubergrade und Vorbereitung zählen je Klassenstufe, Zauberplätze gemeinsam.`, 'form-hint'));
    if (magic.sources.length) box.append(node('p', `Magic Initiate: ${magic.grants.map(entry => `${entry.list} (${entry.ability || 'Attribut fehlt'}): ${[...entry.cantrips, entry.spellId].filter(Boolean).join(', ')}`).join(' · ') || 'Listenwahl offen'}. Noch ${magic.missing} Entscheidungen.`, 'form-hint'));
    if (skilled.sources.length) box.append(node('p', `Zusätzliches Skilled: ${skilled.sources.length} Talent(e), ${skilled.missing} Übungswahl(en) offen.`, 'form-hint'));
    const originResources = getOriginFeatureResources({ profile: values, origin: heritage, spells: characterData.spells });
    if (originResources.length) box.append(node('p', `Begrenzte Herkunftsnutzungen: ${originResources.map(resource => `${resource.name} ${resource.max}×`).join(' · ')}. Passive und situative Wirkungen bleiben bei der Spielleitung.`, 'form-hint'));
    for (const warning of defense.warnings) box.append(node('p', warning, 'form-hint'));
    box.append(node('h3', 'Attribute nach Herkunft und Stufenentscheidungen'));
    const scores = node('div', '', 'stat-grid');
    for (const [index, id] of ATTRIBUTES.entries()) {
      const card = node('div', '', 'stat');
      const modifier = abilityModifier(values.attributes[id]);
      card.append(node('strong', values.attributes[id]));
      card.append(node('span', `${CHARACTER_LABELS[index]} · ${modifier >= 0 ? '+' : ''}${modifier}`));
      scores.append(card);
    }
    box.append(scores);
    box.append(node('h3', 'Rettungswürfe'));
    const saves = node('div', '', 'stat-grid');
    for (const save of proficient.savingThrows) {
      const card = node('div', '', 'stat');
      card.append(node('strong', `${save.modifier >= 0 ? '+' : ''}${save.modifier}`));
      card.append(node('span', `${save.id.toUpperCase()}${save.trained ? ' · geübt' : ''}`));
      saves.append(card);
    }
    box.append(saves);
    box.append(node('h3', 'Fertigkeiten'));
    const skillList = node('div', '', 'feature-list');
    skillList.tabIndex = 0;
    skillList.setAttribute('role', 'region');
    skillList.setAttribute('aria-label', 'Fertigkeiten der Figur, scrollbar');
    for (const skill of proficient.skills) {
      const line = node('div', '', 'feature-line');
      line.append(node('span', `${skill.modifier >= 0 ? '+' : ''}${skill.modifier}`));
      line.append(node('div', `${skill.name} (${skill.ability.toUpperCase()})${skill.expertise ? ' · Expertise' : skill.trained ? ' · geübt' : proficient.jackOfAllTrades ? ' · Alleskönner' : ''}${skill.minimumD20 ? ' · Mindestwurf 10' : ''}`));
      skillList.append(line);
    }
    box.append(skillList);
    box.append(node('p', `Passive Wahrnehmung: ${proficient.passivePerception} · Offene Fertigkeitswahlen: ${proficient.missing} Klasse, ${proficient.missingBonus} Zusatz, ${proficient.missingExpertise} Expertise.${proficient.reliableTalent ? ' Reliable Talent: Bei geübten Fertigkeits- und Werkzeugproben zählt ein d20-Wurf unter 10 als 10.' : ''}`, 'form-hint'));
    if (weaponMastery.count) box.append(node('p', `Waffenmeisterschaft (${weaponMastery.count}): ${weaponMastery.selected.map(weapon => `${weapon.name} (${weapon.mastery})`).join(' · ') || 'noch keine Wahl'}${weaponMastery.missing ? ` · Noch ${weaponMastery.missing} offen.` : ''}`, 'form-hint'));
    if (classFeatures.styles.count) box.append(node('p', `Kampfstile: ${classFeatures.styles.chosen.map(entry => entry.name).join(' · ') || 'noch offen'}${classFeatures.styles.missing || classFeatures.styles.missingCantrips ? ` · Offene Stile: ${classFeatures.styles.missing}, Zusatzzaubertricks: ${classFeatures.styles.missingCantrips}.` : ''}`, 'form-hint'));
    if (classFeatures.styles.cantripCount && values.classFeatures.styleCantrips.length) box.append(node('p', `Kampfstil-Zaubertricks (extra, aus ${classFeatures.styles.source}): ${values.classFeatures.styleCantrips.map(id => characterData.spells.find(spell => spell.index === id)?.name || id).join(' · ')}.`, 'form-hint'));
    if (classFeatures.metamagic.count) box.append(node('p', `Metamagie: ${classFeatures.metamagic.chosen.map(entry => `${entry.name} (${entry.cost} SP)`).join(' · ') || 'noch offen'} · ${classFeatures.metamagic.missing} offen.`, 'form-hint'));
    if (classFeatures.invocations.count) box.append(node('p', `Anrufungen: ${classFeatures.invocations.chosen.map(entry => entry.name).join(' · ') || 'noch offen'} · ${classFeatures.invocations.missing} offen. Paktbuch-Zusatzzauber und einzelne Aktivierungsfolgen bleiben manuell.`, 'form-hint'));
    if (decisions.groups.length) box.append(node('p', `Quellenmerkmale: ${decisions.groups.length} Entscheidungsgruppen · ${decisions.missing} offene Wahlen.${decisions.manualReview.length ? ` ${decisions.manualReview.join(' ')}` : ''}`, 'form-hint'));
    if (classSummary.spellcasting) {
      const casting = classSummary.spellcasting;
      box.append(node('h3', casting.pactMagic ? 'Paktmagie · kurze oder lange Rast' : 'Zauberplätze · lange Rast'));
      const slots = node('div', '', 'stat-grid');
      for (const slot of casting.slots) {
        const card = node('div', '', 'stat');
        card.append(node('strong', slot.max));
        card.append(node('span', `Grad ${slot.level}`));
        slots.append(card);
      }
      box.append(slots);
      box.append(node('p', `${casting.cantripsKnown} Zaubertricks · ${casting.preparedSpells} vorbereitete Zauber (Klassentabelle) · Zauber-SG ${casting.saveDC} · Angriffsbonus ${casting.attackBonus >= 0 ? '+' : ''}${casting.attackBonus}`, 'form-hint'));
      if (casting.pactMagic) box.append(node('p', 'Mystisches Arkanum verwendet eigene Nutzungen ohne Paktzauberplätze.', 'form-hint'));
      const chosenSpells = [...values.spells.cantrips, ...values.spells.prepared]
        .map(id => characterData.spells.find(spell => spell.index === id)?.name || id);
      box.append(node('p', `Zauberwahl: ${values.spells.cantrips.length}/${spellCheck.cantripLimit} Tricks, ${values.spells.prepared.length + values.spells.secrets.length}/${spellCheck.preparedLimit} vorbereitete Zauber.${spellCheck.missingCantrips || spellCheck.missingPrepared ? ` Noch ${spellCheck.missingCantrips} Tricks und ${spellCheck.missingPrepared} Zauber offen.` : ' Klassenliste vollständig gewählt.'}`, 'form-hint'));
      if (chosenSpells.length) box.append(node('p', chosenSpells.join(' · '), 'form-hint'));
      if (automatic.granted.length) box.append(node('p', `Immer vorbereitet (zusätzlich): ${automatic.granted.map(entry => entry.name).join(' · ')}. Diese Zauber belegen keinen normalen Vorbereitungsplatz.`, 'form-hint'));
      if (discoveries.chosen.length) box.append(node('p', `Magical Discoveries (zusätzlich): ${discoveries.chosen.map(entry => entry.name).join(' · ')}. Auch gewählte Zaubertricks belegen keinen normalen Bard-Platz.`, 'form-hint'));
      if (mastery.chosen.some(Boolean)) box.append(node('p', `Spell Mastery (zusätzlich vorbereitet, ohne Zauberplatz auf niedrigstem Grad): ${mastery.chosen.filter(Boolean).map(entry => entry.name).join(' · ')}. Höhergradiges Wirken verbraucht weiterhin einen Zauberplatz.`, 'form-hint'));
      if (secrets.chosen.length) box.append(node('p', `Magical Secrets (belegt normale Vorbereitungsplätze): ${secrets.chosen.map(entry => entry.name).join(' · ')}.`, 'form-hint'));
      if (arcanum.chosen.some(Boolean)) box.append(node('p', `Mystisches Arkanum (je 1 × ohne Platz pro langer Rast): ${arcanum.chosen.filter(Boolean).map(entry => entry.name).join(' · ')}.`, 'form-hint'));
      if (signature.chosen.length) box.append(node('p', `Signaturzauber (zusätzlich vorbereitet, je 1 × Grad 3 ohne Platz pro kurzer/langer Rast): ${signature.chosen.map(entry => entry.name).join(' · ')}.`, 'form-hint'));
      if (automatic.blocked.length) box.append(node('p', `Für diese Welt gesperrte Klassenzauber: ${automatic.blocked.map(entry => entry.name).join(' · ')}. Für das betroffene Klassenmerkmal muss eine zulässige Alternative mit der Spielleitung vereinbart werden.`, 'form-hint'));
      const pending = automatic.pending.filter(entry =>
        (discoveries.missing || !entry.includes('Magical Discoveries'))
        && (mastery.missing || !entry.includes('Spell Mastery')));
      if (pending.length) box.append(node('p', `Noch offen: ${pending.join(' · ')}.`, 'form-hint'));
      if (arcanum.missing || signature.missing) box.append(node('p', `Sonderzauber offen: ${arcanum.missing} Mystische Arkana, ${signature.missing} Signaturzauber.`, 'form-hint'));
      if (values.classId === 'wizard') box.append(node('p', `Zauberbuch: ${values.spells.spellbook.length} Einträge. ${spellCheck.missingSpellbook ? `Noch mindestens ${spellCheck.missingSpellbook} neue Zauber aus Stufenanstiegen fehlen.` : 'Reguläre Mindestzahl erreicht.'} Weitere gefundene/abgeschriebene Zauber und der Zeitpunkt des Erwerbs bleiben manuell.`, 'form-hint'));
      if (values.classId === 'bard' && values.classLevel >= 10) box.append(node('p', `Magical Secrets: höchstens ${secrets.maxForeign} fremde Zauber sind bei den erreichten Stufen historisch möglich; einzelne Erwerbs- und Austauschzeitpunkte bleiben noch unbestätigt.`, 'form-hint'));
      if (values.edras) box.append(node('p', 'Edras: Weltweit unzulässige Zauber sind aus der Klassenliste entfernt. Weitere erzählerische Grenzen benötigen die Spielleitung.', 'form-hint'));
    }
    if (classSummary.resources.length) {
      box.append(node('h3', 'Klassenressourcen · Höchstwerte'));
      box.append(node('p', classSummary.resources.map(resource => `${resource.name}: ${resource.max}`).join(' · '), 'form-hint'));
    }
    if (values.edras) {
      const technique = EDRAS_TECHNIQUES.find(entry => entry.id === values.edras.techniqueId);
      box.append(node('h3', 'Edras · Zusatzregeln (Spieltest)'));
      box.append(node('p', `Lebensenergie: ${edrasMaximum(values.level, values.attributes.con, values.edras.potential)} · Potenzial: ${values.edras.potential} · Technik: ${technique.name} (${technique.action}, 1 LE).`, 'form-hint'));
      box.append(node('p', `${technique.effect} LE ist unabhängig von TP, Zauberplätzen und Klassenressourcen. Belastung beginnt bei 0; der spätere Abgleich bestimmt nur Edras-Werte, niemals die D&D-Klasse.`, 'form-hint'));
    }
    const openLevels = values.levelChoices.filter(choice => choice.kind === 'pending' || (choice.kind === 'feat' && !choice.featId)).map(choice => choice.level);
    if (openLevels.length) box.append(node('p', `Noch nicht entschieden: Stufe ${openLevels.join(', ')}.`, 'form-hint'));
    const chosenFeats = values.levelChoices.filter(choice => choice.kind === 'feat' && choice.featId);
    if (chosenFeats.length) box.append(node('p', `Gewählte Talente: ${chosenFeats.map(choice => characterData.feats.find(feat => feat.index === choice.featId)?.name).join(', ')}. Grappler- und Epische-Gabe-Attributsboni werden berechnet; übrige Wirkungen bleiben manuell.`, 'form-hint'));
    box.append(node('p', `${background.name} · Herkunftstalent: ${background.feat?.name || '—'}${background.feat?.note ? ` (${background.feat.note})` : ''}`, 'form-hint'));
    box.append(node('p', `Hintergrund-Übungen: ${(background.proficiencies || []).map(entry => entry.name).join(', ') || '—'}`, 'form-hint'));
    box.append(node('p', `Speziesmerkmale: ${(species?.traits || []).map(entry => entry.name).join(', ') || '—'}`, 'form-hint'));
    if (values.classLevel >= 3) {
      box.append(node('p', subclass ? `Gewählte SRD-Unterklasse: ${subclass.name}` : 'Unterklasse noch nicht gewählt: Die entsprechenden Merkmale fehlen in dieser Vorschau.', 'form-hint'));
    }
    box.append(node('h3', `${features.length} Klassenmerkmale`));
    const list = node('div', '', 'feature-list');
    list.tabIndex = 0;
    list.setAttribute('role', 'region');
    list.setAttribute('aria-label', 'Klassenmerkmale der Figur, scrollbar');
    for (const feature of features) {
      const line = node('div', '', 'feature-line');
      line.append(node('span', `St. ${feature.unlockedAt}`));
      line.append(node('div', feature.name));
      list.append(line);
    }
    if (!features.length) list.append(node('p', 'Für diese Kombination wurden noch keine Daten geladen.', 'placeholder'));
    box.append(list);
    box.append(node('p', '¹ Trefferpunkte nach gewählter Methode, einschließlich Attributssteigerungen, Zwergischer Zähigkeit und ggf. Drakonischer Widerstandskraft; weitere Talent-/Spezieswirkungen, Kampfdetails und sekundäre Klassenmerkmale brauchen noch eine SL-Prüfung.', 'form-hint'));
  } catch (error) { if (request === characterRequest) box.textContent = error.message; }
}

function getTrackerSummary(profile) {
  return getCharacterTrackerSummary({ level: profile.level, profile }, characterData);
}

function getVitalContext(profile) {
  return getCharacterVitalContext({ level: profile.level, profile }, characterData);
}

function getProfileDecisions(profile) {
  const classLevels = profile.levelHistory?.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {})
    || { [profile.classId]: profile.level };
  return getClassDecisionEffects({ choices: profile.classFeatures?.decisions || {}, classLevels,
    subclasses: { [profile.classId]: profile.subclassId, ...profile.secondarySubclasses },
    levels: characterData.levels });
}

function setCharacterEditState(id = '', name = '') {
  clearCharacterIssues();
  editingCharacterId = id;
  $('#character-starter').hidden = !!id;
  $('#character-save').textContent = id ? 'Änderungen an dieser Figur speichern' : 'Entwurf in Würfelbund speichern';
  $('#character-cancel-edit').hidden = !id;
  $('#character-edit-state').textContent = id
    ? `Du bearbeitest „${name}“. Speichern aktualisiert nur diese Figur.`
    : 'Neuer Charakterentwurf. Bestehende Figuren bleiben unverändert.';
}

function clearDynamicCharacterChoices() {
  for (const selector of ['#character-skill-choices', '#character-bonus-skill-choices', '#character-expertise-choices',
    '#character-mastery-choices', '#character-style-choices', '#character-style-cantrips',
    '#character-metamagic-choices', '#character-invocation-choices',
    '#character-source-decision-list', '#character-secondary-subclass-list',
    '#character-origin-feat-choices', '#character-secondary-spell-panels']) $(selector).replaceChildren();
}

function resetCharacterEditor() {
  $('#character-form').reset();
  invalidateEdrasQuestionnaire({ keepInputs: false });
  $('#character-level-history').replaceChildren();
  advancementChoiceCache = new Map();
  refreshMulticlassOptions();
  refreshHitPointChoices({ reset: true });
  clearDynamicCharacterChoices();
  advancementClassId = '';
  refreshOriginOptions(); refreshHeritageOptions(); refreshStartingKits(); refreshSkillOptions(); refreshSubclassOptions(); refreshTrainingOptions();
  refreshWeaponMasteryOptions(); refreshLandOptions(); refreshAdvancementOptions();
  refreshSpellOptions(true); refreshClassFeatureOptions();
  refreshSecondarySubclasses(); refreshSourceDecisions(); refreshOriginFeatChoices();
  $('#character-bonus-choices').hidden = $('#character-bonus-mode').value === 'all-one';
  $('#character-edras-options').hidden = $('#character-world').value !== EDRAS_ID;
  $('#character-save').disabled = false;
  setCharacterEditState();
  previewCharacter();
}

function restoreSelectChoices(selector, desired = []) {
  const controls = $$(`${selector} select`);
  for (const [index, select] of controls.entries()) {
    const target = desired[index] || '';
    if ([...select.options].some(option => option.value === target)) select.value = target;
  }
}

function restoreSpellChoices(spells = {}) {
  refreshSpellOptions(true);
  const choose = (kind, ids = []) => {
    const selected = new Set(ids.filter(Boolean));
    for (const input of $$('#character-spell-options [data-spell-kind]')) {
      if (input.dataset.spellKind === kind) input.checked = selected.has(input.value);
    }
  };
  choose('cantrips', spells.cantrips);
  choose('spellbook', spells.spellbook);
  // Die vorbereitbaren Magierzauber und Meisterschaftszauber hängen vom Buch ab.
  refreshSpellOptions();
  for (const kind of ['prepared', 'discoveries', 'secrets', 'signature']) choose(kind, spells[kind]);
  for (let grade = 1; grade <= 2; grade++) choose(`mastery${grade}`, [spells.mastery?.[grade - 1]]);
  for (let grade = 6; grade <= 9; grade++) choose(`arcanum${grade}`, [spells.arcanum?.[grade - 6]]);
  updateSpellCount();
}

function restoreClassChoices(features = {}) {
  refreshClassFeatureOptions();
  restoreSelectChoices('#character-style-choices', features.fightingStyles);
  refreshClassFeatureOptions();
  restoreSelectChoices('#character-style-cantrips', features.styleCantrips);
  restoreSelectChoices('#character-metamagic-choices', features.metamagic);
  // Pakt-Anrufungen können andere Anrufungen freischalten: ggf. in zwei Durchläufen.
  for (let pass = 0; pass < 3; pass++) {
    restoreSelectChoices('#character-invocation-choices', features.invocations);
    refreshClassFeatureOptions();
  }
}

function restoreSourceDecisions(decisions = {}) {
  for (let pass = 0; pass < 2; pass++) {
    refreshSourceDecisions();
    for (const wrap of $$('#character-source-decision-list [data-decision-id]')) {
      const wanted = decisions[wrap.dataset.decisionId];
      const values = Array.isArray(wanted) ? wanted : [wanted];
      for (const [index, select] of [...wrap.querySelectorAll('select')].entries()) {
        if ([...select.options].some(option => option.value === values[index])) select.value = values[index];
      }
    }
  }
}

function restoreHeritageChoices(choices = {}) {
  const wanted = {
    lineageId: choices.lineageId, size: choices.size,
    language0: choices.languages?.[0], language1: choices.languages?.[1],
    speciesSkillId: choices.speciesSkillId, backgroundToolId: choices.backgroundToolId,
    versatileFeatId: choices.versatileFeatId,
    lineageSpellAbility: choices.lineageSpellAbility, highElfCantripId: choices.highElfCantripId,
    ...Object.fromEntries((choices.skilledIds || []).map((id, index) => [`skilled${index}`, id])),
  };
  for (let pass = 0; pass < 2; pass++) {
    for (const [key, value] of Object.entries(wanted)) {
      const select = $(`#character-heritage-choices [data-origin-key="${key}"]`);
      if (select && [...select.options].some(option => option.value === value)) select.value = value;
    }
    if (pass === 0) refreshHeritageOptions();
  }
}

function assertCharacterRestored(profile) {
  const actual = readCharacterForm();
  for (const key of ['classId', 'speciesId', 'backgroundId', 'subclassId', 'level',
    'baseAttributes', 'attributeMethod', 'backgroundBonus', 'levelChoices',
    'classSkillIds', 'bonusSkillIds', 'expertiseIds', 'weaponMasteryIds',
    'armorId', 'shield', 'classFeatures', 'spells', 'originChoices', 'hitPoints',
    'levelHistory', 'multiclassProficiencyIds', 'secondarySubclasses',
    'magicInitiate', 'additionalSkilled', 'spellsByClass']) {
    if (key === 'originChoices' && profile.originChoices) {
      for (const [choiceId, wanted] of Object.entries(profile.originChoices)) {
        if (JSON.stringify(actual.originChoices?.[choiceId]) !== JSON.stringify(wanted)) {
          throw new Error(`Die gespeicherte Herkunftswahl „${choiceId}“ lässt sich nicht vollständig laden.`);
        }
      }
      continue;
    }
    if (profile[key] !== undefined && JSON.stringify(actual[key]) !== JSON.stringify(profile[key])) {
      throw new Error(`Die gespeicherte Auswahl „${key}“ lässt sich nicht vollständig laden. Bitte diesen Entwurf vorerst unverändert lassen.`);
    }
  }
  if (profile.land && actual.land !== profile.land) throw new Error('Das gespeicherte Druiden-Gelände lässt sich nicht laden.');
  if (profile.edras && (actual.edras?.potential !== profile.edras.potential
    || actual.edras.techniqueId !== profile.edras.techniqueId)) {
    throw new Error('Die gespeicherte Edras-Entscheidung lässt sich nicht laden.');
  }
}

async function loadSelectedCharacter() {
  const id = $('#tracker-character').value;
  const character = readGame().characters.find(entry => entry?.id === id);
  if (!character?.profile || character.profile.ruleset !== RULESET.id) {
    notice('Diese Figur hat kein bearbeitbares SRD-5.2.1-Profil.');
    return;
  }
  setCharacterEditState(id, character.name || 'Ohne Namen');
  $('#character-save').disabled = true;
  try {
    const profile = character.profile;
    clearDynamicCharacterChoices();
    $('#character-name').value = character.name || '';
    $('#character-class').value = profile.classId;
    $('#character-level').value = String(character.level);
    $('#character-multiclass-enabled').checked = Array.isArray(profile.levelHistory)
      && new Set(profile.levelHistory).size > 1;
    $('#character-level-history').replaceChildren();
    refreshMulticlassOptions();
    if ($('#character-multiclass-enabled').checked) {
      for (const select of $$('#character-level-history select')) {
        select.value = profile.levelHistory[Number(select.dataset.historyLevel) - 1];
      }
      refreshMulticlassOptions();
    }
    if (classLevelsNow().druid >= 2 && !beastCatalog.length) {
      beastCatalog = await loadCategory('monsters');
    }
    refreshHitPointChoices({ reset: true });
    $('#character-hp-method').value = profile.hitPoints?.method || 'fixed';
    for (const [index, roll] of (profile.hitPoints?.rolls || []).entries()) {
      const field = $$('#character-hp-rolls [data-hp-level]')[index];
      if (field) field.value = roll == null ? '' : String(roll);
    }
    refreshHitPointChoices();
    $('#character-species').value = profile.speciesId;
    $('#character-background').value = profile.backgroundId;
    $('#character-method').value = profile.attributeMethod;
    $('#character-bonus-mode').value = profile.backgroundBonus?.mode || 'two-one';
    $('#character-bonus-choices').hidden = $('#character-bonus-mode').value === 'all-one';
    for (const input of $$('[data-ability]')) input.value = String(profile.baseAttributes?.[input.dataset.ability] ?? '');
    refreshOriginOptions();
    if (profile.backgroundBonus?.primary) $('#character-plus-two').value = profile.backgroundBonus.primary;
    if (profile.backgroundBonus?.secondary) $('#character-plus-one').value = profile.backgroundBonus.secondary;
    refreshHeritageOptions(); restoreHeritageChoices(profile.originChoices);
    $('#character-world').value = profile.edras ? EDRAS_ID : '';
    $('#character-edras-options').hidden = !profile.edras;
    if (profile.edras) {
      $('#character-edras-potential').value = String(profile.edras.potential);
      $('#character-edras-technique').value = profile.edras.techniqueId;
    }
    restoreEdrasQuestionnaire(profile.edras?.publicAssessment || null);
    refreshSkillOptions(); restoreSelectChoices('#character-skill-choices', profile.classSkillIds);
    refreshMulticlassSkillOptions(); restoreSelectChoices('#character-multiclass-skills', profile.multiclassProficiencyIds);
    refreshSubclassOptions(); $('#character-subclass').value = profile.subclassId || '';
    refreshSecondarySubclasses();
    for (const select of $$('#character-secondary-subclass-list select')) {
      if ([...select.options].some(option => option.value === profile.secondarySubclasses?.[select.dataset.subclassClass])) {
        select.value = profile.secondarySubclasses[select.dataset.subclassClass];
      }
    }
    refreshLandOptions(); $('#character-land').value = profile.land || 'temperate';
    refreshTrainingOptions(); restoreSelectChoices('#character-bonus-skill-choices', profile.bonusSkillIds);
    refreshTrainingOptions(); restoreSelectChoices('#character-expertise-choices', profile.expertiseIds);
    refreshWeaponMasteryOptions(); restoreSelectChoices('#character-mastery-choices', profile.weaponMasteryIds);
    advancementClassId = '';
    advancementChoiceCache = new Map();
    refreshAdvancementOptions();
    for (const choice of profile.levelChoices || []) {
      const row = $(`#character-improvements [data-asi-level="${choice.level}"]`);
      if (!row) continue;
      for (const [field, value] of [['kind', choice.kind], ['primary', choice.primary],
        ['secondary', choice.secondary], ['feat', choice.featId]]) {
        if (value !== undefined) row.querySelector(`[data-asi-${field}]`).value = value;
      }
    }
    syncAdvancementInputs();
    $('#character-armor').value = profile.armorId || '';
    $('#character-shield').value = profile.shield ? 'yes' : 'no';
    restoreSpellChoices(profile.spells);
    renderSecondarySpellOptions(false, profile.spellsByClass || {});
    restoreClassChoices(profile.classFeatures);
    restoreSourceDecisions(profile.classFeatures?.decisions);
    refreshOriginFeatChoices(profile.magicInitiate, profile.additionalSkilled);
    assertCharacterRestored(profile);
    $('#character-save').disabled = false;
    setCharacterMode('build', { focus: true });
    $('#character-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    previewCharacter();
    notice(`${character.name || 'Figur'} wurde zum Bearbeiten geöffnet.`);
  } catch (error) {
    setCharacterMode('build', { focus: true });
    notice(`Laden nicht vollständig: ${error.message} Mit „Bearbeitung beenden“ kannst du neu beginnen.`);
  }
}

function renderTrackerOptions(preferredId = '') {
  const select = $('#tracker-character');
  const previous = preferredId || select.value;
  const entries = readGame().characters
    .filter(character => character?.profile?.ruleset === RULESET.id && characterData.classes.some(entry => entry.index === character.profile.classId))
    .map(character => ({ index: character.id, name: `${character.name || 'Ohne Namen'} · Stufe ${character.level}` }));
  inputOptions(select, entries.length ? entries : [{ index: '', name: '– Noch keine lokalen Entwürfe –' }]);
  select.disabled = !entries.length;
  $('#tracker-edit').disabled = !entries.length;
  if (entries.some(entry => entry.index === previous)) select.value = previous;
  renderTracker();
}

function updateTracker(action, restKind = '', recovery = 'none') {
  try {
    const id = $('#tracker-character').value;
    const game = readGame();
    const character = game.characters.find(entry => entry.id === id);
    if (!character || character.profile?.ruleset !== RULESET.id) throw new Error('Charakter nicht gefunden.');
    const profile = { ...character.profile, level: character.level };
    if (restKind) {
      character.profile.vitals = applyVitals(getVitalContext(profile), profile.vitals,
        restKind === 'short' ? 'shortRest' : 'longRest');
    }
    character.profile.tracker = action(getTrackerSummary(profile), character.profile.tracker);
    // Die Rast aktualisiert auch aktivierte Weltmodule, ohne den SRD-Tracker zu verändern.
    if (character.profile.edras && restKind) {
      const context = { level: character.level, constitution: character.profile.attributes.con };
      character.profile.edras = applyEdrasAction(context, character.profile.edras,
        restKind === 'short' ? 'shortRest' : 'longRest', { recovery });
    }
    saveGame(game);
    renderTracker();
  } catch (error) { notice(`Ressourcen konnten nicht gespeichert werden: ${error.message}`); }
}

function updateEdras(action, options = {}) {
  try {
    const game = readGame();
    const character = game.characters.find(entry => entry.id === $('#tracker-character').value);
    if (!character?.profile?.edras) throw new Error('Keine Edras-Figur ausgewählt.');
    const context = { level: character.level, constitution: character.profile.attributes.con };
    character.profile.edras = applyEdrasAction(context, character.profile.edras, action, options);
    saveGame(game);
    renderTracker();
    if (options.overdraw) notice('Überzug: Konstitutionsrettungswurf SG 12 ablegen; bei Misserfolg zusätzlich 1 Erschöpfung (2024) manuell eintragen.');
  } catch (error) { notice(error.message); }
}

function renderEdrasTracker(profile, level) {
  const box = $('#tracker-edras');
  box.hidden = !profile.edras;
  box.replaceChildren();
  if (!profile.edras) return;
  const context = { level, constitution: profile.attributes.con };
  const state = normalizeEdrasState(context, profile.edras);
  const max = edrasMaximum(level, context.constitution, state.potential);
  const technique = EDRAS_TECHNIQUES.find(entry => entry.id === state.techniqueId);
  const effects = edrasTechniqueRules(state);
  box.append(node('h3', 'Edras · Lebensenergie'));
  box.append(node('p', `${state.lifeEnergy} / ${max} LE · Belastung ${state.stress}/5 · Potenzial ${state.potential}`, 'edras-values'));
  box.append(node('p', `${technique.name} · ${technique.action} · 1 LE — ${technique.effect}`, 'form-hint'));
  if (state.publicAssessment) box.append(node('p', 'Öffentlicher Fragebogenentwurf hinterlegt · keine geheime oder kanonische Resonanzauswertung.', 'form-hint'));
  box.append(node('p', effects.blocked ? 'Belastung 5: Technik gesperrt.' :
    `Technikproben: ${effects.disadvantage ? 'Nachteil' : 'kein Belastungsnachteil'}.` +
    ` ${effects.dcPenalty ? 'Technik-SG −2 (nur falls die Technik einen SG erfordert).' : 'Kein Belastungsabzug auf Technik-SG.'}` +
    ' D&D-Proben außerhalb dieser Technik bleiben unverändert.', 'form-hint'));
  const check = document.createElement('details'); check.className = 'vitals-details';
  check.append(node('summary', 'Optionale Technikprobe mit W20 · nur auf SL-Anweisung'));
  const row = node('div', '', 'vitals-actions');
  const attribute = document.createElement('select');
  attribute.setAttribute('aria-label', 'Attribut für Edras-Technikprobe');
  inputOptions(attribute, ATTRIBUTES.map(id => ({ index: id, name: id.toUpperCase() })));
  const bonus = document.createElement('input'); bonus.type = 'number'; bonus.min = '-20'; bonus.max = '20'; bonus.value = '0';
  bonus.setAttribute('aria-label', 'Manuell bestätigter zusätzlicher Technikbonus');
  const dc = document.createElement('input'); dc.type = 'number'; dc.min = '1'; dc.max = '99'; dc.placeholder = 'SG';
  dc.setAttribute('aria-label', 'Optionaler Schwierigkeitsgrad der Technikprobe');
  const circumstance = document.createElement('select');
  circumstance.setAttribute('aria-label', 'Situativer Vor- oder Nachteil bei Technikprobe');
  inputOptions(circumstance, [{ index: 'normal', name: 'Normal' }, { index: 'advantage', name: 'Vorteil' },
    { index: 'disadvantage', name: 'Nachteil' }]);
  const output = node('p', 'Attribut, Zusatzbonus und ggf. Ziel-SG werden von der Spielleitung bestätigt.', 'form-hint');
  row.append(attribute, bonus, dc, circumstance, button('Technik-W20', () => {
    try {
      const vitals = normalizeVitals(getVitalContext({ ...profile, level }), profile.vitals);
      const rules = getEdrasTechniqueD20Rules(state, vitals, { ability: attribute.value, circumstance: circumstance.value });
      const additional = Number(bonus.value);
      if (!Number.isInteger(additional) || additional < -20 || additional > 20 || bonus.value === '') {
        throw new Error('Technik-Zusatzbonus muss zwischen −20 und +20 liegen.');
      }
      const modifier = abilityModifier(profile.attributes[attribute.value]) + additional;
      const target = dc.value === '' ? null : Number(dc.value);
      const rolls = rules.blocked || rules.automaticFailure ? [] : rollDice(rules.mode === 'normal' ? '1d20' : '2d20').rolls;
      const result = resolveD20Roll(rules, rolls, { modifier, dc: target });
      const rollText = result.automaticFailure ? 'Automatischer Fehlschlag' :
        `${result.rolls.join(' / ')} → ${result.total} (Modifikator ${modifier >= 0 ? '+' : ''}${modifier}, Erschöpfung ${rules.penalty})`;
      output.textContent = `Technikprobe: ${rollText}${result.success === null ? '' : result.success ? ' · Gelungen' : ' · Misslungen'}` +
        ` · ${rules.mode === 'disadvantage' ? 'Nachteil' : rules.mode === 'advantage' ? 'Vorteil' : 'normal'}` +
        '. Ein Technik-SG für ein Ziel ist separat zu bestimmen; hier wurde keiner erfunden.';
    } catch (error) { output.textContent = error.message; }
  }));
  check.append(row, output);
  box.append(check);
  const actions = node('div', '', 'action-row');
  const allowed = state.stress < 5 && !state.usedThisRound;
  const spend = button('Technik einsetzen', () => updateEdras('spend'));
  spend.disabled = !allowed || state.lifeEnergy === 0;
  actions.append(spend);
  const overdraw = button('Überzug (SG 12)', () => updateEdras('spend', { overdraw: true }));
  overdraw.disabled = !allowed || state.lifeEnergy !== 0 || state.overdrawUsed || state.stress >= 3;
  actions.append(overdraw);
  actions.append(button('Neue Runde', () => updateEdras('nextRound')));
  actions.append(button('Belastung +1', () => updateEdras('stress', { change: 1 })));
  actions.append(button('Belastung −1', () => updateEdras('stress', { change: -1 })));
  actions.append(button('Sichere Genesung (24 h)', () => {
    updateTracker((summary, saved) => restResourceTracker(summary, saved, 'long'), 'long', '24h');
  }));
  box.append(actions);
  box.append(node('p', `Kurze Rast: LE ${state.shortRecoveryUsed ? 'bereits einmal erholt' : 'einmalig wiederherstellbar'} · Überzug ${state.overdrawUsed ? 'verbraucht' : 'verfügbar'} · ${state.usedThisRound ? 'Technik in dieser Runde benutzt' : 'Technik in dieser Runde frei'}. Änderungen erfolgen lokal; Runde, Konstitutionswurf und SL-Vorgaben müssen am Spieltisch bestätigt werden.`, 'form-hint'));
}

function updateVitals(action, options = {}) {
  try {
    const game = readGame();
    const character = game.characters.find(entry => entry.id === $('#tracker-character').value);
    if (!character?.profile || character.profile.ruleset !== RULESET.id) throw new Error('Charakter nicht gefunden.');
    const context = getVitalContext({ ...character.profile, level: character.level });
    const previous = normalizeVitals(context, character.profile.vitals);
    character.profile.vitals = applyVitals(context, previous, action, options);
    saveGame(game);
    renderTracker();
    if (action === 'damage' && previous.concentrating && character.profile.vitals.concentrating) {
      notice(`Konzentration: KON-Rettungswurf SG ${character.profile.vitals.pendingConcentrationDCs.at(-1)} offen. Bitte im Charakterzustand würfeln.`);
    } else if (action === 'deathSave') notice(`Todesrettungswurf: ${options.roll} · ${character.profile.vitals.dead ? 'verstorben' : character.profile.vitals.stable ? 'stabil' : character.profile.vitals.hp ? 'wieder bei Bewusstsein' : 'noch bei 0 TP'}.`);
    else if (action === 'hitDie') notice(`Trefferwürfel ${options.roll} + KON ${context.conModifier >= 0 ? '+' : ''}${context.conModifier}: ${character.profile.vitals.hp - previous.hp} TP wiederhergestellt.`);
  } catch (error) { notice(error.message); }
}

function updateTypedDamage(options) {
  try {
    if (!Number.isSafeInteger(options.amount) || options.amount < 1 || options.amount > 9999) {
      throw new Error('Schaden muss zwischen 1 und 9999 liegen.');
    }
    const game = readGame();
    const character = game.characters.find(entry => entry.id === $('#tracker-character').value);
    if (!character?.profile || character.profile.ruleset !== RULESET.id) throw new Error('Charakter nicht gefunden.');
    const context = getVitalContext({ ...character.profile, level: character.level });
    const result = applyTypedDamage(context, character.profile.vitals, { ...options,
      resistances: context.resistances, immunities: options.immune ? [options.type] : [],
      vulnerabilities: options.vulnerable ? [options.type] : [] });
    character.profile.vitals = result.vitals;
    saveGame(game);
    renderTracker();
    notice(`${result.damage.original} ${result.damage.type} → ${result.damage.total} Schaden${result.damage.immune ? ' (immun)' : ''}${result.damage.resistant ? ' (resistent)' : ''}${result.damage.vulnerable ? ' (verwundbar)' : ''}.${result.vitals.pendingConcentrationDCs.length ? ' Konzentrationsrettung im Charakterzustand prüfen.' : ''}`);
  } catch (error) { notice(error.message); }
}

function updateCombatTurn(key, used) {
  try {
    const game = readGame();
    const character = game.characters.find(entry => entry.id === $('#tracker-character').value);
    if (!character?.profile || character.profile.ruleset !== RULESET.id) throw new Error('Charakter nicht gefunden.');
    character.profile.combatTurn = changeTurn(character.profile.combatTurn, key, used);
    saveGame(game);
    renderTracker();
  } catch (error) { notice(error.message); }
}

function resolveConcentrationD20(circumstance) {
  try {
    const game = readGame();
    const character = game.characters.find(entry => entry.id === $('#tracker-character').value);
    const profile = { ...character.profile, level: character.level };
    const context = getVitalContext(profile);
    const state = normalizeVitals(context, profile.vitals);
    const dc = state.pendingConcentrationDCs[0];
    if (!dc) throw new Error('Kein offener Konzentrationswurf.');
    const klass = characterData.classes.find(entry => entry.index === profile.classId);
    const trained = klass.saving_throws?.some(entry => entry.index === 'con');
    const bonus = context.conModifier + (trained
      ? basicDndCharacter({ level: context.level, hitDie: context.hitDie, attributes: profile.attributes }).proficiencyBonus : 0);
    const rules = getD20RuleEffects(state, { kind: 'save', ability: 'con', circumstance });
    const outcome = resolveD20Roll(rules, rollDice(rules.mode === 'normal' ? '1d20' : '2d20').rolls,
      { modifier: bonus, dc });
    character.profile.vitals = applyVitals(context, state, 'concentrationSave', { success: outcome.success });
    saveGame(game);
    renderTracker();
    notice(`Konzentration SG ${dc}: W20 ${outcome.rolls.join('/')} ${bonus >= 0 ? '+' : ''}${bonus} ${rules.penalty} Erschöpfung = ${outcome.total} · ${outcome.success ? 'bestanden' : 'verloren'}.`);
  } catch (error) { notice(error.message); }
}

function renderD20Panel(profile, context, state, sheet) {
  const proficiency = sheet.proficiencyBonus;
  const labelModifier = number => `${number >= 0 ? '+' : ''}${number}`;
  const initiativeModifier = sheet.initiative;
  const choices = [
    { id: 'initiative', name: `Initiative (${labelModifier(initiativeModifier)})`,
      kind: 'initiative', ability: 'dex', modifier: initiativeModifier },
    ...sheet.savingThrows.map(entry => ({ id: `save-${entry.id}`, name: `Rettung ${entry.id.toUpperCase()} (${labelModifier(entry.modifier)})`,
      kind: 'save', ability: entry.id, modifier: entry.modifier })),
    ...sheet.skills.map(entry => ({ id: `skill-${entry.id}`, name: `${entry.name} (${labelModifier(entry.modifier)})`,
      kind: 'check', ability: entry.ability, skillId: entry.id, modifier: entry.modifier,
      minimumD20: entry.minimumD20 })),
    { id: 'unarmed', name: `Unbewaffneter Angriff (${labelModifier(abilityModifier(profile.attributes.str) + proficiency)})`,
      kind: 'attack', ability: 'str', modifier: abilityModifier(profile.attributes.str) + proficiency },
  ];
  if (profile.classId === 'monk' && !profile.armorId && !profile.shield) {
    choices.push({ id: 'monk-unarmed', name: `Mönch: Unbewaffnet mit GE (${labelModifier(abilityModifier(profile.attributes.dex) + proficiency)})`,
      kind: 'attack', ability: 'dex', modifier: abilityModifier(profile.attributes.dex) + proficiency });
  }
  for (const source of sheet.spellcasting) {
    const spellClass = characterData.classes.find(item => item.index === source.classId);
    choices.push({ id: `spell-${source.classId}`,
      name: `Zauberangriff · ${source.className} (${labelModifier(source.attackBonus)}, SG ${source.saveDC})`,
      kind: 'attack', ability: spellClass.spellcasting?.spellcasting_ability?.index || '',
      modifier: source.attackBonus, spellAttack: true });
  }
  const panel = document.createElement('details'); panel.className = 'vitals-details'; panel.id = 'tracker-d20';
  panel.append(node('summary', 'W20-Würfe · Rettungen, Fertigkeiten, Angriffe'));
  const controls = node('div', '', 'vitals-actions');
  const choiceSelect = document.createElement('select');
  choiceSelect.setAttribute('aria-label', 'W20-Probe');
  inputOptions(choiceSelect, choices.map(entry => ({ index: entry.id, name: entry.name })));
  const circumstance = document.createElement('select');
  circumstance.setAttribute('aria-label', 'Situativer Vorteil oder Nachteil');
  inputOptions(circumstance, [
    { index: 'normal', name: 'Normal' }, { index: 'advantage', name: 'Vorteil' },
    { index: 'disadvantage', name: 'Nachteil' },
  ]);
  const target = document.createElement('input');
  target.type = 'number'; target.min = '1'; target.max = '99'; target.placeholder = 'SG/RK';
  target.setAttribute('aria-label', 'Optionaler Schwierigkeitsgrad oder Ziel-RK');
  controls.append(choiceSelect, circumstance, target);
  const situational = node('div', '', 'vitals-conditions');
  const flags = {};
  for (const [id, text, applicable] of [
    ['fearSourceVisible', 'Furchtquelle sichtbar', state.conditions.includes('frightened')],
    ['targetsOtherThanGrappler', 'Angriff nicht gegen Greifer', state.conditions.includes('grappled')],
    ['unseenByTarget', 'Unsichtbar für Ziel', state.conditions.includes('invisible')],
    ['requiresSight', 'Sicht für Probe nötig', state.conditions.includes('blinded')],
  ]) {
    if (!applicable) continue;
    const label = document.createElement('label');
    const input = document.createElement('input'); input.type = 'checkbox';
    label.append(input, document.createTextNode(` ${text}`));
    situational.append(label);
    flags[id] = input;
  }
  const output = node('p', 'Wähle einen Wurf. Bei bedingten Zuständen entscheidet die Situation am Spieltisch.', 'form-hint');
  controls.append(button('W20 würfeln', () => {
    try {
      const selection = choices.find(item => item.id === choiceSelect.value);
      if (!selection) throw new Error('W20-Probe fehlt.');
      const dc = target.value === '' ? null : Number(target.value);
      const rule = getD20RuleEffects(state, { kind: selection.kind, ability: selection.ability,
        skillId: selection.skillId, spellAttack: selection.spellAttack, circumstance: circumstance.value,
        untrainedArmor: context.untrainedArmor, stealthDisadvantage: context.stealthDisadvantage,
        ...Object.fromEntries(Object.entries(flags).map(([key, input]) => [key, input.checked])) });
      const rolls = rule.automaticFailure ? [] : rollDice(rule.mode === 'normal' ? '1d20' : '2d20').rolls;
      const result = resolveD20Roll(rule, rolls, { modifier: selection.modifier,
        minimumD20: selection.minimumD20, dc });
      const detail = rule.advantages.length || rule.disadvantages.length
        ? ` · ${[...rule.advantages, ...rule.disadvantages].join(', ')}${rule.mode === 'normal' ? ' (heben sich auf)' : ''}` : '';
      const conclusion = result.automaticFailure ? 'Automatischer Fehlschlag' :
        `${result.rolls.join(' / ')} → ${result.kept} ${labelModifier(selection.modifier)} ${labelModifier(rule.penalty)} Erschöpfung = ${result.total}`;
      const verdict = result.critical ? ' · Kritischer Treffer' : result.automaticMiss ? ' · Automatisch verfehlt'
        : result.success === null ? '' : result.success ? ' · GELUNGEN' : ' · MISSERFOLG';
      output.textContent = `${selection.name}: ${conclusion}${verdict}${detail}`;
    } catch (error) { output.textContent = error.message; }
  }));
  panel.append(controls);
  if (situational.childElementCount) panel.append(situational);
  panel.append(output);
  panel.append(node('p', `Passive Wahrnehmung (bekannte Zustände): ${sheet.passivePerception}. Situative Sicht- und Hörumstände offen.`, 'form-hint'));
  panel.append(node('p', 'Vorteil und Nachteil heben sich auf. Natürliche 1/20 entscheiden nur bei Angriffswürfen automatisch. Weitere Talente, Ziele, Sichtverhältnisse und Inspiration bleiben manuell.', 'form-hint'));
  return panel;
}

function renderVitals(profile, sheet) {
  const box = $('#tracker-vitals');
  const wasTurnOpen = box.querySelector('details[data-turn]')?.open || false;
  const context = getVitalContext(profile);
  const state = normalizeVitals(context, profile.vitals);
  box.replaceChildren();
  box.append(node('h3', 'Trefferpunkte & Zustände'));
  const diceLabel = context.hitDice ? Object.entries(context.hitDice)
    .map(([die, count]) => `${count - (state.hitDiceSpentByDie?.[die] || 0)}/${count}W${die}`).join(', ')
    : `${context.level - state.hitDiceSpent} / ${context.level} (W${context.hitDie})`;
  box.append(node('p', `TP ${state.hp} / ${context.maxHp} · temporär ${state.tempHp} · Trefferwürfel ${diceLabel} · RK ${context.armorClass} · Tempo ${effectiveSpeed(context.speed, state)} ft.${state.dead ? ' · VERSTORBEN' : state.stable ? ' · Stabil' : state.hp === 0 ? ' · Bewusstlos' : ''}`, 'vitals-values'));
  const actions = node('div', '', 'vitals-actions');
  const amount = document.createElement('input');
  amount.type = 'number'; amount.min = '1'; amount.max = '9999'; amount.value = '1';
  amount.setAttribute('aria-label', 'Schaden, Heilung oder temporäre TP');
  actions.append(amount);
  for (const [label, action] of [['Schaden', 'damage'], ['Heilen', 'heal'], ['Temp. TP', 'temporaryHp']]) {
    const control = button(label, () => updateVitals(action, { amount: Number(amount.value) }));
    control.disabled = state.dead;
    actions.append(control);
  }
  box.append(actions);
  const typed = node('div', '', 'vitals-actions');
  const type = document.createElement('select'); type.setAttribute('aria-label', 'Schadensart');
  inputOptions(type, DAMAGE_TYPES.map(id => ({ index: id, name: id })));
  const immune = document.createElement('input'); immune.type = 'checkbox';
  const vulnerability = document.createElement('input'); vulnerability.type = 'checkbox';
  for (const [label, control] of [['Immun (SL)', immune], ['Verwundbar (SL)', vulnerability]]) {
    const wrap = node('label', label); wrap.prepend(control); typed.append(wrap);
  }
  typed.prepend(type);
  typed.append(button('Schaden nach Schadensart', () => updateTypedDamage({ amount: Number(amount.value),
    type: type.value, immune: immune.checked, vulnerable: vulnerability.checked })));
  box.append(typed, node('p', `Bekannte Herkunftsresistenzen: ${context.resistances.join(', ') || 'keine'}. Zusätzliche Immunität/Verwundbarkeit nur nach SL-Prüfung; Widerstand vor Verwundbarkeit.`, 'form-hint'));
  const turn = normalizeTurn(profile.combatTurn);
  const turnBox = document.createElement('details'); turnBox.className = 'vitals-details';
  turnBox.dataset.turn = 'true'; turnBox.open = wasTurnOpen;
  turnBox.append(node('summary', 'Aktionsmerker im Kampf'));
  const turnRow = node('div', '', 'vitals-actions');
  for (const [key, label] of [['action', 'Aktion'], ['bonus', 'Bonusaktion'],
    ['reaction', 'Reaktion'], ['nick', 'Nick einmal/Zug']]) {
    turnRow.append(button(`${turn[key] ? '✓' : '○'} ${label}`, () => updateCombatTurn(key, !turn[key])));
  }
  turnRow.append(button('Nächster Zug: zurücksetzen', () => updateCombatTurn('reset')));
  turnBox.append(turnRow, node('p', 'Merker zum manuellen Abhaken; Extra Attack, Action Surge, Zugwechsel und Reaktionsrückgewinnung bewertet die Spielleitung.', 'form-hint'));
  box.append(turnBox);
  const diceActions = node('div', '', 'action-row');
  const dieChoice = document.createElement('select');
  dieChoice.setAttribute('aria-label', 'Art des Trefferwürfels');
  inputOptions(dieChoice, context.hitDice ? Object.entries(context.hitDice).map(([die, count]) => ({
    index: die, name: `W${die} · ${count - (state.hitDiceSpentByDie?.[die] || 0)} verbleibend`,
  })) : [{ index: String(context.hitDie), name: `W${context.hitDie}` }]);
  diceActions.append(dieChoice);
  const hitDie = button('Trefferwürfel ausgeben', () => {
    const die = Number(dieChoice.value);
    updateVitals('hitDie', { die, roll: rollDice(`1d${die}`).total });
  });
  hitDie.disabled = state.dead || state.hp === 0 || state.hitDiceSpent >= context.level;
  diceActions.append(hitDie);
  if (state.hp === 0 && !state.dead) {
    const save = button('Todesrettungswurf W20', () => updateVitals('deathSave', { roll: rollDice('1d20').total }));
    save.disabled = state.stable;
    diceActions.append(save);
    const stabilize = button('Stabilisieren (SL)', () => updateVitals('stabilize'));
    stabilize.disabled = state.stable;
    diceActions.append(stabilize);
    box.append(node('p', `Todesrettungen · Erfolge ${state.deathSaves.successes}/3 · Fehlschläge ${state.deathSaves.failures}/3`, 'form-hint'));
  }
  box.append(diceActions);
  for (const warning of context.manualReview || []) box.append(node('p', `Mehrklassen-SL-Prüfung: ${warning}`, 'form-hint'));
  if (state.pendingConcentrationDCs.length) {
    const row = node('div', '', 'vitals-actions');
    const circumstance = document.createElement('select');
    circumstance.setAttribute('aria-label', 'Vorteil oder Nachteil auf Konzentrationsrettung');
    inputOptions(circumstance, [
      { index: 'normal', name: 'Normal' }, { index: 'advantage', name: 'Vorteil' },
      { index: 'disadvantage', name: 'Nachteil' },
    ]);
    row.append(node('strong', `${state.pendingConcentrationDCs.length} Konzentrationsrettung(en) offen · SG ${state.pendingConcentrationDCs[0]}`),
      circumstance, button('KON-Rettung würfeln', () => resolveConcentrationD20(circumstance.value)));
    box.append(row);
  }
  box.append(node('p', 'Trefferwürfel nur während einer abgeschlossenen kurzen Rast ausgeben. Erholung und Wurf erfolgen einzeln; die Spielleitung bestätigt besondere Effekte.', 'form-hint'));

  if (sheet) box.append(renderD20Panel(profile, context, state, sheet));
  else box.append(node('p', 'W20-Auswahl derzeit nicht verfügbar. TP und Zustände bleiben benutzbar.', 'form-hint'));

  const other = document.createElement('details'); other.className = 'vitals-details';
  other.append(node('summary', `Weitere Zustände · Erschöpfung ${state.exhaustion}/6`));
  const more = node('div', '', 'action-row');
  for (const [label, change] of [['Erschöpfung −1', -1], ['Erschöpfung +1', 1]]) {
    const control = button(label, () => updateVitals('exhaustion', { change }));
    control.disabled = state.dead || change < 0 && !state.exhaustion;
    more.append(control);
  }
  const concentration = button(state.concentrating ? 'Konzentration beenden' : 'Konzentration beginnen',
    () => updateVitals('concentration', { active: !state.concentrating }));
  concentration.disabled = state.dead || state.hp === 0;
  more.append(concentration);
  more.append(button(state.heroicInspiration ? 'Inspiration verbrauchen' : 'Inspiration vergeben',
    () => updateVitals('inspiration', { active: !state.heroicInspiration })));
  other.append(more);
  other.append(node('p', `2024-Erschöpfung: W20-Tests −${state.exhaustion * 2}; Tempo −${state.exhaustion * 5} ft. · Konzentration ${state.concentrating ? 'aktiv' : 'inaktiv'} · Heroische Inspiration ${state.heroicInspiration ? 'vorhanden' : 'keine'}`, 'form-hint'));
  const condRow = node('div', '', 'vitals-conditions');
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'D&D-Zustand wählen');
  inputOptions(select, CONDITIONS.map(id => ({ index: id, name: id[0].toUpperCase() + id.slice(1) })));
  condRow.append(select, button('Zustand umschalten', () => updateVitals('condition', { id: select.value })));
  other.append(condRow);
  other.append(node('p', `Aktiv: ${state.conditions.join(', ') || 'keine'}. Bedingungen und ihre Effekte werden bis zur vollständigen Kampflogik manuell beurteilt.`, 'form-hint'));
  box.append(other);
}

function castFromSheet(spellId, modeId) {
  try {
    const game = readGame();
    const character = game.characters.find(entry => entry.id === $('#tracker-character').value);
    if (!character?.profile || character.profile.ruleset !== RULESET.id) throw new Error('Charakter nicht gefunden.');
    const profile = { ...character.profile, level: character.level };
    const spellReference = characterData.spells.find(entry => entry.index === spellId);
    if (!spellReference) throw new Error('Zauber nicht im offiziellen Katalog gefunden.');
    const confirmations = [];
    if (spellReference.casting_time?.startsWith('Reaction')) confirmations.push('Reaktionsauslöser und freie Reaktion bestätigt');
    if (spellReference.components?.includes('M')) confirmations.push(`Materialkomponente vorhanden${spellReference.material ? `: ${spellReference.material}` : ''}`);
    if (confirmations.length && !confirm(`Vor dem Wirken prüfen:\n${confirmations.join('\n')}\n\nJetzt die Ressource verbrauchen?`)) return;
    const result = castSelectedSpell({ profile, summary: getTrackerSummary(profile),
      spellCatalog: characterData.spells, classCatalog: characterData.classes, levelRows: characterData.levels,
      excludedIds: profile.edras ? EDRAS_FORBIDDEN_SPELLS : [],
      originSpells: resolveCharacterOrigin(profile).originSpells,
      vitalContext: getVitalContext(profile), spellId, modeId });
    character.profile.tracker = result.tracker;
    character.profile.vitals = result.vitals;
    saveGame(game);
    renderTracker();
    notice(`${result.spell.name} gewirkt (${result.mode.label}).${result.spell.concentration ? ' Konzentration aktiv.' : ''} Ziel und Wirkung am Spieltisch bestimmen.`);
  } catch (error) { notice(error.message); }
}

function renderCasting(profile, summary) {
  const box = $('#tracker-casting');
  box.replaceChildren();
  const spells = getCastableSpells({ profile, summary, spellCatalog: characterData.spells,
    classCatalog: characterData.classes, levelRows: characterData.levels,
    excludedIds: profile.edras ? EDRAS_FORBIDDEN_SPELLS : [],
    originSpells: resolveCharacterOrigin(profile).originSpells });
  box.hidden = !spells.length;
  if (!spells.length) return;
  box.append(node('h3', 'Zauber im Spiel wirken'));
  const row = node('div', '', 'vitals-actions');
  const spellSelect = document.createElement('select');
  spellSelect.setAttribute('aria-label', 'Zauber zum Wirken');
  inputOptions(spellSelect, spells.map(item => ({ index: item.id, name: `${item.name} · ${item.level ? `Grad ${item.level}` : 'Zaubertrick'}` })));
  const modeSelect = document.createElement('select');
  modeSelect.setAttribute('aria-label', 'Zauberplatz oder kostenlose Wirkart');
  const cast = button('Zauber wirken', () => castFromSheet(spellSelect.value, modeSelect.value));
  const rollDamage = button('Schadenswürfel', () => {
    try {
      const spell = characterData.spells.find(entry => entry.index === spellSelect.value);
      const reference = getSpellDamageReference({ spell, modeId: modeSelect.value, characterLevel: profile.level });
      if (!reference.formula) throw new Error('Für diese Wirkart ist kein eindeutiger Schadenswurf im SRD strukturiert. Manuell würfeln.');
      const result = rollDice(reference.formula);
      notice(`${spell.name}: ${result.rolls.join(' + ')} = ${result.total} ${reference.type}. Treffer, Rettungswurf, Bonus und Zielwirkung separat prüfen.`);
    } catch (error) { notice(error.message); }
  });
  const hint = node('p', '', 'form-hint');
  const rules = node('details', '', 'vitals-details');
  rules.append(node('summary', 'Regelhinweise und Komponenten'));
  const rulesText = node('p', '', 'form-hint'); rules.append(rulesText);
  function updateCastHint() {
    const chosen = spells.find(item => item.id === spellSelect.value);
    const available = chosen?.modes.some(entry => entry.id === modeSelect.value && entry.available);
    cast.disabled = !available;
    const damage = getSpellDamageReference({ spell: characterData.spells.find(entry => entry.index === chosen.id),
      modeId: modeSelect.value, characterLevel: profile.level });
    rollDamage.disabled = !available || !damage.formula;
    hint.textContent = `${chosen.castingTime} · ${chosen.components.join('/')} · ${chosen.duration}${chosen.concentration ? ' · Konzentration' : ''}${chosen.ritual ? ' · Ritual möglich' : ''}.${damage.formula ? ` SRD-Schaden: ${damage.formula} ${damage.type}.` : ' Wirkung/Skalierung manuell.'}`;
    rulesText.textContent = `${chosen.material ? `Material: ${chosen.material}. ` : ''}${chosen.higherLevel ? `Höhergradig: ${chosen.higherLevel} ` : ''}Reaktionsauslöser, Wirkzeit, verfügbare Komponenten, ein verbrauchter Zauberplatz pro Zug und Ziele bestätigt die Spielleitung. Schadenswürfel enthalten keine situationsabhängigen Boni oder Zielfolgen.`;
  }
  function syncMode() {
    const chosen = spells.find(item => item.id === spellSelect.value);
    modeSelect.replaceChildren();
    for (const entry of chosen?.modes || []) {
      const option = node('option', `${entry.label}${entry.available ? '' : ' · verbraucht'}`);
      option.value = entry.id;
      option.disabled = !entry.available;
      modeSelect.append(option);
    }
    const ready = chosen?.modes.find(entry => entry.available);
    modeSelect.value = ready?.id || '';
    updateCastHint();
  }
  spellSelect.addEventListener('change', syncMode);
  modeSelect.addEventListener('change', updateCastHint);
  syncMode();
  row.append(spellSelect, modeSelect, cast, rollDamage);
  box.append(row, hint, rules);
}

function updateInventory(kind, id, delta) {
  try {
    const game = readGame();
    const character = game.characters.find(entry => entry.id === $('#tracker-character').value);
    if (!character?.profile || character.profile.ruleset !== RULESET.id) throw new Error('Charakter nicht gefunden.');
    character.profile.inventory = kind === 'coins'
      ? changeCoins(characterData.equipment, character.profile.inventory, id, delta)
      : changeInventory(characterData.equipment, character.profile.inventory, id, delta);
    saveGame(game);
    renderTracker();
  } catch (error) { notice(error.message); }
}

function updateMagicItem(operation) {
  try {
    const game = readGame();
    const character = game.characters.find(entry => entry.id === $('#tracker-character').value);
    if (!character?.profile || character.profile.ruleset !== RULESET.id) throw new Error('Charakter nicht gefunden.');
    character.profile.magicItems = changeMagicItems(characterData.magicItems, character.profile.magicItems, operation);
    saveGame(game);
    renderTracker();
  } catch (error) { notice(error.message); }
}

function renderMagicItems(profile, parent, wasOpen, selectedId, expandedIds) {
  const catalog = characterData.magicItems;
  const items = normalizeMagicItems(catalog, profile.magicItems);
  const sources = new Map(catalog.map(entry => [entry.index, entry]));
  const details = document.createElement('details'); details.className = 'vitals-details';
  details.dataset.magic = 'true'; details.open = wasOpen;
  details.append(node('summary', `Magische Gegenstände · ${items.length} · ${items.filter(entry => entry.attuned).length}/3 eingestimmt`));
  const addRow = node('div', '', 'vitals-actions');
  const select = document.createElement('select'); select.id = 'tracker-add-magic';
  select.setAttribute('aria-label', 'Magischen SRD-Gegenstand auswählen');
  inputOptions(select, [...catalog].sort((a, b) => a.name.localeCompare(b.name)));
  if (sources.has(selectedId)) select.value = selectedId;
  addRow.append(select, button('Magischen Gegenstand aufnehmen', () => updateMagicItem({ type: 'add', catalogId: select.value })));
  details.append(addRow);
  if (!items.length) details.append(node('p', 'Noch keine magischen Gegenstände im Besitz.', 'form-hint'));
  for (const item of items) {
    const source = sources.get(item.catalogId);
    const entry = document.createElement('details'); entry.className = 'vitals-details';
    entry.dataset.magicId = item.instanceId;
    entry.open = expandedIds.includes(item.instanceId);
    entry.append(node('summary', `${source.name} · ${source.rarity?.name || 'SRD'}${item.attuned ? ' · eingestimmt' : ''}${item.maxCharges === null ? '' : ` · ${item.charges}/${item.maxCharges} Ladungen`}`));
    if (source.attunement) {
      entry.append(button(item.attuned ? 'Einstimmung lösen' : 'Einstimmen', () => {
        if (!item.attuned && !confirm('Kurze Rast, Voraussetzungen und ggf. Fluchregeln mit der SL geklärt? Einstimmung jetzt eintragen?')) return;
        updateMagicItem({ type: 'attune', instanceId: item.instanceId, active: !item.attuned });
      }));
    }
    const chargesRow = node('div', '', 'vitals-actions');
    const maximum = document.createElement('input'); maximum.type = 'number'; maximum.min = '0';
    maximum.max = '999'; maximum.value = String(item.maxCharges || 0);
    maximum.setAttribute('aria-label', `Manuelle maximale Ladungen: ${source.name}`);
    chargesRow.append(maximum, button('Ladungsmaximum setzen', () => updateMagicItem({ type: 'capacity',
      instanceId: item.instanceId, max: Number(maximum.value) })));
    if (item.maxCharges !== null) {
      const use = button('−1 Ladung', () => updateMagicItem({ type: 'charge', instanceId: item.instanceId, delta: -1 }));
      use.disabled = item.charges <= 0;
      const restore = button('+1 Ladung', () => updateMagicItem({ type: 'charge', instanceId: item.instanceId, delta: 1 }));
      restore.disabled = item.charges >= item.maxCharges;
      chargesRow.append(use, restore);
    }
    entry.append(chargesRow);
    entry.append(node('p', `Ladungen: Maximalzahl aus der Gegenstandsbeschreibung durch SL übernehmen; Wiederherstellung und mögliche Zerstörung nicht automatisch.`, 'form-hint'));
    if (source['limited-to']) entry.append(node('p', `Einstimmungsbedingung: ${source['limited-to']} (SL prüfen).`, 'form-hint'));
    entry.append(node('p', Array.isArray(source.desc) ? source.desc.join('\n') : 'Keine SRD-Beschreibung.', 'form-hint'));
    entry.append(button('Entfernen', () => {
      if (confirm(`„${source.name}“ wirklich aus dem Besitz entfernen?`)) {
        updateMagicItem({ type: 'remove', instanceId: item.instanceId });
      }
    }));
    details.append(entry);
  }
  details.append(node('p', 'Besitz und Einstimmung sind getrennt von angelegter Rüstung/Waffe. Boni, Wirkung, Tragen, Gewicht und spezielle Voraussetzungen bleiben ausdrücklich SL-Prüfungen.', 'form-hint'));
  parent.append(details);
}

function rollWeaponFromSheet(weaponId, options, damage = false, critical = false, targetAc = null) {
  try {
    const game = readGame();
    const character = game.characters.find(entry => entry.id === $('#tracker-character').value);
    if (!character?.profile || character.profile.ruleset !== RULESET.id) throw new Error('Charakter nicht gefunden.');
    const profile = { ...character.profile, level: character.level };
    const klass = characterData.classes.find(entry => entry.index === profile.classId);
    const weapon = getWeaponProfile({ profile, classEntry: klass, equipment: characterData.equipment,
      weaponId, thrown: options.mode === 'thrown', twoHanded: options.mode === 'versatile',
      ability: options.ability, additionalProficiencies: getProfileDecisions(profile).proficiencies });
    let message;
    if (damage) {
      const result = rollWeaponDamage(weapon, { critical });
      message = weapon.damageDice === '1' ? `${weapon.name}: 1 ${weapon.damageType} (fester Schaden).`
        : `${weapon.name}${critical ? ' · KRITISCH' : ''}: ${result.rolls.join(' + ')} ${weapon.damageBonus >= 0 ? '+' : ''}${weapon.damageBonus} = ${result.total} ${weapon.damageType}.`;
    } else {
      const target = targetAc === null ? null : resolveTargetAc(targetAc, options.cover || 'none');
      if (target?.blocked || options.cover === 'total') {
        $('#tracker-weapon-output').textContent = 'Vollständige Deckung: Das Ziel kann nicht direkt angegriffen werden; keine Munition verbraucht.';
        return;
      }
      const context = getVitalContext(profile);
      const state = normalizeVitals(context, profile.vitals);
      const rules = getD20RuleEffects(state, { kind: 'attack', ability: weapon.ability,
        circumstance: options.circumstance, heavyWeaponDisadvantage: weapon.heavyDisadvantage,
        longRange: options.longRange, untrainedArmor: context.untrainedArmor });
      const result = resolveD20Roll(rules, rollDice(rules.mode === 'normal' ? '1d20' : '2d20').rolls,
        { modifier: weapon.attackBonus, dc: target?.ac ?? null });
      const mastery = getWeaponMasteryEffect(weapon, { hit: target ? result.success : null,
        proficiencyBonus: basicDndCharacter({ level: profile.level, hitDie: klass.hit_die,
          attributes: profile.attributes }).proficiencyBonus });
      const nextInventory = consumeWeaponAmmo(characterData.equipment, profile.inventory, weapon);
      character.profile.inventory = nextInventory;
      saveGame(game);
      message = `${weapon.name} (${weapon.ability.toUpperCase()}${weapon.trained ? ', geübt' : ', ungeübt'}): W20 ${result.rolls.join('/')} ${weapon.attackBonus >= 0 ? '+' : ''}${weapon.attackBonus} ${rules.penalty} = ${result.total}`
        + (target === null ? '' : result.success ? ` · TREFFER gegen RK ${target.ac}` : ` · VERFEHLT gegen RK ${target.ac}`)
        + (result.critical ? ' · Kritisch' : '')
        + (rules.disadvantages.length ? ` · Nachteil: ${rules.disadvantages.join(', ')}` : '')
        + (weapon.consumeId ? ` · 1 ${weapon.consumeId} verbraucht` : '')
        + (mastery ? ` · ${mastery.note}${mastery.damage ? ` ${mastery.damage} ${weapon.damageType} Schaden bei Fehlschlag (Ziel durch SL).` : ''}${mastery.saveDc ? ` SG ${mastery.saveDc}.` : ''}` : '')
        + (options.cover && options.cover !== 'none' && target === null ? ' · Deckung bei Ziel-RK manuell einrechnen' : '') + '.';
      renderTracker();
    }
    $('#tracker-weapon-output').textContent = message;
  } catch (error) { notice(error.message); }
}

function renderInventory(profile) {
  const box = $('#tracker-inventory');
  const previousItem = $('#tracker-add-item')?.value;
  const previousWeapon = $('#tracker-weapon')?.value;
  const previousMagic = $('#tracker-add-magic')?.value;
  const magicOpen = box.querySelector('details[data-magic]')?.open || false;
  const expandedMagic = [...box.querySelectorAll('details[data-magic-id]')]
    .filter(detail => detail.open).map(detail => detail.dataset.magicId);
  const expanded = box.querySelector('details[data-gear]')?.open || false;
  const content = document.createElement('details'); content.dataset.gear = 'true';
  content.className = 'vitals-details'; content.open = expanded;
  content.append(node('summary', 'Ausrüstung, Münzen & Waffen'));
  box.replaceChildren(content);
  const equipment = characterData.equipment;
  const inventory = normalizeInventory(equipment, profile.inventory);
  const load = inventoryLoad(equipment, inventory, profile.attributes.str);
  const entries = Object.entries(inventory.items);
  content.append(node('p', `Getragen: ${load.weight} / ${load.capacity} lb.${load.overCapacity ? ' · TRAGLAST ÜBERSCHRITTEN' : ''}${load.unspecified.length ? ' · Einige Gegenstandsgewichte unbekannt' : ''}`, 'vitals-values'));
  const addRow = node('div', '', 'vitals-actions');
  const item = document.createElement('select'); item.id = 'tracker-add-item';
  item.setAttribute('aria-label', 'SRD-Gegenstand ins Inventar übernehmen');
  inputOptions(item, [...equipment].sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => ({ index: entry.index, name: `${entry.name}${entry.quantity ? ` (${entry.quantity} Stück/Paket)` : ''}` })));
  if (equipment.some(entry => entry.index === previousItem)) item.value = previousItem;
  const packs = document.createElement('input'); packs.type = 'number'; packs.min = '1'; packs.max = '100'; packs.value = '1';
  packs.setAttribute('aria-label', 'Anzahl Gegenstände oder Pakete hinzufügen');
  addRow.append(item, packs, button('Hinzufügen', () => {
    const selected = equipment.find(entry => entry.index === item.value);
    const count = Number(packs.value);
    if (!selected || !Number.isSafeInteger(count) || count < 1 || count > 100) { notice('Menge muss zwischen 1 und 100 liegen.'); return; }
    updateInventory('items', item.value, count * (selected.quantity || 1));
  }));
  content.append(addRow);
  const details = document.createElement('details'); details.className = 'vitals-details';
  details.append(node('summary', `Inventar · ${entries.reduce((sum, [, count]) => sum + count, 0)} Stück`));
  const list = node('div', '', 'tracker-list');
  for (const [id, amount] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    const object = equipment.find(entry => entry.index === id);
    const row = node('div', '', 'tracker-row');
    row.append(node('span', `${object.name} · ${amount} Stk.`));
    row.append(button('−', () => updateInventory('items', id, -1)), button('+', () => updateInventory('items', id, 1)));
    list.append(row);
  }
  if (!entries.length) list.append(node('p', 'Noch keine Gegenstände eingetragen.', 'form-hint'));
  details.append(list);
  content.append(details);

  const coins = node('div', '', 'vitals-actions');
  const coinType = document.createElement('select'); coinType.setAttribute('aria-label', 'Münzart');
  inputOptions(coinType, COINS.map(id => ({ index: id, name: id.toUpperCase() })));
  const coinAmount = document.createElement('input'); coinAmount.type = 'number'; coinAmount.min = '1';
  coinAmount.max = '1000000'; coinAmount.value = '1'; coinAmount.setAttribute('aria-label', 'Münzmenge');
  for (const [label, sign] of [['+', 1], ['−', -1]]) coins.append(button(`${label} Münzen`, () => {
    const amount = Number(coinAmount.value);
    updateInventory('coins', coinType.value, sign * amount);
  }));
  coins.prepend(coinType, coinAmount);
  content.append(node('p', COINS.map(id => `${id.toUpperCase()} ${inventory.coins[id]}`).join(' · '), 'form-hint'), coins);
  renderMagicItems(profile, content, magicOpen, previousMagic, expandedMagic);

  const weapons = equipment.filter(entry => entries.some(([id]) => id === entry.index)
    && entry.equipment_categories?.some(cat => cat.index === 'weapons'));
  if (!weapons.length) {
    content.append(node('p', 'Für einen Waffenwurf zuerst eine Waffe ins Inventar aufnehmen. Rüstung und Schild werden weiterhin im Charakterlabor angelegt.', 'form-hint'));
    return;
  }
  const weaponRow = node('div', '', 'vitals-actions');
  const weaponSelect = document.createElement('select'); weaponSelect.id = 'tracker-weapon';
  weaponSelect.setAttribute('aria-label', 'Waffe für Angriff und Schaden');
  inputOptions(weaponSelect, weapons.map(entry => ({ index: entry.index, name: entry.name })));
  if (weapons.some(entry => entry.index === previousWeapon)) weaponSelect.value = previousWeapon;
  const modeSelect = document.createElement('select'); modeSelect.setAttribute('aria-label', 'Waffenverwendung');
  const statSelect = document.createElement('select'); statSelect.setAttribute('aria-label', 'Angriffsattribut');
  inputOptions(statSelect, [{ index: 'auto', name: 'Bestes Attribut' },
    { index: 'str', name: 'Stärke' }, { index: 'dex', name: 'Geschicklichkeit' }]);
  weaponRow.append(weaponSelect, modeSelect, statSelect);
  content.append(weaponRow);
  const attackRow = node('div', '', 'vitals-actions');
  const circumstance = document.createElement('select'); circumstance.setAttribute('aria-label', 'Vorteil oder Nachteil');
  inputOptions(circumstance, [{ index: 'normal', name: 'Normal' },
    { index: 'advantage', name: 'Vorteil' }, { index: 'disadvantage', name: 'Nachteil' }]);
  const distance = document.createElement('select'); distance.setAttribute('aria-label', 'Waffenreichweite');
  const armorClass = document.createElement('input'); armorClass.type = 'number'; armorClass.min = '1';
  armorClass.max = '99'; armorClass.placeholder = 'Ziel-RK (optional)'; armorClass.setAttribute('aria-label', 'Ziel-Rüstungsklasse');
  const cover = document.createElement('select'); cover.setAttribute('aria-label', 'Deckung des Ziels');
  inputOptions(cover, [{ index: 'none', name: 'Keine Deckung' }, { index: 'half', name: 'Halbe Deckung (+2 RK)' },
    { index: 'three-quarters', name: 'Dreivierteldeckung (+5 RK)' }, { index: 'total', name: 'Vollständige Deckung' }]);
  const critical = document.createElement('input'); critical.type = 'checkbox';
  critical.setAttribute('aria-label', 'Kritischer Schaden');
  const attack = button('Angriff W20', () => {
    const dc = armorClass.value === '' ? null : Number(armorClass.value);
    rollWeaponFromSheet(weaponSelect.value, { mode: modeSelect.value, ability: statSelect.value,
      circumstance: circumstance.value, longRange: distance.value === 'long', cover: cover.value }, false, false, dc);
  });
  const damage = button('Schaden würfeln', () => rollWeaponFromSheet(weaponSelect.value,
    { mode: modeSelect.value, ability: statSelect.value }, true, critical.checked));
  attackRow.append(circumstance, distance, armorClass, cover, attack, critical, node('span', 'Kritisch'), damage);
  content.append(attackRow);
  const hint = node('p', '', 'form-hint');
  content.append(hint, node('p', '', 'result'));
  content.lastElementChild.id = 'tracker-weapon-output';
  function syncWeapon() {
    const entry = weapons.find(item => item.index === weaponSelect.value);
    const properties = new Set(entry.properties?.map(prop => prop.index));
    inputOptions(modeSelect, [{ index: 'normal', name: 'Normal' },
      ...(properties.has('thrown') && !entry.equipment_categories?.some(cat => cat.index === 'ranged-weapons')
        ? [{ index: 'thrown', name: 'Werfen' }] : []),
      ...(properties.has('versatile') ? [{ index: 'versatile', name: 'Zweihändig' }] : [])]);
    syncDetails();
  }
  function syncDetails() {
    try {
      const klass = characterData.classes.find(entry => entry.index === profile.classId);
      const current = getWeaponProfile({ profile, classEntry: klass, equipment, weaponId: weaponSelect.value,
        thrown: modeSelect.value === 'thrown', twoHanded: modeSelect.value === 'versatile',
        ability: statSelect.value, additionalProficiencies: getProfileDecisions(profile).proficiencies });
      inputOptions(distance, [{ index: 'normal', name: 'Normale Reichweite' },
        ...(current.range?.long ? [{ index: 'long', name: 'Lange Reichweite (Nachteil)' }] : [])]);
      const ammo = current.consumeId ? inventory.items[current.consumeId] || 0 : null;
      attack.disabled = ammo === 0;
      damage.disabled = false;
      hint.textContent = `Angriff ${current.attackBonus >= 0 ? '+' : ''}${current.attackBonus}, Schaden ${current.damageDice} ${current.damageBonus >= 0 ? '+' : ''}${current.damageBonus} ${current.damageType}; ${current.trained ? 'geübt' : 'ungeübt'}${current.mastery ? ` · Meisterschaft ${current.mastery}` : ''}${ammo !== null ? ` · ${current.consumeId}: ${ammo}` : ''}. Angriffsreichweite, zusätzliche Angriffe und Handbelegung bestätigt die Spielleitung.`;
    } catch (error) { hint.textContent = error.message; attack.disabled = true; damage.disabled = true; }
  }
  weaponSelect.addEventListener('change', syncWeapon);
  modeSelect.addEventListener('change', syncDetails);
  statSelect.addEventListener('change', syncDetails);
  syncWeapon();
}

function renderTracker() {
  const character = readGame().characters.find(entry => entry.id === $('#tracker-character').value);
  const profile = character?.profile ? { ...character.profile, level: character.level } : null;
  const panel = $('#tracker-panel');
  panel.hidden = !profile;
  if (!profile) { $('#tracker-help').textContent = 'Speichere oben einen Charakterentwurf, um seine Ressourcen zu verwalten.'; return; }
  try {
    const summary = getTrackerSummary(profile);
    const state = normalizeResourceTracker(summary, profile.tracker);
    let sheet = null;
    try {
      sheet = buildCharacterSheet(character, characterData);
      renderCharacterSheet($('#tracker-sheet'), sheet);
    } catch (error) {
      $('#tracker-sheet').replaceChildren(node('p', `Spielbogenwerte prüfen: ${error.message}. Ressourcen können weiterhin benutzt werden.`, 'form-hint'));
    }
    renderVitals(profile, sheet);
    try { renderCasting(profile, summary); }
    catch (error) {
      $('#tracker-casting').hidden = false;
      $('#tracker-casting').replaceChildren(node('p', `Zauberauswahl prüfen: ${error.message}. Trefferpunkte und übrige Ressourcen bleiben nutzbar.`, 'form-hint'));
    }
    $('#sheet-jump-casting').hidden = $('#tracker-casting').hidden;
    renderInventory(profile);
    const entries = [
      ...(summary.spellcasting?.slots || []).map(slot => ({ kind: 'slots', id: String(slot.level), name: `${summary.spellcasting.pactMagic ? 'Paktplatz' : 'Zauberplatz'} · Grad ${slot.level}`, max: slot.max })),
      ...summary.resources.map(resource => {
        const sig = /^signature_(\d)$/.exec(resource.id);
        const arc = /^arcanum_(\d)$/.exec(resource.id);
        const spellId = sig ? profile.spells?.signature?.[Number(sig[1]) - 1]
          : arc ? profile.spells?.arcanum?.[Number(arc[1]) - 6] : null;
        const spellName = characterData.spells.find(spell => spell.index === spellId)?.name;
        return { kind: 'resources', ...resource, name: spellName ? `${resource.name} · ${spellName}` : resource.name };
      }),
    ];
    const list = $('#tracker-list'); list.replaceChildren();
    for (const entry of entries) {
      const remaining = state[entry.kind][entry.id];
      const row = node('div', '', 'tracker-row');
      row.append(node('span', entry.name));
      row.append(node('strong', `${remaining} / ${entry.max}`));
      for (const [label, amount] of [['−', -1], ['+', 1]]) {
        const control = button(label, () => updateTracker((limits, saved) => changeResourceTracker(limits, saved, entry.kind, entry.id, amount)));
        control.disabled = amount < 0 ? remaining === 0 : remaining === entry.max;
        control.setAttribute('aria-label', `${entry.name}: ${amount < 0 ? 'eine Nutzung verbrauchen' : 'eine Nutzung wiederherstellen'}`);
        row.append(control);
      }
      list.append(row);
    }
    if (!entries.length) list.append(node('p', 'Für diese Klassenstufe gibt es keine automatisch erfassten Ressourcen.', 'placeholder'));
    $('#tracker-rest').hidden = false;
    renderEdrasTracker(profile, character.level);
    $('#tracker-help').textContent = 'Nur lokal gespeichert. D&D-5.5e-Ressourcen und zusätzliche Weltressourcen bleiben getrennt. Bei Edras senkt nur eine versorgte, sichere lange Rast die Belastung (Bestätigung beim Rasten).';
  } catch (error) {
    panel.hidden = true;
    $('#tracker-help').textContent = error.message;
  }
}

$('#tracker-short-rest').addEventListener('click', () => {
  updateTracker((summary, saved) => restResourceTracker(summary, saved, 'short'), 'short');
});
$('#tracker-long-rest').addEventListener('click', () => {
  const character = readGame().characters.find(entry => entry.id === $('#tracker-character').value);
  const recovery = character?.profile?.edras && confirm('Edras: War die Rast sicher und gab es Nahrung und Wasser? Nur dann sinkt die Belastung um 1.') ? 'safe' : 'none';
  updateTracker((summary, saved) => restResourceTracker(summary, saved, 'long'), 'long', recovery);
});

$('#character-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    clearCharacterIssues();
    const name = $('#character-name').value.trim();
    if (!name) throw characterFormError('Bitte einen Namen angeben.', '#character-name');
    const values = readCharacterForm();
    const chosen = characterData.classes.find(entry => entry.index === values.classId);
    const kind = characterData.species.find(entry => entry.index === values.speciesId);
    if (!chosen) throw characterFormError('Bitte eine gültige Klasse wählen.', '#character-class');
    if (!kind) throw characterFormError('Bitte eine gültige Spezies wählen.', '#character-species');
    const saved = readGame();
    const previous = editingCharacterId ? saved.characters.find(entry => entry.id === editingCharacterId) : null;
    if (editingCharacterId && previous?.profile?.ruleset !== RULESET.id) throw new Error('Die ursprüngliche Figur ist nicht mehr vorhanden oder hat andere Regeln.');
    const id = editingCharacterId || globalThis.crypto?.randomUUID?.() || `char-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const summary = getClassLevelSummary(characterData.levels, chosen, values.classLevel, values.attributes, values.level);
    const issues = [];
    const multi = values.levelHistory ? checkCharacterSection('#character-multiclass', () => {
      const result = summarizeMulticlass({ classId: values.classId, level: values.level,
        history: values.levelHistory, classes: characterData.classes, rows: characterData.levels,
        attributes: values.attributes, hitPoints: values.hitPoints, entryAttributes: entryAttributesFor(values) });
      const source = characterData.backgrounds.find(entry => entry.index === values.backgroundId);
      validateMulticlassChoices(result, values.multiclassProficiencyIds,
        [...(source?.proficiencies || []).map(item => item.index),
          ...resolveCharacterOrigin(values).skillIds.map(id => `skill-${id}`)]);
      return result;
    }) : null;
    const hp = checkCharacterSection('#character-hitpoints', () => multi?.hp || calculateHitPoints({
      level: values.level, hitDie: chosen.hit_die, attributes: values.attributes, hitPoints: values.hitPoints,
    }));
    if (hp.missing.length) issues.push({ message: `Trefferpunkte: Würfe für Stufe ${hp.missing.join(', ')} fehlen oder sind ungültig.`, target: '#character-hitpoints' });
    const heritage = resolveCharacterOrigin(values);
    if (heritage.missing) issues.push({ message: `2024-Herkunft: Noch ${heritage.missing} Wahlen offen.`, target: '#character-heritage' });
    const magic = checkCharacterSection('#character-origin-feats', () => validateMagicInitiate({
      profile: values, spells: characterData.spells }));
    if (magic.missing) issues.push({ message: `Magic Initiate: Noch ${magic.missing} Zauberentscheidung(en) offen.`, target: '#character-origin-feats' });
    const originalProf = characterData.backgrounds.find(entry => entry.index === values.backgroundId)?.proficiencies || [];
    const skilled = checkCharacterSection('#character-origin-feats', () => validateAdditionalSkilled({
      profile: values, skills: characterData.skills, proficiencies: characterData.proficiencies,
      baseSkills: [...values.classSkillIds, ...values.bonusSkillIds, ...heritage.skillIds,
        ...originalProf.filter(entry => entry.index.startsWith('skill-')).map(entry => entry.index.slice(6))],
      baseTools: [...heritage.toolIds,
        ...originalProf.filter(entry => !entry.index.startsWith('skill-')).map(entry => entry.index)],
    }));
    if (skilled.missing) issues.push({ message: `Skilled: Noch ${skilled.missing} zusätzliche Übungen offen.`, target: '#character-origin-feats' });
    const classLevels = multi?.classLevels || { [values.classId]: values.level };
    const subclasses = { [values.classId]: values.subclassId, ...values.secondarySubclasses };
    for (const [id, count] of Object.entries(classLevels)) {
      if (count >= 3 && !subclasses[id]) issues.push({
        message: `Die Unterklasse für ${characterData.classes.find(entry => entry.index === id)?.name || id} fehlt.`,
        target: id === values.classId ? '#character-subclass-wrap' : '#character-secondary-subclasses',
      });
    }
    const decisions = checkCharacterSection('#character-source-decisions', () => validateClassDecisions({
      classLevels, subclasses, levels: characterData.levels, languages: characterData.languages,
      spells: characterData.spells, monsters: beastCatalog, choices: values.classFeatures.decisions || {},
      knownLanguages: heritage.languages, knownCantrips: values.spells.cantrips,
    }));
    if (decisions.missing) issues.push({ message: `${decisions.missing} Wahl(en) zu Klassenmerkmalen fehlen.`,
      target: '#character-source-decisions' });
    const effects = getClassDecisionEffects({ choices: decisions.choices, classLevels,
      subclasses, levels: characterData.levels });
    const classFeatures = checkCharacterSection('#character-class-options', () => checkClassFeatureChoices(values));
    if (classFeatures.styles.missing || classFeatures.styles.missingCantrips
      || classFeatures.metamagic.missing || classFeatures.invocations.missing) {
      issues.push({ message: `Klassenwahlen: ${classFeatures.styles.missing} Kampfstile, ${classFeatures.styles.missingCantrips} Zusatztricks, ${classFeatures.metamagic.missing} Metamagie, ${classFeatures.invocations.missing} Anrufungen offen.`, target: '#character-class-options' });
    }
    const { spellCheck, discoveries, mastery, arcanum, signature } = checkCharacterSection('#character-spells', () => checkCharacterSpells(values, summary));
    if (spellCheck.missingCantrips || spellCheck.missingPrepared || spellCheck.missingSpellbook
      || discoveries.missing || mastery.missing || arcanum.missing || signature.missing) {
      issues.push({ message: `Zauberwahl: ${spellCheck.missingCantrips} Zaubertricks, ${spellCheck.missingPrepared} vorbereitete Zauber, ${spellCheck.missingSpellbook} Buchzauber, ${discoveries.missing} Magical Discoveries, ${mastery.missing} Spell Mastery, ${arcanum.missing} Arkana, ${signature.missing} Signaturzauber offen.`, target: '#character-spells' });
    }
    const secondaryMagic = checkCharacterSection('#character-secondary-spells', () => checkSecondaryCharacterSpells(values));
    for (const entry of secondaryMagic) if (entry.missing) issues.push({
      message: `Zauberwahl für ${characterData.classes.find(item => item.index === entry.classId)?.name || entry.classId}: ${entry.missing} Wahl(en) offen.`,
      target: '#character-secondary-spells',
    });
    const training = checkCharacterSection('#character-skill-choices', () => getStartingProficiencies({ classEntry: chosen,
      background: characterData.backgrounds.find(entry => entry.index === values.backgroundId),
      skills: characterData.skills, classSkillIds: values.classSkillIds, bonusSkillIds: values.bonusSkillIds,
      extraSkillIds: [...heritage.skillIds, ...skilled.skills, ...(values.multiclassProficiencyIds || [])
        .filter(id => id.startsWith('skill-')).map(id => id.slice(6))],
      expertiseIds: values.expertiseIds, subclassId: values.subclassId,
      attributes: values.attributes, level: values.level, classLevel: values.classLevel,
      additionalSavingThrows: effects.savingThrows }));
    if (training.missing || training.missingBonus || training.missingExpertise) {
      if (training.missing) issues.push({ message: `${training.missing} Klassenfertigkeit(en) fehlen.`, target: '#character-skill-choices' });
      if (training.missingBonus || training.missingExpertise) issues.push({ message: `Zusatzfertigkeiten: ${training.missingBonus} Übungen und ${training.missingExpertise} Expertise-Wahlen fehlen.`, target: '#character-training' });
    }
    const weaponMastery = checkCharacterSection('#character-mastery', () => getWeaponMasteryChoices({ classEntry: chosen, levelRows: characterData.levels,
      level: values.classLevel, equipment: characterData.equipment, selected: values.weaponMasteryIds }));
    if (weaponMastery.missing) issues.push({ message: `${weaponMastery.missing} Waffenmeisterschaft(en) fehlen.`, target: '#character-mastery' });
    if (issues.length) {
      const error = new Error('Charakterentscheidungen unvollständig.');
      error.issues = issues;
      throw error;
    }
    checkCharacterSection('#character-armor', () => getDefenseStats({ classEntry: chosen, subclassId: values.subclassId, level: values.classLevel,
      levelRows: characterData.levels, attributes: values.attributes, equipment: characterData.equipment,
      armorId: values.armorId, shield: values.shield, speciesSpeed: heritage.speed,
      fightingStyles: classFeatures.effectiveStyles,
      additionalProficiencies: [...(multi?.proficiencies || []), ...effects.proficiencies] }));
    const { level: _level, classLevel: _classLevel, edras, ...ruleChoices } = values;
    if (previous && previous.level > values.level
      && !confirm('Beim Zurückstufen gehen spätere Stufenentscheidungen verloren. Wirklich fortfahren?')) return;
    const before = previous?.profile.levelHistory || (previous ? Array(previous.level).fill(previous.profile.classId) : []);
    const after = values.levelHistory || Array(values.level).fill(values.classId);
    const classTrackChanged = !!previous && (previous.profile.classId !== values.classId
      || before.slice(0, Math.min(before.length, after.length)).some((id, index) => id !== after[index])
      || !!previous.profile.levelHistory !== !!values.levelHistory);
    if (classTrackChanged && !confirm('Der geänderte Klassenverlauf setzt Klassenressourcen zurück; die neue Trefferwürfelverteilung wird übernommen. Fortfahren?')) return;
    if (previous?.profile.edras && !edras
      && !confirm('Das Edras-Weltmodul samt Lebensenergie und Belastung entfernen?')) return;
    const edrasChanged = previous?.profile.edras && edras
      && (previous.profile.edras.potential !== edras.potential || previous.profile.edras.techniqueId !== edras.techniqueId);
    if (edrasChanged && !confirm('Edras-Potenzial oder -Technik ändern? Der bisherige LE-/Belastungszustand wird zurückgesetzt.')) return;
    const state = edras ? previous?.profile.edras && !edrasChanged
      ? normalizeEdrasState({ level: values.level, constitution: values.attributes.con },
        { ...previous.profile.edras, publicAssessment: edras.publicAssessment })
      : makeEdrasState({ level: values.level, constitution: values.attributes.con, ...edras }) : null;
    const startingEquipment = previous ? previous.profile.startingEquipment || null : readStartingKitSelection();
    if (!previous && values.backgroundId === 'soldier' && startingEquipment.backgroundVariant === '0'
      && startingEquipment.choices['background-option-0'] !== values.originChoices.backgroundToolId.slice(5)) {
      const error = new Error('Soldier: Das gewählte Spielset muss mit der Werkzeugübung des Hintergrunds übereinstimmen.');
      error.issues = [{ message: error.message, target: '#character-starter' },
        { message: 'Werkzeugübung des Hintergrunds prüfen.', target: '#character-heritage' }];
      throw error;
    }
    const inventory = previous ? normalizeInventory(characterData.equipment, previous.profile.inventory)
      : grantStartingKits({ classEntry: chosen,
        background: characterData.backgrounds.find(entry => entry.index === values.backgroundId),
        equipment: characterData.equipment, selection: startingEquipment });
    // Beim Erstellen existiert noch kein gespeichertes Profil. Die gemeinsame
    // Zustandsprüfung benötigt bereits die verbindliche SRD-Regelkennung.
    const vitalContext = getVitalContext({ ...ruleChoices, ruleset: RULESET.id, level: values.level });
    const now = new Date().toISOString();
    const className = multi ? `${chosen.name} + ${Object.keys(multi.classLevels).length - 1} Klasse(n)` : chosen.name;
    const next = { ...(previous || {}), id, name, className, race: kind.name, level: values.level,
      profile: { ...(previous?.profile || {}), ruleset: RULESET.id, rulesetVersion: RULESET.version,
        creationStage: 'draft', ...ruleChoices, edras: state, startingEquipment, inventory,
        vitals: normalizeVitals(vitalContext, previous?.profile.vitals),
        createdAt: previous?.profile.createdAt || now, ...(previous ? { updatedAt: now } : {}) } };
    if (!values.levelHistory) {
      delete next.profile.levelHistory;
      delete next.profile.multiclassProficiencyIds;
    }
    next.profile.tracker = normalizeResourceTracker(getCharacterTrackerSummary(next, characterData),
      previous && !classTrackChanged ? previous.profile.tracker : {});
    saveGame(upsertCharacter(saved, next, editingCharacterId));
    renderTrackerOptions(id);
    if (editingCharacterId) notice(`${name} wurde aktualisiert; die bisherigen Ressourcenstände wurden übernommen.`);
    else notice(`${name} wurde als lokaler Charakterentwurf gespeichert.`);
    setCharacterEditState(id, name);
    setCharacterMode('play', { focus: true });
  } catch (error) { showCharacterIssues(error.issues || [{ message: error.message, target: '#character-name' }]); }
});

function currentPack() { return packs.find(pack => pack.id === activePackId) || packs[0]; }
function writePacks() {
  saveLocalPacks(packs);
  renderPacks();
  renderAbilities();
}
function renderPackOptions() {
  const selected = $('#ability-pack').value || activePackId;
  inputOptions($('#ability-pack'), packs.map(pack => ({ index: pack.id, name: pack.name })));
  if (packs.some(pack => pack.id === selected)) $('#ability-pack').value = selected;
  else $('#ability-pack').value = activePackId;
}
function renderPacks() {
  renderPackOptions();
  $('#pack-count').textContent = `${packs.length} Paket${packs.length === 1 ? '' : 'e'}`;
  const box = $('#pack-list'); box.replaceChildren();
  for (const pack of packs) {
    const card = node('article', '', 'pack-card');
    card.append(node('h3', pack.name));
    card.append(node('p', `Version ${pack.version} · ${pack.abilities.length} Fähigkeiten · ${pack.id}`));
    const actions = node('div', '', 'action-row');
    actions.append(button(pack.id === activePackId ? 'Aktives Paket' : 'Bearbeiten', () => {
      activePackId = pack.id; $('#ability-pack').value = pack.id; renderAbilities(); switchTab('abilities');
    }));
    actions.append(button('JSON exportieren', () => exportPack(pack)));
    actions.append(button('Löschen', () => {
      if (!confirm(`Regelpaket „${pack.name}“ samt aller Fähigkeiten lokal löschen?`)) return;
      packs = packs.filter(entry => entry.id !== pack.id);
      if (!packs.length) packs = [makePack('Meine Hausregeln')];
      activePackId = packs[0].id;
      try { writePacks(); notice('Regelpaket lokal entfernt.'); } catch (error) { notice(error.message); }
    }));
    card.append(actions); box.append(card);
  }
}
function exportPack(pack) {
  const json = JSON.stringify(pack, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = node('a'); link.href = url; link.download = `${pack.id}-v${pack.version}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notice('Regelpaket exportiert.');
}
$('#pack-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#pack-name').value.trim();
  if (!name) return;
  if (packs.length >= 50) { notice('Die lokale Paketgrenze ist erreicht.'); return; }
  const pack = makePack(name);
  packs.push(pack); activePackId = pack.id;
  try { writePacks(); $('#pack-form').reset(); notice('Regelpaket angelegt.'); }
  catch (error) { packs.pop(); notice(error.message); }
});
$('#pack-import').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 250000) throw new Error('Regelpaket-Datei zu groß.');
    const pack = importPackJson(await file.text());
    const exists = packs.findIndex(item => item.id === pack.id);
    if (exists >= 0 && !confirm(`Paket „${pack.name}“ durch die importierte Version ersetzen?`)) return;
    if (exists === -1 && packs.length >= 50) throw new Error('Die lokale Paketgrenze ist erreicht.');
    const next = [...packs];
    if (exists >= 0) next[exists] = pack; else next.push(pack);
    saveLocalPacks(next);
    packs = next; activePackId = pack.id; renderPacks(); renderAbilities(); notice('Regelpaket importiert.');
  } catch (error) { notice(error.message); }
});

function adaptAbilityForm() {
  const kind = $('#ability-effect').value;
  const isModifier = kind === 'modifier';
  const isManual = kind === 'manual';
  $('#ability-target-wrap').hidden = !isModifier;
  $('#ability-value-label').hidden = isManual;
  $('#ability-value').required = !isManual;
  if (isModifier) {
    $('#ability-value-label').firstChild.textContent = 'Zahlenbonus';
    if (!/^-?\d+$/.test($('#ability-value').value.trim())) $('#ability-value').value = '2';
    $('#ability-activation').value = 'passive';
  } else if (!isManual) {
    $('#ability-value-label').firstChild.textContent = 'Würfelformel';
    if (!/\dd/.test($('#ability-value').value)) $('#ability-value').value = '2d6';
    if ($('#ability-activation').value === 'passive') $('#ability-activation').value = 'action';
  }
}
$('#ability-effect').addEventListener('change', adaptAbilityForm);
$('#ability-pack').addEventListener('change', () => { activePackId = $('#ability-pack').value; renderAbilities(); });
$('#ability-form').addEventListener('submit', event => {
  event.preventDefault();
  const pack = currentPack();
  const kind = $('#ability-effect').value;
  const name = $('#ability-name').value.trim();
  const description = $('#ability-description').value.trim();
  const value = $('#ability-value').value.trim();
  const activation = $('#ability-activation').value;
  const effect = kind === 'modifier'
    ? { type: kind, target: $('#ability-target').value, value: Number(value) }
    : kind === 'manual' ? { type: 'manual', note: description || 'Die Spielleitung entscheidet über die Wirkung.' }
      : { type: kind, dice: value };
  const ability = {
    schemaVersion: 1,
    id: `hb.${(globalThis.crypto?.randomUUID?.() || `a${Date.now()}${Math.random().toString(36).slice(2)}`).replace(/[^a-z0-9.-]/gi, '').toLowerCase()}`,
    version: 1,
    name, description, activation,
    minLevel: Number($('#ability-level').value),
    resource: $('#ability-resource').value.trim().toLowerCase(),
    cost: Number($('#ability-cost').value),
    effects: [effect],
  };
  const errors = validateAbility(ability);
  if (activation === 'passive' && kind !== 'modifier' && kind !== 'manual') errors.push('Passive Fähigkeiten benötigen einen Modifikator oder einen manuellen Effekt.');
  if (errors.length) { notice(errors.slice(0, 2).join(' ')); return; }
  if (pack.abilities.length >= 100 || pack.version >= 9999) { notice('Paketgrenze erreicht.'); return; }
  pack.abilities.push(ability); pack.version++;
  try { writePacks(); $('#ability-form').reset(); adaptAbilityForm(); notice(`„${name}“ wurde in „${pack.name}“ gespeichert.`); }
  catch (error) { pack.abilities.pop(); pack.version--; notice(error.message); }
});

function renderAbilities() {
  const pack = currentPack();
  if (!pack) return;
  const box = $('#ability-list'); box.replaceChildren();
  if (!pack.abilities.length) { box.append(node('p', 'Noch keine eigenen Fähigkeiten. Erstelle links die erste.', 'placeholder')); return; }
  for (const ability of pack.abilities) {
    const card = node('article', '', 'ability-card');
    card.append(node('h3', ability.name));
    card.append(node('p', ability.description || 'Keine Beschreibung.'));
    card.append(node('div', `${ACTIVATION_NAMES[ability.activation]} · Ab Stufe ${ability.minLevel} · ${ability.cost} ${ability.resource || 'Ressourcenkosten'}`, 'meta'));
    const actions = node('div', '', 'action-row');
    actions.append(button('Effekt testen', () => testAbility(ability)));
    actions.append(button('Entfernen', () => {
      if (!confirm(`Fähigkeit „${ability.name}“ wirklich aus diesem Paket entfernen?`)) return;
      pack.abilities = pack.abilities.filter(item => item.id !== ability.id); pack.version++;
      try { writePacks(); notice('Fähigkeit entfernt.'); } catch (error) { notice(error.message); }
    }));
    card.append(actions); box.append(card);
  }
}
function testAbility(ability) {
  const box = $('#ability-test');
  try {
    const example = { level: Math.max(ability.minLevel, 8), hp: 15, maxHp: 40, temporaryHp: 0, resources: ability.resource ? { [ability.resource]: 10 } : {} };
    if (ability.activation === 'passive') {
      const before = { level: example.level, armor_class: 10, initiative: 0, speed: 30, max_hp: 40, attack_bonus: 3, spell_dc: 11 };
      const after = applyPassiveModifiers(before, [ability]);
      box.textContent = `${ability.name}\nVorher: ${JSON.stringify(before)}\nNachher: ${JSON.stringify(after)}\nSonderbedingungen werden durch die Spielleitung geprüft.`;
    } else {
      const result = activateAbility(ability, example);
      box.textContent = `${ability.name}\nEreignisse: ${JSON.stringify(result.events, null, 2)}\nRessourcen danach: ${JSON.stringify(result.character.resources)}\nOffene Treffer-/Zielentscheidungen bleiben bei der Spielleitung.`;
    }
  } catch (error) { box.textContent = error.message; }
}

function cloudFriendly(error) {
  const code = error?.code || '';
  if (code.includes('permission-denied')) return 'Cloud-Zugriff noch nicht freigeschaltet. Die ergänzenden Firestore-Regeln müssen veröffentlicht werden. Lokale Entwürfe bleiben erhalten.';
  if (code.includes('unavailable') || code.includes('network')) return 'Netzwerk oder Cloud nicht erreichbar. Lokale Entwürfe bleiben erhalten.';
  return error?.message || 'Cloud-Aktion fehlgeschlagen.';
}
async function initCloud() {
  try {
    const { setupCloud } = await import('./cloud.mjs');
    cloud = setupCloud(email => {
      $('#cloud-state').textContent = email ? 'Angemeldet · private Pakete' : 'Lokal · nicht angemeldet';
      $('#cloud-help').textContent = email ? `Angemeldet als ${email}. Pakete werden nur nach Klick auf „online sichern“ hochgeladen.` : 'Zum Cloud-Speichern zuerst auf der Würfelbund-Startseite anmelden.';
      $('#cloud-save').disabled = !email;
      $('#cloud-load').disabled = !email;
    });
  } catch { $('#cloud-state').textContent = 'Offline · lokale Pakete'; $('#cloud-save').disabled = true; $('#cloud-load').disabled = true; }
}
$('#cloud-save').addEventListener('click', async () => {
  try {
    if (!cloud) throw new Error('Cloud nicht geladen.');
    await cloud.save(currentPack());
    notice('Regelpaket privat im Würfelbund-Konto gespeichert.');
  } catch (error) { notice(cloudFriendly(error)); }
});
$('#cloud-load').addEventListener('click', async () => {
  try {
    if (!cloud) throw new Error('Cloud nicht geladen.');
    const remote = await cloud.list();
    if (!remote.length) { notice('Noch keine Online-Pakete gespeichert.'); return; }
    const next = [...packs];
    for (const raw of remote) {
      const pack = importPackJson(JSON.stringify({ schemaVersion: raw.schemaVersion, id: raw.id, name: raw.name, version: raw.version, abilities: raw.abilities, source: raw.source || 'homebrew' }));
      const index = next.findIndex(item => item.id === pack.id);
      if (index >= 0) {
        if (confirm(`Lokales Paket „${pack.name}“ durch seine Online-Version ersetzen?`)) next[index] = pack;
      } else if (next.length < 50) next.push(pack);
    }
    saveLocalPacks(next); packs = next; activePackId = next[0].id;
    renderPacks(); renderAbilities(); notice('Online-Pakete übernommen.');
  } catch (error) { notice(cloudFriendly(error)); }
});

renderPacks(); renderAbilities(); navigateStudioHash();
refreshStorageWarning();
window.addEventListener('storage', event => {
  if (event.key === 'wuerfelbund-save-v1') refreshStorageWarning();
});
