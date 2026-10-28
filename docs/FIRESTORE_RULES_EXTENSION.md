# Firestore-Sicherheitsregeln – verbindliche Projektfassung B02

Stand: 26.10.2026. Die bisherigen losen Konsolen-Erweiterungen sind durch **eine** vollständige, versionierte Datei abgelöst: [`../firestore.rules`](../firestore.rules). Die Emulator-Konfiguration liegt unter [`../firebase.json`](../firebase.json).

**Nicht automatisch veröffentlichen.** Die Datei ist für den geplanten Release vorbereitet. Änderungen an der produktiven Firebase-Instanz werden erst nach den internen Gates, Staging-Prüfung und ausdrücklicher Freigabe übernommen. Die Datei ist ein vollständiger künftiger Ersatz, kein Zusatzblock zum Einfügen.

## Datenpfade und Rollen

| Pfad | Erlaubte Benutzer/Aktionen | Rolle |
| --- | --- | --- |
| `campaigns/{cid}` | Eigentümer erstellen/lesen/bearbeiten, Mitglieder lesen | `ownerId` im Kampagnendokument |
| `campaigns/{cid}/members/{uid}` | Nutzer treten selbst **als `player`** bei; Eigentümer lesen/entfernen | Mitgliedsdokument, nie Nutzerindex |
| `campaigns/{cid}/blockedUsers/{uid}` | Nur Eigentümer sehen, sperren und entsperren | Sperre beendet Mitgliedszugriff sofort |
| `users/{uid}/campaigns/{cid}` | Nur Nutzer selbst lesen; Schreiben nur bei bestätigter Berechtigung | Reiner Navigationsindex |
| `users/{uid}/rulePacks/{pid}` | Nur Kontoinhaber | Private Hausregeln |
| `campaigns/{cid}/characters/{id}` | Figureneigentümer und Spielleitung; andere Spieler nicht | **B03:** expliziter Upload, Laden und ausdrücklich bestätigtes Update in der Website |
| `campaigns/{cid}/dmPrivate/{id}` | Nur Kampagneneigentümer | SL-Geheimnisse getrennt |
| Unbekannte Pfade | Kein Zugriff | Deny by default |

Die aktuelle Website erstellt Kampagne und persönlichen Besitzerindex in **einem** Firestore-Batch; beim Beitritt entstehen Mitgliedsdokument und persönlicher Spielerindex ebenfalls in **einem** Batch. Das neue Regelwerk prüft die zusammengehörigen Schreibvorgänge über `getAfter()`/`existsAfter()`, ohne eine Rollenaufwertung zu ermöglichen. Besitzer brauchen kein zusätzliches Mitgliedsdokument. Bereits vorhandene Kampagnen behalten ihr Format.

Eine unerratbare Kampagnen-ID dient weiterhin als Einladung. **Dauerhaftes Sperren:** Der Eigentümer legt `blockedUsers/{uid}` an; das unterbindet Zugriffe selbst bei noch existierender Mitgliedschaft und verhindert einen erneuten Beitritt mit demselben Link. Ein bloßes Löschen des Mitgliedsdokuments genügt nicht dauerhaft. Der Verwaltungsdialog folgt in einem späteren Mehrspieler-Batch.

Für Cloud-Figuren ist absichtlich **keine Freigabe zum Lesen fremder Spielerprofile** erteilt. Ein Dokument enthält `ownerId`, `schemaVersion: 1`, die Figur unter `character` und Zeitstempel. Spielleitung und Figurbesitzer können lesen/bearbeiten; gesperrte Spieler nicht. B03 lädt nur eigene Figuren oder als Spielleitung alle Figuren, ohne zusätzliche öffentliche Gruppenansicht. Edras-Seed-/Plotdaten gehören nur in SL-private Dokumente, nicht in gewöhnliche Charakterprofile.

**B04-Ergänzung ohne Schemawechsel:** Figurendokumente dürfen zusätzlich `recentActionIds` enthalten (maximal 24 Einträge); alte Figuren ohne diese Liste bleiben gültig. Eine Browser-Spielaktion liest und aktualisiert dasselbe Dokument in einer Firestore-Transaktion; ein wiederholter Aufruf mit einer in der Liste vorhandenen ID verbucht nichts erneut. IDs dienen ausschließlich der **begrenzten Idempotenz**, nicht der Zugangskontrolle oder einer lückenlosen Revision. Die Regeln sperren weiterhin Außenstehende und gesperrte Mitglieder, prüfen aber nicht die regeltechnische Korrektheit jedes verschachtelten TP-/LE-Werts. Besitzer und SL können durch Rohdatenänderungen weiterhin eigene Werte manipulieren; die Cloud-Aktionen sind für kooperative Kampagnen gedacht, keine serverseitig unangreifbare Anti-Cheat-Engine.

**B05-Regelquellen:** Kampagnen besitzen optional `rules: { base: 'srd-5.2.1', worlds: [], packs: [] }`; alte Kampagnen ohne Feld gelten als SRD-only. Nur die SL darf `worlds` (derzeit höchstens `edras-v1`) oder die bis zu sechs freigegebenen Paket-IDs ändern. Der neue Pfad `campaigns/{cid}/rulePacks/{packId}` enthält ausdrücklich veröffentlichte Kopien persönlicher Hausregeln: `schemaVersion`, `id`, `version`, `name`, `abilities`, `source: 'homebrew'`, `license: 'author-confirmed'`, `publisherId`, `updatedAt`. Nur die SL darf veröffentlichen oder auf eine **höhere** Versionsnummer aktualisieren; Mitglieder dürfen gezielt lesen, die SL auch gelistete (inaktive) Pakete verwalten. Löschen ist gesperrt, deaktivieren geschieht über `rules.packs`.

Neue bzw. erstmals angehängte Quellenfelder (`profile.edras`, `profile.sourceRefs.worlds`, `profile.sourceRefs.packs`) werden serverseitig gegen die Kampagneneinstellungen begrenzt. Nach Abschaltung dürfen alte Figuren die betroffenen Quellenwerte unverändert behalten; neue Inkompatibilitäten blockiert der Client mit dem gemeinsamen Resolver, statt Figuren still umzuschreiben. **Grenze:** Firestore validiert nicht jede Regelwirkung oder die Urheberschaft. `author-confirmed` ist eine dokumentierte ausdrückliche Erklärung der veröffentlichenden Spielleitung, keine automatische Rechteprüfung. Der Quellresolver lehnt unbekannte oder inkonsistente Pakete vor Anwendung ab. Echte Live-/Staging-Berechtigungen bleiben vor dem öffentlichen Release zu prüfen.

## Isoliert im Emulator prüfen

Die produktive Website benötigt keine npm-Abhängigkeiten. Nur die Entwicklung nutzt die offiziellen, gepinnten Firebase-Tools aus `package.json`:

```sh
npm ci
npm run test:firestore
```

Der Testbefehl verwendet ausschließlich das lokale Demo-Projekt `demo-wuerfelbund`, nie die echte Firebase-Datenbank. Die Testdatei [`tests/firestore-security.emulator.mjs`](../tests/firestore-security.emulator.mjs) prüft anonym, Besitzer, zwei Spieler und Fremdkonto sowie zulässige/verbotene get/list/create/update/delete, Rollenfälschungen, Trennung, Ausschluss, erneuten Beitritt, Privatdaten und Profilwahrung. In der aktuellen Containerumgebung mit Java 17 braucht der Aufruf zusätzlich `LD_LIBRARY_PATH=/usr/lib/jvm/java-17-openjdk-amd64/lib`.

Firestore-Regeln sind **keine** Query-Filter: Für Spielerlisten ist ein `where('ownerId', '==', uid)` notwendig; die SL darf vollständige Kampagnenlisten abfragen.

**Vor Live bleibt Staging Pflicht.** Der Emulator-Erfolg beweist nicht, dass die aktive Firebase-Konsole dieselben Regeln besitzt. Nutzer haben bis zum großen abschließenden Nutzertest keine Installations-/Testpflicht.

Quellen: [Firebase: `getAfter`](https://firebase.google.com/docs/firestore/security/rules-conditions), [Rules-Emulator](https://firebase.google.com/docs/firestore/security/test-rules-emulator), [Abfragen](https://firebase.google.com/docs/firestore/security/rules-query).
