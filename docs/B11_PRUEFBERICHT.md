# B11 · v0.39 – Charakterbogen und Wartbarkeit

Stand: 27.10.2026 · **Code implementiert, Node-Tests bestanden. Gate B (echter Browser) offen. Keine Live-Veröffentlichung.**

## Ergebnis

- Charakterlabor hat **zwei echte Ansichten**: „Erstellen & steigern“ und „Im Spiel“. Der Spieler kann ohne Datenduplikat wechseln. Erfolgreiches Speichern schaltet in den Spielmodus, „Figur bearbeiten“ führt wieder zum Formular mit dem gewählten Profil.
- **Spielbogen-Lesemodell** `js/rules/character-sheet.mjs`: 2024-SRD-Klassenstufen, Attribute, Trainingsbonus, sechs Rettungen, 18 Fertigkeiten, passive Wahrnehmung, TP, RK, Initiative, Zauberangriffsboni/SG je Klasse, Herkunftstalente, Speziesmerkmale und Klassenwahl-/Merkmalquellen. Die bestehenden Berechnungen in `dnd55.mjs`, `character-actions.mjs`, `origins.mjs`, `class-decisions.mjs` und `casting.mjs` bleiben die einzige Regellogik.
- **Anzeige** `js/studio/character-sheet.mjs`: DOM-Knoten mit `textContent` statt dynamischem HTML. Auf der Spielansicht zuerst die entscheidenden Kennzahlen, darunter aufklappbare Attribute/Fertigkeiten und SRD-Merkmaltexte. Ressourcen, W20-Auswahl, Zauber, Inventar, Rasten und Edras verbleiben am alten Speicher-/Trackerweg. Eine defekte optionale Spielbogenableitung blendet **nicht** den kompletten Ressourcenbereich aus.
- Vorhandene grün/goldene Formensprache und native Details-/Button-Elemente verwendet. Neue Aktionstasten mindestens 44 px; 650- und 370-px-Reflow; sichtbare Tastatur-Fokusmarkierung. Keine neue Laufzeitabhängigkeit, kein neues Speicherformat.

## Automatische Prüfungen

| Fall | Status |
| --- | --- |
| Gesamte Node-Suite nach gemeinsamer UI-/W20-Veränderung | **295/295 bestanden, 0 Fehler** |
| Kämpfer, Magier, Paladin – Stufe 1/8/20: TP, RK, Bewegung, Training, Rettungen, Initiative, Zauber-SG | Bestanden |
| Alle 12 SRD-Klassen – Stufe 1/8/20 = 36 weitere Bogenableitungen | Bestanden |
| Mehrklassenfigur Magier/Paladin/Kämpfer: 2/4/2 Klassenstufen, zwei Zauberquellen, nur Startrettungen | Bestanden |
| TP-Schaden, Erschöpfung und passive Wahrnehmung; JSON-Roundtrip | Bestanden (Regel-/Speichermodell) |
| Edras an/aus: keine Änderung an D&D-Rettungen/TP; Hintergrundwechsel entfernt Alert | Bestanden |
| Falsches Regelwerk, unbekannte Klasse, kaputte Chronik | Sicher abgewiesen |
| Statische UI-IDs, Umschalt- und Speichern/Bearbeiten-Verdrahtung, Modulsyntax | Bestanden (kein Browser-E2E) |
| Echte Browserklicks, mobile 320 px, Zoom 200 %, Tastaturrundgang, Screenshot-/Screenreader-Abnahme | **OFFEN**: `sites-preview start` scheitert mit fehlender `sites-previewd`-Mailbox |

**Achtung:** `node:test` und Quellprüfung ersetzen **keine** tatsächliche Browserbedienung. Insbesondere Scroll-/Fokusverhalten nach Speichern, responsiver Umbruch, Cloud-Übernahme und visuelle Dichte sind im Endbrowser noch nicht abgenommen. Diese Tests sind für B13/B15 vorgesehen; bei fehlendem realem Browser bis dahin bleibt Release blockiert.

## Anti-Bloat und Anti-KI-Look

1. Zweck/Hierarchie: konkrete Hauptansichten und Trefferpunkte zuerst – aus Code überprüfbar.
2. Kartenwiederholungen: nur sechs gleichartige Kennzahlfelder, weil sie tatsächlich vergleichbar sind; Fertigkeiten/Rettungen kompakte Zeilen – unauffällig im Code.
3. Dekor: keine neuen Glows, Animationen oder Farbverläufe – unauffällig.
4. Symbole: keine neuen Dekor-Emojis oder zufälligen Iconsets – unauffällig.
5. Typografie: bestehende Schrift, Gewichte und Goldakzent; tatsächliche Lesbarkeit am Gerät offen.
6. Bilder: keine künstlichen/generierten Bilder – unauffällig.
7. Daten/Ehrlichkeit: keine Platzhalterwerte; unvollständige Wahlen und manuelle SL-Grenzen als Hinweise. Beispielwerte nur in Tests – unauffällig.
8. Aufgabenfluss: echte Schalter, native Steuerelemente, semantische Labels; 320-px-/Zoom-/Tastaturtest **noch offen**.

Kein zweiter Fertigkeits-, Zauber-, TP- oder Klassentabellen-Kern: Das neue Modul ist nur ein Lesemodell; die UI-Anzeige verändert keine gespeicherten Werte. Es wurden drei alte statische Tests angepasst, weil dieselben Methoden nun ein gemeinsames Bogenmodell verwenden. Die Laufzeitanwendung lädt für textliche Merkmalsquellen zusätzlich die **bereits vorhandene** SRD-Features-Kategorie (232 Datensätze, keine neue Datenquelle).

## Noch nicht für v1 abgenommen

- **Gate B:** echte Erstellen→Spielen→Würfeln→Rast→Wiederöffnen-Aufgabe einschließlich Mobil/Zoom, Tastatur, Screenreader-Stichprobe. Der Browser-Nachweis ist verbindlich, nicht bloß empfohlen.
- **Regelgrenze:** Verschachtelte, situative Klassenmerkmale (z. B. Vorteil, Zielwahl, Ausrüstungseffekte) werden als SRD-Text sichtbar, **nicht pauschal automatisch** eingerechnet. Fehlende Pflichtentscheidungen sind als Warnung kenntlich und im Erstellen-Formular auswählbar; Vollständigkeit der SRD-Pflichtwahlen bleibt bis Gate B fachlich zu bestätigen.
- **Sprache:** Originale SRD-Merkmaltexte bleiben in der gepinnten englischen Datenfassung. Öffentliche deutsche Lokalisierung ohne Bedeutungsverschiebung ist B13.
- Firestore-Regeln und Cloud-Transaktionen **nicht verändert**. Alte bestandene Emulatorprüfungen wurden daher nicht mechanisch als neuer Nachweis wiederholt. Mehrkontonachweis weiterhin B15.

**Danach 5 Batches: B12 Edras, B13 UX/Lokalisierung, B14 Betrieb/Sicherheit, B15 interne Gesamtprüfung, B16 einmaliger Nutzer-Abnahmetest.**
