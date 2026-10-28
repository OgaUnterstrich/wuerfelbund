# B13 · v0.41 – UX, Begriffe und Verbindungszustände

**27.10.2026 · Entwicklungsprüfung, keine Freigabe zur öffentlichen Beta.**

## Umgesetzt

- Zaubersuche für erste **und weitere Klassen**: Umlaute/ß, Großschreibung, Wortreihenfolge und Leerzeichen robust; bereits ausgewählte Zauber bleiben sichtbar, unabhängig von Suchtreffern; Ergebniszahlen werden angezeigt. Passende Folgeklassen-Panels öffnen bei aktiver Suche vorübergehend; vorherige Offen-Zustände bleiben erhalten.
- Cloud-Bereich unterscheidet **lokale Figur, geladene Cloud-Liste, Serverbestätigung, Anmeldestatus und Offline-Zustand**. Upload, Download, Aktualisierung, Quellenumschaltung und Paketfreigabe bleiben offline gesperrt. Nach dem Online-Ereignis werden Kampagnen/Quellen/Charaktere aktualisiert; angefangene Offline-Abfragen können nicht nachträglich die UI überschreiben.
- Skiplinks in Hauptseite und Studio, die tatsächlich im aktuellen Tab bleiben. Links zu Tracker-Abschnitten wählen das Charakterlabor, anstatt fälschlich die Regelbibliothek zu öffnen.
- Hilfe- und Zukunftstexte unterscheiden **vorhanden**, **teilweise vorhanden**, **geplant** und **nur im geöffneten Cloud-Spielmodus synchronisiert**. Keine künstlich übersetzten SRD-Regeln.
- Keine neue Laufzeitabhängigkeit, keine zweite Datenhaltung, kein neues Regelwerk, keine Änderung der Firestore-Regeln.

## Durchgeführte technische Prüfungen

| Aufgabe / Rolle | Automatisierter Nachweis | Stand |
| --- | --- | --- |
| Figur im Charakterlabor anlegen und Fehler beheben | `character-editing`, `ux-wiring`, `b13-ux`: Speicher-/Fehlerziele, Fokus, Einstieg | **Node bestanden**; Browser offen |
| Stufe, Mehrklassenanteil, erlaubte Entscheidungen ändern | `multiclass`, `class-decisions`, `hit-points`, `character-sheet` | **Node bestanden**; Browser offen |
| Zauber auswählen, suchen, Ressourcen nutzen | `b13-ux`, `advanced-class-spells`, `casting`, `automatic-spells`, `vitals` | **Node bestanden**; Browser offen |
| Lokalen Spielstand importieren/ablegen, Cloud bewusst separat behandeln | `game-import`, `storage-safety`, `cloud-characters`, `b13-ux` | **Node bestanden**; Browser offen |
| Als Spieler/SL Kampagne, Quellen und Cloud-Spielzustand verwalten | `cloud-ui-wiring`, `cloud-actions`, `sources`, `b13-ux` | **Node bestanden**; echte Mehrkonten-/Netztests offen |

**Ergebnis:** `node --test --test-reporter=dot tests/*.test.mjs` → **311/311 erfolgreich**. In B13 zusätzlich acht gezielte UX-Prüfungen (Suchfälle, Zählergrenzen, Offline-/Anmeldestatus, UI-Verdrahtung, Skiplinks, Spieler/SL-Sperren). Unveränderte B12-Firestore-Regeln wurden **nicht erneut** im Emulator geprüft; letzter belegter Stand **23/23 B12**. `npm ci --offline --ignore-scripts` war mangels gecachtem Paket `zip-stream@6.0.1` nicht ausführbar; die Node-Regeltests sind unabhängig davon und vollständig gelaufen.

## Design- und Anti-Bloat-Kontrolle

| Acht Warnsignale aus `DESIGN_ANTI_AI_LOOK.md` | B13-Befund |
| --- | --- |
| Austauschbarer Werbetext | **Verbessert:** Einstiegs- und Synchronisationsbeschreibung nennt konkrete Funktion |
| Identische unnötige Karten | **Unauffällig für Änderung:** keine neuen UI-Karten |
| Dekorative Glows/Gradienten | **Unauffällig für Änderung:** keine Effekte ergänzt; vorhandene Ästhetik unverändert |
| Zufällige Emojis/Icons | **Unauffällig für Änderung:** neue Bedienelemente ohne Dekor |
| Unklare Typografie/Hierarchie | **Verbessert:** Suchstatus und Verbindungszustand direkt am zugehörigen Bereich |
| Ungeprüfte Fantasy-Bilder | **Unauffällig für Änderung:** keine Bilder ergänzt |
| Erfundene Werte/Scheinbedienung | **Verbessert:** Trefferzahlen aus sichtbaren Listen; Offline-Bedienung deaktiviert |
| Schöne, aber nicht benutzbare Formulare | **Teilweise verbessert:** Suchtreffer bleiben erreichbar, Skiplinks/fokussierte Fehlerziele; visuelle Prüfung offen |

**Anti-Bloat:** nur ein kleines wiederverwendbares `js/rules/ux.mjs` für reine Such-/Verbindungsentscheidungen, existierende Komponenten und Testmuster. Kein neues Framework, keine zweite Persistenz oder dekorative Oberflächen. Der Anti-KI-Look ist **keine objektive KI-Erkennung**; die Bewertung hier ist ein gezielter **Code-/Text-Review**, **kein** behaupteter Screenshot- oder Dreisekunden-Nutzertest.

## Offene Pflichtnachweise für Gate C / B15

- Tatsächliche Chrome-/Firefox- und mobile Browseraufgaben, **320 px und 200 % Zoom**, Tastaturfluss, visuell sichtbarer Fokus, Screenreader-Stichprobe, Kontrast/Lesbarkeit, reale Ladezeiten.
- Reale Screenshots jeder zentralen Ansicht und vollständige achtteilige Anti-KI-Look-Sichtprüfung statt Code-Indizien.
- Offline/Online-Wechsel in Browsern, echte Firestore-Staging-Verbindung und mindestens drei getrennte Mehrspielerrollen; bei Browserstörung keine serverseitige Erfolgsaussage.
- Menschlicher Dreisekunden-Test und Nutzerabnahme **nur einmal am Schluss**, nach internem B15-Gate.

**Releaseentscheid:** B13-Funktionscode und Node-Tests fertig; UX-Browserabnahme **offen**, daher keine Veröffentlichung und kein Ersatz-Nutzertest. Folgebatches **B14 Sicherheit/Betrieb**, **B15 intern vollständiger Abschlusstest**, **B16 einmalige finale Nutzerabnahme/Freigabe**.
