import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { originOptions, resolveOrigin } from '../js/rules/origins.mjs';
import { getDefenseStats, getStartingProficiencies } from '../js/rules/dnd55.mjs';
import { applyVitals } from '../js/rules/vitals.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../data/srd-5.2.1/en/5e-SRD-${name}.json`, import.meta.url), 'utf8'));
const data = Promise.all(['Species', 'Subspecies', 'Traits', 'Feats', 'Backgrounds', 'Skills',
  'Languages', 'Proficiencies', 'Classes', 'Levels', 'Equipment'].map(load)).then(([
  species, subspecies, traits, feats, backgrounds, skills, languages, proficiencies, classes, levels, equipment,
]) => ({ species, subspecies, traits, feats, backgrounds, skills, languages, proficiencies, classes, levels, equipment }));
const chosen = {
  languages: ['draconic', 'dwarvish'], speciesSkillId: '', backgroundToolId: '',
  versatileFeatId: '', skilledIds: [], lineageId: '', size: '',
};

async function origin(speciesId, backgroundId = 'criminal', level = 8, overrides = {}, others = {}) {
  const source = await data;
  const species = source.species.find(entry => entry.index === speciesId);
  const background = source.backgrounds.find(entry => entry.index === backgroundId);
  return resolveOrigin({ ...source, species, background, level,
    choices: { ...chosen, ...overrides }, ...others });
}

test('Alle neun SRD-Spezies und 24 Abstammungen nutzen ausschließlich die vorhandenen Quelldaten', async () => {
  const source = await data;
  assert.equal(source.species.length, 9);
  assert.equal(source.subspecies.length, 24);
  let checked = 0;
  for (const species of source.species) {
    const opts = originOptions({ ...source, species, background: source.backgrounds[1] });
    for (const lineage of opts.lineages.length ? opts.lineages : [{ index: '' }]) {
      const result = await origin(species.index, 'criminal', 8, {
        lineageId: lineage.index, size: opts.sizeOptions[0],
        speciesSkillId: opts.traitSkillOptions[0]?.index || '', versatileFeatId: opts.versatileOptions[0]?.index || '',
      });
      assert.ok(result.speed >= species.speed);
      assert.equal(result.lineage?.index || '', lineage.index);
      assert.equal(result.languages[0], 'common');
      assert.equal(new Set(result.activeTraits.map(trait => trait.index)).size, result.activeTraits.length);
      checked++;
    }
  }
  assert.equal(checked, 28, 'jede Variante wurde durchlaufen; variantenlose Spezies einmal');
});

test('Stufen 1, 3, 5, 20 schalten Abstammungsmerkmale exakt bei Quellenstufe frei', async () => {
  const source = await data;
  let checked = 0;
  for (const subtype of source.subspecies) {
    for (const level of [1, 3, 5, 20]) {
      const species = source.species.find(item => item.index === subtype.species.index);
      const opts = originOptions({ ...source, species, background: source.backgrounds[1] });
      const actual = await origin(species.index, 'criminal', level, {
        lineageId: subtype.index, size: opts.sizeOptions[0],
        speciesSkillId: opts.traitSkillOptions[0]?.index || '',
      });
      for (const trait of subtype.traits) {
        assert.equal(actual.activeTraits.some(item => item.index === trait.index), trait.level <= level,
          `${subtype.index}/${trait.index} @${level}`);
      }
      checked++;
    }
  }
  assert.equal(checked, 96);
});

test('Zwerg-Zähigkeit, Waldelf-Tempo, Mensch-Feat und Ressourceneffekt korrekt', async () => {
  assert.equal((await origin('dwarf', 'criminal', 17)).hpBonus, 17);
  const elf = await origin('elf', 'criminal', 8, {
    lineageId: 'elven-lineage-wood-elf', speciesSkillId: 'survival',
  });
  assert.equal(elf.speed, 35);
  const source = await data;
  const defense = getDefenseStats({ classEntry: source.classes.find(entry => entry.index === 'wizard'),
    levelRows: source.levels, level: 8, attributes: { str: 12, dex: 14, con: 14, int: 18 },
    equipment: source.equipment, speciesSpeed: elf.speed });
  assert.equal(defense.speed, 35);
  const human = await origin('human', 'criminal', 8, { versatileFeatId: 'savage-attacker', speciesSkillId: 'arcana', size: 'medium' });
  assert.equal(human.missing, 0);
  assert.equal(human.heroicInspirationOnRest, true);
  assert.equal(applyVitals({ level: 8, maxHp: 60, heroicInspirationOnRest: true },
    { heroicInspiration: false }, 'longRest').heroicInspiration, true);
  assert.equal(applyVitals({ level: 8, maxHp: 60 }, {}, 'longRest').heroicInspiration, false);
  assert.equal((await origin('human', 'sage', 8, { versatileFeatId: 'alert', speciesSkillId: 'athletics', size: 'small' })).initiativeBonus, 3);
  assert.equal((await origin('orc', 'soldier', 8, { backgroundToolId: 'tool-dice' })).initiativeBonus, 0);
});

test('Speziesfertigkeit und Skilled (inkl. Werkzeuge) zählen zu echten Fertigkeitsboni', async () => {
  const source = await data;
  const result = await origin('human', 'criminal', 8, {
    versatileFeatId: 'skilled', speciesSkillId: 'perception', size: 'medium',
    skilledIds: ['skill:athletics', 'tool:bagpipes', 'skill:arcana'],
  });
  assert.equal(result.missing, 0);
  assert.deepEqual(result.skillIds.sort(), ['arcana', 'athletics', 'perception']);
  assert.ok(result.toolIds.includes('bagpipes'));
  const trained = getStartingProficiencies({
    classEntry: source.classes.find(entry => entry.index === 'fighter'),
    background: source.backgrounds.find(entry => entry.index === 'criminal'),
    skills: source.skills, level: 8, attributes: { str: 16, dex: 14, con: 14, int: 12, wis: 10, cha: 8 },
    extraSkillIds: result.skillIds,
  });
  assert.equal(trained.skills.find(entry => entry.id === 'perception').trained, true);
  assert.equal(trained.skills.find(entry => entry.id === 'arcana').modifier, 4);
});

test('Soldier wählt eine spielbare Werkzeugübung aus dem importierten SRD', async () => {
  const soldier = await origin('dwarf', 'soldier', 8, { backgroundToolId: 'tool-dice' });
  assert.equal(soldier.missing, 0);
  assert.ok(soldier.toolIds.includes('tool-dice'));
  await assert.rejects(origin('dwarf', 'criminal', 8, { backgroundToolId: 'tool-dice' }), /Werkzeug/);
});

test('Kein geschmuggeltes Erbe, keine seltene Sprache, keine doppelte Übung', async () => {
  await assert.rejects(origin('dwarf', 'criminal', 8, { lineageId: 'elven-lineage-drow' }), /Spezies-Abstammung/);
  await assert.rejects(origin('elf', 'criminal', 8, { lineageId: 'fiendish-legacy-infernal' }), /Spezies-Abstammung/);
  await assert.rejects(origin('dwarf', 'criminal', 8, { languages: ['celestial', 'draconic'] }), /Sprachen/);
  await assert.rejects(origin('dwarf', 'criminal', 8, { languages: ['elvish', 'elvish'] }), /Sprachen/);
  await assert.rejects(origin('dwarf', 'criminal', 8, { versatileFeatId: 'alert' }), /Herkunftstalent/);
  await assert.rejects(origin('human', 'criminal', 8, {
    versatileFeatId: 'skilled', speciesSkillId: 'stealth', skilledIds: ['skill:perception', 'tool:bagpipes', 'skill:arcana'],
  }), /Doppelte Fertigkeitsübung/);
  await assert.rejects(origin('human', 'criminal', 8, {
    versatileFeatId: 'skilled', speciesSkillId: 'perception', skilledIds: ['skill:perception', 'tool:bagpipes', 'skill:arcana'],
  }), /Doppelte Fertigkeitsübung/);
  await assert.rejects(origin('human', 'criminal', 8, {
    versatileFeatId: 'skilled', speciesSkillId: 'perception', skilledIds: ['tool:bagpipes', 'tool:bagpipes', 'skill:arcana'],
  }), /Skilled/);
  await assert.rejects(origin('tiefling', 'criminal', 8, { size: 'huge' }), /Speziesgröße/);
});

test('Früh/spät gewonnene Zauber und Resistenzen sind getrennt und Edras wird nicht berührt', async () => {
  const early = await origin('tiefling', 'criminal', 1, { lineageId: 'fiendish-legacy-infernal', size: 'small' });
  const later = await origin('tiefling', 'criminal', 5, { lineageId: 'fiendish-legacy-infernal',
    lineageSpellAbility: 'cha', size: 'small' });
  assert.deepEqual(early.resistances, ['fire']);
  assert.ok(early.originSpells.includes('fire-bolt'));
  assert.ok(!early.originSpells.includes('darkness'));
  assert.ok(later.originSpells.includes('darkness'));
  assert.equal(later.size, 'small');
  assert.equal(later.missing, 0);
  const saved = JSON.parse(JSON.stringify({ ruleset: 'srd-5.2.1', speciesId: 'tiefling',
    originChoices: { ...chosen, size: 'small', lineageId: 'fiendish-legacy-infernal' } }));
  assert.equal((await origin(saved.speciesId, 'criminal', 5, saved.originChoices)).size, 'small');
});

test('Oberfläche erfasst Herkunft als eigenes Profilfeld; D&D-Klassen bleiben unabhängig', async () => {
  const html = await readFile(new URL('../studio.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  assert.match(html, /id="character-heritage-choices"/);
  assert.match(main, /originChoices: readHeritageChoices\(\)/);
  assert.match(main, /restoreHeritageChoices\(profile.originChoices\)/);
  assert.match(main, /extraSkillIds: \[\.\.\.heritage\.skillIds/);
  assert.doesNotMatch(html, /verbindliche Edras-Klasse/);
});
