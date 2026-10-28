# B09 · v0.37 – Zauberwahl und Mehrklassen-Casting

Stand: 27.10.2026. **Größerer Codeblock umgesetzt, 273 Node-Tests grün; Browser-Endabnahme offen. Kein Deployment.**

## Implementiert

- Im Charakterlabor gibt es bei einem Mehrklassenprofil einen **einklappbaren Zauberbereich je weiterer tatsächlich gewählter Zauberklasse**, mit eigenem Level und eigener Unterklasse. Zaubertricks, Vorbereitungen, Magierbuch, Magical Secrets/Discoveries, Spell Mastery, Signaturzauber und Mystisches Arkanum werden über die vorhandenen SRD-Auswahlfunktionen aufgebaut.
- Die Wahl wird in **demselben Charakterprofil** als `spellsByClass` gespeichert und bei Wiederbearbeitung rekonstruiert. Primärklasse und alte Einzelklassenprofile verwenden weiterhin `spells`. Unvollständige oder regelwidrige Sekundärwahlen blockieren die Speicherung mit einem Feldhinweis.
- Die bestehende Casting-Funktion kombiniert erlaubte Zauber aller Klassen, prüft importierte Zweitklassenwahlen bei lokalen Wirkaktionen nochmals gegen Klassenstufe und SRD-Daten, nutzt gemeinsame reguläre Zauberplätze und hält Paktplätze/Arkana/Signaturzauber getrennt. Ritualzauber aus einem Zweitklassen-Magierbuch benötigen keinen Slot.
- Die W20-Auswahl nennt **Zauberangriff und Zauber-SG je wirklicher Klasse** einschließlich des Übungsbonus der Gesamtstufe – nicht einen einzigen falschen Mehrklassen-Zauberangriff.
- Wirkzeit, V/S/M-Komponenten, Materialbeschreibung und Dauer sind angezeigt. Vor einer materiellen oder reagierenden Wirkart wird die manuelle Bestätigung **vor dem Abbuchen** eingeholt. Ein zusätzlicher Schadenswurf-Button verwendet `rollDice` ausschließlich für **genau im gepinnten SRD strukturierte** Formeln; höhere Plätze, hochskalierte Zaubertricks, Zielwirkungen und unstrukturierte Heilung werden nicht falsch automatisiert.
- Edras-Zaubersperren bleiben auch für zweite Klassen und bei tatsächlicher Zauberanwendung gültig. Fehlerhafte importierte Zauberauswahl macht **nicht** die übrigen TP-/Inventar-/Ressourcenpaneele unbedienbar.

## Tatsächlich durchgeführte Tests

| Prüfpunkt | Ergebnis |
| --- | --- |
| `node --test --test-reporter=dot tests/*.test.mjs` | **273/273 bestanden**, 0 Fehlschläge |
| Cleric 9 / Wizard 1 | Kein frühzeitiger Fireball; legaler Grad-1-Magierzauber über vorhandenen Grad-5-Platz; richtiger Abzug |
| Fighter / Wizard | Rituale aus Zweitklassen-Zauberbuch; kein Verbrauch von Slots |
| Cleric / Warlock | Gemeinsame Slots und Paktplätze einzeln verwendbar, korrektes Kurze-Rast-Verhalten |
| Fighter / Warlock 10–11 | Mystisches Arkanum nur nach **Warlock-Klassenstufe**, separate Ressource |
| Fighter / Bard 10 | Magical Secrets einer Zweitklasse; illegale Fremd-/Zukunftszauber abgewiesen |
| 11 mögliche weitere Klassen × 4 Randstufen | **44 Prüfkombinationen**, eindeutige Klassenquellen und keine Casting-Abstürze |
| Profile / Manipulation | Doppelte/fremde Quellschlüssel, gefälschte Listen und unmögliche Zauberbuchgrade abgewiesen |
| Edras | Verbotene Wiederbelebung auch aus Sekundärklasse nicht wirkbar; normale Welt unverändert |
| Schadenswürfel | Fireball Grad 3 exakt `8d6`; höhere Platzgrade, Stufe-5-Cantrip und Heilung nicht als sichere Formel ausgegeben |
| UI-Syntax und Verdrahtung | Vorhandene DOM-IDs/Imports und Speicher-/Restorepfad durch Tests geprüft; kein echter Klicktest |
| Desktop-/Mobilbrowser, Tastatur, Screenreader, reale Cloud-Zwei-Konto-Aktionen | **OFFEN** – im aktuellen Container nicht ausführbar; internes Release-Gate B15 |

Bereits bestandene Firestore-Emulator-Sicherheitsfälle wurden **nicht nochmals als neue Prüfung ausgegeben**, denn an Firestore-Regeln und Cloud-Aktionsverfahren wurde hier nichts geändert.

## Anti-Bloat, Wartbarkeit und Design

- **Keine** neuen Laufzeitabhängigkeiten, Datenquellen, Firestore-Kollektionen, Cloud-Deployments oder getrennte Zauberressourcen-Speicher. Die gespeicherte Zusatzauswahl ist ein Feld desselben Profils.
- Der vorhandene `dnd55.mjs`-Adapter bleibt für Klassenstufengrenzen und Sonderzauber zuständig. `casting.mjs` verbindet nur diese Quellen und validiert vor Verbrauch.
- Vorhandene Formularklassen und ein natives `<details>` vermeiden eine neue Komponenten-/Kartenbibliothek. Keine dekorativen Glows, zufälligen Icons, erfundenen Zahlen oder Scheinbuttons.
- Laut [Anti-KI-Look-Guide](DESIGN_ANTI_AI_LOOK.md) ist die Darstellung im Code konsistent mit der vorhandenen UI; **keine Behauptung einer visuellen Vollprüfung** ohne Browser-Screenshots. Auf Mobilbreite, 200-%-Zoom, 320 px, Tastaturfluss und echte Nutzbarkeit erst im B15-Gesamtdurchlauf abnehmen.

## Bewusst offene D&D-Punkte

1. Die **chronologische Historie des Erlernens/Austauschens** einzelner Zauber und das **Abschreiben ins Zauberbuch** mit Zeit-/Goldkosten sind noch keine eigene beweisbare Simulation. Die aktuelle Wahl wird nach erreichtem Klassenlevel streng geprüft; frühere Level-Entscheidungen bleiben manuell zu plausibilisieren.
2. **Konkrete** Komponentenverfügbarkeit, Konzentrations-/Reaktionsumstände, ein Zauberplatz pro Zug, Gegnerrettungswürfe, Ziele, Schadensboni und Heal-/Upcast-Skalierung sind situativ und werden nicht erfunden. Einige Wirkarten benötigen zuerst ergänzende SRD-Strukturdaten, bevor sichere Automatik möglich ist.
3. Browser-/Mehrkonto-End-to-End-Test fehlt. Die neuen Funktionen bleiben bis zu diesem Nachweis ein **intern getesteter Codeblock**, nicht eine geprüfte Live-Version.

**Folgeplanung: 7 Batches B10–B16. B15 = großer interner Abschlusstest; kein Nutzer-Zwischentest und keine vorzeitige Veröffentlichung.**
