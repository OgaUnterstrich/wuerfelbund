# Würfelbund – B15-C1/C2: tatsächliche lokale Browser-Nachprüfung

**27.10.2026 · B15 Gate C: GESPERRT.** Dieser Bericht ergänzt die älteren, historisch zutreffenden B15-C1-Berichte. Es handelt sich weiterhin um **denselben B15**; keine Produktionsfreigabe.

## Beobachtungen, Korrekturen und Nachweise

1. **Bestätigter Playwright-Fehler behoben:** `tests/browser/website.spec.mjs` öffnet „Optionale Weltregeln“ durch Benutzerklick und prüft danach, ob `#character-world` sichtbar ist. Erst dann wird Edras gewählt. Das geschlossene `details`-Element ist beabsichtigtes UI-Verhalten, kein Fehler der Website. Die Prüfung bestand in Chromium und Firefox.
2. **Echter Speicherfehler gefunden und korrigiert:** Ein vollständig ausgefüllter SRD-5.2.1-Charakter konnte nicht gespeichert werden. Vor dem erstmaligen Speichern wurde die Vitaldatenprüfung mit einem noch nicht persistenten Profil **ohne `ruleset`** aufgerufen. `getCharacterVitalContext` wies das korrekte neue Profil deswegen als ungültig ab. In `js/studio/main.mjs` wird die verbindliche Kennung `RULESET.id` vor dieser Prüfung übergeben. Die vollständige UI-Strecke *Charakter erstellen → speichern → neu laden → im Spiel benutzen → zu Stufe 2 steigern* hat die Korrektur in beiden Browsern bestätigt.
3. **Konkreter Mobile-UX-Fehler behoben:** Die horizontal scrollbare, zugleich unsichtbar scrollbarlose Startnavigation zeigte bei 320 CSS-Pixeln den letzten Menüpunkt nur angeschnitten. Bis 550 Pixeln wird nun ein zweispaltiges, vollständig sichtbares Navigationsraster benutzt. Auf der Einstellungsseite verursachte der lange Wiederherstellen-Button einen Seitenüberlauf; dort wird sein Text umgebrochen. Bestehende Würfelbund-Farben, Typografie und Bausteine bleiben erhalten.
4. **Zusätzliche End-to-End-Tests:** vollständige Pflichtwahlen eines SRD-Barbaren auf 320 Pixeln, lokale Charakterpersistenz und Steigerung, Schaden/TP, verbrauchte Klassenressource und Erholung bei langer Rast; außerdem tatsächlicher JSON-Export, JSON-Import, Wiederherstellungs-Sicherung und Reload. Der schon vorhandene Test für beschädigte JSON-Daten bleibt erhalten. Seitliche Überläufe werden für Charakterformular und Spielbogen explizit gemessen.
5. **Browsernetz ausschließlich für Tests isoliert:** `tests/browser/network.mjs` gestattet nur lokalen HTTP-Server, lokale Emulatoren und das offizielle Firebase-SDK-CDN. Eine **opt-in**-Weiterleitung des echten CDN-Skripts durch den Node-Testprozess kann bei eingeschränkter lokaler Proxy-Umgebung verwendet werden (`WUERFELBUND_TEST_CDN_RELAY=1`). Sie verändert keine Website-Datei und wird **nicht** in die öffentliche Build-Freigabeliste aufgenommen. Kein unsicheres TLS-Verhalten wird in die Website eingebaut. GitHub Actions nutzt ohne diese Variable den regulären Browser-Abruf.

## Lokal tatsächlich ausgeführt

| Prüfung | Ergebnis | Umgebung |
| --- | --- | --- |
| Logiktests `npm run test:logic` | **317/317 bestanden** | Node 22.23.4 |
| Firestore-Regeltests `npm run test:firestore` | **25/25 bestanden** | Java 21, Node 22, Firebase-CLI 15.34.1, ausschließlich `demo-wuerfelbund` |
| Öffentlicher Build | **58 freigegebene Dateien** | `npm run build:public` |
| Öffentliche Build-Prüfung | **7/7 bestanden** | `npm run test:public`, Node 22 |
| Browser Chromium | **11/11 bestanden** | Tatsächlich gestarteter Chromium-Browser, lokale Auth-/Firestore-Emulatoren |
| Browser Firefox | **11/11 bestanden** | Tatsächlich gestarteter gepatchter Firefox-Browser, lokale Auth-/Firestore-Emulatoren |
| Produktionsabhängigkeiten | **0 bekannte Meldungen** | `npm audit --omit=dev` |
| Entwicklungsabhängigkeiten | **5 mittlere Meldungen** | `npm audit`, ausschließlich transitive `firebase-tools`-Ketten |

**Gesamt:** 317 + 25 + 7 + 11 + 11 = **371/371** bestandene automatisierte lokale Tests. Die Chromium-/Firefox-Matrix wurde **nach der endgültigen Erweiterung** des Charaktertests um TP-, Klassenressourcen- und Überlaufprüfungen in zwei getrennten Testprozessen **nochmals vollständig** ausgeführt: 11/11 plus 11/11, Exitcode 0.

### Abhängigkeits-Audit

`firebase-tools@15.34.1` zieht `@google-cloud/pubsub@5.3.1 → @opentelemetry/core@1.30.1` sowie `gaxios@6.7.1 → uuid@9.0.1` nach sich. npm schlägt zur Beseitigung einen **erzwungenen Downgrade auf firebase-tools 14.23.0** vor. Dieser wurde bewusst **nicht** übernommen: kein `npm audit fix --force`, keine ungeprüften Major-Overrides der Entwicklertools. 5 mittelschwere Befunde verbleiben; die Produktionsabhängigkeiten sind nicht betroffen. Vor v1 erneut prüfen.

## B15-C2: Design- und Bedienbefunde (echte Screenshots)

Referenz: `docs/DESIGN_ANTI_AI_LOOK.md`. Screenshots unter `docs/screenshots/b15/` stammen aus tatsächlich ausgeführten Playwright-Browserläufen; es sind keine KI-generierten Mockups.

| Warnsignal des Designleitfadens | Befund | Begründung / Handlung |
| --- | --- | --- |
| Austauschbare Texte | **prüfen** | „Deine Taverne“ ist stimmig, muss aber zusammen mit konkretem SRD-Charakter-/Kampagnenaufruf stehen. |
| Überflüssige Karten | **prüfen** | Die funktionalen Einstiegskarten sind Klickziele. Der Abschnitt „Was später möglich ist“ enthält rein informierende Zukunftskarten; im späteren Anti-Bloat-Finish reduzieren. |
| Glows/Gradienten | **unauffällig für diesen Eingriff** | Keine neuen Dekore ergänzt; vorhandene grün-goldene Identität beibehalten. |
| Zufällige Icons | **unauffällig** | Vorhandene, konsistente SVG-Symbole; keine neuen Emoji-Icons. |
| Typografiehierarchie | **prüfen** | Charakterstudio ist bei 320 Pixeln sehr lang und textdicht; keine unbewiesene pauschale Barrierefreiheit behaupten. |
| KI-Bilder | **unauffällig** | Keine neuen Bilder erzeugt oder eingebunden. |
| Erfunden wirkende Zahlen/Scheinaktionen | **prüfen** | Die geprüften Aktionen erzeugen echte Spielstände; reine Zukunftskarten sind ausdrücklich als geplant markiert. |
| Mobile Formulare/Fehlerzustände | **teilweise korrigiert** | Navigation und Wiederherstellen-Button bereinigt; 320px-Charakteranlage inklusive Pflichtwahlen erfolgreich. Weitere manuelle Bedienbarkeitsstichprobe sinnvoll. |

## Noch nicht nachgewiesen – Release-Gates bleiben geschlossen

- **B15-C1:** Ein **echter erfolgreicher GitHub-Actions-Lauf** der zweigeteilten Browsermatrix **nach Übertragung der Änderungen** liegt nicht vor. YAML und lokale Befehle sind überprüfbar, aber kein CI-Ausführungsergebnis. Keine Repository- oder Produktionsänderungen in diesem Arbeitsdurchlauf.
- **B15-C2:** 200-%-Prüfung erfolgte bislang über **CSS-Reflow-Simulation**, **nicht** mit nachweislich nativer Browser-Zoomfunktion; ein realer Screenreader-Test, umfangreiche Kontrastprüfung und weitere Ende-zu-Ende-Varianten fehlen. Der Test heißt bewusst „CSS-Zoom-Reflow“.
- **B15-C3:** Kein separates Cloud-Staging-Projekt und keine drei tatsächlichen Staging-Konten. Die erfolgreichen Mehrspielertests nutzen ausschließlich den **lokalen Demo-Emulator**. Rückwärtskompatibilität mit vorhandenen echten 0.2-Kampagnendaten noch nicht bestätigt.
- **B15-C4:** Damit keine endgültige Gesamtabnahme; Lizenz-, Betreiber-, Produktivkompatibilitäts- und Integritäts-Gates müssen zusammen abgeschlossen werden.
- **B16:** Kontolöschung, rechtliche Freigaben, App Check, Produktionsüberwachung, einmalige Nutzerabnahme und ausdrücklich genehmigte Veröffentlichung folgen **erst nach B15**.

**Entscheidung: B15 weiterhin GESPERRT.** Lokal geprüfte Korrekturen können zur nächsten Abnahmerunde weitergegeben werden. Die tatsächliche produktive Firestore-Regelversion 0.2, echte Konten/Kampagnen und GitHub Pages wurden nicht angefasst.
