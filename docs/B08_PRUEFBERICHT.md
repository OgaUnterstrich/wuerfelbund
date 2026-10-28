# B08 · v0.36 – Herkunfts- und Talentwirkungen

Stand: 27.10.2026. **Codeblock umgesetzt; echter Browsernachweis steht noch aus. Kein Deployment.**

## Implementiert

- **Magic Initiate:** Acolyte = Cleric, Sage = Wizard; zusätzliche Quellen aus menschlichem Talent, Stufenentscheidungen und Warlock-Anrufung. Drei unterschiedliche Listen maximal; je zwei gültige, verschiedene Cantrips, ein gültiger Grad-1-Zauber, INT/WIS/CHA. Die komplette Wahl ist im bestehenden `profile.magicInitiate` gespeichert, einschließlich Wiederöffnen/Bearbeiten.
- **Skilled:** Weitere Vorkommen aus Stufentalenten und Warlock-Anrufungen mit je drei SRD-Fertigkeiten/-Werkzeugen. Schon durch Klasse/Herkunft gewählte Übungen können nicht erneut vergeben werden. Speicherung als `profile.additionalSkilled`.
- **Abstammung:** Elf, Tiefling und Gnom wählen das Zauberattribut; der Hochelf bekommt den jeweils gewählten Wizard-Cantrip anstelle seines Standardtricks. Abstammungszauber werden mit richtiger Freischaltstufe und vorhandenen Zauberplätzen gewirkt; Gratiswirkungen werden im gleichen Rasttracker gezählt. Waldgnom-Speak-with-Animals nutzt ausschließlich den PB-basierten Zähler.
- **Begrenzte Spezieswirkungen:** Drachenodem/-flug, Stonecunning, Adrenaline Rush, Relentless Endurance, Riesenerbe/Großform sowie Spezieszauber. Boon of Fate ist als einzeln verbrauchbare Ressource (kurze Rast/Initiative manuell) sichtbar. Herleitbare Widerstände werden angezeigt, typabhängiger Schaden nicht ohne echten Schadenstyp automatisch halbiert.
- **Keine parallele Engine:** ein reines `origin-features.mjs` für Validierung/Zählertabelle; bestehende `origins.mjs`, `casting.mjs`, `character-actions.mjs` und Profilstorage bleiben zuständig. Keine neuen npm-Laufzeitpakete, keine Firestore-Regeländerungen.

## Reale Prüfungen im Container

| Prüfung | Ergebnis |
| --- | --- |
| `npm run test:logic` | **262/262 bestanden**, 0 Fehlschläge |
| 9 Spezies, 24 Abstammungen und Stufen 1/5/17/20 | Variantenmatrix, Nutzungsgrenzen, eindeutige Ressourcen bestanden |
| Acolyte/Sage/Mensch/Level/Warlock | mehrere Magic-Initiate-Quellen, erlaubte/falsche Zauberlisten, doppelte Auswahl, fehlende Felder bestanden |
| Skilled | Zusatzübungen, doppelte/gefälschte IDs, fehlende Auswahlen bestanden |
| Gratiszauber | Auswahl, einmalige Nutzung, verbrauchte Ressource, kurze/lange Rast, falscher Zauber bestanden |
| Waldgnom-Sonderzähler | PB-abhängig, keine doppelte Gratisressource, richtige Rast bestanden |
| Hochelf und Welttrennung | austauschbarer Wizard-Cantrip, ungültige Wahl und fehlendes Abstammungsattribut bestanden |
| Quell-/Cloud-/Legacy-Regression | vorhandene Node-Regressionen inklusive Cloud-Profil-/Klassen-/Zauber- und alter Herkunftsprofile bestanden |
| Syntax | `node --check js/studio/main.mjs` bestanden |
| Echte Desktop-/Mobilbrowser, Tastatur, Screenreader | **OFFEN:** kein ausführbarer lokaler Browser oder Preview-Daemon verfügbar |

Firestore-Regeln und Cloud-Transaktionen wurden in diesem Batch **nicht geändert**. Ihre bereits bestandenen Emulatorprüfungen werden deshalb nicht als neue Tests ausgegeben. Eine vollständige browserbasierte Integration samt Mehrspielerbetrieb ist weiterhin ein **Release-Gate** und spätestens in B15 intern nachzuholen.

## Anti-Bloat

- SRD-Listen werden aus dem vorhandenen `characterData` gefiltert; **keine** zusätzlichen JSON-Kopien von Zaubern, Klassen, Spezies oder Talenten.
- Der Ressourcenstand bleibt ausschließlich unter `profile.tracker`, neue Feat-Wahlen unter `profile`. Keine zweite App-/Backend-Schicht.
- Ein kombinierter ausklappbarer Formularbereich für Herkunftstalente statt zusätzlicher Editor oder Wizard.
- Nur feste Verbrauchsgrenzen automatisiert; Trigger, Zielschaden, Reaktionen, Resistenzanwendung und andere von Kontext abhängige Regeln ausdrücklich manuell.

## Anti-KI-Look-/UX-Prüfung betroffener UI

Gegen den [Designguide](DESIGN_ANTI_AI_LOOK.md) geprüft, soweit ohne gerenderten Browser möglich:

| Warnsignal | Befund |
| --- | --- |
| Austauschbare Werbetexte | **unauffällig** – konkrete Auswahlbegriffe und Limits |
| Generische neue Karten | **unauffällig** – ein vorhandenes `<details>` und native `<fieldset>`/`<select>` |
| Dekorative Glows/Gradients | **unauffällig** – keine neuen visuellen Effekte |
| Zufallsicons/Emojis | **unauffällig** – keine hinzugefügt |
| Laute Typografie | **unauffällig im Code** – bestehende Klassen/Farben benutzt; Bildschirmprüfung offen |
| Generierte Fantasybilder | **unauffällig** – keine Bilder hinzugefügt |
| Erfundenes Zahlenmaterial/Scheinbuttons | **unauffällig** – Counts aus konkreten Quellwahlen, keine Fake-Interaktion |
| Fehlbedienung/Mobil-/Keyboard-Fluss | **prüfen** – native Felder und Fehleranker vorhanden; echter Browser nötig |

## Bewusste Restgrenzen

1. Nicht alle Feat- und Abstammungsfolgen sind automatisch ausrechenbar. Situative Boni, Resistenz bei unbekannter Schadensart, Initiative-Reset von Boon of Fate und Hoch-Elf-Wechsel **während** einer Rast bleiben bestätigte Handentscheidungen.
2. Alte Profile ohne neu eingeführte Auswahlfelder bleiben erhalten. Bei Bearbeitung müssen relevante neue Angaben ergänzt werden, ehe erneut gespeichert werden kann. Die echte UI-Restore-Prüfung steht wegen fehlendem Browser aus.
3. Mehrklassen-eigene Zauberwahlregeln stehen explizit in B09, umfangreiche Kampfautomatik ist nicht Gegenstand einer vorgetäuschten B08-Abnahme.

**Folgeplanung: 8 Batches B09–B16. Kein Zwischentest durch den Nutzer.**
