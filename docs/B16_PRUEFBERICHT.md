# Würfelbund – B16-R1/R2/R3: Prüfbericht zum gesperrten Release Candidate

**Letzter Betriebsnachtrag:** Das funktional unveränderte RC.1 hat zusätzlich einen **dauerhaften, strikt isolierten Spark-Staging-Hostingweg** erhalten (keine Sieben-Tage-Vorschau). Die neuen lokalen Staging-Host-/Berechtigungsprüfungen und die extern weiterhin offenen Schritte sind im [B16_STAGING_DAUERBETRIEB_PRUEFBERICHT.md](B16_STAGING_DAUERBETRIEB_PRUEFBERICHT.md) dokumentiert. Der folgende Bericht hält den historischen vollständigen RC.1-Stand fest.

**Stand:** 28.10.2026 · **Version:** `1.0.0-rc.1` · **Prüfumgebung:** isolierter Linux-Workspace mit echten lokalen Firebase-Auth-/Firestore-Emulatoren und echten Browserprozessen.

**Ergebnis:** Die neue B16-RC ist technisch für die **einmalige abschließende Betreiber- und Stagingabnahme vorbereitet**, aber **nicht zur Veröffentlichung freigegeben**. Weder GitHub Pages noch die produktive Firebase-Umgebung `wuerfelbund` wurden verändert. Das Release-Gate bleibt absichtlich geschlossen.

## 1. Ausgangsbasis und Belegklassen

Die Projektquellen stammen aus dem geprüften Archiv `wuerfelbund-b15-c4-gate-c-abnahme-2026-10-28.zip`. Der Betreiber hat für `OgaUnterstrich/wuerfelbund`, Branch `b15-gate-c-ci-ux`, Commit `99d7bd8`, die externe **C4-GitHub-Prüfung als erfolgreich** gemeldet; diese Meldung gilt als bestätigte externe Grundlage und wurde nicht als neuer eigener GitHub-Lauf ausgegeben. Weiterhin verbindlich: C1/C2 bestanden; C3 in **echtem** `wuerfelbund-staging` **9/9** bestanden; C4 **322/322** Logik-, **7/7** Audit- und **8/8** Buildprüfungen, GitHub erfolgreich. Keine erneute Nutzerbestätigung erforderlich.

**Die B16-Änderungen sind noch nicht in GitHub Actions auf dem aktuellen Code und noch nicht im echten Firebase-Staging nachgewiesen.** Ein lokaler Demo-Emulator ist kein Ersatz für diese beiden unabhängigen Nachweise.

## 2. B16 – lokal ausgeführte Prüfungen

| Prüffeld | Nachweis | Bewertung |
| --- | --- | --- |
| SRD-Regelwerk, Stufe 1–20, Charakterlebenszyklus, Ein-/Ausgabe, Zauber, Multiclassing und Edras | `npm run test:logic`: **327/327** | Bestanden, lokal |
| Firestore-Sicherheitsregeln einschließlich positiver/negativer Rechte, owner handover, Indexpflicht, Löschschutz | `npm run test:firestore`: **30/30** mit **echtem Firestore-Emulator** | Bestanden, lokal |
| Authentifizierung SL + zwei Spieler, Einladung, Rechte, Persistenz und konflikthafte Aktionen | `npm run test:c3:emulator`: **9/9** mit Auth-/Firestore-Emulator | Bestanden, lokal; *nicht* der externe C3-Staging-Test |
| Öffentliche Dateifreigabe- und Lizenz-Auslieferung | `npm run build:public`: **60 erlaubte Webdateien** | Bestanden, lokal |
| Allowlist-/Sicherheitsprüfung des Build-Artefakts | `npm run test:public`: **8/8** | Bestanden, lokal |
| Bestehende C4-Sicherheits-, Quellen-, Lizenz- und UX-Prüfungen | `npm run test:c4:audit`: **7/7** | Bestanden, lokal |
| Neue B16-Konto-, App-Check- und Veröffentlichungs-Prüfungen | `npm run test:b16:audit`: **6/6** | Bestanden, lokal |
| Browseraufgaben im **echten Chromium**: Konten, Kampagne, Figuren, Offline, Export, 320px, Reflow, Tastatur, Zugänglichkeit | `npm run test:browser:isolated:chromium`: **21/21** | Bestanden, lokal |
| Dieselbe Matrix im **echten Firefox** | `npm run test:browser:isolated:firefox`: **21/21** | Bestanden, lokal |
| Öffentliche Freigabe | `npm run check:release`: **gezielt verweigert** | **Sperre funktioniert wie gefordert** |

**Zusammenhängender Abschlusslauf:** `npm run test:b16:rc` endete mit **10/10 erfolgreichen bzw. absichtlich gesperrten Prüfstufen, Exitcode 0**. Er schreibt `test-results/b16-rc-summary.json` mit den tatsächlichen Status- und Exitcodes; genau diese JSON-Nachweisdatei liegt der RC-ZIP bei. Logs erwarteter `PERMISSION_DENIED`-Versuche sind bei den **negativen** Firestore-Rechtetests beabsichtigt. Die Browser laden das gepinnte Firebase-Web-SDK aus dem eigenen `node_modules`; übrige externe Hosts werden in den Tests blockiert. Ein `demo-`-Projekt verhindert versehentliche echte Cloud-Zugriffe. Die Firefox-Browser-Sandbox wurde **nur im restriktiven lokalen Testcontainer** deaktiviert, nachdem Firefox sonst wegen `/proc`-Namensräumen vor dem ersten Test abstürzte; die reale Anwendung und deren Firestore-Sicherheit wurden dafür nicht gelockert. GitHub CI verwendet reguläre Runner.

**Abhängigkeiten:** `npm audit --omit=dev` meldete **0 produktive Sicherheitsbefunde**. Die umfassendere Entwickler-Abhängigkeitsprüfung meldete **5 mittlere**, **0 hohe/kritische** Befunde in der bereits vorhandenen transitiven Entwicklungs-Toolkette. Kein zusätzliches Framework, keine neue Datenbank, keine neuen Runtime-Pakete und kein automatisches kostenpflichtiges Backend wurden eingeführt.

## 3. B16-R1 – Konten, Datenschutz und Kampagnenrechte

**Umgesetzt und automatisch geprüft:**

- E-Mail-/Passwort-Anmeldung bleibt erhalten. Kontoerstellung sendet Verifikations-Mail; erneut senden und Bestätigungsstatus mit aktualisiertem Token abrufen ist in Einstellungen möglich. **Eine verifizierte E-Mail wird serverseitig für die kritische Besitzerübergabe verlangt**; alte unverifizierte Konten werden nicht ohne Anlass ausgesperrt.
- Passwort-Zurücksetzen ist im Login-Dialog verfügbar; die Rückmeldung verrät nicht, ob eine E-Mail zu einem Konto gehört. Quoten-/Netzfehler werden allgemein behandelt.
- Sichtbare Konto-UID, Cloud-Auskunft als JSON, Einwilligung zur bewussten Löschung mit Passwort-Reauthentifizierung und exakter Bestätigungsformel. Nur eigene Figuren/private Pakete werden gelöscht; Auth-Löschung erfolgt **nach** den zugeordneten Firestore-Daten. Teilfehler werden nicht als Erfolg ausgegeben. Der Browser-Spielstand bleibt gesondert.
- Eine alleinige SL kann ihr Konto nicht unkontrolliert löschen. Besitzübergabe nur an bereits beigetretene, nicht blockierte Person; alter Besitzer wird in **einer Transaktion** Spieler. UI zeigt, dass die neue SL auch SL-Notizen sehen kann. Kampagnen-Elterndokumente bleiben generell vom Client aus **nicht löschbar**.
- Neu angelegte Kampagnen/Mitgliedschaften erfordern einen passenden persönlichen Index im selben Batch. Die `firestore.rules` verhindern Selbstbeförderung, fremde Figurenlöschung, Zugriff auf SL-Geheimnisse und unauthorisierte Übernahme. Negative Tests beweisen diese Schranken.

**Bewusst offen:** Eine klientseitige Auskunft ist nicht automatisch eine vollständige rechtliche Auskunft: Providerprotokolle, entzogene Mitgliedschaften, alte publizierte Inhalte und verwaiste Unterkollektionen benötigen einen **authentifizierten Betreiberweg**. Die im `B16_RECHT_RETENTION_ENTWURF.md` vorgeschlagenen Löschfristen und -zuständigkeiten sind **noch nicht rechtlich genehmigt**. Keine pauschale Firestore-Löschfreigabe als Abkürzung.

## 4. B16-R2 – Betrieb, Recht und Release

- Drei sauber benannte Umgebungen: `demo-wuerfelbund` nur lokal, `wuerfelbund-staging` für echte Betreiberprüfung, `wuerfelbund` nur nach Produktionserlaubnis. **Keine automatische Produktion-Migration/Rule-Änderung**.
- Bestehende GitHub-Workflows bleiben drei Jobs (Logik, Chromium, Firefox) und getrennte, **manuelle** Pages-Auslieferung. B16-Audit ergänzt die bestehenden Schritte. `ops/release-config.json` bleibt in allen Freigaben `false`; `impressum.html` und `datenschutz.html` bleiben als `RELEASE_BLOCKER` markiert.
- Optionale App-Check-Initialisierung mit reCAPTCHA Enterprise vorbereitet; **Site-Key leer**, keine Enforcement-Aktivierung. Free-Tier-Assessment-Grenzen, Android-/Firefox-Kompatibilität und mögliche Rechnungsfolgen erfordern eine gesonderte Betreiberentscheidung.
- Separater Rollback für Pages, Firestore-Regeln, App Check und fehlerhafte Kontoauflösung; keine riskante automatische Datenbankbereinigung.
- Spark-Kontingente, Auth-Domains, Mailvorlagen, Umgang mit C3-Staging-Testdaten und Android/Termux sind in `B16_BETRIEB_RELEASE.md` beschrieben.
- Die Rechtstexte bleiben bis zur Betreiberprüfung **Entwürfe**, nicht rechtsverbindliche Vollständigkeitsbehauptungen.

## 5. B16-R3 – Grenzen der technischen Abnahme

Die Playwright-Suiten decken tatsächliche DOM-/Firebase-Abläufe in Chromium/Firefox ab: Charakteranlage/Bearbeiten/Import/Rast, optionales Edras, Cloud-Mehrpersonen-Spiel, Rollen, Auth-E-Mails im Emulator, Offline/Online, 320px-Ansichten, Tastaturnavigation und automatisierte A11y-Befunde. Es wurden **echte Browser** verwendet, keine bloß simulierten Browserausgaben.

**Nicht als bestanden behauptet:** Eine 320px-Reflow-Prüfung entspricht einem wichtigen Layoutstress bei angenommener 640px-Ausgangsbreite, ist aber **kein nativer Browser-200%-Zoom-Nachweis**. Automatische A11y-Checks sprechen **keine** Texte über TalkBack/NVDA aus und ersetzen keinen echten Hör-/Screenreader-Test. Der einmalige Android-Praxistest und reale B16-Staging-Abläufe bleiben Betreiber- und Freigabevoraussetzung. Es gibt außerdem keine belastbare Aussage zu sämtlichen möglichen Android-Geräten/Netzen oder einer formal vollständigen WCAG-Konformität.

## 6. Noch offen bis zur öffentlichen Beta

| Erforderlicher Nachweis/Entscheid | Verantwortung | Zeitpunkt |
| --- | --- | --- |
| B16-Version in GitHub Actions, unverändert bestehende drei Jobs | GitHub CI nach Übernahme der RC | Vor der finalen Nutzerabnahme |
| B16-Konto-/Übergabe-/Löschwege mit echten Testkonten in **`wuerfelbund-staging`**, ausdrücklich nicht Produktion; vorsichtige C3-Testdatenbereinigung | Betreiber mit `B16_BETRIEB_RELEASE.md`, automatisierte Nachweise soweit möglich | Vor öffentlicher Beta |
| Auth-Domains und E-Mail-Vorlagen, realistische Android-Chrome-Verifikation/Reset | Betreiber | Vor Nutzertest |
| 200%-Zoom **nativ**, echte TalkBack-Speech-/Bedienprobe und kleine reale Android-Geräte | Einmaliger abschließender B16-Nutzertest | Nur einmal am Ende |
| Rechtsprüfung und reale Anbieter-/Verantwortlichen-/Retention-/Betroffenenrechtsangaben | Betreiber / fachliche Prüfung | Vor Freigabe |
| App-Check-Enforcement nur nach Staging-, Kompatibilitäts- und Kostenentscheidung | Betreiber | Vor oder bewusst nach Beta (begründen) |
| Genau bezeichnete Releaseversion, freigegebener PR/Commit und **ausdrückliche** Publikationszustimmung | Betreiber | Ganz zuletzt |

**Verbleibende Entwicklungsbatches bis B16:** **0** – B16-R1/R2/R3 sind für den **gesperrten RC technisch implementiert**. **Verbleibende Abnahme-/Betriebsaufgaben: 7 Zeilen oben.** Das sind keine neuen Entwicklerbatches und keine Forderung nach Zwischentests. Eventuelle Befunde beim einmaligen B16-Praxistest führen zu gezielten Korrekturen und erneuter technischer Prüfung, nicht zu vorgezogener Veröffentlichung.

## 7. Dokumente und Reproduzierbarkeit

- `B16_BETRIEB_RELEASE.md` – exakte Firebase-/GitHub-/Termux-Schritte, Staging-Trennung, Spark und App Check.
- `B16_EINMALIGER_NUTZERTEST.md` – ein zusammenhängender abschließender Test auf Android und Desktop, nicht nach jedem Batch.
- `B16_RELEASE_CHECKLISTE.md` – Freigabefolgen und Stoppsignale.
- `B16_ROLLBACK.md` – abgesicherte Rückkehrstrategie.
- `B16_RECHT_RETENTION_ENTWURF.md` – noch zu genehmigendes Dateninventar und Rechteweg.
- `docs/B15_C4_STAGING_BEREINIGUNG.md` – C3-Staging-Testdaten ausschließlich im korrekten Projekt prüfen und gezielt entfernen.

**Freigabeentscheidung für dieses Archiv: `TECHNISCHER RC / ÖFFENTLICH GESPERRT`.** Keine automatische Produktivwebsite, keine produktiven Firebase-Regeln, keine heimliche Abbuchungs-/Billing-Umstellung.
