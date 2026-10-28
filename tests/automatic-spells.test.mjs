import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCategory } from '../js/rules/catalog.mjs';
import { LAND_CHOICES, getAutomaticSpells, getClassLevelSummary, getClassSpellChoices } from '../js/rules/dnd55.mjs';
import { EDRAS_FORBIDDEN_SPELLS } from '../js/rules/edras.mjs';

globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')) });

test('2024-SRD: jede unterstützte Klasse/Unterklasse auf allen 20 Stufen besitzt gültige automatische Zauber', async () => {
  const [classes, subclasses, spells] = await Promise.all([
    loadCategory('classes'), loadCategory('subclasses'), loadCategory('spells'),
  ]);
  let cases = 0;
  for (const entry of classes) {
    for (let level = 1; level <= 20; level++) {
      const results = [getAutomaticSpells({ classId: entry.index, level, spells })];
      for (const subclass of subclasses.filter(item => item.class.index === entry.index)) {
        if (level < 3) continue;
        const lands = subclass.index === 'circle-of-the-land' ? LAND_CHOICES : [''];
        for (const land of lands) results.push(getAutomaticSpells({
          classId: entry.index, subclassId: subclass.index, level, spells, land,
        }));
      }
      for (const { granted, blocked } of results) {
        assert.equal(blocked.length, 0, 'Ohne Weltprofil darf das SRD nichts blockieren');
        assert.ok(granted.every(gift => spells.some(spell => spell.index === gift.id)));
        assert.equal(new Set(granted.map(gift => gift.id)).size, granted.length);
        assert.ok(granted.every(gift => gift.unlockedAt <= level));
        cases++;
      }
    }
  }
  assert.ok(cases > 450);
});

test('2024-Klassenmerkmale gewähren Zauber ab dem korrekten Level ohne Vorbereitungslimit', async () => {
  const spells = await loadCategory('spells');
  const ids = info => info.granted.map(item => item.id);
  assert.deepEqual(ids(getAutomaticSpells({ classId: 'druid', level: 1, spells })), ['speak-with-animals']);
  assert.deepEqual(ids(getAutomaticSpells({ classId: 'ranger', level: 1, spells })), ['hunters-mark']);
  assert.deepEqual(ids(getAutomaticSpells({ classId: 'paladin', level: 1, spells })), []);
  assert.deepEqual(ids(getAutomaticSpells({ classId: 'paladin', level: 2, spells })), ['divine-smite']);
  const life3 = getAutomaticSpells({ classId: 'cleric', subclassId: 'life-domain', level: 3, spells });
  assert.deepEqual(ids(life3), ['aid', 'bless', 'cure-wounds', 'lesser-restoration']);
  assert.equal(getAutomaticSpells({ classId: 'cleric', subclassId: 'life-domain', level: 5, spells }).granted.length, 6);
  assert.equal(getAutomaticSpells({ classId: 'cleric', subclassId: 'life-domain', level: 20, spells }).granted.length, 10);
});

test('Edras: automatisch gewährte verbotene Wiederbelebung ist sichtbar blockiert', async () => {
  const spells = await loadCategory('spells');
  const result = getAutomaticSpells({ classId: 'cleric', subclassId: 'life-domain', level: 5,
    spells, excludedIds: EDRAS_FORBIDDEN_SPELLS });
  assert.equal(result.granted.length, 5);
  assert.deepEqual(result.blocked.map(item => item.id), ['revivify']);
  assert.ok(result.granted.some(item => item.id === 'bless'));
  const plain = getAutomaticSpells({ classId: 'cleric', subclassId: 'life-domain', level: 5, spells });
  assert.ok(plain.granted.some(item => item.id === 'revivify'));
});

test('Zirkel des Landes: vier echte Varianten, fehlende Wahl wird als offen markiert', async () => {
  const spells = await loadCategory('spells');
  const base = { classId: 'druid', subclassId: 'circle-of-the-land', level: 9, spells };
  const pending = getAutomaticSpells(base);
  assert.ok(pending.pending.some(entry => entry.includes('Gelände')));
  assert.deepEqual(LAND_CHOICES, ['arid', 'polar', 'temperate', 'tropical']);
  const arid = getAutomaticSpells({ ...base, land: 'arid' });
  const polar = getAutomaticSpells({ ...base, land: 'polar' });
  assert.ok(arid.granted.some(spell => spell.id === 'fire-bolt' && spell.level === 0));
  assert.ok(arid.granted.some(spell => spell.id === 'wall-of-stone'));
  assert.ok(polar.granted.some(spell => spell.id === 'cone-of-cold'));
  assert.ok(!polar.granted.some(spell => spell.id === 'fire-bolt'));
});

test('Nicht automatisch umgesetzte Wahlmerkmale bleiben erkennbar offen', async () => {
  const spells = await loadCategory('spells');
  const bard = getAutomaticSpells({ classId: 'bard', subclassId: 'college-of-lore', level: 6, spells });
  assert.ok(bard.pending.some(entry => entry.includes('Magical Discoveries')));
  const wizard = getAutomaticSpells({ classId: 'wizard', subclassId: 'evoker', level: 18, spells });
  assert.ok(wizard.pending.some(entry => entry.includes('Spell Mastery')));
  assert.throws(() => getAutomaticSpells({ classId: 'bard', level: 21, spells }));
});

test('Zusatzzauber belegen keine Vorbereitungsplätze – alle Klassenstufen bleiben auswählbar', async () => {
  const [classes, subclasses, levels, spells] = await Promise.all([
    loadCategory('classes'), loadCategory('subclasses'), loadCategory('levels'), loadCategory('spells'),
  ]);
  for (const cls of classes) {
    for (let level = 1; level <= 20; level++) {
      const summary = getClassLevelSummary(levels, cls, level);
      const sub = level >= 3 ? subclasses.find(entry => entry.class.index === cls.index) : null;
      const variants = sub?.index === 'circle-of-the-land' ? LAND_CHOICES : [''];
      for (const land of variants) {
        const auto = getAutomaticSpells({ classId: cls.index, subclassId: sub?.index, level, spells, land });
        const choices = getClassSpellChoices(summary, cls.index, spells, auto.granted.map(entry => entry.id));
        assert.ok(choices.cantrips.length >= choices.cantripLimit, `${cls.index}/${level}: Tricks fehlen`);
        assert.ok(choices.prepared.length >= choices.preparedLimit, `${cls.index}/${level}: normale Vorbereitungen fehlen`);
        assert.ok([...choices.cantrips, ...choices.prepared].every(spell => !auto.granted.some(gift => gift.id === spell.index)),
          `${cls.index}/${level}: freier Zauber steht fälschlich zur Wahl`);
      }
    }
  }
});
