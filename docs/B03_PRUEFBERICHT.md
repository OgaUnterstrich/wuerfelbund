# B03 · Cloud-Charaktere – Implementierung und gezielte Prüfung

Stand: 26.10.2026 · Entwicklungsstand, **nicht** live veröffentlicht. Basis B02 bleibt unverändert. Nach diesem Codebatch sind **13 Folgebatches B04–B16** geplant; B01/B03-Browsernachweise bleiben zusätzlich offen.

## Funktionaler Stand

1. Kampagne in der vorhandenen Würfelbund-Online-Lobby auswählen. Lokale und Cloud-Figuren werden nebeneinander angezeigt; die Oberfläche kennzeichnet die Nutzerrolle.
2. **Hochladen** übernimmt genau einen validierten lokalen Charakter einschließlich des bestehenden 5.5e-/Edras-`profile`. Keine automatische oder bulkweite Migration. Bereits vorhandene Cloud-Figuren erfordern eine ausdrückliche Bestätigung; ein Firestore-Transaktionsvergleich verweigert zwischenzeitliche Fremdänderungen.
3. **Lokal übernehmen** liest die aktuelle, berechtigte Cloud-Figur erneut. Bei gleicher ID wird eine ausdrückliche Ersetzungsbestätigung verlangt; `saveImportedGame` legt vor der Änderung die wiederherstellbare lokale Sicherung an. Ohne Konflikt wird der Charakter nur hinzugefügt. Ein Fehler lässt die lokale Liste unangetastet.
4. Firestore-Queries: Spieler `where('ownerId', '==', uid)`, Spielleitung vollständige Charakterliste. Andere Spieler sehen fremde private Profile nicht. Kampagnen, Besitzer und gespeicherte Inhalte bleiben getrennt.
5. Abmelden/Kontowechsel entfernt die bisherige Cloud-Ansicht und verwirft asynchrone veraltete Abfrageergebnisse. Ein zusätzlicher manueller **Aktualisieren**-Knopf lädt den jüngsten Stand.

## Tatsächlich ausgeführte Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| Firebase-Emulator: B02-Rollen-, Sperr-, Index-, Homebrew- und Charaktermatrix + B03-Tests | **15/15 bestanden** |
| Neue Cloud-Logik: Profil-Roundtrip, Zauber, Inventar, Edras, Kollisionsverbot, Rücksicherung, Grenzwerte | **5/5 bestanden** |
| Neue statische UI-Verdrahtung: zwei Inline-Module syntaxgeprüft, Aktionen/Queries/Abmeldung | **3/3 bestanden** |
| Alte direkt betroffene Speicher-/Import-/Charakter-/UX-/Website-Tests plus obige Node-Tests | **42/42 bestanden** |
| Echter Browser-Smoke: Anmeldung, Kampagnenwahl, zwei Geräte, UI-Interaktion, 320 px, Tastatur | **Offen**: `sites-preview start` scheitert an nicht vorhandenem `sites-previewd`-Mailboxpfad; keine Ersatzbehauptung |

Die bewusst verbotenen Schreibversuche im Firestore-Emulator erzeugen erwartete `PERMISSION_DENIED`-Logs. Dies sind geprüfte Negativfälle. Es wurden weder produktive Firebase-Regeln veröffentlicht noch GitHub-Inhalte verändert.

## Anti-Bloat- und Designprüfung

- **Keine** neue Laufzeitbibliothek, kein Frontend-Framework, keine neue Datenbank, keine zweite Charakterstruktur, keine separate Regelberechnung und keine automatische Schattenkopie.
- `js/rules/cloud-characters.mjs` übernimmt nur JSON-/Profilvalidierung und sicheres lokales Zusammenführen. Die vorhandene Firebase-Anmeldung und das Firestore-Clientmodul der Hauptseite werden weiterverwendet.
- Die Oberfläche nutzt bestehende Buttons, Farben und Listen; der einzige neue Bereich erscheint **nur nach Kampagnenauswahl**. Keine neuen Grafiken, Icons, erfundenen Statistiken oder leeren Werbekarten.
- Nach dem [Anti-KI-Look-Guide](DESIGN_ANTI_AI_LOOK.md) sind Warnsignale 1–7 im neuen Bereich textuell/statisch unauffällig; Punkt 8 (reale Mobil-/Tastaturbedienung) **noch offen**, weil Screenshots und Browsertests in dieser Umgebung nicht möglich waren. Keine Behauptung automatischer KI-Look-Erkennung.

## Grenzen und nächste Schritte

- Cloud-Charaktere sind bewusst **Momentaufnahmen**; lokale Bearbeitungen, Ressourcen, Würfel, Chronik und Initiative synchronisieren sich nicht selbst. B04 ergänzt autoritative Ressourcenaktionen und echtes Live-Update.
- Die SL darf vollständige Figuren lesen; Spieler nur die eigenen. Allgemein sichtbare Figuren-Kurzprofile sind ohne eigenständige Datenschutzentscheidung nicht eingeführt.
- Die Cloud benötigt die in B02 geprüften Firestore-Regeln, die noch nicht live publiziert wurden. Produktivfunktionen dürfen bis zur kontrollierten Freigabe scheitern.
- B01/B03-Browser-End-to-End bleiben offene Abnahmen. Vor dem großen internen Endtest B15 muss reproduzierbare Browserinfrastruktur bereitstehen. **Kein Nutzertest zwischen den Batches.**
