import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCategory } from '../js/rules/catalog.mjs';
import { getClassLevelSummary, getClassSpellChoices, validateCharacterSpells } from '../js/rules/dnd55.mjs';
import { EDRAS_FORBIDDEN_SPELLS, makeEdrasState } from '../js/rules/edras.mjs';
import { emptyGame, readGame, SAVE_KEY } from '../js/rules/characters.mjs';

globalThis.fetch = async url => ({
  ok: true, json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')),
});

test('Alle 12 Klassen × 20 Stufen: Zauberlimits aus offiziellen SRD-Klassentabellen', async () => {
  const [classes, levels, spells] = await Promise.all([
    loadCategory('classes'), loadCategory('levels'), loadCategory('spells'),
  ]);
  assert.ok(spells.length > 300);
  let casterCases = 0;
  for (const cls of classes) {
    for (let level = 1; level <= 20; level++) {
      const summary = getClassLevelSummary(levels, cls, level, { cha: 18, wis: 18, int: 18 });
      const choices = getClassSpellChoices(summary, cls.index, spells);
      assert.equal(choices.cantripLimit, summary.spellcasting?.cantripsKnown || 0);
      assert.equal(choices.preparedLimit, summary.spellcasting?.preparedSpells || 0);
      if (!summary.spellcasting) {
        assert.deepEqual(choices.cantrips, []);
        assert.deepEqual(choices.prepared, []);
        continue;
      }
      casterCases++;
      assert.ok(choices.cantrips.length >= choices.cantripLimit, `${cls.index}/${level} hat zu wenig SRD-Tricks`);
      assert.ok(choices.prepared.length >= choices.preparedLimit, `${cls.index}/${level} hat zu wenig SRD-Zauber`);
      assert.ok(choices.cantrips.every(spell => spell.level === 0 && spell.classes.some(ref => ref.index === cls.index)));
      assert.ok(choices.prepared.every(spell => spell.level >= 1 && spell.level <= choices.highestSlot));
      const cantrips = choices.cantrips.slice(0, choices.cantripLimit).map(spell => spell.index);
      const spellbook = cls.index === 'wizard' ? choices.prepared.slice(0, 6 + 2 * (level - 1)).map(spell => spell.index) : [];
      const prepared = (cls.index === 'wizard' ? choices.prepared.filter(spell => spellbook.includes(spell.index)) : choices.prepared)
        .slice(0, choices.preparedLimit).map(spell => spell.index);
      const ok = validateCharacterSpells({ summary, classId: cls.index, classLevel: level, spells, cantrips, prepared, spellbook });
      assert.equal(ok.missingCantrips, 0);
      assert.equal(ok.missingPrepared, 0);
      assert.equal(ok.missingSpellbook, 0);
      assert.equal(validateCharacterSpells({ summary, classId: cls.index, spells }).missingPrepared, choices.preparedLimit);
    }
  }
  assert.equal(casterCases, 8 * 20);
});

test('5.5e-Zauberwahl weist falsche Klassen, zu hohe Grade und doppelte IDs ab', async () => {
  const [classes, levels, spells] = await Promise.all([
    loadCategory('classes'), loadCategory('levels'), loadCategory('spells'),
  ]);
  const bard = classes.find(entry => entry.index === 'bard');
  const summary = getClassLevelSummary(levels, bard, 3, { cha: 16 });
  const opts = getClassSpellChoices(summary, 'bard', spells);
  assert.equal(opts.highestSlot, 2);
  assert.ok(!opts.prepared.some(spell => spell.level === 3));
  assert.throws(() => validateCharacterSpells({ summary, classId: 'bard', spells, prepared: ['fireball'] }), /unzulässige/);
  assert.throws(() => validateCharacterSpells({ summary, classId: 'bard', spells,
    prepared: [opts.prepared[0].index, opts.prepared[0].index] }), /Duplikate/);
  assert.throws(() => validateCharacterSpells({ summary, classId: 'bard', spells,
    cantrips: opts.cantrips.slice(0, opts.cantripLimit + 1).map(spell => spell.index) }), /Grenze/);
  assert.throws(() => validateCharacterSpells({ summary, classId: 'bard', spells, prepared: ['__unknown__'] }), /unzulässige/);
});

test('Edras-Sperren sind ausschließlich im Weltprofil aktiv', async () => {
  const [classes, levels, spells] = await Promise.all([
    loadCategory('classes'), loadCategory('levels'), loadCategory('spells'),
  ]);
  const wizard = classes.find(entry => entry.index === 'wizard');
  const summary = getClassLevelSummary(levels, wizard, 20, { int: 20 });
  const normal = getClassSpellChoices(summary, 'wizard', spells);
  const edras = getClassSpellChoices(summary, 'wizard', spells, EDRAS_FORBIDDEN_SPELLS);
  for (const id of ['clone', 'wish', 'plane-shift', 'gate', 'teleport', 'teleportation-circle']) {
    assert.ok(normal.prepared.some(spell => spell.index === id), `${id} fehlt im allgemeinen SRD`);
    assert.ok(!edras.prepared.some(spell => spell.index === id), `${id} muss für Edras gesperrt bleiben`);
    assert.throws(() => validateCharacterSpells({ summary, classId: 'wizard', spells,
      prepared: [id], excludedIds: EDRAS_FORBIDDEN_SPELLS }), /unzulässige/);
  }
  assert.ok(edras.prepared.some(spell => spell.index === 'divination'), 'Erkenntniszauber nur in ihrer Wirkung begrenzen');
  assert.equal(makeEdrasState({ level: 20, constitution: 14, potential: 4, techniqueId: 'W' }).potential, 4);
});

test('Magier-Zauberbuch: 6 Startzauber und 2 pro Folgestufe, Vorbereitungen nur daraus', async () => {
  const [classes, levels, spells] = await Promise.all([
    loadCategory('classes'), loadCategory('levels'), loadCategory('spells'),
  ]);
  const wizard = classes.find(entry => entry.index === 'wizard');
  for (const level of [1, 3, 8, 11, 20]) {
    const summary = getClassLevelSummary(levels, wizard, level, { int: 18 });
    const options = getClassSpellChoices(summary, 'wizard', spells);
    const minimum = 6 + 2 * (level - 1);
    const spellbook = options.prepared.slice(0, minimum).map(spell => spell.index);
    const prepared = spellbook.slice(0, options.preparedLimit);
    const valid = validateCharacterSpells({ summary, classId: 'wizard', classLevel: level,
      spells, spellbook, prepared });
    assert.equal(valid.missingSpellbook, 0);
    assert.equal(validateCharacterSpells({ summary, classId: 'wizard', classLevel: level,
      spells, spellbook: spellbook.slice(0, -1), prepared: [] }).missingSpellbook, 1);
    const outside = options.prepared.find(spell => !spellbook.includes(spell.index));
    assert.throws(() => validateCharacterSpells({ summary, classId: 'wizard', classLevel: level,
      spells, spellbook, prepared: [outside.index] }), /Zauberbuch/);
  }
});

test('Edras sperrt jede tatsächlich verfügbare explizite Wiederbelebung für alle Zauberklassen', async () => {
  const [classes, levels, spells] = await Promise.all([
    loadCategory('classes'), loadCategory('levels'), loadCategory('spells'),
  ]);
  assert.ok(['revivify', 'raise-dead', 'resurrection', 'true-resurrection', 'clone']
    .every(id => EDRAS_FORBIDDEN_SPELLS.includes(id)));
  for (const cls of classes) {
    const choices = getClassSpellChoices(getClassLevelSummary(levels, cls, 20), cls.index, spells, EDRAS_FORBIDDEN_SPELLS);
    assert.ok(choices.prepared.every(spell => !EDRAS_FORBIDDEN_SPELLS.includes(spell.index)));
  }
});

test('Gewählte Zauber werden zusammen mit der Figur gespeichert und exportiert', () => {
  const saved = emptyGame();
  saved.characters.push({ id: 'w1', level: 8, name: 'Mira', profile: {
    ruleset: 'srd-5.2.1', classId: 'wizard', spells: {
      cantrips: ['mage-hand'], prepared: ['shield', 'magic-missile'], spellbook: ['shield', 'magic-missile'],
      discoveries: [], mastery: ['', ''], secrets: [], signature: [], arcanum: ['', '', '', ''],
    },
  } });
  const content = new Map([[SAVE_KEY, JSON.stringify(saved)]]);
  const storage = { getItem: key => content.get(key), setItem: (key, value) => content.set(key, value) };
  const loaded = readGame(storage);
  assert.deepEqual(loaded.characters[0].profile.spells, saved.characters[0].profile.spells);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded)), loaded);
});

test('Zauber-Auswahl ist nur im Charakterlabor vorhanden, kein zusätzlicher UI-/Backend-Stack', async () => {
  const html = await readFile(new URL('../studio.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  assert.match(html, /id="character-spell-options"/);
  assert.match(html, /id="character-spell-search"/);
  assert.match(script, /validateClassSpellSource/);
  assert.match(script, /selectedSpellExclusions/);
});
