import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCategory } from '../js/rules/catalog.mjs';
import { getBardMagicalSecrets, getMysticArcanum, getSignatureSpells,
  getClassLevelSummary, getClassSpellChoices, validateCharacterSpells,
  normalizeResourceTracker, changeResourceTracker, restResourceTracker } from '../js/rules/dnd55.mjs';
import { EDRAS_FORBIDDEN_SPELLS } from '../js/rules/edras.mjs';

globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')) });
const data = async () => {
  const [classes, levelRows, spells] = await Promise.all([
    loadCategory('classes'), loadCategory('levels'), loadCategory('spells'),
  ]);
  const summary = (classId, level) => getClassLevelSummary(levelRows, classes.find(c => c.index === classId), level);
  const bard = (level, extra = {}) => getBardMagicalSecrets({ classId: 'bard', level, levelRows,
    summary: summary('bard', level), spells, ...extra });
  return { classes, levelRows, spells, summary, bard };
};

test('Bard 10+: Magical Secrets belegt reguläre Vorbereitungen und folgt realer Stufenprogression', async () => {
  const { bard, spells, summary } = await data();
  assert.equal(bard(9).maxForeign, 0);
  assert.equal(bard(10).maxForeign, 2);
  assert.equal(bard(11).maxForeign, 4);
  assert.equal(bard(12).maxForeign, 5);
  assert.equal(bard(20).maxForeign, 19);
  assert.ok(bard(10).available.some(s => s.index === 'fireball'));
  assert.ok(!bard(10).available.some(s => s.index === 'vicious-mockery'));
  assert.ok(!bard(10).available.some(s => s.index === 'meteor-swarm'));
  const picked = bard(10, { secrets: ['fireball', 'shield'] });
  assert.deepEqual(picked.chosen.map(s => s.index), ['fireball', 'shield']);
  assert.equal(picked.remainingPrepared, 13);
  const normal = getClassSpellChoices(summary('bard', 10), 'bard', spells).prepared.slice(0, 13).map(s => s.index);
  const validated = validateCharacterSpells({ summary: summary('bard', 10), classId: 'bard', classLevel: 10, spells,
    prepared: normal, secrets: ['fireball', 'shield'] });
  assert.equal(validated.missingPrepared, 0);
  assert.throws(() => bard(10, { secrets: ['fireball', 'shield'], prepared: normal.concat(['healing-word']) }), /Magical Secrets/);
  assert.throws(() => bard(9, { secrets: ['fireball'] }), /Magical Secrets/);
});

test('Bard: zu viele hochgradige Fremdzauber werden trotz ausreichender Gesamtzahl abgewiesen', async () => {
  const { bard } = await data();
  const grade9 = ['meteor-swarm', 'mass-heal', 'gate'];
  assert.equal(bard(17, { secrets: grade9.slice(0, 2) }).chosen.length, 2);
  assert.throws(() => bard(17, { secrets: grade9 }), /hochgradige/);
  assert.throws(() => bard(10, { secrets: ['fireball', 'fireball'] }), /Magical Secrets/);
  assert.throws(() => bard(10, { secrets: ['healing-word'] }), /Magical Secrets/);
});

test('Edras sperrt Wiederbelebung und Fernreisen auch in Magical Secrets', async () => {
  const { bard } = await data();
  assert.ok(bard(10).available.some(spell => spell.index === 'revivify'));
  assert.ok(!bard(10, { excludedIds: EDRAS_FORBIDDEN_SPELLS }).available.some(s => s.index === 'revivify'));
  assert.throws(() => bard(10, { secrets: ['revivify'], excludedIds: EDRAS_FORBIDDEN_SPELLS }), /Magical Secrets/);
  assert.ok(bard(13).available.some(s => s.index === 'plane-shift'));
  assert.ok(!bard(13, { excludedIds: EDRAS_FORBIDDEN_SPELLS }).available.some(s => s.index === 'plane-shift'));
});

test('Warlock 11/13/15/17: je ein Arkanum der Grade 6/7/8/9, nicht vorher', async () => {
  const { spells } = await data();
  const choices = (level, arcanum = ['', '', '', ''], excludedIds = []) => getMysticArcanum({
    classId: 'warlock', level, spells, arcanum, excludedIds,
  });
  assert.equal(choices(10).missing, 0);
  assert.equal(choices(11).missing, 1);
  assert.equal(choices(13).missing, 2);
  assert.equal(choices(15).missing, 3);
  assert.equal(choices(17).missing, 4);
  assert.deepEqual(choices(17, ['eyebite', 'finger-of-death', 'power-word-stun', 'imprisonment'])
    .chosen.map(s => s.index), ['eyebite', 'finger-of-death', 'power-word-stun', 'imprisonment']);
  assert.throws(() => choices(11, ['eyebite', 'finger-of-death', '', '']), /Mystic Arcanum/);
  assert.throws(() => choices(17, ['finger-of-death', '', '', '']), /Mystic Arcanum/);
  assert.throws(() => choices(17, ['eyebite', '', '', 'gate'], EDRAS_FORBIDDEN_SPELLS), /Mystic Arcanum/);
  assert.ok(!choices(17, undefined, EDRAS_FORBIDDEN_SPELLS).available[7].some(s => s.index === 'plane-shift'));
});

test('Wizard 20: zwei verschiedene Signaturzauber Grad 3 aus dem Buch, auch Reaktionszauber', async () => {
  const { spells } = await data();
  const input = { classId: 'wizard', level: 20, spells, spellbook: ['fireball', 'counterspell', 'shield'] };
  assert.equal(getSignatureSpells(input).missing, 2);
  assert.ok(getSignatureSpells(input).available.some(s => s.index === 'counterspell' && s.casting_time.startsWith('Reaction')));
  assert.deepEqual(getSignatureSpells({ ...input, signature: ['fireball', 'counterspell'] })
    .chosen.map(s => s.index), ['fireball', 'counterspell']);
  assert.throws(() => getSignatureSpells({ ...input, level: 19, signature: ['fireball'] }), /Signature Spells/);
  assert.throws(() => getSignatureSpells({ ...input, signature: ['fireball', 'fireball'] }), /Signature Spells/);
  assert.throws(() => getSignatureSpells({ ...input, signature: ['fireball'], prepared: ['fireball'] }), /Signature Spells/);
  assert.throws(() => getSignatureSpells({ ...input, signature: ['lightning-bolt'] }), /Signature Spells/);
});

test('Sonderressourcen: Mystisches Arkanum nur lange Rast, Signaturzauber auch kurze Rast', async () => {
  const { summary } = await data();
  const warlock = summary('warlock', 17);
  const wizard = summary('wizard', 20);
  assert.deepEqual(warlock.resources.filter(r => r.id.startsWith('arcanum_')).map(r => r.id),
    ['arcanum_6', 'arcanum_7', 'arcanum_8', 'arcanum_9']);
  assert.deepEqual(wizard.resources.filter(r => r.id.startsWith('signature_')).map(r => r.id), ['signature_1', 'signature_2']);
  const spentArcanum = changeResourceTracker(warlock, normalizeResourceTracker(warlock), 'resources', 'arcanum_6', -1);
  const spentSignature = changeResourceTracker(wizard, normalizeResourceTracker(wizard), 'resources', 'signature_1', -1);
  assert.equal(restResourceTracker(warlock, spentArcanum, 'short').resources.arcanum_6, 0);
  assert.equal(restResourceTracker(wizard, spentSignature, 'short').resources.signature_1, 1);
  assert.equal(restResourceTracker(warlock, spentArcanum, 'long').resources.arcanum_6, 1);
  assert.equal(restResourceTracker(wizard, spentSignature, 'long').resources.signature_1, 1);
});

test('Alle 12 Klassen und 20 Stufen behalten unabhängige Sonderzauber und eindeutige Ressourcen', async () => {
  const { classes, levelRows, spells, summary } = await data();
  let cases = 0;
  for (const cls of classes) {
    for (let level = 1; level <= 20; level++) {
      const opts = { classId: cls.index, level, spells };
      const spellSummary = summary(cls.index, level);
      const bard = getBardMagicalSecrets({ ...opts, levelRows, summary: spellSummary });
      const warlock = getMysticArcanum(opts);
      const wizard = getSignatureSpells(opts);
      assert.equal(bard.maxForeign > 0, cls.index === 'bard' && level >= 10);
      assert.equal(warlock.missing, cls.index === 'warlock'
        ? [[11, 6], [13, 7], [15, 8], [17, 9]].filter(([at]) => level >= at).length : 0);
      assert.equal(wizard.missing, cls.index === 'wizard' && level >= 20 ? 2 : 0);
      assert.equal(new Set(spellSummary.resources.map(resource => resource.id)).size, spellSummary.resources.length);
      assert.equal(normalizeResourceTracker(spellSummary).resources.arcanum_6 !== undefined,
        cls.index === 'warlock' && level >= 11);
      cases++;
    }
  }
  assert.equal(cases, 240);
});

test('Sonderregeln bleiben in demselben Charakterprofil und Zauber-Auswahlbereich', async () => {
  const ui = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  assert.match(ui, /getBardMagicalSecrets/);
  assert.match(ui, /getMysticArcanum/);
  assert.match(ui, /getSignatureSpells/);
  assert.match(ui, /checkCharacterSpells\(values, summary\)/);
  assert.match(ui, /makeGroup\(section, 'secrets', 'Magical Secrets'/);
  assert.match(ui, /signature\.missing/);
});
