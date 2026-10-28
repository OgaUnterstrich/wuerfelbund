# B01 · Lokales Speichern, Ladepfade und reproduzierbare Prüfungen

Stand: 26.10.2026 · **Code umgesetzt; Browser-End-to-End-Abnahme offen.** Daher B01 nach den Roadmap-Gates **noch nicht als vollständig abgenommen** bezeichnen.

## Tatsächlich umgesetzt

1. **Eine Speicherprüfung für beide Oberflächen:** `inspectGameStorage()` unterscheidet leeren, lesbaren, beschädigten und gesperrten lokalen Speicher. `saveGame()` schreibt nur überprüfte Spielstände und weigert sich, bereits beschädigte Rohdaten still zu überschreiben.
2. **Hauptseite:** Ein dauerhaft sichtbarer Hinweis benennt Datenprobleme. Gescheiterte Schreibvorgänge führen die In-Memory-Änderung auf den letzten erfolgreich geladenen/gespeicherten Stand zurück. Erfolgsmeldungen bei Charakter-/Chronik-/Kampagnen-/Initiativbearbeitung erscheinen nur nach erfolgreichem Speichern.
3. **Rettung vor Zurücksetzen:** Bei beschädigtem gespeicherten JSON exportiert der normale Exportknopf **die unveränderten Rohdaten unter eindeutigem Dateinamen**, nicht einen irreführenden leeren Spielstand. Erneuter Import und explizites Zurücksetzen bleiben als bewusste Rettungswege bestehen.
4. **Charakterlabor:** Die vorhandenen Stellen für TP, Rasten, Zauber, Inventar, Edras und Figurenerstellung benutzen denselben geprüften Speicherweg. Ein beständiger Hinweis warnt vor bestehender Beschädigung. Keine zweite Datenbank, keine zusätzliche Bibliothek, keine Änderung der 5.5e-Berechnungen.
5. **Statischer Smoke-Check:** Haupt-/Studio-Links auf lokale Dateien, eindeutige HTML-IDs, Syntax der Inline-Skripte, alle lokalen JS-Modulimporte, 25 SRD-JSON-Kategorien und Modul-Ladeverhalten (503 → erneuter Versuch) sind mit Node reproduzierbar prüfbar.

## Testergebnisse

| Testblock | Ergebnis | Nachweis |
| --- | --- | --- |
| Stufe-8-Profil erstellen, speichern, nach erneutem Laden bearbeiten | **BESTANDEN – simulierte Browserspeicherung** | `tests/storage-safety.test.mjs` |
| 5.5e-Profile + Inventar + Edras, JSON-Roundtrip und Rücksicherung | **BESTANDEN – Logik** | `storage-safety`, `game-import` |
| Ungültiges JSON, fremde Version, doppelter Charakter, volles Kontingent, blockierter Zugriff | **BESTANDEN – Logik** | `storage-safety`, `game-import` |
| Relative Dateien, Module, Inline-Syntax, 25 SRD-Kategorien, Retry | **BESTANDEN – statisch/Node** | `tests/site-assets.test.mjs` |
| Vollständige existierende Node-Suite nach Anpassung zweier überholter UI-Textassertionen | **BESTANDEN** | `node --test --test-reporter=dot tests/*.test.mjs` |
| Klick-, Download-, Reload- und Tastaturverhalten in tatsächlichem Desktop-/Mobilbrowser | **OFFEN – nicht ausgeführt** | Vorschau-Dienst in Container nicht verfügbar |
| Screenreader/Zoom/Screenshots nach Designguide | **OFFEN – nicht ausgeführt** | Benötigt funktionierende Browser-Vorschau |

**Wichtige Unterscheidung:** Die simulierten `localStorage`-Roundtrips sind echte Logiktests, aber **keine** Beweise für Browser-Download, native Dateiauswahl oder Firebase. Diese Tests werden intern nachgeholt, nicht an den Nutzer ausgelagert. Vorschaufehler: `sites-previewd mailbox is unavailable ... /tmp/sites-previewd/requests`.

## Verbindliches internes Browser-Smoke-Szenario für spätere Umgebung

1. Frischen Browserkontext öffnen; lokal eine Stufe-8-Figur aus dem Studio speichern und den Charakterbogen nach Reload kontrollieren.
2. TP/Zauberplatz ändern, Startseite und Studio wechselseitig öffnen, Stufe/Klasse/Herkunft prüfen; in zweitem Tab Änderungen nachladen.
3. Export herunterladen; Charakter bearbeiten; gültige exportierte Datei importieren; vorigen Spielstand über Rücksicherung einmalig wiederherstellen.
4. Vor dem Import fehlerhafte Datei, zu große Datei sowie Abbrechen am Bestätigungsdialog ausprobieren; die Figur darf nicht verschwinden.
5. Mit blockiertem und vollem `localStorage` Änderungen versuchen; keine falschen Erfolgsmeldungen oder überschriebenen Daten.
6. Beschädigten gespeicherten JSON-Wert setzen; Warnbanner und unveränderten Rohdaten-Export testen; erst nach bewusster Aktion zurücksetzen.
7. Studio-Katalog ohne Netzwerk-API des Datenanbieters laden; fehlenden SRD-Dateipfad simulieren und verständliche Fehlermeldung sehen.
8. Hauptfunktionen per Tastatur bedienen; Fokus nach Formularfehler, 320-px-Ansicht und 200-%-Zoom prüfen.

## Anti-Bloat und Designkontrolle

- **Keine Laufzeitabhängigkeiten**, kein weiteres Frontend-Framework, kein paralleler Speicherstand, kein neuer Cloud-/Firebase-Datenpfad.
- Neue Logik konzentriert auf bestehendes `characters.mjs`; Studio-Aufrufer ersetzt, statt kopiert. Zwei kleine Testmodule statt einer großen Browser-Abhängigkeit.
- Statischer Review nach `DESIGN_ANTI_AI_LOOK.md`: reale Charakter-/Chronik-/Würfelstatistiken, ausdrücklich markierte Zukunftsfeatures und vorhandene konsistente SVG-Symbole. Keine erfundenen Kennzahlen oder neuen dekorativen Elemente. **Auffälligkeiten für B13:** einige generische Begrüßungstexte, mehrfach wiederholte Zukunftskarten und visuelle Dichte des Studio-Formulars; keines davon wird ohne Nutzer-/Browserbeleg mit einem übergroßen Redesign beantwortet.
- Die acht Warnsignale können nur teilweise am Quelltext geprüft werden. **Sichtprüfung, Screenshots, Fokus, Layout und Kontrast bleiben offen**, werden beim nächsten verfügbaren internen Browser-Gate nachgeholt.

## Status und Folgeschritt

**B01: technischer Teil umgesetzt, Browser-Abnahme nicht möglich.** B02 (serverseitige Firestore-Rechte) kann separat vorbereitet werden. Die offenen Browsernachweise müssen vor Gate A/B15 intern vollständig abgearbeitet werden. **Keine Zwischenprüfung durch den Nutzer erforderlich.**
