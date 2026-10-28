# B15-C3 – Prüfbericht (28.10.2026)

> **Verbindlicher externer Nachtrag vom 28.10.2026 (C4-Eingang):** Der Betreiber bestätigt die vollständig eingerichtete unabhängige Firebase-Spark-Umgebung `wuerfelbund-staging`, aktivierte E-Mail/Passwort-Authentifizierung, erfolgreich bereitgestellte Firestore-Regeln und den echten Lauf `npm run test:c3:staging` mit **9/9 bestanden, 0 fehlgeschlagen**. Die GitHub-Actions-Prüfungen wurden ebenfalls als erfolgreich gemeldet; der produktive Firebase-Projektstand `wuerfelbund` ist unverändert. **C3 gilt damit als BESTANDEN.** Die unten aufgeführten früheren „Staging ausstehend“-Angaben sind der historische lokale Stand **vor** diesem externen Nachweis und gelten nicht mehr als offene C3-Prüfung. Eine Run-URL und ein Rohlog wurden nicht übermittelt; die Aussage ist als Betreiberbestätigung gekennzeichnet. Sichere Bereinigung verbliebener Testdaten: [C4-Staging-Bereinigung](B15_C4_STAGING_BEREINIGUNG.md).

**Ergebnis:** Implementierung und lokale C3-Automation bestanden; **reales Firebase-Staging noch offen**, bis der Betreiber ein separates Spark-Projekt einrichtet und die dortigen Tests ausführt. **B15 / Gate C / Veröffentlichung bleiben GESPERRT.**

## 0. Eingangsdatei und GitHub-Ausgangsnachweis

Die übergebene Datei `wuerfelbund-b15-c1-c2-github-vorbereitung.zip` enthält **172 Verzeichniseinträge/Dateien insgesamt**, 11.897.611 Byte entpacktes Material und bestand die vollständige ZIP-Integritätsprüfung. Darin liegen die B15-C1/C2-Dokumentation, die beiden Workflows, Quellen, Regeln und die vorhandenen Prüfungen. Sie ist der richtige Ausgangsstand.

Der vom Betreiber neu gemeldete erste erfolgreiche GitHub-Actions-Lauf wird **nicht** als offen geführt: `ogaunterstrich/wuerfelbund` · `b15-gate-c-ci-ux` · `360a53b` · **Success** · **2:11 min** · **Logik, Chromium, Firefox bestanden** · **zwei Browserartefakte**. Dokumentiert in `B15_C1_C2_GITHUB_BESTAETIGT.md`. Dieser Erfolg bezieht sich auf den Ausgangscommit, **nicht** auf die nachfolgenden C3-Änderungen. Eine unabhängige Run-URL liegt nicht vor.

## 1. Umsetzungen

1. **GitHub-Actions-Warnungen adressiert:** In beiden vorhandenen Workflows `actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-java@v6`, `actions/upload-artifact@v7`. Pages-Actions im weiterhin manuell gesperrten Release-Workflow: `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`. Alle Job-Runner explizit `ubuntu-24.04`. Keine neue Workflowdatei, weiterhin zwei Browser-Matrixjobs plus Logikjob.
2. **C3-Real-Auth-Testmatrix:** `tests/staging/c3-staging.test.mjs` nutzt drei voneinander getrennte echte Firebase-Auth-Sitzungen sowie Firestore-Operationen; alle acht Sachgruppen werden mit insgesamt neun Node-Testresultaten ausgegeben. Über den bestehenden Logik-CI-Job wird diese Matrix **nur mit Demo-Emulatoren** ausgeführt, nicht mit Cloud-Zugangsdaten.
3. **Getrenntes echtes Spark-Staging:** Opt-in über `npm run test:c3:staging` und `npm run staging:deploy-rules`, mit doppelter Projekt-ID-Bestätigung, Ausschluss der Produktions-ID `wuerfelbund`, strenger `staging`-Namensvorgabe und Verweigerung fremder Cloud-/Emulator-Umgebungen. Staging-Konfiguration ausschließlich zur Laufzeit aus der lokalen Shell, nie im öffentlichen Build.
4. **Release und Dateigrenzen:** Keine Änderungen an produktiven Firestore-Regeln, API-/App-Konfiguration des Webclients, Hosting, Pages-Freigabe oder Betriebsdaten. Der bestehende Release-Gate-Code bleibt unfreigegeben und die öffentliche Build-Allowlist unverändert. Keine zusätzlichen npm-Pakete oder Designkomponenten.

## 2. Trennung der Prüfstatus

| Bereich | Ergebnis | Evidenz / Grenze |
| --- | --- | --- |
| **GitHub-bestätigt, ursprünglicher Commit `360a53b`** | **Erfolgreich** | Betreiber-Nachweis: alle drei Jobs, zwei Browserartefakte, 2:11 min |
| **Lokal neu: Logik** | **319/319 bestanden** | `npm run test:logic`, Node 24.22.1, inklusive zwei Schutztests für Staging-Ziele |
| **Lokal neu: bestehende Firestore-Regelmatrix** | **25/25 bestanden** | `npm run test:firestore`, Java 21.0.13, Firebase-Demo-Emulator |
| **Lokal neu: C3, echte Auth-SDK-Identitäten im Demo-Emulator** | **9/9 bestanden** | `npm run test:c3:emulator`, 3 Konten, 8 Szenariengruppen |
| **Lokal neu: Public-Build/Schutz** | **8/8 bestanden** | 58 freigegebene Webdateien, Release-/Workflow- und Secret-Grenzen |
| **Lokal neu: Workflow-Syntax** | **bestanden** | Beide YAML-Dateien geparst, erwartete Jobs erhalten |
| **Lokal neu: Browser-Testentdeckung** | **34 gefunden** | 17 Chromium + 17 Firefox; **nur Auflistung, keine Ausführung** |
| **Lokal neu: echte Browser-Ausführung** | **nicht erneut bestätigt** | Playwright-CDN lieferte hier ungültige 0-MiB-Archive; zudem fehlt `/proc`. Der ältere erfolgreiche GitHub-Nachweis bleibt gültig. |
| **Lokal: Release-Gate** | **wie vorgesehen abgewiesen** | `npm run check:release` Exitcode 1, Freigabefelder/Impressum/Datenschutz gesperrt |
| **Lokal: Produktionspaket-Audit** | **0 Schwachstellen** | `npm audit --omit=dev`; Entwicklungspakete gesondert zu prüfen |
| **Lokal: gesamter Abhängigkeits-Audit** | **5 mittlere, 0 hohe/kritische** | `npm audit`; transitive Schwachstellen in der bereits vorhandenen `firebase-tools`-Entwicklungskette, nicht in neuen Laufzeitpaketen; kein erzwungenes Downgrade |
| **GitHub: neue C3-Workflowversion** | **ausstehend** | Noch kein Push, kein CI-Lauf für neuen Stand; Erfolg `360a53b` nicht übertragen |
| **Echtes getrenntes Firebase-Staging** | **ausstehend** | Keine Betreiber-Staging-ID, kein Web-API-Key, keine Live-Tests; Anleitung bereitgestellt |
| **B16: großer manueller Abschlusstest** | **bewusst ausstehend** | Keine Zwischenabnahme erbeten |

## 3. C3-Abdeckung

| Schutz-/Kampagnenziel | Demo-Emulator | Echtes Staging |
| --- | --- | --- |
| Drei unabhängige E-Mail/Passwort-Konten | bestanden | ausstehend |
| Kampagne, Besitzerindex, zwei Einladungsbeitritte | bestanden | ausstehend |
| Rollen, manipulationssichere Indizes, ungefragter Fremdzugriff | bestanden | ausstehend |
| Charakterbesitz, fremde Abfragen, private SL-Daten | bestanden | ausstehend |
| Gleichzeitige Firestore-Transaktionen ohne verlorenes Update | bestanden | ausstehend |
| Serverbestätigter Live-Listener und Charakterpersistenz nach Login | bestanden | ausstehend |
| Netztrennung, lokaler Cache, Wiederverbindung | bestanden | ausstehend |
| Sperrung/Entzug der Mitgliedschaft, verhinderter Wiederbeitritt | bestanden | ausstehend |

Erwartete `PERMISSION_DENIED`-Einträge bei ausdrücklich unerlaubten Aktionen sind **bestandene Negativprüfungen**, keine Fehler. Das reale Staging ist entscheidend, um dieselben Aussagen auf die **tatsächlich dort ausgerollten** Regeln und echte Firebase-Dienste zu übertragen. Der Live-Test bleibt ein SDK-/Datenbanktest, kein voll gehosteter UI-Test. Es wurden keine Produktionskonten kontaktiert.

## 4. Risiko- und Freigabebewertung

- Keine neuen Laufzeitabhängigkeiten, keine neuen Workflows, keine neue Online-Speicherstruktur und kein kosmetisches Redesign. Mobil- und Offline-Muster bleiben unverändert.
- Der Staging-Test erzeugt keine langlebigen Geheimnisse in Dateien. Testkonten werden per Auth-SDK gelöscht, sofern möglich. Da die Sicherheitsregeln Kampagnenlöschen verbieten, bleiben echte Staging-Testdokumente bewusst zurück und müssen per Konsole überprüft/bereinigt werden.
- Backend-Schutz ersetzt nicht Browser-/Screenreader-Tests. Native 200-%-Zoom- und echte Sprachfeedbackprüfungen bleiben als separate offene B15-C2-Nachweise erhalten.
- Versionsupdates der Actions sind anhand offizieller Releases gewählt, **aber erst ein neuer GitHub-Lauf** kann ihre konkrete Integration als bestanden bestätigen.
- GitHub Pages bleibt ausschließlich manuell und mehrfach gesperrt, Firestore `wuerfelbund` wird niemals für C3 verwendet. Ohne nachweislich positives Staging und B15-C4 bleibt B16-/Release-Bereitschaft ausstehend.

## 5. Betreiber-Nächste-Schritte

1. `B15_C3_FIREBASE_STAGING_BETRIEB.md` abarbeiten (eigenes kostenloses Projekt; kein Produktionszugang).
2. Reale `test:c3:staging`-Ergebnisse dokumentieren und verbleibende Staging-Testdaten entfernen.
3. Den neuen Entwicklungsstand sicher auf GitHub nach bewusster Quellcode-Übernahme prüfen; **keine** Pages-/Produktivfreigabe auslösen.
4. B15-C4 als letztes internes Gate, danach **einmalig** B16 mit dem Betreiber.
