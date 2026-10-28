import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cloudConnectionState, matchesSearch, searchFeedback } from '../js/rules/ux.mjs';

const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const studio = readFileSync(new URL('../studio.html', import.meta.url), 'utf8');
const editor = readFileSync(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
const homeStyle = home.slice(home.indexOf('<style>'), home.indexOf('</style>'));
const studioStyle = readFileSync(new URL('../studio.css', import.meta.url), 'utf8');

test('Zaubersuche ist akzent-, großschreibungs-, ß- und leerzeichenunabhängig', () => {
  assert.equal(matchesSearch('Große Flamme · Grad 2 · Ritual', '  grosse   FLAMME '), true);
  assert.equal(matchesSearch('Ätherische Gestalt', 'atherische'), true);
  assert.equal(matchesSearch('Straße', 'STRASSE'), true);
  assert.equal(matchesSearch('Feuerball · Grad 3', 'feuer grad 3'), true);
  assert.equal(matchesSearch('Feuerball · Grad 3', 'feuer grad 4'), false);
  assert.equal(matchesSearch('Blitz', ''), true);
  assert.equal(matchesSearch(null, 'zauber'), false);
});

test('Suchstatus zählt Treffer und festgehaltene Auswahl ohne doppelte Zählung', () => {
  assert.equal(searchFeedback({ matches: 3, total: 10 }), '3 von 10 Zaubereinträgen gefunden');
  assert.equal(searchFeedback({ matches: 0, total: 9, pinned: 2 }),
    '0 von 9 Zaubereinträgen gefunden · 2 bereits gewählt, zusätzlich sichtbar');
  for (const input of [{matches:-1,total:1},{matches:5,total:4},{matches:1,total:2,pinned:2},
    {matches:1.5,total:2},{matches:1,total:-1}]) {
    assert.throws(() => searchFeedback(input), /Ungültiger Suchstatus/);
  }
});

test('Offline- und Anmeldungstatus sind getrennt von tatsächlicher Serverbestätigung', () => {
  const offline = cloudConnectionState({ online: false, signedIn: true });
  assert.equal(offline.canTransfer, false);
  assert.match(offline.label, /Offline.*lokale Daten/);
  const loggedOut = cloudConnectionState({ online: true, signedIn: false });
  assert.equal(loggedOut.canTransfer, false);
  assert.match(loggedOut.label, /nicht angemeldet/);
  const online = cloudConnectionState({ online: true, signedIn: true });
  assert.equal(online.canTransfer, true);
  assert.match(online.label, /Serverbestätigung/);
  assert.doesNotMatch(online.label, /verbunden mit Firestore/i);
});

test('Zwei unabhängige Zaubersuchen und Live-Trefferzahlen sind vollständig verkabelt', () => {
  for (const id of ['character-spell-search', 'character-spell-search-status',
    'character-secondary-spell-search', 'character-secondary-spell-search-status',
    'character-secondary-spell-panels']) assert.match(studio, new RegExp(`id="${id}"`));
  for (const id of ['character-spell-search-status', 'character-secondary-spell-search-status']) {
    assert.match(studio, new RegExp(`id="${id}"[^>]*role="status"[^>]*aria-live="polite"`));
  }
  assert.match(editor, /\['#character-secondary-spell-search', '#character-secondary-spell-panels'/);
  assert.match(editor, /row\.hidden = !found && !checked/);
  assert.match(editor, /panel\.querySelector\('\.spell-option:not\(\[hidden\]\)'\)/);
  assert.match(editor, /delete panel\.dataset\.searchWasOpen/);
  assert.match(editor, /filterSpells\(\)/);
});

test('Tastatur-Nutzer können auf beiden Seiten Navigation überspringen und Fokus sehen', () => {
  for (const [page, name] of [[home, 'Hauptseite'], [studio, 'Regelstudio']]) {
    const markup = page.replace(/<script\b[\s\S]*?<\/script>/g, '');
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size, `${name}: doppelte HTML-ID`);
  }
  assert.match(home, /<a class="skip-link" href="#main-content">/);
  assert.match(home, /<main class="main" id="main-content" tabindex="-1">/);
  assert.match(studio, /<a class="skip-link" href="#studio-main">/);
  assert.match(studio, /<main class="layout" id="studio-main" tabindex="-1">/);
  assert.match(homeStyle, /\.skip-link:focus\{top:12px\}/);
  assert.match(studioStyle, /\.skip-link:focus\{top:12px\}/);
  assert.match(studioStyle, /:focus-visible/);
  assert.match(home, /if\(location\.hash==="#main-content"\)return/);
  assert.match(editor, /if \(fragment === 'studio-main'\) return/);
  assert.match(editor, /fragment\.startsWith\('tracker-'\)/);
  assert.match(editor, /switchTab\('characters', true\)/);
});

test('Lokaler Charakterentwurf bleibt auch bei Online-Ausfall lesbar und sicher', () => {
  assert.match(home, /#cloud-connection-status/);
  assert.match(home, /role="status" aria-live="polite">Verbindungszustand/);
  assert.match(home, /Lokale Charaktere/);
  assert.match(home, /Offline · Online-Liste nicht verfügbar/);
  assert.match(home, /Offline: Hochladen erst nach erneuter Verbindung\. Lokale Figur bleibt erhalten\./);
  assert.match(home, /Offline: Übernahme erst nach erneuter Verbindung\. Lokale Daten bleiben erhalten\./);
  assert.match(home, /window\.addEventListener\("offline", renderConnectionChange\)/);
  assert.match(home, /window\.addEventListener\("online", renderConnectionChange\)/);
});

test('Spieler- und SL-Aktionen respektieren Verbindungsstatus und Rechte', () => {
  assert.match(home, /el\("#new-online-campaign"\)\.disabled = !connection\.canTransfer/);
  assert.match(home, /el\("#join-online-campaign"\)\.disabled = !connection\.canTransfer/);
  assert.match(home, /el\("#cloud-characters-refresh"\)\.disabled = !connection\.canTransfer/);
  assert.match(home, /!local\.length \|\| navigator\.onLine === false/);
  assert.match(home, /if \(!currentCampaign \|\| !campaignIsOwner \|\| !currentUser\)/);
  assert.match(home, /Offline: Regelquellen lassen sich erst wieder mit Verbindung ändern/);
  assert.match(home, /runTransaction\(db, async transaction/);
  assert.match(home, /Quellen können nicht aktualisiert werden|zuletzt geladene Quellen/);
});

test('Charakter- und Kampagnen-Haupteinstiege bleiben unmissverständlich', () => {
  assert.match(home, /href="studio\.html#characters"[^>]*>[\s\S]*?5\.5e-Held erstellen/);
  assert.match(studio, /id="character-errors"[^>]*tabindex="-1"/);
  assert.match(editor, /box\.focus\(\{ preventScroll: true \}\)/);
  assert.match(home, /Lokale Chronik, Würfel und Initiative werden nicht synchronisiert/);
  assert.match(home, /Nur der geöffnete Cloud-Spielmodus überträgt Änderungen/);
});
