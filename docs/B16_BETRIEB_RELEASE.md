# B16 – Betreiberanleitung: Firebase, GitHub Pages und kostenloser Betrieb

**Stand:** 28.10.2026 · **Release Candidate:** `1.0.0-rc.1` · **KEINE Veröffentlichung erfolgt.**

**B16-RC.1-Betriebsnachtrag:** Eine **dauerhafte Staging-only Firebase-Hosting-Website** ist jetzt mit eigenem, geprüften Web-Bundle vorbereitet. Sie endet nicht nach sieben Tagen und verwendet ausschließlich das vorhandene Spark-Projekt `wuerfelbund-staging`. [Einmaliger Startbefehl, externe Änderungen, Staging-Smoke und PC/Xiaomi-Abnahme](B16_STAGING_DAUERBETRIEB.md). Der normale öffentliche Client bleibt unverändert; keine GitHub-Pages-/Produktivfreigabe.

Diese Schritte sind **Vorbereitung**, nicht die Aufforderung, die produktive Website jetzt freizuschalten. C1–C4 sowie die echten C3-Staging-Tests (9/9) und die C4-GitHub-Prüfung bei `99d7bd8` sind vom Betreiber als bestanden bestätigt. B16 hat neue Regeln und neue Kontowege; vor einem Live-Deploy braucht **dieser** Stand eigene Staging- und Browsernachweise.

## 1. Trennung der drei Umgebungen

| Zweck | Firebase-ID | Zugriff | Wichtig |
| --- | --- | --- | --- |
| Automatisierte lokale Tests | `demo-wuerfelbund` | `localhost` / `127.0.0.1`, Emulatoren 9099 und 8080 | Emulatordaten, **keine Cloud** |
| Echte externe Vorabprüfung | `wuerfelbund-staging` | eigene Firebase-Console-Konfiguration, Testaccounts | Nur Staging; C3-Testdaten vor Löschung einzeln prüfen |
| Spätere öffentliche Beta | `wuerfelbund` | produktiver HTTPS-Host | Erst nach einem großen Nutzertest und schriftlicher Freigabe |

Die **normale** Laufzeitkonfiguration in `js/rules/firebase-runtime.mjs` zeigt auf `wuerfelbund`, sobald die Site über HTTPS auf einem anderen öffentlichen Host läuft. Deshalb das unveränderte Standard-`dist` oder rohe `index.html` **niemals** als Staging-Website öffentlich ausliefern. **Einzige zulässige Ausnahme:** `npm run staging:site` erzeugt und prüft **`dist-staging-site`**, ersetzt dort die gesamte Firebase-Runtime und liefert ausschließlich an `wuerfelbund-staging.web.app`. Lokal nutzen bestehende Tests die `demo-`-Emulatoren. Keine Firebase-Service-Account-Datei, `.env` oder private Schlüssel in Git oder die Projekt-ZIP geben. Firebase-Web-API-Keys sind öffentlich, aber müssen auf die benötigten Firebase-APIs beschränkt bleiben. Quelle: https://firebase.google.com/docs/projects/api-keys

## 2. Firebase – zuerst Staging, erst später Produktion

1. In https://console.firebase.google.com/ **exakt `wuerfelbund-staging`** auswählen. Projektnamen vor jeder Aktion oben kontrollieren. E-Mail/Passwort und Firestore sind dort laut C3 schon eingerichtet; nicht neu erstellen.
2. In **Authentication → Settings → Authorized domains** nur die wirklich verwendete Staging-Domain hinzufügen. `localhost` ist ausschließlich für lokale Emulatorprüfungen nötig. Fremde oder Wildcard-Domains vermeiden. Keine Produktiv-Domains ungeprüft ins Staging kopieren.
3. Die neuen `firestore.rules` lokal mit `npm run test:firestore` prüfen. Sie fügen einen atomaren Besitzerwechsel und Indexpflicht hinzu; `/campaigns/{cid}` bleibt nicht frei löschbar. Anschließend **nur im ausdrücklich gewählten Staging-Projekt** bereitstellen. Vorher `docs/B15_C4_STAGING_BEREINIGUNG.md` auf verbliebene C3-Testdaten anwenden. Ein versehentlicher Klick auf das produktive Projekt ist ein Stoppsignal.
4. In Staging mit **drei neuen Testkonten** prüfen: Registrierung und Bestätigungs-Mail, Passwortreset, echte Übergabe (bestätigte SL → aktiver Spieler), Löschung eigener Spielerfiguren, gesperrter Spieler, Kontoarchiv und Kontoauflösung. Für die Transferfunktion muss die SL-E-Mail tatsächlich bestätigt sein. Die bestehenden echten **C3 9/9** gelten weiter, belegen aber nicht die neuen B16-R1-Abläufe.
5. Zu keiner Zeit `firebase deploy` ohne explizites `--project wuerfelbund-staging` für die Staging-Abnahme nutzen. **Nicht** `wuerfelbund` als Standardprojekt einstellen; produktive Regeln vor Freigabe nicht ersetzen.
6. Erst nach bestandenem finalem Nutzer-Test und ausdrücklicher Zustimmung in der Firebase Console das Produktivprojekt **`wuerfelbund`** separat öffnen. Aktuelle Rules-Version mit der bisherigen sichern, korrekte `projectId`, App-ID, Domains und Firebase-Key-API-Beschränkungen gegen die öffentliche App prüfen. Unter **Authentication → Settings → Authorized domains** den **tatsächlich benutzten Hostnamen** erlauben: bei der üblichen Repository-Pages-Adresse beispielsweise `ogaunterstrich.github.io` (ohne `https://` und ohne `/wuerfelbund`); bei abweichender Custom Domain **deren** Hostname, nicht die pauschale GitHub-Domain. Authentifizierungs-Weiterleitungen und E-Mail-Link-Vorlagen auf die freigegebene Domain abstimmen. Danach die freigegebenen Regeln separat ausrollen und einen kurzen HTTPS-/Login-/Rechte-Smoke mit explizit freigegebenem Testkonto ausführen.

### E-Mail-Konten und Betroffenenrechte

- Unter **Authentication → Sign-in method** E-Mail/Passwort aktiv lassen; im Reiter **Templates** Absender/Sprache und Vorlagen für Verifikation/Passwortreset prüfen.
- Die Web-App versendet beim Anlegen eines Kontos einen Verifikationslink; nicht verifizierte Bestandskonten werden nicht still ausgesperrt. **Nur die neue SL-Übergabe** setzt serverseitig eine verifizierte E-Mail voraus. Für Kontoauflösung wird per Passwort erneut authentifiziert.
- Benutzer findet in **Einstellungen → Online-Konto und Cloud-Daten** Auskunfts-JSON, Bestätigung, ID und Löschung. Bei entzogenem Zugriff, verwaisten Daten, älteren Publikationen, Log-/Anbieteranfragen und alleiniger SL ohne Nachfolger muss der Betreiber einen geschützten Auskunfts-/Löschprozess bearbeiten. Keine unsicheren globalen `allow delete`-Regeln hinzufügen.
- Umgang mit gemeinsamen Kampagnen-/SL-Inhalten und eine vorgeschlagene, **noch nicht genehmigte** Aufbewahrungsmatrix stehen in `B16_RECHT_RETENTION_ENTWURF.md`. Diese Angaben sind rechtlich zu prüfen.

## 3. App Check – vorbereitete Integration ohne Kosten-Autostart

Die RC enthält `js/rules/app-check-config.mjs` und eine optionale `ReCaptchaEnterpriseProvider`-Initialisierung **vor** Auth/Firestore. Der öffentliche Site-Key ist bewusst **leer**: App Check ist damit noch nicht aktiv. Emulatoren nutzen nie App Check; produktive Durchsetzung bleibt aus.

1. Erst im getrennten Staging-Web-Client eine reCAPTCHA-Enterprise-Webregistrierung erwägen und die von Google tatsächlich verlangten Voraussetzungen/Billing-Konditionen prüfen. **Keine** private Secret-Key-Datei oder Debug-Token committen.
2. Für einen **späteren, gesondert genehmigten App-Check-Test** den öffentlichen Enterprise-Site-Key nur in einer eigens dafür geprüften Staging-Kopie verwenden. **Der hier gelieferte dauerhafte Staging-Build verweigert absichtlich einen nicht leeren App-Check-Key** und startet ohne Enforcement. Nie Staging- und Produktions-App-ID oder Site-Keys vermischen.
3. Mit Android Chrome, Desktop-Chromium/Firefox, Tracking-Schutz und schwacher Verbindung Login, Firestore und Token-Erneuerung überprüfen. 24 Stunden App-Check-Metriken in der **Staging-Console** beobachten. Keine echte Benutzergruppe durch vorzeitiges Enforce aussperren.
4. **Erst nach erfolgreicher Kompatibilitäts- und Kostenprüfung** in der konkreten Firebase Console die Enforcement-Einstellung separat entscheiden; den verifizierten Site-Key dann für Produktion setzen und die betroffenen Produkte schrittweise absichern. Bei Problemen vor Rollout stoppen, nach Rollout Enforcement zurücknehmen (siehe Rollback).

Firebase empfiehlt Enterprise für neue Webintegrationen; die kostenlose Schwelle von **bis zu 10.000 Assessments/Monat** ist **keine Garantie**, dass ein beliebiges Wachstum dauerhaft gratis bleibt. Token-TTL beeinflusst Assessment-Zahlen. Auf Spark keine nicht geprüfte kostenpflichtige Integration erzwingen. Quellen: https://firebase.google.com/docs/app-check/web/recaptcha-provider, https://firebase.google.com/docs/app-check/enable-enforcement, https://firebase.google.com/pricing

## 4. Spark-Kontingente, keine Premiumsperren

Stand laut offizieller Firebase-Preisliste für Standard-Firestore: **1 GiB Speicher**, **50.000 Dokumentlesungen/Tag**, **20.000 Schreibvorgänge/Tag**, **20.000 Löschvorgänge/Tag**, **10 GiB Egress/Monat** kostenlos. Auth-E-Mail-Kontingente können niedriger liegen, z. B. **150 Passwortreset-Mails/Tag auf Spark**. Dies sind Dienstkontingente, keine künstlichen Würfelbund-Nutzerlimits. TTL-Löschungen, verwaltete Backups/Restore und PITR können kostenpflichtige Features sein – nicht aktivieren, solange Spark-only Voraussetzung bleibt.

1. Firebase Console → **Usage** (Firestore und Authentication getrennt) regelmäßig prüfen; zu Beta-Start täglich, danach bedarfsorientiert. Eventuelle automatische Warnungen nur verwenden, wenn sie tatsächlich auf Spark verfügbar sind.
2. Unerwartet hohe Lese-/Mailzahlen, Scraping oder Quota-Fehler protokollieren und Ursache beheben; nie unbemerkt auf Blaze wechseln. Falls dauerhaft über dem Spark-Rahmen: Nutzer offen über Betriebsgrenze informieren und gemeinsam Kapazitätskonzept entscheiden, **keine Premiumsperren**.
3. Missbrauchsschutz: passende Auth-API-Quoten, restriktive Security Rules, App Check nach Verträglichkeitsprüfung und gezielte Sitzungs-/Fehlermeldungen. Keine aus UI-Fehlern konstruierten Finanzprognosen.

Quellen: https://firebase.google.com/pricing, https://firebase.google.com/docs/firestore/quotas, https://firebase.google.com/docs/auth/limits

## 5. GitHub Pages – allein manuelle Freigabe

1. Repo `OgaUnterstrich/wuerfelbund` öffnen und Branch `b15-gate-c-ci-ux` bzw. später einen dedizierten B16-PR zur Prüfung nutzen. **Die hier erstellte ZIP wurde nicht automatisch gepusht.**
2. ZIP entpacken; Projekt ohne `node_modules` in einen *neuen* Branch übernehmen; `npm ci`, `npm run test:logic`, `npm run test:firestore`, `npm run test:c3:emulator`, `npm run build:public`, `npm run test:public`, `npm run test:c4:audit`, `npm run test:b16:audit`, `npm run test:browser:isolated` (Chromium/Firefox) ausführen. Browser-CDN/Java müssen verfügbar sein. Bei fehlendem Tool gilt der Test als **offen**.
3. Im Repository **Settings → Pages** die Source auf **GitHub Actions** kontrollieren, nicht einen frei zugänglichen Push-Branch mit der ungetesteten RC als Pages-Quelle verwenden.
4. **Settings → Environments → github-pages**: nach Möglichkeit Branch-Schutz `main`, erforderliche Reviewer und ggf. Wartezeit prüfen; Verfügbarkeit hängt vom GitHub-Plan/Repo-Sichtbarkeit ab. Release-Workflow enthält bewusst nur `workflow_dispatch`, `main`, die Zeichenfolge `PUBLIC-V1-CONFIRMED`, die vollständigen Gates und den unabhängigen Deploy-Job. Ein `push` löst **keinen** Pages-Deploy aus.
5. **Erst nach** großer B16-Nutzerabnahme, rechtlicher Prüfung und ausdrücklicher Betreiberentscheidung die Felder in `ops/release-config.json` wahrheitsgemäß setzen, rechtlich geprüfte Seiten publizierbar machen und einen separat freigegebenen PR nach `main` übernehmen. `npm run check:release` muss dann **erstmals** grün sein.
6. Danach manuell **Actions → Würfelbund · öffentliche Seitenfreigabe → Run workflow** starten, `main` auswählen und nur mit bewusster Freigabe `PUBLIC-V1-CONFIRMED` eingeben. Den erfolgreichen `deploy`-Job, Pages-URL und HTTP-Sicherheit prüfen. Firebase-Rules-Deploy ist **nicht** Teil dieses Pages-Workflows und erfordert eine eigene Freigabe.

Quelle: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## 6. Android/Termux – sparsame Operatorroute

1. ZIP im Dateimanager in einen eigenen Ordner im Termux-Home entpacken. Bei Android-Speicherfreigabe nur benötigte Projektdateien, **keine** privaten Firebase-Schlüssel verschieben.
2. In Termux mit `node -v`, `npm -v`, `java -version` prüfen, ob eine unterstützte Node-Version (CI: Node 22) und Java 21 verfügbar sind. Bei fehlenden Tools die Paketquellen der jeweiligen Termux-Version prüfen; nicht beliebige externe Binärdateien aus Foren installieren.
3. `npm ci` (Lockfile beibehalten). `npm run test:logic`, `npm run test:public` und `npm run test:b16:audit` sind ohne Browser möglich. Firestore benötigt Java 21 und Emulator-Komponenten; Firefox/Chromium-Desktop sind auf nativem Android/Termux nicht immer lauffähig.
4. Für Browsermatrix und Staging-Zugriffsprüfung die bereits genutzten **GitHub Actions** als unabhängigen Linux-Testläufer verwenden. Deren CI-Erfolg ersetzt **nicht** den letzten einmaligen Android-Praxistest des Benutzers, erspart aber manuelle Zwischentests.
5. Android-Großtest erst mit der final geprüften B16-Version und den Schritten aus `B16_EINMALIGER_NUTZERTEST.md` durchführen. Keine ZIP auf die Produktivwebsite hochladen, bevor der Betreiber ausdrücklich zustimmt.

## 7. Manuell noch erforderlich (Release-Blocker)

- [ ] B16-spezifische Staging-Tests für Handover, Account-Erasure und App-Check-Verträglichkeit; keinen zweiten C3-9/9-Nachweis verlangen.
- [ ] Externe C4-GitHub-Prüfung aus der Betreiberbestätigung übernommen; B16 Chromium/Firefox und native Zoom-/Screenreader-Stichproben separat nachweisen.
- [ ] Eigene Kontakt-/Betreiberangaben und geprüfte Datenschutz-/Impressumsseiten.
- [ ] Account-Auskunft/Löschung auch in widerrufenen und älteren Datenbeständen organisatorisch klären.
- [ ] Freigabe zu Spark-Monitoring, Auth-Domains und App Check einschließlich Kostenrisiken.
- [ ] Großer einmaliger B16-Praxistest; **danach** ausdrückliche Freigabe von Produktion und GitHub Pages.

Bis dahin bleiben alle `ops/release-config.json`-Freigabefelder `false` und beide Rechtstexte enthalten `RELEASE_BLOCKER`.
