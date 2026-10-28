# B15 – Fortsetzung der CI- und UX-Abnahme (28.10.2026)

**Status: GESPERRT – keine Produktions- oder Veröffentlichungsfreigabe.** Dies ist eine Ergänzung zu `B15_C1_C2_LOKALNACHWEIS.md`, kein weiterer Hauptbatch.

## Übernommener, extern bestätigter Ausgangsstand

Die unabhängige Prüfung der unveränderten Eingangs-ZIP meldete **371/371 erfolgreiche Tests**: 317 Logik, 25 Firestore-Regeltests mit `demo-wuerfelbund`, 7 öffentliche Buildtests, 11 Chromium, 11 Firefox. Diese externe Bestätigung wird nicht als erneuter Test in dieser Arbeitsumgebung dargestellt.

## Änderungen dieser Fortsetzung

- Aus der geprüften Eingangs-ZIP und der aktuellen öffentlichen GitHub-`main`-Historie (`7b8ee7d`) wurde **nur lokal** der Entwicklungszweig `b15-gate-c-ci-ux` vorbereitet. Im öffentlichen `main` standen zuvor lediglich `index.html` und `README.md`; die übrigen Projektquellen stammen aus der Eingangs-ZIP. Kein Push und keine Veröffentlichung.
- Ein zunächst festgestellter Versionskonflikt dieser beiden schon im Klon vorhandenen Dateien wurde **vor der Übergabe** behoben: `index.html` und `README.md` wurden exakt aus der Eingangs-ZIP übernommen; der anschließende vollständige Verzeichnisvergleich zeigt nur die ausdrücklich dokumentierten neuen bzw. geänderten Dateien. Auf dem korrigierten Stand bestehen die Logik- und Buildprüfungen erneut.
- `.github/workflows/verify.yml` behält getrennte Chromium- und Firefox-Jobs, Node 22, Java 21 und ausschließlich Firebase-Demo-Emulatoren bei. Das Pages-Release-Workflow bleibt manuell gesperrt. Ein **echter GitHub-Actions-Lauf fehlt**, solange der vorbereitete Zweig nicht an das Repository übertragen ist.
- Das zusätzliche Entwicklungspaket `axe-core@4.11.0` ermöglicht automatisierte WCAG-Prüfungen im bestehenden Playwright-Setup, ohne neue Produktionsabhängigkeit und ohne zusätzliche UI-Bibliothek.
- Zwei tatsächlich scrollbar begrenzte Bereiche in der Charaktervorschau waren per Tastatur nicht erreichbar. Sie haben jetzt einen Tastaturfokus, eine benannte `region`-Rolle und sichtbare Fokusmarkierung. Dies ist eine eng begrenzte Barrierefreiheitskorrektur, kein Redesign.
- Sechs native Dialoge auf der Startseite haben jetzt explizite, an ihren sichtbaren Überschriften ausgerichtete Accessible Names. Die Zugangsdialog-Semantik und Fehlermeldungs-Fokusführung werden über Rollen, `ariaSnapshot()` und Tastaturinteraktion geprüft.
- Fünf neue 320-Pixel-WCAG-Browsertests prüfen Startseite, Anmeldung, alle fünf Taverne-Ansichten sowie Regelbibliothek, Homebrew-Pakete und Charakterlabor inklusive Fehlerzustand. Der fünfte Test bedient tatsächlich einen Kleriker mit Kämpfer-Mehrklassenstufe, Zaubertricks, Zaubersuche, Auswahlvalidierung und mobiler Fehlermeldungs-Fokussierung. Der Audit wartet auf das tatsächliche Ende kurzzeitiger Einblendanimationen, bevor er Kontrast bewertet.
- Ein zusätzlicher Browser-End-to-End-Test schaltet die Verbindung real im Browser offline und wieder online: Cloud-Status ändert sich, lokale Würfelaktionen und JSON-Export bleiben verfügbar, der lokale Stand bleibt erhalten.
- Das lokale Browser-Provisioning bleibt aus dem Git-Artefakt ausgeschlossen (`.test-browsers/`, `.test-tools/`). Tests behalten Screenshots und Traces bei Fehlern.

## Transparente Testgrenzen

| Nachweis | Status | Umfang / Einschränkung |
| --- | --- | --- |
| Extern bestätigter Eingangsstand | **371/371** | Bestätigung des Prüfers, nicht hier erneut ausgeführt |
| Neu: automatische WCAG-Prüfung in echtem Chromium | **5/5 bestanden** | Lokal mit 320px und Axe; geprüft nach den UI-Fixes |
| Neue Accessibility-Semantik und Dialog-Fokus | **bestanden** | In den fünf WCAG-Tests enthalten, `ariaSnapshot()` und ARIA-Rollen |
| Vollständige Logiktests auf korrigiertem Projektstand | **317/317 bestanden** | Node-Testprozess, Exitcode 0 |
| Öffentlicher Build und Sicherheitstest | **58 Dateien, 7/7 bestanden** | Test- und Public-Build-Befehle, Exitcode 0 |
| Chromium-UI-Gesamtlauf ohne drei Emulator-Konten | **16/16 bestanden** | Realer Browserprozess; 10 vorhandene reine UI-Tests und 6 neue WCAG-/Offline-Tests, Exitcode 0, 33,6 s |
| Chrome-/Firefox-Zoom 200% **nativ** | **offen** | CSS-Zoom und geänderte Viewportgröße sind kein Browserzoom |
| Echter Screenreader (Sprachausgabe) | **offen** | Browser-Semantikprüfung ersetzt keine gesprochene NVDA/Orca-Stichprobe |
| Vollständige CI auf GitHub Actions | **offen** | Workflow lokal vorbereitet; tatsächlicher Lauf nach Zweigübertragung nötig |
| Reales isoliertes Firebase-Staging | **offen – B15-C3** | Kein Zugriff auf Produktionsprojekt `wuerfelbund` |

### Browser-Provisioning in dieser Laufzeit

Das Playwright-CDN lieferte hier unvollständige Browserarchive. Ein alternativer Chromium-Headless-Prozess wurde nach integritätsgeprüfter, gestreamter Bereitstellung tatsächlich gestartet. Auch ein offizielles Firefox-Archiv wurde lokal vollständig geladen; das aktuelle Ausführungscontainer-Setup hat jedoch kein bereitgestelltes `/proc`, wodurch Firefox und der vollständige Chrome-Prozess lokal nicht starteten. Daraus wird **kein Firefox-Testerfolg für die neu hinzugefügten Tests behauptet**. Der unabhängige externe Firefox-Nachweis der Eingangs-ZIP bleibt gültig.

Für die finale Chromium-Matrix wurden **16/16 Nicht-Emulator-Browsertests** in einem gemeinsamen Prozess ausgeführt. Der separat extern bestätigte Mehrspieler-/Emulatortest wurde hier bewusst nicht als Neunachweis gezählt, weil die aktuelle lokale Java-Bereitstellung den Firebase-Emulator nicht starten konnte. Der verpflichtende neue Gesamt-CI-Lauf muss deshalb die komplette Matrix einschließlich drei Demo-Konten übernehmen. Er erwartet pro Browser derzeit **17 Tests**.

## Bedien- und Designbewertung

Das dunkle Grün, die warmen Goldakzente, die bestehende Typografie und die Navigation bleiben unverändert. Die genannten Eingriffe betreffen ausschließlich Bedienbarkeit und Zugänglichkeit. Keine neuen Dashboards, Karten, Dekorationen, KI-Bilder, Marketingtexte oder parallelen Speichersysteme. Die bisherige visuelle Prüfung mit Originalscreenshots in `docs/screenshots/b15/` bleibt die Gestaltungsreferenz. Neuer Fokus und Dialogbenennung sind an nachvollziehbaren UI-Mängeln orientiert. Drei neue **echte Chromium-Screenshots** liegen dort unter `chromium-anmeldung-320.png`, `chromium-charakterfehler-320.png` und `chromium-mehrklassen-zauber-320.png`. Der lange mobile Charakterbogen bleibt ein UX-Prüfpunkt: Seine vielen Pflichtwahlen sind funktional und werden in der gezeigten 320-Pixel-Ansicht ohne horizontales Abschneiden bedient; eine zukünftige kompakte Schrittführung wird hier bewusst nicht spekulativ vorgezogen.

## Nächste verbindliche Reihenfolge

1. **B15-C1:** Entwicklungszweig nach Nutzerautorisierung zu GitHub übertragen; echten erfolgreichen CI-Lauf beider Browser und der Emulatorprüfungen anhand der GitHub-Actions-URL belegen.
2. **B15-C2:** Fehlende native 200%-Browserzoom-Prüfung, echte Screenreader-Stichprobe und weitere komplexe Zauber-/Mehrklassen-/Offline-Flows abschließen.
3. **B15-C3:** Unabhängiges Firebase-Staging mit drei echten Staging-Konten und sicherer Rollenprüfung (keine Produktionsdaten).
4. **B15-C4:** Vollständiger Gate-C-Abschlussbericht, Regression, Lizenz-, Datenfluss-, Sicherheits-, UX- und ZIP-Audit.
5. **B16:** Betreiber-/Release-Bereitschaft, einmalige vollständige Nutzerabnahme und **erst nach expliziter Freigabe** getrennte Veröffentlichung.

B17–B24 bleiben weiterhin zurückgestellt.
