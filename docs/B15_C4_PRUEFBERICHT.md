# Würfelbund B15-C4 – interne Gesamtabnahme / Gate C

**Datum:** 28.10.2026  
**C4-Implementierung:** abgeschlossen; lokale Logik-, Emulator-, Datenfluss-, Lizenz-, UX-Struktur- und Build-Audits bestanden.  
**Gate-C-Freigabeentscheidung: GESPERRT**, da der vollständige neue Browserlauf auf dem geänderten C4-Stand sowie native 200-%-Zoom- und gesprochene Screenreader-Stichproben nicht nachgewiesen sind. **Kein Produktions-Deployment, kein B16-Nutzertest.**

## 1. Verifizierte Arbeitsgrundlage und übernommene Erfolge

- In dieser C4-Nachricht war **keine neue Datei angehängt**. Stattdessen wurde die im selben Arbeitsbereich vorhandene, zuvor ausgelieferte `wuerfelbund-b15-c3-staging-vorbereitung-2026-10-28.zip` als neuester hier verfügbarer Projektstand geprüft und in ein frisches C4-Arbeitsverzeichnis entpackt. Die ZIP-Integritätsprüfung war erfolgreich; alle C3-Skripte und Berichte sind enthalten. Ein möglicherweise außerhalb dieses Arbeitsbereichs veränderter Git-Stand lässt sich daraus nicht behaupten.
- **C1/C2:** Der vom Betreiber schon früher nachgewiesene GitHub-Actions-Lauf für `360a53b` (Logik, Chromium, Firefox) bleibt **bestanden**; keine Wiederholung als „ungeprüft“.
- **C3:** Externe Betreiberbestätigung vom 28.10.2026 für `wuerfelbund-staging`: Firestore, E-Mail/Passwort, Rules-Deploy, echter `npm run test:c3:staging` mit **9/9 bestanden, 0 fehlgeschlagen**, zusätzlich erfolgreiche GitHub-Actions-Prüfungen. **C3 BESTANDEN**, auch wenn für diese neuere Bestätigung keine Run-URL/Rohlogs vorlagen. Kein Kontakt zum Produktivprojekt `wuerfelbund` durch C4.
- Frühere historische Dokumente mit „C3 ausstehend“ beschreiben nur den Stand **vor** der Betreiberbestätigung; die aktuelle Entscheidung steht hier und im C3-Nachtrag.

## 2. C4-Änderungen und behobener Befund

**Befund C4-01 – still abgeschnittene Kampagnenliste:** `index.html` lud lediglich die ersten 60 Einträge aus dem persönlichen Kampagnenindex und ignorierte darüber hinaus weitere berechtigte Kampagnen. Einzelne Netzwerkfehler beim Nachladen konnten außerdem wie eine leere Liste erscheinen. Das widerspricht den Anforderungen „keine künstlichen Beschränkungen“ und ehrliche Cloud-Statusanzeigen.

**Korrektur:** Die vorhandene `js/rules/ux.mjs` bietet jetzt `loadIndexedCampaigns`. Sie lädt **alle** Indexeinträge in Gruppen von höchstens 20 gleichzeitigen Abfragen, verwirft überholte Antworten nach Abmeldung/Offlinewechsel, ignoriert nur nachweislich entzogene/verwaiste Indizes und reicht echte Netz-/Serverfehler an die sichtbare Fehlermeldung weiter. Keine neue Bibliothek, Datenhaltung, UI-Komponente oder serverseitige Regeländerung. Zwei echte asynchrone Unit-Fälle prüfen 73 Kampagnen samt Konkurrenzgrenze sowie Berechtigungsentzug/Netzfehler; ein Wiring-Test bewacht die Einbindung.

**C4-Prüfautomatik:** Sieben zusätzliche Tests in `ops/tests/gate-c.test.mjs` prüfen Quellen/Lizenz, Netzwerk- und Datenflussgrenzen, Staging-/Produktionsisolation, mobile Screenshot-Metadaten und Fokus/Reduced Motion, Anti-Bloat, Release-Sperren sowie den Staging-Aufräumplan. `npm run test:c4:audit` läuft nun im **bestehenden** Logikjob und im weiterhin manuell gesperrten Release-Workflow. **Kein weiterer Workflow.**

## 3. Tatsächlich erzielte Prüfergebnisse

| Ausführungsort / Prüfart | Ergebnis | Aussage |
| --- | --- | --- |
| **Extern durch Betreiber, C1/C2 GitHub** | **Success** | Frühere drei Jobs und Browserartefakte, Stand `360a53b` |
| **Extern durch Betreiber, C3 Staging** | **9/9 bestanden** | Echte Auth-/Firestore-Dienste im getrennten `wuerfelbund-staging` |
| **Extern durch Betreiber, GitHub C3** | **Success gemeldet** | Keine neue CI-Run-ID übermittelt; als externe Bestätigung übernommen |
| **Lokal C4 Node-Gesamtsuite** | **322/322 bestanden** | Regeln, 12 Klassen/Stufen, Spiel-/Speicher-/Quellenlogik, C4-Kampagnen-Paginierung |
| **Lokal C4 Firestore-Emulator** | **25/25 bestanden** | Bestehende Rollen-, Quellen-, Konkurrenz-, Fremdzugriffsregeln |
| **Lokal C4 Auth- und Firestore-Demo-Emulator** | **9/9 bestanden** | Drei echte SDK-Konten im Emulator; Einladungen, Rechte, Sync, Offline, Sperrung |
| **Lokal C4 Public-Build** | **8/8 bestanden** | 58 freigegebene Dateien, SHA-Inventar, Inhalts-/Syntax-/Release-Gates |
| **Lokal C4 Querschnitts-Audit** | **7/7 bestanden** | Lizenz, Datenfluss, Sicherheit, Mobile-Quellen, Anti-Bloat, Sperren, Cleanup-Plan |
| **Lokal C4 realer Chromium-Smoke** | **1/1 bestanden** | Würfeln, Reload, Navigation, Export; Chrome for Testing 156 |
| **Lokal C4 vollständiger Chromium-/Firefox-Lauf** | **nicht durchgeführt** | Der zusätzliche isolierte Lauf wurde wegen nicht freigegebener externer Firebase-Verbindung abgelehnt; kein Umgehen der Sicherheitsfreigabe |
| **Browser-Testentdeckung** | **17 Chromium + 17 Firefox** | 34 konfigurierte Fälle; eine Auflistung ist kein Ausführungsnachweis |
| **npm-Audit, produktiv** | **0 Meldungen** | `npm audit --omit=dev` |
| **npm-Audit, inklusive Entwicklung** | **5 mittlere, 0 hohe/kritische** | Bestehende transitive `firebase-tools`-Kette; kein riskantes erzwungenes Downgrade |
| **Öffentliches Release-Gate** | **korrekt GESPERRT** | Fehlende B16-Admin-/Datenschutz-/Kontaktfreigaben, erwarteter Exitcode 1 |

### Browser-Infrastruktur und Nachweisgrenze

Das offizielle Chrome-for-Testing-156-Headless-Archiv wurde separat heruntergeladen und anhand seines publizierten MD5/ETag sowie der ZIP-Integrität geprüft. Innerhalb der Standard-Ausführungsbeschränkung endete Chromium mit `SIGTRAP`; ein einzelner echter Smoke-Test gelang anschließend in der freigegebenen Ausführungsumgebung. Der **weitere vollständige** Lauf wurde explizit wegen möglicher nicht autorisierter externer Firebase-Kontakte gestoppt. Es gab **keinen** erneuten Zugriff auf das echte Firebase-Staging oder auf Produktion, keine verdeckte Wiederholung und keinen als bestanden ausgegebenen Gesamtlauf. Die ältere GitHub-Browserbestätigung bleibt vollständig gültig; sie bestätigt aber nicht automatisch die neue C4-Kampagnenlogik.

## 4. Verbindliches Gate-C-Protokoll nach Roadmap

| Block | C4-Befund | Status |
| --- | --- | --- |
| 1. SRD 5.5e-Regeln | 12 Klassen × Stufen 1–20, Talente/Mehrklassen/Zauber/Ressourcen durch bestehende 322er Suite abgedeckt; keine neuen Regeländerungen | **Bestanden (lokale Automation)** |
| 2. Lebenszyklus & Daten | Bereits vorhandene Erstellen-/Bearbeiten-/Stufen-/Export-/Import-/Restore-/Legacy-Tests weiter grün | **Bestanden (lokale Automation)** |
| 3. Anwendung im Spiel | Kampf, TP, Trefferwürfel, Zauber, Inventar, Rast, Erschöpfung über Engine- und Integrationstests grün | **Bestanden (lokale Automation)** |
| 4. Mehrspieler & Konkurrenz | Demo-Auth 9/9, Firestore 25/25 und echte externe Staging-C3 9/9; vollständige neue Browsermatrix nicht erneut | **Backend bestanden; C4-Browser offen** |
| 5. Rechte und Geheimnisse | Firestore-Regeln + negatives Rechtesetup bestanden, separate Live-Staging-Bestätigung übernommen, kein Regel-/Produktivdeploy | **Bestanden (Emulator + externer C3-Nachweis)** |
| 6. Optionale Welten & Homebrew | Edras, Quelle an/aus, Pakete, LE, Versionen und SRD-Invarianz in bestehenden Tests; keine kanonischen Geheimnisse eingeführt | **Bestanden (lokale Automation)** |
| 7. Browser & Design | 13 frühere echte B15-Screenshots, vorhandene Axe-/Tastatur-/320px-Tests und ein aktueller Chromium-Smoke; C4-Fullrun, **nativer 200-%-Browserzoom und gesprochene Screenreader-Stichprobe offen** | **GESPERRT bis Nachweis** |
| 8. Auslieferung & Lizenzen | 25 parsebare SRD-Datensätze, verlinkte CC-BY-4.0-/5e-bits-MIT-Attribution, öffentliche Allowlist und bewusst gesperrte Freigabe; neue ZIP separat integritätsgeprüft | **Technisch bestanden, rechtliche B16-Freigaben weiterhin gesperrt** |

Keine offene **belegte** kritische Datenverlust-/Berechtigungsregression. Offene Ausführung ist jedoch nicht dasselbe wie „kein Fehler“, weshalb Gate C vorläufig **GESPERRT** bleibt.

## 5. Anti-KI-Design und mobile UX – tatsächliche Sichtprüfung

Die bereits im Projekt enthaltenen echten 320-Pixel-Chromium-Aufnahmen `chromium-start-320.png`, `chromium-spielbogen-320.png` und `chromium-studio-320.png` wurden bei C4 erneut betrachtet, nicht neu erzeugt. Sie zeigen die bestehende eigene Palette aus dunklem Grün, gedämpftem Gold, ruhiger Typografie und konsistenten Symbolen. Acht Warnsignale des Designguides:

1. **Austauschbarer Text:** Spielaktionen sind konkret benannt; vereinzelte poetische Überschriften gehören zur eigenen Taverne-Identität, kein neues generisches Marketing.
2. **Scheinkarten:** Übersichts-/Quick-Links führen zu echten Bereichen, keine C4-Dekokarten.
3. **Effekte:** Bestehende subtile Flächen/Verläufe unterstützen Gliederung; C4 fügt keine hinzu.
4. **Icons:** Konsistente SVG-/Würfelmetaphern, keine neuen zufälligen Emojis.
5. **Typografie/Hierarchie:** Startseite und Spielansicht besitzen erkennbare Hauptaktionen; schmale Studio-Ansicht bleibt sehr lang und dicht.
6. **KI-Fantasybilder:** Keine neue generierte Grafik; Würfelsymbol als bestehendes SVG.
7. **Scheinwerte:** Sichtbare Kennzahlen kommen aus lokalem Spielstand; automatischer Audit sucht zusätzlich nach Platzhaltern.
8. **Formularbedienung:** 320px-Reflow, Fokusstile und Reduced-Motion sind belegt; die reale Langform-Bedienung und Screenreader-Ausgabe bleiben gesonderte C4-Nachweise.

**Entscheidung:** Kein unbegründetes Redesign. Die dichte, lange mobile Charaktererstellung bleibt ein konkreter UX-Beobachtungspunkt für die letzte interne Browser-/B16-Nutzungsprüfung, kein erfundener kritischer Fehler.

## 6. Staging-Testdaten und veröffentlichte Umgebung

Die Daten aus der extern bestandenen C3-Prüfung dürfen im isolierten Spark-Projekt noch existieren. Die exakte, nicht automatische Bereinigung ist unter [B15_C4_STAGING_BEREINIGUNG.md](B15_C4_STAGING_BEREINIGUNG.md) beschrieben: nur `wuerfelbund-staging`, überprüfte C3-Testkampagnen, Unterkollektionen vor Eltern, Nutzerindizes und verbliebene drei Auth-Konten. **Nicht ausgeführt.** Keine Admin-Credentials oder Service-Account-Dateien in Code/ZIP.

Das Release-Flag `firebaseStagingVerified` in `ops/release-config.json` bleibt bewusst `false`: Es ist Teil der **gesonderten B16-Freigabekette** und wird nicht aufgrund eines C3-Funktionstests automatisch in eine Veröffentlichungsberechtigung umgewandelt. Alle übrigen Freigabeflags, `datenschutz.html` und `impressum.html` bleiben gesperrt. Das Produktivprojekt `wuerfelbund` bleibt unangetastet.

## 7. Verbleibende Arbeiten bis B16 und Batchanzahl

**Roadmap-Zählung:** C1–C3 sind abgeschlossen, C4 ist implementiert, aber **Gate C noch nicht freigegeben**. Es stehen daher **zwei Hauptphasen** bis zur öffentlichen v1-Beta aus: **Abschluss B15 (offene C4-Browser-/Accessibility-Nachweise)** und danach **B16**. C4 und R1–R3 sind **Unterarbeitspakete**, keine zusätzlichen Hauptbatches. Nach einem späteren vollständig bestandenen Gate C ist nur **ein Hauptbatch B16** übrig.

1. **Internes C4-Restgate:** Neuer vollständiger Chromium-/Firefox-CI-Lauf des C4-Stands mit gesicherter Netzwerkisolation; native 200-%-Zoom-Probe und echte Screenreader-Sprachausgabe. Keine bereits bestätigten C1/C2/C3-Ergebnisse wieder auf „ungeprüft“ setzen.
2. **B16-R1:** Passwortwiederherstellung, Kontoverifikation, sichere Datenexport-/Auskunfts-/Löschwege, Aufbewahrung/Retention und SL-Austritt, ohne globale Firestore-Löschrechte.
3. **B16-R2:** Betreiberkontakt, Impressum/Datenschutz, Auth-Domains, App Check, tatsächliche Spark-Quotenüberwachung, getrennte GitHub-/Firestore-Freigabe und Rückrollplan. Nur nach individueller Betreiberentscheidung.
4. **B16-R3:** Eine konsolidierte RC-ZIP, **einmaliger großer Praxistest durch den Nutzer**, gezielte Korrekturen, ausdrückliche Produktionszustimmung und erst danach separat publizierter HTTPS-/Auth-Smoke.

**Manuell nötige Einstellungen (nicht jetzt als Zwischenabnahme):** Staging-Testdatensäuberung in Firebase Console, später B16-Kontakt-/Rechts- und Auth/App-Check-/Quoteneinstellungen sowie die abschließende explizite Veröffentlichungsgenehmigung. Für C4 selbst sind keine neuen Accounts, API-Keys oder Nutzer-Testläufe verlangt.

**Fazit: C4-Codearbeiten und erreichbare Regressionen BESTANDEN; Gate C GESPERRT bis die genannten fehlenden Browser-/Accessibility-Belege nachgeholt sind.** Es fand keine Veröffentlichung statt.
