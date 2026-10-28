import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getClassLevelSummary, normalizeResourceTracker } from '../js/rules/dnd55.mjs';
import { normalizeVitals, applyVitals } from '../js/rules/vitals.mjs';
import { getCastableSpells, castSelectedSpell } from '../js/rules/casting.mjs';
import { EDRAS_FORBIDDEN_SPELLS } from '../js/rules/edras.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../data/srd-5.2.1/en/5e-SRD-${name}.json`, import.meta.url), 'utf8'));
const fixtures = Promise.all([load('Classes'), load('Levels'), load('Spells')]);
const stats = { str: 10, dex: 14, con: 16, int: 18, wis: 14, cha: 18 };
async function example(classId, level, chosen, extra = {}) {
  const [classes, levels, spellCatalog] = await fixtures;
  const classEntry = classes.find(item => item.index === classId);
  const summary = getClassLevelSummary(levels, classEntry, level, stats);
  const profile = { classId, level, attributes: stats, spells: chosen, ...extra };
  const vitalContext = { level, maxHp: 60, hitDie: classEntry.hit_die, conModifier: 3,
    untrainedArmor: false };
  const list = () => getCastableSpells({ profile, summary, spellCatalog });
  const cast = (spellId, modeId) => castSelectedSpell({ profile, summary, spellCatalog,
    vitalContext, spellId, modeId });
  return { profile, summary, spellCatalog, vitalContext, list, cast };
}

test('Zaubertricks kosten keine Plätze, normale Zauber verbrauchen nur den gewählten Platz', async () => {
  const c = await example('wizard', 8, { cantrips: ['mage-hand'], prepared: ['fireball'] });
  assert.deepEqual(c.list().find(item => item.id === 'mage-hand').modes.map(m => m.id), ['cantrip']);
  const free = c.cast('mage-hand', 'cantrip');
  assert.deepEqual(free.tracker, normalizeResourceTracker(c.summary));
  const prepared = c.list().find(item => item.id === 'fireball');
  assert.ok(prepared.modes.some(m => m.id === 'slot:3'));
  assert.ok(prepared.modes.some(m => m.id === 'slot:4'));
  assert.ok(!prepared.modes.some(m => m.id === 'slot:2'));
  const after = c.cast('fireball', 'slot:4');
  assert.equal(after.tracker.slots[4], c.summary.spellcasting.slots.find(s => s.level === 4).max - 1);
  assert.equal(after.tracker.slots[3], c.summary.spellcasting.slots.find(s => s.level === 3).max);
});

test('Keine negative Ressource, kein Zauber außerhalb gewählter oder gewährter Liste', async () => {
  const c = await example('wizard', 5, { prepared: ['fireball'] });
  assert.throws(() => c.cast('wish', 'slot:3'), /nicht gültig/);
  assert.throws(() => c.cast('fireball', 'slot:1'), /nicht gültig/);
  c.profile.tracker = { slots: { 3: 0 } };
  assert.equal(c.list().find(s => s.id === 'fireball').modes.find(m => m.id === 'slot:3').available, false);
  assert.throws(() => c.cast('fireball', 'slot:3'), /nicht gültig/);
});

test('Nur vorbereitete Rituale; Magier darf auch Ritual aus dem Zauberbuch wirken', async () => {
  const c = await example('wizard', 5, { spellbook: ['detect-magic'], prepared: [] });
  const ritual = c.list().find(item => item.id === 'detect-magic');
  assert.deepEqual(ritual.modes.map(mode => mode.id), ['ritual']);
  assert.deepEqual(c.cast('detect-magic', 'ritual').tracker, normalizeResourceTracker(c.summary));
  const cleric = await example('cleric', 5, { spellbook: ['detect-magic'] });
  assert.equal(cleric.list().some(item => item.id === 'detect-magic'), false);
});

test('Fest gewährte Unterklassenzauber erscheinen ohne doppeltes Vorbereiten', async () => {
  const c = await example('warlock', 5, {}, { subclassId: 'fiend-patron' });
  const ids = c.list().map(item => item.id);
  assert.ok(ids.includes('burning-hands'));
  assert.equal(new Set(ids).size, ids.length);
});

test('Hexenmeister-Paktplatz bleibt fest beim passenden Zaubergrad', async () => {
  const c = await example('warlock', 9, { prepared: ['hex'] });
  const modes = c.list().find(item => item.id === 'hex').modes;
  assert.deepEqual(modes.map(m => m.id), ['slot:5']);
  assert.equal(c.cast('hex', 'slot:5').tracker.slots[5], c.summary.spellcasting.slots[0].max - 1);
});

test('Mystisches Arkanum nutzt den bestätigten separaten Ressourcenzähler', async () => {
  const c = await example('warlock', 17, { arcanum: ['eyebite', 'finger-of-death', '', 'imprisonment'] });
  assert.ok(c.list().find(item => item.id === 'eyebite').modes.some(m => m.id === 'arcanum:6'));
  assert.ok(c.list().find(item => item.id === 'finger-of-death').modes.some(m => m.id === 'arcanum:7'));
  assert.ok(c.list().find(item => item.id === 'imprisonment').modes.some(m => m.id === 'arcanum:9'));
  const result = c.cast('finger-of-death', 'arcanum:7');
  assert.equal(result.tracker.resources.arcanum_7, 0);
  assert.equal(result.tracker.resources.arcanum_6, 1);
});

test('Magier Spell Mastery ist kostenlos; Signaturzauber verbrauchen Sonderressourcen', async () => {
  const c = await example('wizard', 20, { spellbook: ['magic-missile', 'misty-step', 'fireball', 'counterspell'],
    mastery: ['magic-missile', 'misty-step'],
    signature: ['fireball', 'counterspell'] });
  assert.ok(c.list().find(item => item.id === 'magic-missile').modes.some(m => m.id === 'mastery'));
  assert.ok(!c.list().find(item => item.id === 'misty-step')?.modes.some(m => m.id === 'mastery'),
    'Spell Mastery akzeptiert nur Aktionszauber');
  const cast = c.cast('counterspell', 'signature:2');
  assert.equal(cast.tracker.resources.signature_2, 0);
  assert.equal(cast.tracker.resources.signature_1, 1);
});

test('Veraltete oder manipulierte Sonderzauber öffnen keine Stufenbeschränkung', async () => {
  const wizard = await example('wizard', 9, { spellbook: ['magic-missile', 'fireball'],
    mastery: ['magic-missile'], signature: ['fireball'] });
  const list = wizard.list();
  assert.ok(!list.find(s => s.id === 'magic-missile')?.modes.some(m => m.id === 'mastery'));
  assert.ok(!list.find(s => s.id === 'fireball')?.modes.some(m => m.id === 'signature:1'));
  const lock = await example('warlock', 10, { arcanum: ['eyebite'] });
  assert.ok(!lock.list().find(s => s.id === 'eyebite')?.modes.some(m => m.id === 'arcanum:6'));
});

test('Edras-Sperren gelten auch beim tatsächlichen Wirken', async () => {
  const c = await example('cleric', 9, { prepared: ['revivify', 'cure-wounds'] });
  const world = getCastableSpells({ profile: c.profile, summary: c.summary,
    spellCatalog: c.spellCatalog, excludedIds: EDRAS_FORBIDDEN_SPELLS });
  assert.ok(world.some(item => item.id === 'cure-wounds'));
  assert.ok(!world.some(item => item.id === 'revivify'));
  assert.throws(() => castSelectedSpell({ profile: c.profile, summary: c.summary,
    spellCatalog: c.spellCatalog, excludedIds: EDRAS_FORBIDDEN_SPELLS,
    vitalContext: c.vitalContext, spellId: 'revivify', modeId: 'slot:3' }), /nicht gültig/);
});

test('Konzentrationszauber starten neue Konzentration, nichtkonzentrierende bleiben neutral', async () => {
  const c = await example('warlock', 5, { prepared: ['hex', 'counterspell'] });
  c.profile.vitals = { concentrating: true, pendingConcentrationDCs: [15, 20] };
  const changed = c.cast('hex', 'slot:3');
  assert.equal(changed.vitals.concentrating, true);
  assert.deepEqual(changed.vitals.pendingConcentrationDCs, []);
  const untouched = c.cast('counterspell', 'slot:3');
  assert.deepEqual(untouched.vitals.pendingConcentrationDCs, [15, 20]);
});

test('Zauberwirken bei 0 TP, Handlungsunfähigkeit oder ungeübter Rüstung ist gesperrt', async () => {
  const c = await example('wizard', 5, { prepared: ['fireball'] });
  c.profile.vitals = { hp: 0 };
  assert.throws(() => c.cast('fireball', 'slot:3'), /gerade keinen/);
  c.profile.vitals = { conditions: ['stunned'] };
  assert.throws(() => c.cast('fireball', 'slot:3'), /gerade keinen/);
  c.profile.vitals = {};
  assert.throws(() => castSelectedSpell({ profile: c.profile, summary: c.summary,
    spellCatalog: c.spellCatalog, vitalContext: { ...c.vitalContext, untrainedArmor: true },
    spellId: 'fireball', modeId: 'slot:3' }), /gerade keinen/);
});

test('Schaden hinterlässt ausstehende Konzentrations-SG, mehrere Treffer werden einzeln erfasst', () => {
  const context = { maxHp: 150, level: 12 };
  let state = applyVitals(context, {}, 'concentration', { active: true });
  state = applyVitals(context, state, 'damage', { amount: 11 });
  state = applyVitals(context, state, 'damage', { amount: 44 });
  assert.deepEqual(state.pendingConcentrationDCs, [10, 22]);
  const passed = applyVitals(context, state, 'concentrationSave', { success: true });
  assert.deepEqual(passed.pendingConcentrationDCs, [22]);
  const failed = applyVitals(context, passed, 'concentrationSave', { success: false });
  assert.equal(failed.concentrating, false);
  assert.deepEqual(failed.pendingConcentrationDCs, []);
});

test('Zauber, Ressourcen und Konzentrationsfolgen überstehen einen JSON-Speicherzyklus', async () => {
  const c = await example('warlock', 5, { prepared: ['hex'] });
  const first = c.cast('hex', 'slot:3');
  const saved = JSON.parse(JSON.stringify({ tracker: first.tracker, vitals: first.vitals }));
  c.profile.tracker = saved.tracker;
  c.profile.vitals = applyVitals(c.vitalContext, saved.vitals, 'temporaryHp', { amount: 8 });
  c.profile.vitals = applyVitals(c.vitalContext, c.profile.vitals, 'damage', { amount: 8 });
  assert.equal(c.profile.vitals.hp, c.vitalContext.maxHp, 'Temporäre TP fangen Treffer ab');
  assert.deepEqual(c.profile.vitals.pendingConcentrationDCs, [10], 'Trotzdem Konzentrationsprüfung');
  const reloaded = JSON.parse(JSON.stringify(c.profile));
  assert.equal(getCastableSpells({ profile: reloaded, summary: c.summary,
    spellCatalog: c.spellCatalog }).find(entry => entry.id === 'hex').modes[0].available, true);
  assert.equal(reloaded.tracker.slots[3], c.summary.spellcasting.slots[0].max - 1);
  const failed = applyVitals(c.vitalContext, reloaded.vitals, 'concentrationSave', { success: false });
  assert.equal(failed.concentrating, false);
  assert.deepEqual(failed.pendingConcentrationDCs, []);
});

test('Auf 0 TP, bei Handlungsunfähigkeit und langer Rast werden offene Konzentrationswürfe entfernt', () => {
  const context = { maxHp: 40, level: 6 };
  let state = normalizeVitals(context, { concentrating: true, pendingConcentrationDCs: [18] });
  assert.deepEqual(applyVitals(context, state, 'longRest').pendingConcentrationDCs, []);
  assert.deepEqual(applyVitals(context, state, 'condition', { id: 'incapacitated' }).pendingConcentrationDCs, []);
  assert.deepEqual(applyVitals(context, state, 'damage', { amount: 40 }).pendingConcentrationDCs, []);
  assert.throws(() => applyVitals(context, state, 'concentrationSave', { success: 1 }), /ungültiges/);
});

test('Alle 12 Klassen/20 Stufen behalten legale Zauberauswahl und getrennte Ressourcenzähler', async () => {
  const [classes, levels, spells] = await fixtures;
  let total = 0;
  for (const klass of classes) for (let level = 1; level <= 20; level++) {
    const summary = getClassLevelSummary(levels, klass, level, stats);
    const profile = { classId: klass.index, level, spells: {} };
    const available = getCastableSpells({ profile, summary, spellCatalog: spells });
    assert.equal(new Set(available.map(s => s.id)).size, available.length);
    assert.deepEqual(normalizeResourceTracker(summary, null), normalizeResourceTracker(summary));
    total++;
  }
  assert.equal(total, 240);
});

test('Casting-UI verwendet dasselbe lokale Profil und die vorhandenen SRD-Ressourcen', async () => {
  const html = await readFile(new URL('../studio.html', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  assert.match(html, /id="tracker-casting"/);
  assert.match(ui, /renderCasting\(profile, summary\)/);
  assert.match(ui, /castSelectedSpell\(/);
  assert.match(ui, /character\.profile\.tracker = result\.tracker/);
  assert.match(ui, /character\.profile\.vitals = result\.vitals/);
  assert.match(ui, /resolveConcentrationD20\(/);
});
