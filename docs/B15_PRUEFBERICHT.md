# B15 · v0.43 – großer interner Abschlusstest, Gate C

**Stand 27.10.2026 · Ergebnis: GESPERRT (Prüfung noch nicht vollständig ausführbar).**

**Nachtrag B15-C1 (27.10.2026):** Die Entwicklung hat die Dependency-/CI-Vorbereitung nach externer Prüfung fortgesetzt: **317/317 Node**, **25/25 Firestore** mit bisheriger lokal lauffähiger CLI und **7/7 öffentliche Buildtests** bestanden; kritische und hohe npm-Audit-Meldungen wurden auf null reduziert. Ein echter Browserlauf gelang noch nicht (Download erneut 0 MiB), GitHub Actions/Java-21-Ausführung ist bisher nicht nachgewiesen. Siehe [B15-C1-Zwischenbericht](B15_C1_PRUEFBERICHT.md). **Gate bleibt GESPERRT, keine neue Batchnummer.**

Die große lokale Regelsuite, ein zusammenhängender Spiel-/Speicher-/Cloud-Übernahmeablauf, die Drei-Rollen-Rechtematrix und das überprüfte öffentliche Dateibundle sind erfolgreich. **Nicht ausgeführte Browsertests gelten ausdrücklich nicht als bestanden.** Daher ist diese Fassung ein interner B15-Prüfstand, **noch kein zur Nutzerabnahme freigegebener v1-Release-Candidate**.

## Tatsächlich ausgeführte Prüfung

| Gate-C-Block | Nachweis | Ergebnis |
| --- | --- | --- |
| 1. SRD-5.2.1-Regeln | Vollständige `tests/*.test.mjs`-Suite; darin 12 Klassen × 20 Stufen, wichtige Mehrklassen-/Zauber-/Herkunftsmatrizen | **Bestanden, 314/314** Node-Fälle gesamt; keine Behauptung aller theoretischen Kombinationen |
| 2. Lebenszyklus/Daten | B15-Endweg: Neuanlage, Schaden, Rast, Stufe 9, Neustart, Export/Import-Sicherung und Wiederherstellung, Cloud-Übernahme und Ersetzungsschutz; bisherige Speichergrenzen | **Bestanden** im isolierten Node-Spielstand |
| 3. Anwendung im Spiel | Ressourcenuntergrenze, TP-/Bogen-Abgleich, kurze/lange Rast, Stufenanzeige, Edras unabhängig vom Grundsystem | **Bestanden** als Engine-Integration, **Browserbedienung offen** |
| 4. Mehrspieler | Firestore-Emulator: Transaktionskonkurrenz und Idempotenz aus B04; neuer zusammenhängender SL/Bob/Carol-Fall mit Einzelrechten und Sperre | **Bestanden, 25/25** Emulatorfälle gesamt; **echter Zwei-Browser-Lauf offen** |
| 5. Rechte/Geheimnisse | Anonym, SL, Spieler, zweiter Spieler, Fremder; Quelle, Privatdokument, Rollenwechsel, gesperrter Nutzer | **Bestanden im Emulator**; reale Staging-Regeln nicht geprüft |
| 6. Edras/Homebrew | Bereits vorhandene Edras-/Paket-/Quellen-/Seeds-/Fallbackfälle, zusätzliche SRD-Invarianz während LE-Verbrauch | **Bestanden als Module/Emulator**, echter Weltwechsel in Browsern offen |
| 7. Browser, UX, Design | Statische Eindeutigkeit der HTML-IDs, Link-/Modulauflösung, fokussierbare Steuerelemente; lokaler Browser-Versuch | **Offen:** kein echter Browserlauf, kein Mobil-/Zoom-/Screenreader-/Screenshot-Nachweis |
| 8. Auslieferung/Lizenzen | Reproduzierbarer `dist`-Allowlist-Build; SHA-256-Inventar, URL-/Importziele, Release-Workflow und Sperre, Lizenzlinks | **7/7** Public-Build-Prüfungen bestanden; Live-/Rechtsfreigaben weiterhin gesperrt |

Die Zählwerte **314/314**, **25/25** und **7/7** beziehen sich auf verschiedene technische Testprogramme, nicht auf 346 reale Browserfälle. Eine bestandene Browser-/WCAG-/Produktionsprüfung wird daraus nicht abgeleitet.

## Reproduzierbarer Bug und Korrektur

- **B15-01, behoben:** Das gültige lokale Importschema erlaubt fehlende `created`-Felder an Chronik- und Wurfeinträgen. Die bisherige Startseite rief `Intl.DateTimeFormat.format(new Date(undefined))` auf und konnte dadurch beim Rendern mit `RangeError` abbrechen.
- **Korrektur:** Eine einzige, vom bestehenden UX-Modul exportierte `storedDateLabel`-Funktion zeigt bei fehlendem/ungültigem Zeitstempel „Datum unbekannt“. Chronik und Würfelhistorie verwenden dieselbe Funktion. Regressionstest mit beiden zulässigen Legacy-Einträgen ergänzt.
- **Text-/Anti-KI-Korrektur:** Seitentitel/Description und zwei Leerzustände beschreiben den echten Nutzungsweg konkreter statt mit austauschbarer Abenteuerlyrik. Keine neuen Bedienelemente oder visuellen Effekte.

## Nachweis der fehlenden Infrastruktur

- Lokale Umgebung: Node 24, Firebase-Emulator über Java 17 und 25 positive/negative Berechtigungs- und Integrationsfälle; Produktions-CI ist unabhängig auf Node 22 konfiguriert.
- Kein installierter Chrome-/Chromium-/Firefox-Prozess/Binary gefunden. Playwright-Core ist für einen Testversuch in der Umgebung vorhanden, aber der Browserdownload von `cdn.playwright.dev` lieferte auch nach erneuter Berechtigungsanfrage eine **0-MiB-/ungültige Archivantwort**.
- Ein lokaler HTTP-Server ließ sich starten, war jedoch aus der getrennten Browseroberfläche mit `ERR_CONNECTION_REFUSED` nicht erreichbar. **Daher kein echter Screenshot, keine klickbasierte Aufgabe und keine visuelle QA durchgeführt.**
- Drei Identitäten wurden im **Firestore-Emulator** statt in drei authentifizierten Browserkontexten geprüft. Ohne echte isolierte Firebase-Staging-Instanz wurden keine Produktions-/Live-Accounts, Regeln oder Daten verändert.

## Anti-KI-Design / UX / Anti-Bloat

Kriterien aus [DESIGN_ANTI_AI_LOOK.md](DESIGN_ANTI_AI_LOOK.md), keine unbelegte KI-Erkennungsquote:

| Warnsignal | Statischer Befund | Status |
| --- | --- | --- |
| Austauschbarer Text | Betroffene Metadaten/Leerzustände konkretisiert; andere Fantasy-Texte bleiben | **Teilweise korrigiert** |
| Gleichförmige Scheinkarten | B15 fügt keine Karten hinzu; bestehende Zukunftskarten brauchen visuellen Aufgabencheck | **Visuell offen** |
| Effekte ohne Zweck | Keine B15-Effekte; bestehende Hintergründe aus B14 unverändert | **Visuell offen** |
| Zufallsicons | Keine neuen Illustrationen/Symbole | **Unauffällig im Diff** |
| Laute Typohierarchie | Keine Schriftfamilien eingeführt; Überschriften nicht im Browser bewertet | **Visuell offen** |
| KI-Fantasybilder | Keine neuen Bilder | **Unauffällig im Diff** |
| Falsche Zahlen/Blindtext | Öffentlicher Build auf Scheintext geprüft; Charakter-/Rollenzustand aus echtem Spielstand | **Statisch unauffällig** |
| Versteckte Bedienzustände | Bestehende Online-/Offline- und Fehlermeldungen regressionstestet; tatsächlicher Fokusgang fehlt | **Browser offen** |

**Anti-Bloat:** Null neue Laufzeit-/Dev-Abhängigkeiten, kein Framework, keine neue Datenhaltung. Produktionsänderung: nur der geteilte Datums-Fallback und konkrete Kurztexte. Zusätzliche Testfälle liegen ausschließlich außerhalb des öffentlichen Artefakts.

## Offene Gate-C-Blocker und Reihenfolge

1. **B15 offen:** Einen Browser-Testhost mit erreichbar eingebundenem lokalem Build und installierten Chromium **und** Firefox bereitstellen; reale Spieler-/SL-Aufgaben inklusive 320px/200%-Zoom, Tastatur, Screenreader-Stichprobe, Kontrast/Fokus, Screenshots und Daten-/Speicherwege automatisiert ausführen. Kritische Befunde beheben und gesamten betroffenen Testbereich erneut prüfen.
2. **B15 offen:** Mit drei voneinander getrennten Testkonten das **isolierte Firebase-Staging** verwenden, niemals Produktionsdaten. Erstellung/Einladung/Entzug, parallele Ressourcenänderungen, Offline/Retry, Edras-Schaltung und Import/Export in echten Browsern prüfen.
3. **B16:** Die noch offenen Betreiber-/Impressums-, Datenschutzhinweis-, Accountlöschungs-, App-Check- und Kostenwarnungsfreigaben durch den Betreiber nachweisen. Erst nach Gate C eine **einzige** Nutzer-Endabnahme durchführen; erst nach ausdrücklichem OK die manuelle Pages-Freigabe ermöglichen.

**Freigabeentscheidung: GESPERRT.** B15 wird bis zum echten Browser-/Stagingnachweis nicht als abgeschlossen gezählt. Der Nutzer muss jetzt noch nichts testen. Es verbleiben weiterhin zwei Abschlussphasen: **B15 fertig prüfen**, dann **B16 einmalige Nutzerabnahme/Freigabe**.
