import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makePack } from '../js/rules/packs.mjs';
import { defaultCampaignRules, normalizeCampaignRules, preparePublishedPack,
  resolveCampaignSources, pinCharacterSources, EDRAS_SOURCE } from '../js/rules/sources.mjs';

const id = 'pack.simpleauthor01';
const source = () => ({ ...makePack('Eigene Fähigkeiten', 'simpleauthor01'), id,
  abilities: [{ schemaVersion: 1, id: 'hb.simplepower1', name: 'Schritt', description: 'Eigener Effekt.',
    activation: 'action', minLevel: 1, version: 1, resource: '', cost: 0,
    effects: [{ type: 'manual', note: 'SL entscheidet.' }] }] });
const char = () => ({ id: 'hero-1', level: 8, name: 'Test', profile: { ruleset: 'srd-5.2.1' } });

test('B05: Kampagnen standardmäßig SRD-only; fremde Regelbasis und fehlerhafte Quellen unmöglich', () => {
  assert.deepEqual(normalizeCampaignRules(), defaultCampaignRules());
  for (const settings of [{ base: 'srd-2014', worlds: [], packs: [] },
    { base: 'srd-5.2.1', worlds: ['edras-v1', 'edras-v1'], packs: [] },
    { base: 'srd-5.2.1', worlds: ['unknown'], packs: [] },
    { base: 'srd-5.2.1', worlds: [], packs: ['bad-id'] },
    { base: 'srd-5.2.1', worlds: [], packs: [id, id] },
    { base: 'srd-5.2.1', worlds: [], packs: [], script: 'steal' }]) {
    assert.throws(() => normalizeCampaignRules(settings), /ungültige Kampagnen/);
  }
});

test('B05: Eigene Hausregeln sind versionierte, explizit lizenzierte Kopien und bleiben isoliert', () => {
  const original = source();
  const published = preparePublishedPack(original, 'alice');
  assert.equal(published.license, 'author-confirmed');
  original.abilities[0].name = 'Nachträglich geändert';
  assert.equal(published.abilities[0].name, 'Schritt');
  assert.throws(() => preparePublishedPack({ ...original, source: 'unknown' }, 'alice'), /Nur eigene/);
  const invalid = { ...source(), abilities: [{ ...source().abilities[0], effects: [{ type: 'eval', code: 'danger' }] }] };
  assert.throws(() => preparePublishedPack(invalid, 'alice'), /Unbekannter Effekt/);
});

test('B05: Edras-Toggle betrifft nur die Kampagne und nie D&D-Klasse', () => {
  const edras = { ...char(), profile: { ...char().profile, classId: 'wizard', edras: { potential: 3 } } };
  assert.match(resolveCampaignSources(defaultCampaignRules(), [], edras).errors.join(' '), /Edras.*deaktiviert/);
  const enabled = { ...defaultCampaignRules(), worlds: [EDRAS_SOURCE.id] };
  const pinned = pinCharacterSources(edras, enabled);
  assert.equal(pinned.profile.classId, 'wizard');
  assert.deepEqual(pinned.profile.sourceRefs.worlds, { edras: 1 });
  assert.ok(resolveCampaignSources(enabled, [], pinned).valid);
  assert.equal(resolveCampaignSources(defaultCampaignRules(), [], pinned).valid, false);
  assert.equal(pinned.profile.edras.potential, 3);
});

test('B05: Nicht aktive Pakete gesperrt; Versionswechsel signalisiert Konflikt ohne Figur-Umschreiben', () => {
  const pack = preparePublishedPack(source(), 'alice');
  const active = { ...defaultCampaignRules(), packs: [id] };
  assert.ok(resolveCampaignSources(active, [pack]).valid);
  assert.equal(resolveCampaignSources(active, [pack]).abilities.length, 1);
  const pinned = pinCharacterSources({ ...char(), profile: { ...char().profile,
    sourceRefs: { base: 'srd-5.2.1', worlds: {}, packs: { [id]: 1 } } } }, active, [pack]);
  assert.equal(pinned.profile.sourceRefs.packs[id], 1);
  const updated = { ...pack, version: 2 };
  const mismatch = resolveCampaignSources(active, [updated], pinned);
  assert.equal(mismatch.valid, false);
  assert.match(mismatch.errors[0], /Version 1/);
  assert.deepEqual(pinned.profile.sourceRefs.packs, { [id]: 1 });
  assert.equal(resolveCampaignSources(defaultCampaignRules(), [pack], pinned).valid, false);
  assert.throws(() => pinCharacterSources(pinned, active, [updated]), /Quellenkonflikt/);
});

test('B05: Fehlende Quelle und doppelte Fähigkeit blockieren aktive Daten', () => {
  const first = preparePublishedPack(source(), 'alice');
  const other = preparePublishedPack({ ...source(), id: 'pack.anotherauthor02' }, 'alice');
  const active = { ...defaultCampaignRules(), packs: [first.id, other.id] };
  assert.match(resolveCampaignSources(active, [first]).errors.join(' '), /fehlt oder ist nicht zulässig/);
  assert.match(resolveCampaignSources(active, [first, other]).errors.join(' '), /ist doppelt/);
});
