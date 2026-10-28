# B10 · v0.38 – Kampf, Ausrüstung und magische Gegenstände

Stand: 27.10.2026 · **Implementierung und Node-Prüfung erfolgt; echter Browser-/Mehrspieler-Smoke offen. Kein Deployment.**

## Geliefert

1. **Kampf:** Typisierte Trefferpunktschäden mit 13 SRD-Schadensarten; bekannte Herkunftsresistenzen automatisch, zusätzliche Immunität/Verwundbarkeit nur nach SL-Auswahl. SRD-Reihenfolge: Modifikationen, Widerstand (abrunden), Verwundbarkeit; Immunität ergibt null Schaden. Kein Konzentrationswurf bei null tatsächlichem Schaden. Vorhandene TP-/Todesrettungs-/Konzentrationsregeln werden weiterverwendet.
2. **Ziel und Deckung:** Bestehender Angriffs-/Munitionsweg versteht Ziel-RK, halbe Deckung (+2), Dreivierteldeckung (+5) und vollständige Deckung (kein direkter Angriff, kein Munitionsverbrauch). Reichweite und vorhandene Waffenhand-/Schild-/Krit-Regeln bleiben erhalten.
3. **Meisterschaft:** Alle acht gepinnten SRD-Einträge `Cleave`, `Graze`, `Nick`, `Push`, `Sap`, `Slow`, `Topple`, `Vex` sind im Angriffsergebnis handlungsnah erklärt. Graze-Schaden und Topple-KON-SG werden bei bestätigtem Ausgang berechnet. Ziele, Nutzungsbegrenzung, Zustandsfolgen und Wirkung nach Schadenswurf bleiben dort manuell, wo die App keine sicheren Zieldaten besitzt.
4. **Zugmerker:** Aktion, Bonusaktion, Reaktion und Nick im vorhandenen TP-Bereich markieren, zurücknehmen und zum nächsten Zug zurücksetzen; keine falsche automatische Sperre bei Extra Attack/Action Surge.
5. **Magische Gegenstände:** 262 bestehende 5.2.1-SRD-Gegenstände nachladen, mehrfache Exemplare separat verwalten, höchstens drei **verschiedene** einstimmbare Gegenstände aktivieren, Kurzrast-/Voraussetzungsbestätigung, manuelle Kapazität und atomare Einzel-Ladungsveränderung. Das englische SRD-Beschreibungsfeld bleibt lesbar; komplexe Boni, automatische Regeneration und Risiken beim letzten Verbrauch werden nicht erraten.
6. **Speicher/Cloud:** Zwei optionale Felder desselben Charakterprofils (`magicItems`, `combatTurn`). Erstellen/Bearbeiten/JSON/Cloud-Kopie bewahren diese Felder. Die gemeinsame `applyCharacterAction` unterstützt getypten Schaden, Magiegegenstände und Zugmerker; doppelte Cloud-Aktions-ID wird im vorhandenen Transaktionsweg abgefangen. Keine neue Datenbank, kein zweiter Kampfsimulator.

## Durchgeführte Prüfungen

| Prüfpunkt | Ergebnis |
| --- | --- |
| Node-Tests (Gesamtverbund nach Änderung gemeinsamer Charakteraktionen) | **289/289 bestanden, 0 Fehler** |
| Getypter Schaden: Resistenz, Verwundbarkeit, Immunität, Mehrfachwerte, Randfehler | Bestanden |
| Konzentrations-SG bei 0/12/24 tatsächlichem Schaden | Bestanden |
| Deckung: +0/+2/+5, vollständige Deckung, ungültige RK | Bestanden |
| Acht Meisterschaften einschließlich Graze, Nick, Topple, Slow/Vex nach Schaden | Bestanden |
| Alle 38 SRD-Waffen, Besitz/Übung, Munition, Krit und Reichweite | Neue und direkt betroffene alte Tests bestanden |
| 262 Original-SRD-Gegenstände, Duplikate, Einstimmungsgrenzen, Ladungen 0–999 | Bestanden |
| Beschädigte Gegenstands-IDs, unzulässige Ladung, gleiche Einstimmung doppelt | Bestanden |
| JSON-/Cloud-Profil-Roundtrip, Cloud-Deduplizierung einer Ladung | Bestanden (Node-Transaktionsmodell) |
| Studio-Einbindung und JS-Syntax | Bestanden (statischer Quell-/Syntaxnachweis) |
| Tatsächliche Klicks, Browser-Screenshots, 320 px, 200-%-Zoom, reale Zwei-Konto-Cloud-Sitzung | **OFFEN** (B15); statische Verdrahtung ist keine End-to-End-Abnahme |

Bereits bestandene Firestore-Regel-Emulatortests wurden nicht erneut als neue Sicherheitsergebnisse verkauft: Es gab **keine Änderung** der Firestore-Regeln oder des Berechtigungs-/Transaktionsverfahrens. Die neuen Cloud-Aktionstypen sind im Node-Transaktionsmodell geprüft; der echte Mehrkonto-Abgleich bleibt Gate B15.

## Anti-Bloat und Gestaltungsprüfung

- Zwei eng begrenzte Regelmodule ohne neue Abhängigkeiten: `combat.mjs` für reine Kampfergebnisse, `magic-items.mjs` für bestätigte Instanzzustände. SRD-Quellen, Würfelfunktion, Charakterprofil, lokale Speicherung, Cloud-Transaktionsfunktion, Formularstile und bestehende `<details>` werden wiederverwendet. **Keine** eigene Gegner-, Action-Economy- oder Magic-Item-Effekt-Engine.
- Anti-KI-Look-Prüfung am **Quellcode** für die neuen UI-Elemente: (1) konkreter Zweck unauffällig; (2) keine neuen Kartenteppiche; (3) kein Glow/Gradient; (4) keine dekorativen Icons; (5) vorhandene Typohierarchie; (6) keine künstlichen Bilder; (7) echte Zähler und wirksame Buttons; (8) native Eingaben/Labels. **Visuelle Befunde** zu Dichte, Mobilreflow, Fokus und Screenreadern können ohne Browser-Screenshots nicht als unauffällig bescheinigt werden. Diese Punkte bleiben bis B15 offen.
- Die Zusatzauswahl sitzt im vorhandenen Inventar-Details-Element, die Zieldeckung unmittelbar beim Angriff und die Zugmarker beim TP-Tracker. Das vermeidet neue Navigationswege und bewahrt vorhandene Rollenspielbegriffe.

## Fachliche Grenzen für v1

- **Keine automatische Ziel-HP-/VTT-Verwaltung**: Angriff gegen RK und separater Schadenswurf bestimmen keine gegnerischen TP, Zustände oder Position. Slow/Vex verlangen tatsächlichen Schaden; Cleave/Nick weitere Voraussetzungen. Die SL entscheidet.
- **Magische Boni** aus Freitext (`+1 RK`, Schutz, Zauberverbrauch, Sonderaktionen), welche Gegenstände angelegt sind, einzelne Klassen-/Magie-Einstimmungsbedingungen und Fluchregeln bleiben manuell. Anzahl der Ladungen muss nach SRD-Beschreibung bestätigt werden; tägliche Wiederaufladung wird nicht vorgetäuscht.
- **Aktionsmerker** sind frei editierbar; Extra Attack, Reaktionstiming, Action Surge und der tatsächliche Übergang eines Kampfzuges können nicht allgemeingültig erzwungen werden.
- Die ursprünglichen offenen Browser-/Mobil- und Zweikonto-Nachweise aus B01–B09 bleiben offen. Kein Anspruch auf Produktionsreife, bis B15 sie wirklich besteht.

Offizielle Regelreferenzen: [D&D Beyond – Playing the Game (2024)](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game) und [D&D Beyond – Equipment (2024)](https://www.dndbeyond.com/sources/dnd/br-2024/equipment), jeweils durch SRD 5.2.1 und die gepinnten CC-BY-Daten des Projekts begrenzt.

**Danach folgen 6 Batches: B11 Bogen/Wartbarkeit, B12 Edras, B13 UX, B14 Sicherheit/Betrieb, B15 großer interner Abschlusstest, B16 einmalige Nutzer-Abnahme.**
