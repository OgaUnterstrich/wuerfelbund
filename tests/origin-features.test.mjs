import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { magicInitiateSources, magicInitiateOptions, validateMagicInitiate,
  additionalSkilledSources, validateAdditionalSkilled, getOriginFeatureResources } from '../js/rules/origin-features.mjs';
import { originOptions, resolveOrigin } from '../js/rules/origins.mjs';
import { getCharacterTrackerSummary } from '../js/rules/character-actions.mjs';
import { normalizeResourceTracker, restResourceTracker } from '../js/rules/dnd55.mjs';
import { getCastableSpells, castSelectedSpell } from '../js/rules/casting.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../data/srd-5.2.1/en/5e-SRD-${name}.json`, import.meta.url), 'utf8'));
const data = Promise.all(['Species', 'Subspecies', 'Traits', 'Feats', 'Backgrounds', 'Skills',
  'Languages', 'Proficiencies', 'Classes', 'Levels', 'Spells'].map(load)).then(([
  species, subspecies, traits, feats, backgrounds, skills, languages, proficiencies, classes, levels, spells,
]) => ({ species, subspecies, traits, feats, backgrounds, skills, languages, proficiencies, classes, levels, spells }));

const blankOrigin = { lineageId: '', size: '', languages: ['draconic', 'dwarvish'],
  speciesSkillId: '', backgroundToolId: '', versatileFeatId: '', skilledIds: [] };

function traitOrigin(catalog, speciesId, level, lineageId = '') {
  const species = catalog.species.find(item => item.index === speciesId);
  const background = catalog.backgrounds.find(item => item.index === 'criminal');
  const options = originOptions({ ...catalog, species, background });
  return resolveOrigin({ ...catalog, species, background, level,
    choices: { ...blankOrigin, lineageId, size: options.sizeOptions[0],
      speciesSkillId: options.traitSkillOptions[0]?.index || '' } });
}

function firstSpell(catalog, list) {
  const options = magicInitiateOptions(catalog.spells, list);
  assert.ok(options.cantrips.length > 1 && options.spells.length > 0);
  return { list, ability: 'wis', cantrips: options.cantrips.slice(0, 2).map(item => item.id),
    spellId: options.spells[0].id };
}

test('Magic Initiate: Cleric für Acolyte, Wizard für Sage und andere Quellen getrennt', async () => {
  const catalog = await data;
  assert.deepEqual(magicInitiateSources({ backgroundId: 'acolyte' }).map(s => s.fixedList), ['cleric']);
  assert.deepEqual(magicInitiateSources({ backgroundId: 'sage' }).map(s => s.fixedList), ['wizard']);
  const profile = { backgroundId: 'acolyte', originChoices: { versatileFeatId: 'magic-initiate' },
    levelChoices: [{ level: 4, kind: 'feat', featId: 'magic-initiate' }],
    magicInitiate: { background: firstSpell(catalog, 'cleric'), human: firstSpell(catalog, 'druid'),
      'level-4': firstSpell(catalog, 'wizard') } };
  const result = validateMagicInitiate({ profile, spells: catalog.spells, strict: true });
  assert.equal(result.sources.length, 3);
  assert.equal(result.missing, 0);
  assert.equal(new Set(result.grants.map(entry => entry.list)).size, 3);
  const tooMany = { ...profile, classFeatures: { invocations: ['lessons-of-the-first-ones:magic-initiate'] } };
  assert.throws(() => validateMagicInitiate({ profile: tooMany, spells: catalog.spells, strict: true }), /fehlen|einmal/);
});

test('Magic Initiate: doppelte Liste, falscher Zauber, fehlende Auswahl, falsches Attribut und Altquellen verboten', async () => {
  const catalog = await data;
  const base = { backgroundId: 'sage', originChoices: { versatileFeatId: 'magic-initiate' },
    magicInitiate: { background: firstSpell(catalog, 'wizard'), human: firstSpell(catalog, 'wizard') } };
  assert.throws(() => validateMagicInitiate({ profile: base, spells: catalog.spells }), /nur einmal/);
  const wrong = { ...base, magicInitiate: { background: { ...firstSpell(catalog, 'wizard'), spellId: 'healing-word' } } };
  assert.throws(() => validateMagicInitiate({ profile: wrong, spells: catalog.spells }), /gehört nicht/);
  assert.throws(() => validateMagicInitiate({ profile: { ...base, magicInitiate: {
    background: { ...firstSpell(catalog, 'wizard'), ability: 'str' } } }, spells: catalog.spells }), /Zauberattribut/);
  assert.throws(() => validateMagicInitiate({ profile: { ...base, magicInitiate: {
    background: firstSpell(catalog, 'wizard'), human: { list: 'druid', cantrips: ['druidcraft', 'druidcraft'] } } },
    spells: catalog.spells }), /eindeutig/);
  assert.throws(() => validateMagicInitiate({ profile: { backgroundId: 'criminal', magicInitiate: {
    background: firstSpell(catalog, 'cleric') } }, spells: catalog.spells }), /nicht mehr gültig/);
  assert.equal(validateMagicInitiate({ profile: { backgroundId: 'sage' }, spells: catalog.spells }).missing, 4);
  const onlySpell = { backgroundId: 'sage', magicInitiate: { background: {
    list: 'wizard', spellId: firstSpell(catalog, 'wizard').spellId } } };
  assert.equal(getOriginFeatureResources({ profile: { ...onlySpell, level: 5 }, spells: catalog.spells })
    .some(entry => entry.id === 'origin:magic-initiate:background'), false,
  'unvollständige Alt-/Manipulationsprofile erhalten keine kostenlose Anwendung');
});

test('Skilled von Stufen und Warlock: drei unterschiedliche Zusatzübungen, keine Dopplung mit Herkunft/Klasse', async () => {
  const catalog = await data;
  const sources = { levelChoices: [{ level: 4, kind: 'feat', featId: 'skilled' }],
    classFeatures: { invocations: ['lessons-of-the-first-ones:skilled'] } };
  assert.deepEqual(additionalSkilledSources(sources).map(source => source.id), ['level-4', 'warlock']);
  const prof = { ...sources, additionalSkilled: {
    'level-4': ['skill:perception', 'skill:arcana', 'tool:tool-thieves-tools'],
    warlock: ['skill:stealth', 'skill:athletics', 'skill:insight'],
  } };
  const valid = validateAdditionalSkilled({ profile: prof, skills: catalog.skills,
    proficiencies: catalog.proficiencies, baseSkills: ['history'], baseTools: [] });
  assert.equal(valid.missing, 0);
  assert.ok(valid.skills.includes('perception'));
  assert.throws(() => validateAdditionalSkilled({ profile: prof, skills: catalog.skills,
    proficiencies: catalog.proficiencies, baseSkills: ['perception'] }), /doppelt/);
  assert.throws(() => validateAdditionalSkilled({ profile: { ...prof,
    additionalSkilled: { 'level-4': ['skill:stealth', 'skill:stealth'] } },
    skills: catalog.skills, proficiencies: catalog.proficiencies }), /doppelt/);
  assert.throws(() => validateAdditionalSkilled({ profile: { ...prof,
    additionalSkilled: { 'level-4': ['skill:invented'] } },
    skills: catalog.skills, proficiencies: catalog.proficiencies }), /ungültig/);
  assert.equal(validateAdditionalSkilled({ profile: { ...sources }, skills: catalog.skills,
    proficiencies: catalog.proficiencies }).missing, 6);
});

test('Alle 9 Spezies und 24 Abstammungen × 1/5/17/20: Ressourcen sind eindeutig, gültig und nur freigeschaltet', async () => {
  const catalog = await data;
  let checked = 0;
  for (const species of catalog.species) {
    const variants = catalog.subspecies.filter(item => item.species?.index === species.index);
    for (const lineage of variants.length ? variants : [{ index: '' }]) {
      for (const level of [1, 5, 17, 20]) {
        const origin = traitOrigin(catalog, species.index, level, lineage.index);
        const resources = getOriginFeatureResources({ profile: { level, backgroundId: 'criminal' },
          origin, spells: catalog.spells });
        assert.equal(new Set(resources.map(resource => resource.id)).size, resources.length);
        for (const resource of resources) {
          assert.ok(resource.id.startsWith('origin:'));
          assert.ok(Number.isInteger(resource.max) && resource.max >= 1 && resource.max <= 6);
          assert.ok(['none', 'all'].includes(resource.shortRest));
        }
        if (level < 5) assert.ok(!resources.some(resource => ['origin:flight', 'origin:large-form'].includes(resource.id)));
        if (species.index === 'orc') {
          assert.equal(resources.find(resource => resource.id === 'origin:adrenaline-rush')?.shortRest, 'all');
          assert.equal(resources.find(resource => resource.id === 'origin:adrenaline-rush')?.max, level >= 17 ? 6 : level >= 5 ? 3 : 2);
        }
        checked++;
      }
    }
  }
  assert.equal(checked, 112);
});

test('Elf/Tiefling/Gnom: explizites Zauberattribut, Hoch-Elf-Zaubertrick und PB-Nutzungen des Waldgnoms', async () => {
  const catalog = await data;
  const high = catalog.species.find(entry => entry.index === 'elf');
  const background = catalog.backgrounds.find(entry => entry.index === 'criminal');
  const choose = { ...blankOrigin, lineageId: 'elven-lineage-high-elf', lineageSpellAbility: 'wis',
    highElfCantripId: 'mage-hand' };
  const elf = resolveOrigin({ ...catalog, species: high, background, level: 5, choices: choose });
  assert.ok(elf.originSpells.includes('mage-hand'));
  assert.ok(!elf.originSpells.includes('prestidigitation'));
  assert.equal(elf.lineageSpellAbility, 'wis');
  assert.throws(() => resolveOrigin({ ...catalog, species: high, background, level: 5,
    choices: { ...choose, highElfCantripId: 'healing-word' } }), /Magierliste/);
  assert.equal(resolveOrigin({ ...catalog, species: high, background, level: 5,
    choices: { ...choose, lineageSpellAbility: '' } }).missing, elf.missing + 1);
  const gnome = traitOrigin(catalog, 'gnome', 5, 'gnomish-lineage-forest-gnome');
  const tracker = getOriginFeatureResources({ profile: { level: 5 }, origin: gnome, spells: catalog.spells });
  assert.equal(tracker.find(resource => resource.id === 'origin:speak-with-animals').max, 3);
  assert.ok(!tracker.some(resource => resource.id === 'origin:spell:speak-with-animals'));
  assert.ok(gnome.originSpells.includes('minor-illusion'));
  const rock = traitOrigin(catalog, 'gnome', 5, 'gnomish-lineage-rock-gnome');
  assert.ok(rock.originSpells.includes('mending'));
});

test('Freie Spezies- und Feat-Zauber: Modus, Verbrauch, Slot, kurze/lange Rast, Missbrauch', async () => {
  const catalog = await data;
  const profile = { ruleset: 'srd-5.2.1', classId: 'fighter', level: 5, speciesId: 'elf',
    backgroundId: 'sage', attributes: { str: 16, dex: 12, con: 14, int: 14, wis: 12, cha: 10 },
    originChoices: { ...blankOrigin, lineageId: 'elven-lineage-high-elf' },
    spells: {}, magicInitiate: { background: firstSpell(catalog, 'wizard') } };
  const origin = traitOrigin(catalog, 'elf', 5, 'elven-lineage-high-elf');
  const character = { level: 5, profile };
  const summary = getCharacterTrackerSummary(character, catalog);
  const freeSpell = profile.magicInitiate.background.spellId;
  const initial = getCastableSpells({ profile, summary, spellCatalog: catalog.spells,
    originSpells: origin.originSpells });
  assert.ok(initial.some(spell => spell.id === profile.magicInitiate.background.cantrips[0]
    && spell.modes.some(mode => mode.id === 'cantrip')));
  assert.ok(initial.some(spell => spell.id === freeSpell && spell.modes.some(mode => mode.id === 'feat:background')));
  const cast = castSelectedSpell({ profile, summary, spellCatalog: catalog.spells,
    originSpells: origin.originSpells, vitalContext: { level: 5, maxHp: 40, hitDie: 10, conModifier: 2,
      untrainedArmor: false }, spellId: freeSpell, modeId: 'feat:background' });
  assert.equal(cast.tracker.resources['origin:magic-initiate:background'], 0);
  profile.tracker = cast.tracker;
  assert.throws(() => castSelectedSpell({ profile, summary, spellCatalog: catalog.spells,
    originSpells: origin.originSpells, vitalContext: { level: 5, maxHp: 40, hitDie: 10, conModifier: 2,
      untrainedArmor: false }, spellId: freeSpell, modeId: 'feat:background' }), /nicht gültig/);
  assert.equal(restResourceTracker(summary, cast.tracker, 'short').resources['origin:magic-initiate:background'], 0);
  assert.equal(restResourceTracker(summary, cast.tracker, 'long').resources['origin:magic-initiate:background'], 1);
  assert.throws(() => castSelectedSpell({ profile, summary, spellCatalog: catalog.spells,
    originSpells: origin.originSpells, vitalContext: { level: 5, maxHp: 40, hitDie: 10, conModifier: 2,
      untrainedArmor: false }, spellId: 'wish', modeId: 'feat:background' }), /nicht gültig/);
  const lineageSpell = origin.originSpells.find(id => catalog.spells.find(spell => spell.index === id)?.level > 0);
  assert.ok(lineageSpell);
  const lineageMode = getCastableSpells({ profile, summary, spellCatalog: catalog.spells,
    originSpells: origin.originSpells }).find(spell => spell.id === lineageSpell).modes;
  assert.ok(lineageMode.some(mode => mode.id === `origin:${lineageSpell}`));
});

test('Waldgnom: freie Speak-with-Animals-Nutzung verbraucht PB-Zähler statt doppelten Slot', async () => {
  const catalog = await data;
  const origin = traitOrigin(catalog, 'gnome', 5, 'gnomish-lineage-forest-gnome');
  const profile = { level: 5, classId: 'fighter', spells: {} };
  const summary = { spellcasting: null,
    resources: getOriginFeatureResources({ profile, origin, spells: catalog.spells }) };
  const available = getCastableSpells({ profile, summary, spellCatalog: catalog.spells,
    originSpells: origin.originSpells });
  assert.ok(available.find(spell => spell.id === 'speak-with-animals')?.modes.some(mode =>
    mode.id === 'origin:speak-with-animals'));
  const cast = castSelectedSpell({ profile, summary, spellCatalog: catalog.spells,
    originSpells: origin.originSpells, spellId: 'speak-with-animals', modeId: 'origin:speak-with-animals',
    vitalContext: { level: 5, maxHp: 30, hitDie: 10, conModifier: 0, untrainedArmor: false } });
  assert.equal(cast.tracker.resources['origin:speak-with-animals'], 2);
  assert.equal(restResourceTracker(summary, cast.tracker, 'short').resources['origin:speak-with-animals'], 2);
  assert.equal(restResourceTracker(summary, cast.tracker, 'long').resources['origin:speak-with-animals'], 3);
});

test('Epische Gabe des Schicksals: keine frühere Freischaltung, Rast-/Initiativ-Regel sichtbar', async () => {
  const catalog = await data;
  const resources18 = getOriginFeatureResources({ profile: { level: 18 }, spells: catalog.spells });
  assert.equal(resources18.some(item => item.id === 'origin:boon-of-fate'), false);
  const selected = { level: 19, levelChoices: [{ level: 19, kind: 'feat', featId: 'boon-of-fate' }] };
  const resources19 = getOriginFeatureResources({ profile: selected, spells: catalog.spells });
  assert.equal(resources19.find(item => item.id === 'origin:boon-of-fate')?.shortRest, 'all');
  assert.equal(restResourceTracker({ resources: resources19 }, {
    resources: { 'origin:boon-of-fate': 0 } }, 'short').resources['origin:boon-of-fate'], 1);
  assert.match(resources19.find(item => item.id === 'origin:boon-of-fate').name, /Initiative/);
});

test('B08: Editor speichert, lädt und prüft die Talentwahlen; keine zweite Speicherschicht', async () => {
  const source = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../studio.html', import.meta.url), 'utf8');
  assert.match(source, /magicInitiate: readMagicInitiateChoices\(\)/);
  assert.match(source, /additionalSkilled: readAdditionalSkilledChoices\(\)/);
  assert.match(source, /refreshOriginFeatChoices\(profile\.magicInitiate, profile\.additionalSkilled\)/);
  assert.match(source, /validateMagicInitiate\(/);
  assert.match(source, /validateAdditionalSkilled\(/);
  assert.match(html, /id="character-origin-feats"/);
  assert.equal((html.match(/id="character-origin-feats"/g) || []).length, 1);
});
