# Würfelbund: verbindliche Batch-Roadmap von 0.28 zur öffentlichen v1-Beta

> **Letzter B16-RC.1-Betriebsnachtrag · 28.10.2026:** Keine weiteren Entwicklerbatches: dauerhafte, streng getrennte Spark-Staging-Website statt eines temporären Sieben-Tage-Kanals. CI verwendet **ausschließlich** `demo-wuerfelbund`; externe Staging-Aktionen geschehen nur nach bewusstem lokalen Betreiberbefehl. [Dauer-Staging-Anleitung](B16_STAGING_DAUERBETRIEB.md) · [Nachtragsprüfbericht](B16_STAGING_DAUERBETRIEB_PRUEFBERICHT.md). Die einmalige B16-Nutzerabnahme, Auth-/Rechtsfreigaben und ausdrückliche Produktionsfreigabe bleiben offen.

> **Neuer B16-Status · 28.10.2026:** Der Betreiber hat B15-C4 inklusive GitHub-Workflow für `OgaUnterstrich/wuerfelbund`, `b15-gate-c-ci-ux`, Commit `99d7bd8` erfolgreich bestätigt; C1–C4 sind deshalb als **abgeschlossen** übernommen. B16-R1 Konten/Berechtigungen und R2 Betriebs-/Release-Vorbereitung sind im gesperrten RC umgesetzt. Die neuen B16-spezifischen Tests und der große einmalige B16-Nutzertest werden separat nachgewiesen; **keine öffentliche Veröffentlichung**. Verbindliche Einzelheiten: [B16-Prüfbericht](B16_PRUEFBERICHT.md), [Betreiberanleitung](B16_BETRIEB_RELEASE.md), [Nutzertest](B16_EINMALIGER_NUTZERTEST.md).

> **Statusnachtrag C4 · 28.10.2026:** C3 (separates Staging `wuerfelbund-staging`, echte 9/9, GitHub-CI) ist durch den Betreiber bestätigt. C4-Automation und lokales Audit sind umgesetzt, ein stilles 60-Kampagnen-Limit ist behoben. Die neue Browsermatrix und native Zoom-/Screenreader-Stichproben bleiben als **Gate-C-Restnachweise** offen. Details: [C4-Prüfbericht](B15_C4_PRUEFBERICHT.md). B15 ist deshalb noch offen; danach folgt nur B16 als weiterer Hauptbatch. Keine Veröffentlichung oder Nutzertests zwischendurch.

Stand: 27.10.2026 · Grundlage: lokale Projektfassung 0.28 und tatsächlich dokumentierte Grenzen in `README.md`, `ARCHITECTURE.md`, `EDRAS_INTEGRATION.md`. **Plan, keine Behauptung bereits implementierter Funktionen.**

## Produkt- und Releasegrenze

- **v1 unterstützt die offen lizenzierten D&D-2024-/5.5e-Regeln aus SRD 5.2.1** als Basis, einschließlich auswählbarer SRD-Optionen, hoher Stufen, Multiclassing und eines alltagstauglichen Charakterzustands. Das kostenpflichtige PHB/DMG/MM und sonstige Bücher sind **nicht** automatisch Bestandteil einer SRD-Fassung.
- **Mehrspieler:** Eine Spielleitung und mehrere Spieler können dieselben dafür freigegebenen Kampagnendaten sehen; Aktionen und Zugriffsrechte sind geprüft. Lokale/private Entwürfe und Cloud-Daten sind klar erkennbar getrennt, bis ein Nutzer sie ausdrücklich übernimmt.
- **Welten:** Edras bleibt ein optionaler, versionierter Aufsatz. Sein Fragebogen bestimmt ausschließlich Edras-Eigenschaften; niemals die D&D-Klasse, Unterklasse, Herkunft, Stufe oder allgemeine Attribute. Geschichten und Entscheidungen bleiben frei.
- **Keine vollständige Computersimulation:** Wo Voraussetzungen oder Wirkungen nicht rechtssicher bzw. zuverlässig automatisch auflösbar sind, zeigen UI und Charakterbogen die Regel und den Spielleitungsentscheid **ausdrücklich** an. Keine erfundenen automatischen Resultate.
- **Nach B04 nur interner Integrations-Meilenstein** mit Testkonten und simulierten Spielern; **kein Nutzertest nach jedem Batch**. Die erste vom Projektinhaber selbst zu prüfende Fassung entsteht **erst nach dem großen Abschlusstest B15**. Veröffentlichung erst nach dessen Freigabe. Ein optionales Weltmodul darf bei unzureichender Prüfung deaktiviert bleiben, ohne den generischen 5.5e-Start zu blockieren.

## Verbindliche Restplanung nach externer B15-Prüfung

**Genau zwei Hauptphasen bis v1-Beta:** Der bestehende **B15 bleibt offen** und wird nicht neu nummeriert; danach **B16**. Interne Kürzel sind Arbeitspakete, keine neuen Hauptbatches. Alle Aufgaben werden zunächst durch Entwicklung/CI geprüft. **Eine einzige Nutzerabnahme am Ende von B16; keine Zwischenabnahmen.**

| Arbeitspaket | Verbindliches Ergebnis / Gate |
| --- | --- |
| **B15-C1** | Dependency-Audit gezielt bereinigen; Chromium/Firefox im isolierten CI reproduzierbar starten; nur `demo-`-Emulator bzw. getrenntes Staging, niemals Produktionskonten; [Zwischenbericht](B15_C1_PRUEFBERICHT.md) |
| **B15-C2** | Ganze reale Benutzeraufgaben, Erstellen/Steigern/Rasten/Zauber/Import/Fehler, Chromium+Firefox, 320px, 200%-Zoom, Tastatur, Fokus, Screenreader-Stichprobe, Kontrast und dokumentierte echte Screenshots; Anti-KI-Designcheck ohne kosmetisches Redesign |
| **B15-C3** | Getrenntes Firebase-Staging mit drei Konten (SL + zwei Spieler); Rechtemanipulation, Einladungen, Quellen, Konflikte, Off-/Online, Legacy-Kompatibilität; keine Produktion und keine echten Migrationen |
| **B15-C4** | Gesamter Testlauf, Sicherheits-/Lizenz-/UX-/Anti-Bloat-/Anti-KI-Abnahme, überprüfte ZIP und eindeutiges BESTANDEN/GESPERRT; nur bei **BESTANDEN** folgt B16 |
| **B16-R1** | Passwortwiederherstellung, Verifikationsentscheidung, sicherer Lösch-/Auskunfts-/Exportweg, Retention und SL-Austritt; keine globalen Firestore-Löschrechte |
| **B16-R2** | Getrennte GitHub-Pages-/Firestore-Freigabe, Rollback, Spark-Quotenüberwachung statt erfundener Kostenwarnung, Auth-Domains, App Check zunächst integrieren/testen und erst dann durchsetzen, Datenschutz/Impressum/Kontakt |
| **B16-R3** | Vollständige RC-ZIP, große **einmalige** Nutzerabnahme, gezielte Korrekturen, ausdrückliche Produktionszustimmung, danach kurzer echter HTTPS-/Login-/Rechte-Smoke-Test |

**Nach v1 – Reihenfolge ohne Vorabentwicklung:** B17 sichere Mitglieder-/DM-Key-Verwaltung; B18 Cloud-Zusammenarbeit und Konflikte; B19 einfacher Kampagnenseitenbaukasten; B20 versionierte Fragebögen und Edras-Eigenschaftsableitung (Geheimlogik nur serverseitig oder manuell durch SL); B21 private Homebrew-Werkzeuge; B22 leichter 2D-Spieltisch; B23 weitere rechtmäßig lizenzierte/gesonderte Regelwerke; B24 nur bei konkretem Bedarf komplexe Plattformfunktionen. Keine künstlichen Premium-Sperren. Vor v1 keine neuen Dashboards, Framework-Migration, VTT, Markt- oder Story-Engine, DM-Key-Mailpflicht oder unkontrollierte Regelautomatisierung.

## Liefervertrag für JEDEN Implementierungsbatch

1. Ein großer **zusammenhängender, benutzbarer Funktionsblock**, keine Sammlung halb fertiger Einzelfeatures. Die bestehende Vanilla-JS-Oberfläche und SRD-Engine weiterverwenden.
2. Neue/angepasste Regel- und Berechtigungslogik mit **gezielten positiven, negativen, Randwert- und Integrationsfällen** testen. Nur bei geänderten gemeinsam genutzten Teilen die direkt abhängigen alten Tests wiederholen. Gesamtsuite an Gates und vor Release.
3. Statische Browser-Verdrahtung allein ist **kein** End-to-End-Nachweis. Browser-Smoketests bei UI-/Speicheränderungen, bei fehlender Umgebung die Lücke offen ausweisen.
4. Vor Abgabe: Anti-Bloat-Audit (keine doppelten Formeln/Datenlisten, überflüssigen Pakete, parallelen Speicherwege, nicht benötigten Abstraktionen). Größere Dateien nur dann aufteilen, wenn es die geänderte Verantwortung vereinfacht. **Bei UI-Änderungen** zusätzlich den [Anti-KI-Look-Designguide](DESIGN_ANTI_AI_LOOK.md) auf die betroffenen Ansichten anwenden; keine unbelegten „KI-Erkennungsquoten“ erfinden.
5. **Vollständige Projekt-ZIP**, inklusive neuer Tests und aktualisierter Dokumentation, Archivintegrität prüfen. Kein stilles GitHub-/Firebase-Live-Deployment. Änderungen, erfüllte Abnahmekriterien und offene Grenzen klar nennen.
6. Ein Batch bleibt **offen**, solange seine Abnahmekriterien oder erforderlichen Tests scheitern. Kein Weiterzählen der Versionsnummer als Ersatz für einen funktionierenden Ablauf.
7. **Der Nutzer muss zwischen den Batches nichts installieren oder manuell testen.** Die Entwicklungsumgebung übernimmt je Batch alle realistisch automatisierbaren Prüfungen, Emulator- und Browserläufe. Fehlende Testinfrastruktur wird als **offener Nachweis** dokumentiert und spätestens vor B15 bereitgestellt – sie wird nicht durch die Behauptung „getestet“ ersetzt. Die ZIP dient während der Entwicklung nur als versionsgebundene Übergabe/Sicherung, nicht als Testauftrag.
8. **Nur ein großer abschließender Nutzer-Abnahmetest:** Zuerst interne Gesamtabnahme B15, dann eine einzige konsolidierte v1-Testfassung mit Anleitung und Prüfprotokoll. Danach Korrekturen, falls die Endabnahme Probleme ergibt; keine öffentliche Freigabe vor Zustimmung.
9. **Anti-KI-Look und gute UX bleiben auch B14–B16 Pflicht, nicht nur bei B13:** Vorhandene Würfelbund-Gestaltung erhalten; jede neue/angepasste Aktion braucht einen echten Zweck, eine erkennbare Beschriftung und einen überprüfbaren Zustand. Keine generischen Karten, Phantasiezahlen, austauschbaren Werbetexte, dekorativen Zufallselemente oder überfrachteten Bildschirme. Bei jeder UI-Änderung auf der betroffenen Ansicht Aufgabenorientierung, Begriffe, Hierarchie, Mobil/Zoom, Tastatur/Fokus, leere/Fehler-/Offlinezustände und die acht Warnsignale aus dem [Designguide](DESIGN_ANTI_AI_LOOK.md) prüfen. Visuelle Prüfungen nur mit echten Screenshots belegen; fehlende Browserinfrastruktur als Lücke führen.
10. **Anti-Bloat-Gate für Code und Produkt:** Kein neues Framework, keine zweite Datenhaltung, keine parallele Regelberechnung und keine neue Funktion ohne konkreten v1-Nutzerfall. Lieber vorhandene Komponenten, kleine reine Logikfunktionen und wenige gezielte Regressionstests. Jede Erweiterung muss den bestehenden Spielweg vereinfachen oder eine Release-Blockade beheben. Lösch-/Vereinfachungspotenzial explizit mitprüfen; kein Design-Redesign nach bloßem Geschmack.

## Batch-Reihenfolge

**Fortschritt 26.10.2026:** B01-Code und Node-Prüfungen umgesetzt; Browser-Vorschau im aktuellen Container nicht erreichbar. B01 bleibt hinsichtlich echter Browser-Abnahme offen, Details in [B01_PRUEFBERICHT.md](B01_PRUEFBERICHT.md). Kein Zwischen-Nutzertest.

**B02-Status:** Versionierte Firestore-Regeln samt Rollen-/Sperr-/Charaktermodell und offiziellem Emulator erfolgreich geprüft (**12/12 Sicherheitsszenarien**). Die Regeln bleiben bis zur Staging-/Live-Freigabe unveröffentlicht. [B02-Prüfbericht](B02_PRUEFBERICHT.md). Danach verbleiben **14 geplante Batches (B03–B16)**; der offene B01-Browsernachweis ist zusätzlich nachzuholen.

**B03-Status:** Charaktere lassen sich ausdrücklich zwischen lokalem Entwurf und Cloud-Kampagne übertragen. Spieler sehen ihre eigenen, die SL alle Kampagnenfiguren. Ein bewusstes Cloud-Update sperrt veraltete Fassungen per Transaktion; ein lokaler Konflikt verlangt Bestätigung und legt eine rückholbare Sicherung an. **15/15 Emulator-Sicherheitsfälle** sowie neue Profil-/UI-/Sicherungstests bestanden. Der verpflichtende echte Zwei-Browser-Smoke blieb mangels Preview-Daemon **offen** und wird spätestens zu B15 intern nachgeholt. [B03-Prüfbericht](B03_PRUEFBERICHT.md). Nach dem B03-Codeblock verbleiben **13 Folge-Batches (B04–B16)**; der Browsernachweis zu B01/B03 ist ein zusätzlicher noch offener Prüfpunkt. Kein Nutzertest zwischendurch.

**B04-Status:** Gemeinsame TP-/Trefferwürfel-/Zauberplatz-/Klassenressourcen-/Inventar-/Rast-Aktionen sind auf dem ausgewählten Cloud-Charakter atomar; ein Live-Dokumentlistener und doppelt abgesicherte Aktions-ID reduzieren Mehrspieler-Konflikte. **19/19 Firestore-Emulatorfälle** einschließlich Konkurrenz, ID-Wiederholung, echter Listener-Mitteilung und Rechte-/Sperrtests bestanden; die lokalen Regeltests sind ebenfalls grün. Das verpflichtende echte Mehrbrowser-Gate A ist mangels verfügbarer Browser-Vorschau **noch offen**. [B04-Prüfbericht](B04_PRUEFBERICHT.md). Nach dem B04-Codeblock verbleiben **12 geplante Batches (B05–B16)**. Die offenen Browser-Nachweise B01/B03/B04 kommen zusätzlich hinzu, kein Nutzertest zwischendurch.

**B05-Status:** Pro Kampagne gilt genau das offene SRD 5.2.1. Die Spielleitung kann Edras und bis zu sechs eigene versionierte, mit expliziter Rechtebestätigung publizierte Regelpakete aktivieren; Mitglieder lesen nur die für sie erlaubten Kopien. Der gemeinsame Quellenresolver begrenzt Uploads und Live-Aktionen, pinnt bisherige Figurenquellen und zeigt bei Abschaltung/Versionswechsel Konflikte ohne Datenänderung. **233/233 Node- und 22/22 Firestore-Emulatorfälle** bestanden. Die echte Browser-/Mobil-Abnahme fehlt weiterhin wegen nicht verfügbarem `sites-previewd`. [B05-Prüfbericht](B05_PRUEFBERICHT.md). Danach **11 geplante Batches (B06–B16)** plus offene interne Browsernachweise B01/B03/B04/B05; kein Nutzertest bis zum großen Abschlusstest.

**B06-Status:** Eine optionale Stufenchronik für alle zwölf SRD-Klassen ergänzt das bestehende Profil; originale Mehrklassen-Voraussetzungen, Klassengrenzen, ASI-Stufen, TP, Trefferwürfel je Typ, Zusatzübungen, gemeinsame Slots, separate Paktplätze und namespacete Klassenressourcen werden aus den vorhandenen Regel- und Klassentabellen geprüft. Erstellen/Bearbeiten, lokaler Spielstand, Cloud-Profil und atomare Aktionen verwenden dieselbe Chronik. **245/245 Node-Tests** bestanden, darunter neue Multiclass-, Casting- und Export-/Importfälle. Die echte Browser-/Mobil-Abnahme scheitert weiterhin am fehlenden Vorschau-Daemon und bleibt **offen**. [B06-Prüfbericht](B06_PRUEFBERICHT.md). Danach **10 geplante Batches (B07–B16)** sowie die offenen internen Browsernachweise; kein Nutzertest bis zum großen Abschlusstest.

**B07-Status (27.10.2026):** Fehlende stufengerechte Klassen-/Unterklassenentscheidungen, zusätzliche Zaubertricks/Übungen, Schurken-Rettungswürfe, bekannte SRD-Tiergestalten und sechs Unterklassenressourcen sind über bestehende Klassen- und Monsterquellen und den gemeinsamen Profil-/Trackerweg ergänzt. Zweitunterklassen werden ausgewählt, validiert und mitgespeichert. **253/253 Node-Tests** inklusive Matrix für zwölf Klassen über alle 20 Stufen bestanden; keine neuen Laufzeitabhängigkeiten. **Realer Browser- und Mobiltest offen**, außerdem verbleiben bewusst manuell geprüfte Merkmalsfolgen und ab B09 eigene Zauberwahlregeln für Zweitklassen. [B07-Prüfbericht](B07_PRUEFBERICHT.md). Nach B07 **neun Folge-Batches (B08–B16)**, kein Nutzer-Zwischentest und keine Veröffentlichung.

**B08-Status (27.10.2026):** Mehrfache Magic-Initiate-Wahlen (einschließlich unterschiedlicher Listen), zusätzliche Skilled-Übungen, Abstammungszauberattribute, Hochelfen-Zaubertrickwechsel und eindeutig begrenzte Spezies-/Talentressourcen sind im bestehenden Charakter- und Casting-/Rastweg verbunden. Herkunftsresistenzen bleiben sichtbar und werden ohne Schadensart nicht automatisch angewandt. **262/262 Node-Tests**, darunter Variantenmatrix über neun Spezies, 24 Abstammungen und vier Stufen, bestanden; **echte Browser-/Mobil- und Zwei-Konto-Abnahme weiter offen**. [B08-Prüfbericht](B08_PRUEFBERICHT.md). Nach B08 **acht Folge-Batches (B09–B16)**; großer interner Abschlusstest B15, erst danach ein Nutzer-Testlauf B16. Keine Veröffentlichung.

**B09-Status (27.10.2026):** Klassenstufengerechte Zauberwahl für **jede** erreichte Zweitklasse im vorhandenen Editor, eigenes Zauberbuch/Sonderzauber je Klasse, Prüfung bei Speicherung und vor lokaler Wirkaktion, gemeinsame Slots mit getrennten Pakt-/Sonderressourcen. Klassenspezifische Zauberangriffsboni, Komponenten-/Reaktionsbestätigung und konservative SRD-Schadenswürfel ergänzt. **273/273 Node-Tests**, darunter 44 Klassen-/Stufen-Kombinationen und positive wie negative Mehrklassen-Castingfälle, bestanden. Noch **nicht** vollständig umgesetzt: chronologischer Nachweis jeder Zaubererlernung, Zauberwechsel und Abschriften, allgemeine sichere Upcasting-/Heilautomatik und echte Browser-/Mobil-/Mehrspieler-Abnahme. Diese Aspekte bleiben als manuelle Spielleitungsentscheidungen bzw. Pflichtnachweise für den v1-Abschluss sichtbar. [B09-Prüfbericht](B09_PRUEFBERICHT.md). Nach B09 **sieben Folge-Batches (B10–B16)**; bis zur internen Gesamtabnahme kein Nutzer-Zwischentest oder Deployment.

**B10-Status (27.10.2026):** Ziel-RK und halbe/dreiviertel/vollständige Deckung, Waffenmeisterschaften, kritische Waffenwürfel, manuelle Aktionsmerker sowie getypter Schaden mit Immunität/Resistenz/Verwundbarkeit nutzen vorhandene 2024-Waffen-, Herkunfts- und TP-Funktionen. **262 originale Magiegegenstände** mit separaten Instanzen, Einstimmung (bis zu drei unterschiedliche) und validierten manuell gepflegten Ladungen sind im selben Profil. Die gemeinsamen Cloud-Aktionsfunktionen akzeptieren diese neuen Operationen transaktional; reale Browser-/Cloud-Abnahme bleibt offen. **289/289 Node-Tests** inklusive neuer Schadens-, Meisterschafts-, Ladungs- und Wiederholungsfälle bestanden. [B10-Prüfbericht](B10_PRUEFBERICHT.md). Nach B10 **sechs Folge-Batches (B11–B16)**; ein einziger Nutzer-Test nach B15, keine Veröffentlichung.

**B11-Status (27.10.2026):** Erstellen/Steigern und Spielen sind zwei klar schaltbare Ansichten. Der aus dem gespeicherten Charakter abgeleitete kompakte Spielbogen und die W20-Würfe nutzen dieselben Fertigkeits-/Rettungs-/Initiativwerte; Klassenstufen, Zauberangriffe, Quellen, Herkunft und SRD-Merkmalstexte werden transparent dargestellt. Der bestehende TP-/Rast-/Zauber-/Inventartracker bleibt maßgeblich. **295/295 Node-Tests**, darunter 36 Konfigurationen über zwölf Klassen, weitere 1/8/20-Detailmatrix und Mehrklassenfälle bestanden. Browser-/320-px-/200-%-Zoom-/Tastatur-Abnahme **nicht möglich**: `sites-previewd` fehlt. Deshalb bleibt das echte **Gate B offen**; [B11-Prüfbericht](B11_PRUEFBERICHT.md). Nach dem B11-Codeblock folgen **fünf Batches (B12–B16)** plus offene interne Browsernachweise. Keine Nutzer-Zwischentests und kein Deployment.

**B12-Status (27.10.2026):** Versionierter, vollständig öffentlicher **17-Fragen-Spieltestentwurf** (16 Situationen + Erfahrungsfrage), reproduzierbare Antwort-/Seed-Auswertung und überprüfbarer lokaler Profil-Roundtrip ergänzen optional den Edras-Editor. Öffentliche Resonanz-Tendenz, Potenzial und Anfangstechnik sind **unverbindliche Vorschläge**, keine kanonische SL-Auswertung. Belastung 2/4/5 greift bei explizit gewählten Technikproben in die gemeinsame W20-Engine ein, nicht in normale 5.5e-Proben. **303/303 Node-Tests, 23/23 Firestore-Emulator-Sicherheitsfälle** bestanden. Die ursprüngliche geheime Auswertungsmatrix und ein serverseitiger Geheimnisgenerator fehlen: Deshalb sind wahre Resonanzen / ein kanonisch bindender Fragebogen für v1 **gesperrt** und bleiben ein Release-Gate bei optionaler Freigabe. Keine Geheimwerte im öffentlichen Paket. Echter Browser-/Mobiltest offen. [B12-Prüfbericht](B12_PRUEFBERICHT.md). **Vier Batches verbleiben: B13–B16**, keine Nutzer-Zwischentests.

**B13-Status (27.10.2026):** Zaubersuche für Erst- und Folgeklassen mit normierter Suchlogik, sofortigem Trefferzähler, Erhalt gewählter Zauber und vorübergehend geöffneten passenden Folgeklassen; lokale/Cloud-Trennung mit expliziten Offline- und Wiederverbindungszuständen; Skiplinks und korrigierte Navigations-Hashlogik; präzisierte Hilfetexte. **311/311 Node-Tests bestanden** (einschließlich acht neuer B13-UX-Tests). Kein zusätzlicher Runtime-Stack, keine Änderung an Cloud-Regeln oder Charakterdatenschema. **Echter Browser-/Mobil-/Screenreader-/Mehrkonto-Test weiterhin offen**, daher keine endgültige UX-/WCAG-Konformitätsbehauptung; Nachweis und Screenshots spätestens Gate C B15. [B13-Prüfbericht](B13_PRUEFBERICHT.md). **Drei Batches verbleiben: B14–B16**; keine manuellen Nutzer-Zwischentests.

**B14-Status (27.10.2026):** Deny-by-default-Pages-Build mit **57 öffentlichen Webdateien**, Inhalts-Hashes und ohne Tests/Firestore-Regeln/Ops-Dateien; automatische Prüf-CI und bewusst gesperrte manuelle Pages-Freigabe. B14 schränkt SL-private Cloud-Eingaben ein, hält Nutzer vor Registrierung über Cloud-Datenflüsse auf dem Laufenden und markiert rechtliche Texte ausdrücklich als **nicht veröffentlichungsreife Entwürfe**. Externe Webfont-Abhängigkeit entfernt. **24/24 Firestore-Emulator-, 26/26 betroffene Node-Verdrahtungs- und 4/4 Public-Build-Tests** lokal bestanden. **Echte Staging-/GitHub-Runner-/Browserabnahme sowie Betreiber-/Datenschutz-/Kosten-/Löschfreigabe bleiben offen** und sperren eine Publikation. [B14-Prüfbericht](B14_PRUEFBERICHT.md) · [Betrieb/Gates](B14_BETRIEB.md). **Zwei Batches verbleiben: B15–B16**, kein Zwischen-Nutzertest.

**B15-Zwischenstand (27.10.2026, Gate C offen):** **314/314** Node-Tests, **25/25** Firestore-Emulatorfälle und **7/7** statische Auslieferungs-/Linktests bestanden. Durchgehender lokaler Figur-/Kampf-/Rast-/Stufen-/Import-/Cloud-Übernahmeweg geprüft; Absturz bei zulässigen alten Einträgen ohne Zeitstempel behoben. **Echter Browserlauf konnte nicht nachgeholt werden** (Chromium-Download 0 MiB/ungültig, getrennte Browseroberfläche erreicht lokalen Server nicht). Mehrbrowser-/Mobil-/Screenreader- und Firebase-Staging-Nachweise fehlen. **B15 nicht abgeschlossen, Gate C gesperrt** und kein Nutzer-Zwischentest; [B15-Prüfbericht](B15_PRUEFBERICHT.md). Es bleiben **zwei Phasen: Abschluss B15 + B16**.

### B01 · v0.29 – Reproduzierbare Browser- und Release-Prüfung

**Bauen:** Minimalen Browser-Smoke-Weg für Hauptseite und Studio; prüfbare Ladepfade/relative Assets; lokale Testdaten getrennt von echten Nutzerdaten; klare Fehlermeldung bei gesperrtem Browserspeicher. Vorhandenen JSON-Import/Export aus v0.28 im Browser durchspielen. Bestehende Tests einheitlich ausführbar machen, ohne ein neues Frontend-Framework.

**Prüfen:** Frischer Browser → Figur Stufe 8 anlegen → Speichern → Seite neu öffnen → Figur bearbeiten → Export → Import → Rücksicherung. Ungültige Datei, volle Speicherung, fehlender Datenpfad und Tastaturbedienung. Die bestehenden 5.5e-Werte dürfen sich dabei nicht ändern. Erste vollständige Sichtprüfung aller bestehenden Oberflächen nach dem Anti-KI-Look-Guide; tatsächliche nutzungsrelevante Auffälligkeiten als Befunde festhalten.

**Abnahme:** Ein dokumentierter reproduzierbarer Smoke-Lauf; keine still verlorenen Charaktere; Fehlerberichte mit reproduzierbarer Aktion. Falls Browserinfrastruktur ausfällt: explizit offen, nicht als bestanden zählen.

### B02 · v0.30 – Autoritative Kampagnenrechte und Firestore-Modell

**Bauen:** Eine kleine, versionierte Struktur für Kampagne, Mitglieder, Rollen und pro Charakter `ownerId`, inklusive Privatsphäre für persönliche Regelpakete und spätere SL-private Daten. Firestore-Regeln **als versionierte Projektdatei** statt ausschließlich Konsolenkopie; keine beliebige Rollenaufwertung durch Clientfelder, keine lesbaren Geheimdaten in Player-Dokumenten. Bestehende Einladungslinks beibehalten.

**Prüfen:** Firebase-Emulator mit mindestens anonym/Spieler A/Spieler B/SL/Fremdkonto: get/list/create/update/delete, Eigentümerwechsel, Rollenspoofing, Beitritt, Entzug des Zugangs, ungültige Felder und übergroße Datensätze. Sowohl erlaubte als auch verbotene Zugriffe beweisen.

**Abnahme:** Fremdzugriff und unerlaubte Rollen-/Eigentumsänderung serverseitig ausgeschlossen; keine für Spieler erreichbaren SL-Geheimfelder. Erst danach echte Cloud-Charaktere anbieten.

### B03 · v0.31 – Charaktere zwischen Geräten und Mitspielern

**Bauen:** Vorhandenes SRD-Charakterprofil aus `js/rules/characters.mjs` einem Kampagnencharakter zuordnen; expliziter lokaler→Cloud-Import, Laden und Rollenzugriff. Kein zweites Charakterdatenmodell und kein automatisches Überschreiben persönlicher Entwürfe. Gelöschte/entzogene Mitgliedschaft wird berücksichtigt.

**Prüfen:** Zwei Konten, zwei Browser, gleicher Charakter: Sichtbarkeit, Bearbeitungsrecht, Trennung zweier Kampagnen, Profil-Roundtrip mit Stufe/Zaubern/Ausrüstung/Edras und Abmelden. Unberechtigte Änderungen im Emulator scheitern; Abbruch und Retry verlieren keine lokalen Daten.

**Abnahme:** Berechtigte Spieler und SL sehen nach Neuladen denselben zulässigen Charakterstand. Kein fremder Spieler kann den Charakter still überschreiben.

### B04 · v0.32 – Gemeinsame Ressourcenaktionen und Konfliktschutz

**Bauen:** Bestehenden TP-/Zauberplatz-/Trefferwürfel-/Rast-/Inventarstatus über atomare, berechtigte Änderungen aktualisieren. Klare Anzeige von lokal vs. Cloud, Verbindungsverlust und veraltetem Stand. Keine unkontrollierten Firestore-Listener für alles; nur den aktuell benötigten Spielzustand abonnieren.

**Prüfen:** Zwei Spieler geben gleichzeitig eine begrenzte Ressource aus; kein doppeltes Verbrauchen oder verlorenes Update. Offline/Online-Wechsel, doppelte Klicks, veraltete Revision, Abbruch, fehlerhafte Edras-Ressourcen und SL-sperrige Aktionen. Firestore-Emulator **plus** Zwei-Browser-Szenario.

**Abnahme / internes Gate A:** Simulierte Spieler-/SL-Konten und zwei automatisierte Browserkontexte können eine gemeinsame Kampagne mit live sichtbaren Charakterressourcen nutzen, ohne Geheimnisse oder fremde Daten offenzulegen. **Keine Testpflicht für den Nutzer.** Noch nicht als komplette 5.5e-Version bezeichnen.

### B05 · v0.33 – Kampagnenquellen und einheitliche Umschalter

**Bauen:** Pro Kampagne genau eine Regelbasis (`srd-5.2.1`), versionierte zugelassene Inhaltsquellen und explizite optionale Regel-/Weltmodule. Vorhandene Homebrew-Pakete zu- und abschaltbar; Quelle, Version, Abhängigkeit und Konflikt sichtbar. Alte Figuren behalten ihren Quellenstand; keine 2014-/2024-Vermischung ohne separate Kompatibilitätsregel.

**Prüfen:** Toggle an/aus wirkt nur auf die eigene Kampagne; nicht freigegebene Optionen können nicht gewählt/gespeichert werden. Bei Paket-Update bleiben bestehende Charakterreferenzen auflösbar oder zeigen einen konkreten Konflikt. Unbekannte/mangelhaft lizenzierte Quelle bleibt gesperrt.

**Abnahme:** Nur **eine** Quellenauflösung für Charakterlabor, Spielzustand und Homebrew; keine 75 einzelnen Buch-Schalter oder doppelte Regelkopien.

### B06 · v0.34 – Multiclassing und echte Stufenchronik

**Bauen:** 2024-Multiclass-Voraussetzungen, Klassenstufen 1–20, Übungsgewinn, Trefferwürfel je Klasse, gemeinsam verfügbare Zauberplätze und getrennte Paktmagie. Stufenentscheidungen chronologisch speichern statt nur Endstufe; bestehende Single-Class-Figuren automatisch weiterhin gültig.

**Prüfen:** Alle 12 Klassen als Start-/Zweitklasse mit gültigen/ungültigen Voraussetzungen; Levelsumme 1/3/5/8/11/17/20; Kombinationen Voll-/Halb-/Paktzauberer, KON-Änderung, rückwirkende HP und klassenspezifische Ressourcen. Import-/Export-/Edit-Roundtrip.

**Abnahme:** Multiclass-Charaktere erhalten keine falschen Anfangsübungen, TP oder Zauberplätze. Sonderfälle werden ausdrücklich manuell markiert statt falsch berechnet.

### B07 · v0.35 – Klassenmerkmale und Unterklassen geschlossen abarbeiten

**Bauen:** Die **tatsächlich im SRD enthaltenen** Klassen-/Unterklassenentscheidungen für alle zwölf Klassen stufengerecht erfassen. Fehlende Übungen, Orden, Ressourcentrigger, Kampfstile, Form-/Begleiterzustände, Ersatz- und Steigerungswahlen ergänzen. Komplexe Wirkungen als bekannte manuelle Effekte anzeigen; wiederverwendbare Ressourcen über den bestehenden Tracker.

**Prüfen:** Für jede Klasse alle Stufen 1–20 auf erforderliche Wahlen, exakte Freischaltstufe, Maximalwerte, kurze/lange Rast, Klassenwechsel und Import prüfen. Paarweise wichtige Kombinationen statt blind alle Kombinationen zu multiplizieren.

**Abnahme:** Jede angebotene SRD-Klasse lässt sich bis Stufe 20 ohne unaufgeklärte Pflichtauswahl anlegen und spielen; automatisch unterstützte Effekte sind fachlich belegt.

### B08 · v0.36 – Spezies, Hintergründe, Talente und Wechselwirkungen

**Bauen:** Noch fehlende SRD-Talent- und Spezieswirkungen, Werkzeug-/Sprach-/Zusatzfertigkeiten, Herkunftszauber, Epische-Gaben-Sondereffekte und relevante Resistenzen. Einträge aus gepinnten SRD-Daten beziehen; keine parallele Talent- oder Speziesdatenbank.

**Prüfen:** Alle angebotenen Spezies/Hintergründe/Feats gegen Wahlberechtigung und Stufengrenzen. Doppelübungen, Fähigkeitswertgrenzen, Wiederholbarkeit, Magic-Initiate-Varianten, Feat-Ressourcen sowie Konflikte mit Klassenmerkmalen. Bestehende Charaktere behalten ihre Auswahl.

**Abnahme:** Keine stillen, automatisch falsch berechneten Boni; alle unvollständigen manuellen Auswirkungen am Charakter erkennbar.

### B09 · v0.37 – Magie über die vollständige Charakterlebensdauer

**Bauen:** Erwerb/Austausch von Zaubern pro Stufe, Zauberbuchabschriften, Ritual-/Komponenten-/Wirkzeit-Hinweise, Talent-/Spezieszauber, Upcasting, Ressourcenrückgewinnung und Zauberwirkarten. Regelgeprüfte, einfache Angriff-/Schadens-/Heilwirkungen mit bestehenden Würfeln verbinden; Ziele/Situationen weiterhin bei der SL.

**Prüfen:** Alle Zauberklassen, Kombinationen aus Klassen-/Spezies-/Talentzaubern, Zauberbuch und Paktmagie; 0/1/9-Gradgrenzen, fehlende Komponenten, Konzentration und Reaktionsauslöser; Verbrauch und Erholung. Multiclass- und Edras-Sperrtests.

**Abnahme:** Eine Figur kann ihre erlaubten Zauber wählen und Ressourcen korrekt verwalten; automatisierte Wirkungen nennen Grundlage, offene Wirkungen ihren manuellen Prüfpunkt.

### B10 · v0.38 – Kampf-, Ausrüstungs- und Gegenstandsverbindung

**Bauen:** Waffenmeisterschaftseffekte, Resistenzen/Immunitäten, Ziel-RK/Schaden, Reichweite/Deckung, begrenzte Aktionen/Reaktionen und bekannte 2024-Zustände soweit eindeutig; magische Gegenstände mit Einstimmung, Ladungen und Inventarstatus. Kein VTT, keine Gegner-KI, kein automatischer taktischer SL.

**Prüfen:** Je nach Ausrüstung Attacke/Waffe/Munition/Handbelegung, Kritischer Treffer, Resistenz/Immunität und Konzentration; parallele Ressourcenaktionen; Zustände und Gegenstandsladungen. Randwerte und doppelte Effekte.

**Abnahme:** Ein realer SRD-Kampf lässt sich mit vorhandenen Werkzeugen und klaren manuellen SL-Entscheidungen abwickeln; automatische Regeln behaupten nicht mehr, als sie können.

### B11 · v0.39 – Ein benutzbarer Charakterbogen und Wartbarkeit

**Bauen:** Ein lesbarer, mobiler 2024-Charakterbogen mit Fähigkeiten, Boni, Zaubern, Aktionen, Inventar, TP, Quellen und bekannten Einschränkungen. Getrennte Ansicht für Erstellen/Steigern/Spielen; nachvollziehbar, welche Wahl welchen Wert erzeugt. Nur an tatsächlich betroffenen Stellen die langen Hauptdateien entflechten; keine neue Komponentenbibliothek.

**Prüfen:** Stufen 1/8/20 von Kampffigur, Vollzauberer, Halbzauberer und Multiclass; Speichern, Wiedereinsteigen, Ressourcenänderung, Klassen- und Quellkonflikt. 320-px-Ansicht, 200-%-Zoom und Tastaturrundgang. Visuelle Inhaltsdichte, echte Daten statt Scheinwerte, UI-Hierarchie und einheitliche vorhandene Bildsprache anhand des Anti-KI-Look-Guides.

**Abnahme / Gate B:** Alle im SRD angebotenen Pflichtentscheidungen sind erreichbar; Bogen und Regelberechnung stimmen überein. Vollständigkeit bedeutet **SRD-Umfang**, nicht kostenpflichtige PHB-Inhalte.

### B12 · v0.40 – Optionaler Edras-Abgleich und Weltregeln

**Bauen:** Konfigurierbaren, versionierten Edras-Fragebogen für Resonanz/Affinität/Potenzial/Technikneigung; deterministische Antwort+Seed-Auswertung; geschützte SL-Ergebnisse **nicht** im öffentlichen JS, der Spielerantwort oder offen lesbaren Cloud-Dokument. Lebensenergie, Belastung, Technik-SG und erfasste Folgeregeln an bestehende Ressourcen-/W20-Routinen anschließen. Weiterhin freie Klasse und Handlung.

**Prüfen:** Derselbe Seed und dieselben Antworten erzeugen identische Ergebnisse; anderer Seed nur die ausdrücklich zufälligen Anteile. Grenzfälle, Gleichstände, Versionwechsel, Manipulations-/Rollentests und keine Weitergabe geheimer Felder an Spieler. Edras deaktiviert → Standard-5.5e völlig unverändert.

**Abnahme:** Edras ist vollständig abschaltbar, ohne Unterklassen/Attribute auszutauschen. Wenn Geheimhaltung oder Auswirkungen noch unsicher sind, bleibt der Fragebogen in v1 deaktiviert.

### B13 · v0.41 – UX, Lokalisierung und reale Nutzung

**Bauen:** Durchgängige Begriffe zwischen Hauptseite/Studio, klare Auflösung lokal/Cloud, Hilfetexte, Suchbarkeit langer Auswahllisten, verständliche Lade-/Fehler-/Offlinezustände. Deutsche öffentlich lizenzierte SRD-Texte soweit korrekt verknüpfbar; keine maschinell erfundenen Regelübersetzungen.

**Prüfen:** Mindestens fünf **intern durchgeführte** Aufgaben aus Spieler- und SL-Perspektive (Erstellen, Fehler korrigieren, Stufe ändern, Zauber/Ressourcen nutzen, Kampagne gemeinsam verwalten). Chrome/Firefox und mobil, Tastatur, Screenreader-Stichprobe, 320 px, Zoom 200 %, Kontrast/Fokus, Ladezeit. WCAG 2.2 AA als Prüfkatalog, **keine** ungeprüfte Konformitätsbehauptung. Vollständiger Anti-KI-Look-Rundgang: acht Warnsignale, Screenshots, Drei-Sekunden-Verständnistest, echte statt dekorative Aktionen. Menschliche Beobachtung durch echte Spieler erfolgt **einmalig am Schluss**, nicht hier.

**Abnahme:** Blockierende UX-Befunde behoben, übrige Einschränkungen sichtbar dokumentiert. Kein Kosmetik-Redesign ohne Nutzungsbefund.

### B14 · v0.42 – Öffentliche Sicherheit und Betrieb

**Bauen:** Versionierte GitHub-Pages-Auslieferung, Build-/Syntax-/regelbasierte CI, Freigabecheckliste, Rollback-/Backup-Prozess; Firebase-Live-Konfiguration nur nach Emulatorprüfung veröffentlichen. Cloud-Kosten-/Missbrauchsgrenzen und Eingabegrößen; Account-/Datenschutzhinweise, Kontakt-/Feedbackweg und rechtlich erforderliche Angaben prüfen. Keine internen Edras-SL-Geheimnisse im öffentlichen ZIP.

**Prüfen:** Rechte in Live-/Staging-Umgebung mit Testkonten, Einladungen, Löschung, Berechtigungsentzug, Paketvalidierung, keine unabsichtlichen Logs/Secrets/privaten Dateien. Serverlose Regeln mit Emulator vollständig; lizenzierter SRD-Umfang und Attribution belegt. Im Bedarfsfall externe Rechtsprüfung.

**Abnahme:** Reproduzierbarer Deploy und Rückweg; keine offenen kritischen Daten- oder Berechtigungsfehler.

### B15 · v0.43 – Großer interner Abschlusstest und Release Candidate

**Bauen:** Keine neuen Systeme mehr einführen. Testinfrastruktur und reproduzierbare Testkampagnen vervollständigen; nur aufgedeckte Fehler beheben. Alle früher wegen fehlender Browser-/Cloud-Testumgebung offenen Nachweise **hier nachholen**, bevor ein Nutzer etwas testen muss.

**Prüfen:** Das vollständige, unter **„Abschlusstest-Protokoll“** definierte Regel-, Browser-, Daten-, Sicherheits- und Mehrspieler-Testprogramm. Mindestens drei getrennte Testkonten bzw. Rollen in echten Browser-/Emulatorkontexten; komplette Kampagne vom Erstellen über Kämpfe und Rasten bis zum Stufenaufstieg, Export und Wiederherstellung. Konkurrenzaktionen, schlechte Verbindung, unerlaubte Rechte, Versionwechsel, Edras an/aus. Letzter Anti-KI-Look-Review mit Screenshots. Reproduzierbare Fehlerliste, **keine** improvisierte Nutzer-Testpflicht.

**Abnahme / internes Gate C:** Gesamtsuite grün; keine offenen kritischen Datenverlust-, Rechte-, Spielblocker- oder Integrationsfehler; Testprotokoll benennt Testumgebung, Fälle, Pass/Fail und verbleibende Grenzen. Erst dann gibt es die gebündelte Fassung für den **einmaligen Nutzer-Abnahmetest**.

### B16 · v1.0 Beta – ein abschließender Nutzertest, dann kontrollierte Veröffentlichung

**Vorbereiten:** Nach bestandenem internem B15 eine einzige konsolidierte Test-ZIP samt Anleitung, bekannter Grenzen und nachvollziehbarem Testbericht ausgeben. Der Nutzer probiert sie **einmalig am Ende** aus. Nur nach ausdrücklicher Bestätigung GitHub-Release, GitHub-Pages-Version und zuvor geprüfte Firebase-Regeln veröffentlichen. Edras/Erweiterungen nur als geprüftes opt-in.

**Prüfen:** **Vor Nutzerabnahme** sämtliche oben genannten End-to-End-Wege intern. **Ein einziger abschließender externer Abnahmelauf** des Nutzers für tatsächliches Spielgefühl, Verständlichkeit und reale Geräteumgebung. Nach freigegebenem Deployment ein kurzer automatisierter öffentlicher HTTPS-/Login-/Rechte-Smoke-Test. Danach Rückmeldungen priorisieren, ohne riskante Daten automatisch zu sammeln.

**Abnahme:** Nutzer hat die Endfassung einmalig abgenommen; danach können reale Testspieler denselben freigegebenen Charakter-/Kampagnenzustand sicher nutzen. Freigabe ist zurücknehmbar; offene Mängel werden transparent kommuniziert. Bei Endabnahmefehlern erfolgt ein gezielter Korrekturlauf und erneuter Abschlusscheck, **kein Zurückfallen in Tests nach jedem Batch**.

## Abschlusstest-Protokoll B15 – eine große, zusammenhängende Endabnahme

Die folgenden Blöcke werden **intern in der Entwicklungsumgebung oder einer isolierten Staging-Instanz** abgearbeitet. Der Nutzer erhält erst danach eine kompakte Zusammenfassung und **eine** eigene Abnahmefassung.

| Block | Umfang des großen Abschlusstests | Bestehenskriterium |
| --- | --- | --- |
| 1. SRD 5.5e-Regellogik | Alle 12 angebotenen Klassen auf allen Stufen 1–20; SRD-Herkünfte, Talente, Multiclass-Paare, Zauber-/Ressourcen- und HP-Grenzfälle | Keine widersprüchliche automatische Regel; manuelle Entscheidungen eindeutig markiert |
| 2. Lebenszyklus & Daten | Erstellen → Bearbeiten → Steigern → Speichern → Export/Import → Neustart → Migration/Wiederherstellung, auch beschädigte und volle Speicher | Keine stillen Verluste, Duplikate oder unbemerkten Profiländerungen |
| 3. Anwendung im Spiel | Kampf-/W20-Aktionen, TP/temporäre TP, Trefferwürfel, Zauber, Konzentration, Inventar, Rasten, Erschöpfung | Angezeigte Ressourcen stimmen nach allen Aktionen mit der Engine überein |
| 4. Mehrspieler & Konkurrenz | SL + mindestens zwei Spieler, mehrere Browser, gleichzeitiger Ressourcenverbrauch, Offline/Retry, Kampagnenwechsel | Keine verlorenen Updates oder stillen Überschreibungen |
| 5. Rechte und Geheimnisse | Firestore-Emulator und Staging: anonym, Eigentümer, Spieler, Außenseiter, entzogener Nutzer, manipulierte Felder, Edras-Geheimnisse | Jeder verbotene Zugriff wird serverseitig verweigert |
| 6. Optionale Welten & Homebrew | Edras aus/an, deterministischer Fragebogen, LE-Folgen, Regelpakete, Quellenkonflikte und Versionwechsel | Standard-5.5e bleibt ohne Modul unverändert; keine geheimen Daten im Spielerclient |
| 7. Browser & Design | Desktop/mobil, mindestens zwei Browser-Engines soweit verfügbar; Tastatur, Zoom, Screenreader-Stichprobe, Ladezeiten, Anti-KI-Look-Guide | Kernaufgaben sind ausführbar; keine kritischen UX-/Design-/Accessibility-Befunde |
| 8. Veröffentlichung & Lizenzen | ZIP-Integrität, Quellnachweise, SRD-Attribution, versehentlich beigefügte Geheimnisse, Version, Rückrollbarkeit | Kein Veröffentlichungshindernis; Nachweis dokumentiert |

**Abschlussbericht B15:** Anzahl geprüfter Fälle und bestandene/fehlgeschlagene Fälle je Block, tatsächlich verwendete Browser/Emulatoren, reproduzierbare Restprobleme, Entscheidung `bereit / gesperrt`. Nicht ausführbare Browser-/Cloud-Tests zählen als **offen**, niemals als bestanden. **0 kritische offene Befunde** vor Übergabe an den Nutzer.

## Tests sinnvoll verteilen, nicht blind wiederholen

| Prüfung | Wann verpflichtend |
| --- | --- |
| Reine Berechnungs-/Randwerttests | In B06–B10/B12 bei jeder geänderten Regel |
| Charakter-/Profil-Roundtrip und Migration | B03, B06–B09, B11 und B15 |
| Firestore-Emulator, Rollenmatrix und fremde Schreibrechte | B02–B04, B05 bei Kampagnentoggles, B12 bei Geheimdaten, B14–B15 |
| Browser-End-to-End / mobile UI | Intern B01 als Grundlage, dann nur für betroffene Wege; großer vollständiger Lauf B15 |
| Alle 12 SRD-Klassen × Stufen 1–20 | B06–B09 gezielt, B11/B15 als Gesamtabgleich |
| Vollständige Node-Suite | Nach Änderungen an gemeinsamen Kernmodulen bei Bedarf; bei internen Gates A/B und vollständig bei B15/v1 |
| Performance, Accessibility und Lizenz-/Datenfreigabe | B13–B16 bzw. sofort bei entsprechender Änderung |
| Anti-KI-Look-Guide: echte Inhalte, klare Hierarchie, kein generischer Schein | **Jeder UI-Batch** auf den betroffenen Ansichten; vollständig B01/B11/B13/B15 |
| ZIP-Inhalt, Testdateien, Checksums/Integrität | **Jeder Batch** |

## Nach v1 ausdrücklich als Backlog geführt – keine heimlichen v1-Blocker

1. **Weitere offizielle Bücher** (vollständiges PHB, Xanathar, Tasha, Artificer, DMG-Bastions usw.) als zulässige, versionierte **Datenquellen**, sofern erforderliche Rechte/Vertriebswege tatsächlich vorhanden sind. Niemals kostenpflichtige Texte ohne Berechtigung in die öffentliche ZIP packen.
2. Eigenständige 2014-Kompatibilität und andere Regelsysteme als gesonderte Adapter; keine stille Mischlogik.
3. Öffentlicher Homebrew-Marktplatz mit Moderation/Lizenzprüfung, Sharing/Entgelt, komplexen Custom-Klassen/-Zaubern/-Monstern. Bereits vorhandene persönliche Pakete bleiben lokal/privat nutzbar.
4. Virtueller Spieltisch (Karten/Token), Gegner-KI, automatische taktische Kämpfe, Händler-/Handwerks-/Bastionssimulatoren und Medien-/Story-Engine.
5. Tiefgreifende, kampagnenspezifische SL-Geheim- und Plotfunktionen einschließlich besonderer Edras-Weltprojekte. **Nicht im öffentlichen Kern veröffentlichen; kein geskripteter Erzählpfad.**

## Quellen- und Lizenzanker

- Offizielles D&D SRD 5.2.1 mit deutschen und englischen Fassungen: <https://www.dndbeyond.com/srd>.
- Firestore-Rules mit Emulator prüfen: <https://firebase.google.com/docs/firestore/security/test-rules-emulator>.
- Barrierefreiheit: <https://www.w3.org/TR/WCAG22/>.
- Belegbare Designprinzipien und Grenzen generischer KI-Prototypen: <https://www.nngroup.com/articles/ai-prototyping/> und <https://www.nngroup.com/articles/principles-visual-design/>. Interner Prüfkatalog: `DESIGN_ANTI_AI_LOOK.md`.
- GitHub Actions für minimale Prüf- und Releasepipelines: <https://docs.github.com/en/actions>.
- Projektintern: `ARCHITECTURE.md`, `EDRAS_INTEGRATION.md`, `FIRESTORE_RULES_EXTENSION.md` und `../README.md`.
