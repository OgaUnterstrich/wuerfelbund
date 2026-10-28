import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Beide Homepage-Module bleiben syntaktisch gültig', () => {
  const scripts = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 2);
  for (const match of scripts) {
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--input-type=module', '--check'],
      { input: match[1], encoding: 'utf8' }));
  }
});

test('Cloud-Bereich verbindet Kampagnenwahl, zwei Listen und explizite Aktionen', () => {
  for (const id of ['cloud-characters', 'cloud-character-heading', 'cloud-character-role',
    'cloud-characters-refresh', 'cloud-local-characters', 'cloud-remote-characters']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /data-cloud=\\?"upload-character/);
  assert.match(html, /data-cloud=\\?"download-character/);
  assert.match(html, /runTransaction\(db, async transaction/);
  assert.match(html, /transaction\.get\(reference\)/);
  assert.match(html, /prior\.updatedAt\?\.isEqual/);
  assert.match(html, /where\("ownerId", "==", uid\)/);
  assert.match(html, /saveImportedGame\(next, localStorage\)/);
});

test('Abmelden trennt die Cloud-Ansicht; lokaler Spielstand bleibt separat', () => {
  assert.match(html, /clearCloudSelection\(\); knownCampaigns = \[\]/);
  assert.match(html, /el\("#cloud-characters"\)\.hidden = true/);
  assert.match(html, /window\.dispatchEvent\(new CustomEvent\("wuerfelbund:local-updated"\)\)/);
  assert.match(html, /wuerfelbund:local-updated/);
  assert.match(html, /Im Cloud-Spielmodus werden TP, Klassenressourcen, Inventar und Rasten live synchronisiert/);
});

test('B04: Nur aktive Cloud-Figur abonniert, Cache-/Offline-Stand und unsichere Wiederholung blockiert', () => {
  for (const id of ['cloud-live', 'cloud-live-title', 'cloud-live-state',
    'cloud-live-content', 'cloud-live-close']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /onSnapshot\(doc\(db, "campaigns", cid, "characters", characterId\)/);
  assert.match(html, /includeMetadataChanges: true/);
  assert.match(html, /snapshot\.metadata\.fromCache \|\| snapshot\.metadata\.hasPendingWrites/);
  assert.match(html, /liveUnsubscribe\(\)/);
  assert.match(html, /liveFromCache \|\| !navigator\.onLine/);
  assert.match(html, /runTransaction\(db, async transaction => \{/);
  assert.match(html, /return commitCloudAction\(transaction, reference,/);
  assert.match(html, /operationId = retry \? liveRetry\.operationId : crypto\.randomUUID\(\)/);
  assert.match(html, /data-live="retry"/);
});

test('B05: Kampagnenquellen werden vor Upload und Spieltransaktion gegen denselben Resolver geprüft', () => {
  for (const id of ['cloud-sources-heading', 'cloud-source-status', 'cloud-source-list',
    'cloud-source-controls', 'cloud-pack-choice', 'cloud-publish-pack', 'cloud-pack-rights']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /rules: defaultCampaignRules\(\)/);
  assert.match(html, /normalizeCampaignRules\(campaign\.data\(\)\.rules\)/);
  assert.match(html, /pinCharacterSources\(character, rules, published\)/);
  assert.match(html, /resolveCampaignSources\(rules, published, character\)/);
  assert.match(html, /preparePublishedPack\(local, uid\)/);
  assert.match(html, /serverTimestamp\(\)/);
  assert.match(html, /let currentSources = null, sourceRequest = 0/);
  assert.match(html, /sourceRequest\+\+/);
});
