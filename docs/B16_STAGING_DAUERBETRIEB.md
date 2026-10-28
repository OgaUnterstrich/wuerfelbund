# Würfelbund B16-RC.1 – dauerhafte, kostenlose Firebase-Staging-Website

**Stand 28.10.2026.** Kein siebentägiger Testplan, kein automatischer Ablauf der Website. Der getrennte Host **`https://wuerfelbund-staging.web.app/`** gehört ausschließlich zum bestehenden Firebase-Spark-Projekt `wuerfelbund-staging`. Der produktive Host und `wuerfelbund` bleiben tabu. Ein Hosting-Staging-Deploy ist **keine** Freigabe von GitHub Pages oder Produktiv-Firebase.

## A. Möglichst nur ein Startbefehl – Windows-PC

1. Die neue ZIP in einen eigenen Ordner entpacken. Den Ordner im Explorer öffnen, in der Adressleiste `cmd` eingeben und Enter drücken. So öffnet sich die Eingabeaufforderung **direkt im Projektordner**.
2. Diese **eine Zeile** ausführen:

   ```cmd
   npm ci && npm run staging:site
   ```

3. Nur bei **`DAUER-STAGING VERIFIZIERT: https://wuerfelbund-staging.web.app/`** den Browser öffnen. Dieselbe Adresse funktioniert langfristig auf PC und Xiaomi Redmi. Es gibt **keine siebentägige Ablaufgrenze**; die Site wird bei einem bewusst erneuten Deploy aktualisiert.

Die bereits vorhandene Firebase-CLI-Anmeldung wird wiederverwendet. Die gepinnte Projekt-CLI wird durch `npm ci` installiert und liest die **öffentliche** Konfiguration der registrierten Staging-Web-App selbst – **kein Kopieren eines API-Keys nötig**. Für den Hosting-Build ist **kein Java** erforderlich. Falls noch keine CLI-Anmeldung besteht, einmal `npx firebase login` ausführen und anschließend den Einzeiler erneut starten.

**Voraussetzungen:** Node und npm auf Windows; im bestehenden Spark-Projekt eine Firebase-Web-App sowie eine Hosting-Site mit **exakt der ID `wuerfelbund-staging`**. Fehlt die Hosting-Site, bricht der Befehl ab. Dann in [Firebase Console](https://console.firebase.google.com/) **wuerfelbund-staging** auswählen → Hosting → *Get started* und die Standard-Site mit dem exakten Namen einrichten; niemals das Projekt `wuerfelbund` wählen. Keine neue Datenbank, kein zusätzlicher bezahlter Dienst, kein zweites Firebase-Projekt.

**Termux alternativ:** Im entpackten Projektordner `npm ci && npm run staging:site`. Je nach Android-/Termux-Paketstand kann die native Firebase-CLI eingeschränkt sein. Am unkompliziertesten erfolgt der Staging-Deploy auf dem Windows-PC; das Xiaomi benötigt für die Nutzung **nur Android Chrome**, keinen Hosting- oder Termux-Server.

## B. Exakte externe Auswirkungen dieses einen Befehls

| Schritt | Extern / lokal | Veränderung |
| --- | --- | --- |
| `npm ci` | Lokal + npm Registry | Lockfile-Abhängigkeiten nur in den Projektordner installieren; keine Cloud-Firebase-Schreibaktion |
| CLI-Site-Liste `hosting:sites:list` | **Staging-Cloud** | Hosting-Site und festen HTTPS-Host prüfen; Firebase-CLI kann die Hosting-API **nur in Staging** einschalten, falls sie noch nicht aktiv ist |
| `apps:list WEB`, `apps:sdkconfig WEB` | **Staging-Cloud** | Registrierte Web-App, App-ID und öffentliche Firebase-Webkonfiguration **nur lesen**; niemals Web-App neu erzeugen |
| Build | **Lokal** | 60 geprüfte Webdateien aus der Allowlist, danach ein eigener Ordner `dist-staging-site`, in dem die **gesamte Produktions-Runtime** durch die validierte Staging-Runtime ersetzt wird |
| `firebase deploy --only hosting --project wuerfelbund-staging --config <generiert>` | **Staging-Hosting** | **Nur die Live-Auslieferung der Staging-Site `wuerfelbund-staging`** wird aktualisiert. Das ist eine dauerhaft erreichbare *Testsite*, nicht das produktive Projekt. Keine Firestore-Rules, keine Nutzerdaten oder Auth-Konten werden dabei verändert |
| Nachprüfung | **Staging-Hosting nur lesend** | Den ausgelieferten HTML-Inhalt und die Staging-Runtime über den exakten Host zurücklesen; Ergebnis/Site-ID gegen Firebase-CLI verifizieren |

**Keinesfalls durch diesen Befehl verändert:** Produktivprojekt `wuerfelbund`, Produktivwebsite, GitHub Pages, GitHub-Repositorium, GitHub-Workflows als externe CI-Runs, Datenbankinhalte oder -regeln, Testkonten, Billing/Spark-Plan, App-Check-Enforcement. Der Deploy verwendet **kein implizites Standardprojekt**. Sein statisches Hosting-Config-Objekt enthält **genau eine** Hosting-Site; `--only hosting` verhindert jede Rules-/Functions-Veröffentlichung.

**Host-/Konfigurationsschutz:** Schon **vor dem Upload** muss die Firebase-CLI als Site-ID `projects/wuerfelbund-staging/sites/wuerfelbund-staging` und als Default-URL `https://wuerfelbund-staging.web.app` liefern. Web-App-ID, `projectId`, `authDomain` und API-Key-Format müssen exakt zusammenpassen. Die generierte Website akzeptiert **nur HTTPS auf diesem festen Host**; sie verweigert `localhost`, fremde `web.app`-Domains und Produktions-Hosts. Ein zusätzlich eingeschleuster Prod-Firebase-Client, ein geänderter App-Check-Site-Key oder unbekannte Dateien führen zum Build-Abbruch. Nach dem Deploy werden Version und echte HTTPS-Auslieferung erneut geprüft.

## C. Einmalige Einstellungen, falls nötig

- **Hosting-Site fehlt:** Nur im korrekten Staging-Projekt die oben beschriebene Hosting-Initialisierung durchführen. Es wird **kein** Hosting eines anderen Projekts als Ersatz gewählt.
- **Mehrere Firebase-Web-Apps ohne Hosting-Verknüpfung:** Optional die **öffentliche App-ID**, nicht den API-Key, als `WB_STAGING_APP_ID` setzen; bei nur einer App oder einer mit der Hosting-Site verknüpften App erfolgt die Zuordnung automatisch. Bei widersprüchlichen App-IDs bricht der Befehl ab.
- **Authentication Authorized domains:** Im Staging unter Authentication → Settings → Authorized domains **genau `wuerfelbund-staging.web.app`** prüfen/eintragen (ohne Protokoll oder Pfad). Das normale Hosting-Deploy verspricht **keine automatische Auth-Domain-Erweiterung**. Eventuelle vorhandene `firebaseapp.com`-Domains bleiben in der passenden Staging-Auth-Konfiguration. Keine Produktions-Domain als Ersatz verwenden.
- **Keine externe Änderung bei reiner Vorbereitung gewünscht:** Nach `npm ci` nur `npm run staging:site:prepare` ausführen. Es prüft die Staging-CLI-Metadaten und erstellt lokal das sichere Bundle, **ohne Hosting-Dateien hochzuladen** (die Firebase-Hosting-API-Abfrage kann die API im Staging aktivieren).

## D. Neue B16-Firestore-Rechte optional separat prüfen

Die **Website-Veröffentlichung in Staging verändert Firestore-Regeln bewusst nicht**. Für die neue SL-Übergabe müssen dort nach Prüfung die B16-R1-Regeln aktiv sein. Dazu gibt es einen **gesonderten, ausdrücklich auszuführenden** Befehl:

```cmd
npm run staging:rules
```

Er ersetzt **ausschließlich Firestore-Sicherheitsregeln** in `wuerfelbund-staging`; kein Hosting-Deploy und keine automatische Datenlöschung. Den vorherigen Staging-Rules-Stand in der Firebase Console sichern und bei Fehlern dort gezielt zurückgehen. **Nicht** `wuerfelbund` verwenden.

Optionaler, kontrollierter echter Rechte-/Konto-Smoke **erst nach den Staging-Regeln**:

```cmd
npm run staging:smoke
```

9 echte Firebase-Szenarien: drei unabhängige Auth-Konten, atomare Kampagnen-/Indexanlage, unberechtigte Fremdlese- und Rollenversuche, gesperrter Kampagnen-Delete, verweigerte Besitzerübernahme ohne verifizierte SL-E-Mail, Figurensichtbarkeit, SL-Geheimnisse, persönliche Cloud-Auskunft und sichere Auflösung eines frisch angelegten Testspielerkontos.

**Genau benannte Smoke-Schreibaktionen:** Drei `wb-b16smoke-...@example.test`-Testidentitäten, eine `B16-SMOKE-...`-Kampagne, eigene Mitglieder-/Indexeinträge, eine künstliche Figur und eine synthetische SL-Notiz. **Nur die gerade erzeugte Testfigur, deren eigene Spieler-Mitgliedschaft/Index und genau das eigene Testspieler-Auth-Konto** werden als positiver Löschtest entfernt. Kampagne, SL- und Fremd-Testkonto sowie synthetische Notiz bleiben im **Staging** für spätere manuelle, einzeln geprüfte Bereinigung. Kein Admin-Wildcard-Löschen. Das lokale Protokoll `test-results/b16-staging-smoke-<Zufallskennung>.json` enthält Pfade und UIDs **ohne Passwörter**; es ist **nicht in der Projekt-ZIP**. Für verbliebene ältere C3-Testdaten gilt weiterhin `B15_C4_STAGING_BEREINIGUNG.md`.

## E. Genau eine abschließende Nutzer-Sitzung – PC und Xiaomi

1. **PC:** Dauer-Staging-Host öffnen, mit einem eigenen **Test-Mailpostfach** Konto anlegen; echten Verifikationslink öffnen, Status aktualisieren, Passwortreset-Mail tatsächlich empfangen. Kein produktives Passwort/Produktivkonto nutzen.
2. **Mehrbenutzer:** Drei getrennte Testkonten (SL + zwei Spieler), Kampagne, Einladung, Figur, Cloud-Übernahme und Neustart auf zweitem Konto durchspielen. Rechte und SL-Geheimnisse prüfen. Mit verifizierter SL-E-Mail den Besitz bewusst an ein beigetretenes Mitglied übertragen. Cloud-Auskunft sowie Löschung eines **nicht leitenden** Testkontos prüfen.
3. **Xiaomi Redmi / Android Chrome:** Den **gleichen** `wuerfelbund-staging.web.app`-Link öffnen. Touch und kleine Displays, Konto-Dialoge, hoch-/querformat, 200-%-Zoom, Offline/Wiederverbindung, Spielbogen. Mit aktiviertem TalkBack **echte hörbare** Beschriftungen/Fokusführung prüfen; nicht mit simulierten A11y-Ausgaben gleichsetzen.
4. **PC:** Chromium/Firefox, Tastatur, echter 200-%-Zoom und lokale Import-/Exportwege in derselben einmaligen Sitzung abschließen. Auffälligkeiten dokumentieren; keine weiteren Zwischenabnahmen nach jedem technischen Schritt.
5. **Erst danach:** Betreiberangaben/Datenschutz/App-Check-Kostenentscheidung und ausdrückliche Freigabe für **separate** Produktion und GitHub Pages. Diese Staging-Website ist **niemals** die öffentliche Produktivwebsite.

## F. Dauerbetrieb, Spark und Rückweg

- Anders als ein sieben Tage gültiger Vorschaukanal bleibt die Staging-Website bestehen, bis du ihre Hosting-Version bewusst ersetzt oder die **Staging-Site** gezielt entfernst. Auf Spark gelten weiterhin Kontingente für Hosting-Traffic, Firestore und Auth. **Keine** Kostenautofreigabe, Blaze-Umstellung, Premium-Sperre oder neue Dienst-Abhängigkeit.
- `X-Robots-Tag: noindex` und `Cache-Control: no-store` reduzieren Indexierung und Caching, sind aber **keine Zugangssperre**. Der Staging-Link ist öffentlich erreichbar. Nur künstliche Testinhalte, restriktive Firestore-Regeln und bewusst verteilte URL verwenden.
- Bei Fehlern die bisherige **Staging-Hosting-Version** in der Firebase Console / Hosting-Releases prüfen und gezielt auf die letzte geprüfte Version zurückgehen. Keine Produktionsversion übernehmen, keine globalen Datenlöschungen. Auth-/Firestore-Testdaten laufen **nicht** mit Hosting ab.
- Quellen: [Firebase Hosting](https://firebase.google.com/docs/hosting/), [Hosting-Ressourcen und Versionen](https://firebase.google.com/docs/hosting/manage-hosting-resources), [Firebase Spark-Kontingente](https://firebase.google.com/pricing).
