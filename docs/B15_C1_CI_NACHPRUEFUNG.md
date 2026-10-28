# B15-C1 – CI-Stabilisierung und Übergabe an B15-C2

**Stand: 27.10.2026 · Gate C: GESPERRT.** Das ist die Nacharbeit innerhalb des bestehenden B15. Keine zweite Hauptphase namens B15, kein Deployment und keine Änderungen an der produktiven Firebase-Instanz.

## Ausgangsbefund aus externer Nachprüfung

Laut dem vom Projektinhaber übergebenen Prüfprotokoll wurden mit Firebase CLI 15.34.1, Java 21 und lokalen Demo-Emulatoren **317/317** Logiktests, **25/25** Firestore-Tests, **7/7** Build-Tests sowie jeweils **6/6** Browserprüfungen in Chromium und Firefox bestanden. Zwei kombinierte Playwright-Läufe hatten jedoch jeweils nur **11/12** Erfolge: ein sporadischer Firefox-Timeout im Anmeldedialog. Außerdem konnten Fehler beim Kontextabbau den primären Fehler überdecken. Das externe Protokoll ist ein **übermittelter Befund**, keine von uns erneut ausgeführte browserübergreifende CI-Abnahme.

## Umgesetzte Änderungen

1. **Unabhängige GitHub-Actions-Browserjobs** statt eines gemeinsamen Prozesses: separate Ubuntu-Runner, jeweils Node 22, Java 21, `npm ci`, öffentlicher Build, Playwright-Browser und Auth-/Firestore-Demo-Emulatoren. Beide Matrix-Jobs laufen auch dann zu Ende, wenn einer scheitert (`fail-fast: false`). Kein Browser kann den anderen durch einen Firefox-Crash blockieren.
2. **Getrennte lokale Testbefehle:** `npm run test:browser:isolated:chromium` und `npm run test:browser:isolated:firefox`. `npm run test:browser:isolated` ruft sie **nacheinander in getrennten Prozessen** auf. Die Projektkennung lautet ausschließlich `demo-wuerfelbund`.
3. **Unabhängige Artefakte:** `playwright-report/chromium` bzw. `playwright-report/firefox`, `test-results/chromium` bzw. `test-results/firefox`; jeder CI-Job lädt seinen Report hoch. Der manuelle Pages-Workflow bewahrt Berichte ebenfalls, auch wenn das Freigabe-Gate anschließend sperrt.
4. **Robusterer Registrierungstest:** wartet sichtbar auf SDK-Initialisierung, Dialog, Registrierungsmodus, freigegebenen Submit-Button und geschlossenen Dialog; aufteilbare `test.step`-Abschnitte je Konto. Erhöhte globale Timeouts oder blindes Retry wurden **nicht** eingeführt. `Promise.allSettled` beim Aufräumen lässt einen ursprünglichen Testfehler erkennbar.
5. **B15-C2 vorbereitet:** drei weitere echte UI-Abläufe als Playwright-Tests angelegt: lokales Kurzprofil anlegen/neuladen/bearbeiten/abbrechen; ungültige E-Mail und Dialogabbruch; Edras umschalten und fehlerhaftes Regelpaket ablehnen. Die Browsermatrix umfasst **9 Tests pro Browser, 18 insgesamt**. Das Vorhandensein eines Tests ist kein Durchführungsnachweis.
6. Eine nur bei Bedarf gesetzte Variable `PLAYWRIGHT_CHROMIUM_EXECUTABLE` erlaubt einen lokal heruntergeladenen **offiziellen** Chrome-for-Testing-Browser als Ausweichpfad; in GitHub Actions wird unverändert der von Playwright gepinnte Chromium-Browser installiert.

## Tatsächlich in diesem Arbeitsdurchlauf ausgeführt

| Prüfung | Ergebnis | Umgebung |
| --- | --- | --- |
| `npm run test:logic` | **317/317 bestanden** | Node 24.22.1, lokaler Arbeitscontainer |
| `npm run test:firestore` | **25/25 bestanden** | Firebase CLI **15.34.1**, **Temurin Java 21.0.13**, Firestore-Emulator, Projekt `demo-wuerfelbund` |
| `npm run build:public` | **58 öffentliche Dateien erzeugt** | Lokaler Builder |
| `npm run test:public` | **7/7 bestanden** | Node 24.22.1, inklusive Syntax-/Asset-Gates |
| Playwright `--list` | **18 Testfälle erkannt**, 9 je Browser | Keine Ausführung durch `--list` |
| Workflow-YAML parser | **beide Workflows syntaktisch lesbar** | Lokaler `yaml`-Parser; kein GitHub-Actions-Lauf |
| `npm audit --omit=dev` | **0 Meldungen** | npm-Paketprüfung |
| `npm audit` inklusive Dev-Werkzeugen | **5 mittlere, 0 hohe, 0 kritische Meldungen** | CLI-Kette `firebase-tools` → `@google-cloud/pubsub` / `gaxios` → `@opentelemetry/core` / `uuid`; keine riskanten erzwungenen Downgrades |
| Browserstart Firefox | **gescheitert vor erster Browserinteraktion** | Firefox 157/Playwright 1.64.1; im Prüfcontainer fehlt das für den Firefox-Starter notwendige `/proc`; Meldung: „Couldn't find the application directory.“ |
| Chromium-/Firefox-CI-Matrix | **nicht ausgeführt** | Es liegt noch kein neuer GitHub-Actions-Lauf vor |

**Wichtige Grenze:** Die Browserbinärdateien konnten in diesem Arbeitsdurchlauf teilweise über offizielle alternative Downloadquellen bezogen werden; der Testcontainer selbst kann ohne `/proc` jedoch keinen echten Firefox-Prozess starten. Ein Firefox-Startfehler ist **kein Fehler der Würfelbund-Oberfläche**, aber genauso wenig ein bestandener Browsertest. Chromium wurde ebenfalls nicht als vollständiger UI-Durchlauf ausgeführt. Die reproduzierbare *vorgesehene* Prüfumgebung ist der normale Ubuntu-Runner in GitHub Actions (mit `/proc` und installierbaren Systembibliotheken). Ein tatsächlicher Workflow-Lauf steht weiter aus.

## Fortsetzung und Abnahmeregel

- **C1 noch offen:** Der GitHub-Actions-Matrixlauf muss mit den neuen Tests erfolgreich durchgeführt werden. Die hinzugefügten UI-Fälle sind erst nach diesem Lauf belastbar. Browserlogs, Screenshots und Traces aufbewahren; bei Fehlversuch gezielt korrigieren.
- **C2 begonnen, nicht abgeschlossen:** Echte Screenshots und Prüfung mit 320 px, echtem 200-%-Browserzoom, Tastatur/Fokus, Screenreader-Stichprobe und Designleitfaden `docs/DESIGN_ANTI_AI_LOOK.md`; vollständige Charakter-/Kampf-/Rast-/Zauberabläufe müssen noch nachgewiesen werden.
- **C3 offen:** Eigenständiges echtes Firebase-Staging-Projekt mit drei Konten und veröffentlichter **Test**-Regelversion. Niemals das Projekt `wuerfelbund` als Staging nutzen.
- **C4 offen:** Gesamtabnahme, Anti-Bloat-/Anti-KI-Designaudit anhand echter Screenshots, ZIP-Integrität und ausdrückliche Entscheidung.
- **B16 folgt erst nach bestandenem B15**, inklusive der einmaligen Nutzerabnahme und ausdrücklichen Produktionsfreigabe.

**Sicherheitsstand:** Firestore-Denial-Tests zeigen erwartete `PERMISSION_DENIED`-Meldungen, nicht Regressionen. Produktionsregeln (Stand 0.2), echte Konten, bestehende Kampagnen und GitHub Pages wurden nicht verändert. Kein Login, keine Migration und keine Veröffentlichung wurden ausgelöst.

Quellen für die CI-Strategie: [Playwright – Continuous Integration](https://playwright.dev/docs/ci), [Playwright – Reporter](https://playwright.dev/docs/test-reporters), [Firebase – Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure).
