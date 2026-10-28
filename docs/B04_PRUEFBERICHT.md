# B04 · Gemeinsamer Spielzustand – Umsetzung und Prüfbericht

Stand: 26.10.2026 · **Lokale Entwicklungsfassung, keine Veröffentlichung.** Nach dem B04-Codeblock folgen **12 geplante Batches B05–B16**. Die Browser-Nachweise B01/B03 und der neue B04-Nachweis sind zusätzlich offen.

## Implementiert

- Eine ausdrücklich hochgeladene Cloud-Figur lässt sich auf der Hauptseite unter **„Im Spiel öffnen“** live verfolgen. Der Besitzer und die SL sehen nur die ihnen nach Firestore-Regeln erlaubten Figuren.
- TP, temporäre TP, Todesrettungen, Stabilisierung, Trefferwürfel, bekannte Zauberplätze, Klassenressourcen, Inventargegenstände sowie kurze/lange Rasten benutzen die **schon bestehende** Regelengine. Optionale Edras-LE und Belastung werden nur bei vorhandenen Edras-Daten gezeigt.
- Jede einzelne Aktion liest und schreibt dieselbe Figur in **einer Firestore-Transaktion**. Bei konkurrierendem Ausgeben der letzten Nutzung wird die zweite Aktion nicht still auf null begrenzt, sondern abgewiesen. Die letzten 24 Aktions-IDs bleiben im Charakterdokument; ein erneuter Aufruf mit derselben ID wird als bereits erledigt erkannt.
- Pro Browseransicht gibt es höchstens **einen** aktiven Dokument-Listener. Kampagnen-/Figurenwechsel und Abmeldung beenden ihn. Cache-Snapshots, ausstehende Schreibbestätigungen und Offline-Zustand sperren Aktionen sichtbar. Bei einer **unbestätigten** Transaktion wird nur dieselbe Aktion mit derselben ID erneut angeboten, bevor andere Aktionen möglich sind.
- **Kein** automatischer Abgleich vom lokalen Charakterlabor: Dort geänderte Profile werden weiterhin ausdrücklich hochgeladen. Notizen, Würfe und Initiative bleiben lokal. Das verhindert zusätzliche Schattenzustände.

## Durchgeführte technische Prüfungen

| Nachweis | Ergebnis |
| --- | --- |
| Gesamte lokale Node-Regelsuite, Import-/UI-/Katalog-/Syntaxregression nach gemeinsamer Regelmoduländerung | **227/227 bestanden** |
| Isolierter Firebase-Firestore-Emulator: Rollen, andere Spieler, Sperre, Cloud-Figuren, gebündelte Ressourcenfälle | **19/19 bestanden** |
| Zwei konkurrierende Schreibtransaktionen auf derselben letzten Klassenressource | **Genau 1 Erfolg, 1 abgewiesene Aktion**, Zähler 0 |
| Transaktionswiederholung derselben Kennung | **Einmal verbucht**, zweiter Aufruf `duplicate: true` |
| Echter Firestore-Listener der SL auf Spielerfigur | **Server-Update mit exakt erwarteten TP empfangen** |
| Negativfälle: übergroße Aktionsliste, Zugriff anderer Spieler, nachträglich gesperrter Spieler | **Serverseitig abgewiesen** |
| Pure Regelaktionen: Inventar unter 0, Ressourcen oberhalb Maximum, ungültige Würfe/Heilwerte/Edras-Aktion | **Abgewiesen** |
| Inline-Module und lokale Imports, neue Bedienelemente und Offline-/Retry-Verdrahtung | **Syntax-/Strukturtests bestanden** |
| `git diff --check` | **Unauffällig** |
| Tatsächliches Verhalten bei Verbindungsabbruch und Wiederaufnahme in zwei Browsern, Bedienbarkeit/320-px-Ansicht | **Offen – nicht als bestanden gewertet** |

Die `PERMISSION_DENIED`-Ausgaben des Emulators entstehen bei absichtlich abgewiesenen Testzugriffen. Kein Test hat die produktive Datenbank oder GitHub verändert.

## Bekannte Grenzen / Gate A

**Das vollständige interne Mehrbrowser-Gate A bleibt offen.** Der offizielle verwaltete Website-Preview-Dienst (`sites-previewd`) steht im Container nicht zur Verfügung. Node-Tests und Emulator beweisen die Regel- und Datenbankseite, aber weder echte Zwei-Browser-Interaktion noch Mobil-Reflow oder Tastaturbedienung. Diese Nachweise werden spätestens im großen internen B15-Abschlusstest nachgeholt, **ohne vorherigen Nutzertest**.

Weitere Grenzen:

1. Firestore-Regeln autorisieren **Figurbesitzer/SL**, nicht jede innere Regeloperation. Ein berechtigter Nutzer könnte per eigenem Client Werte direkt verändern. Die Anwendung erzwingt regelgerechte Transaktionen für ihre eigenen Aktionen, ist jedoch **kein serverseitig manipulierungssicheres Anti-Cheat-System**.
2. Der 24er-ID-Verlauf ist begrenzter Retry-Schutz, kein unbegrenztes Aktionsjournal. Ein alter Vorgang kann nach mehr als 24 weiteren Aktionen nicht mehr sicher dedupliziert werden.
3. Browser-Offline-Zustände werden in der Oberfläche gesperrt, aber ein echter Netzausfall mit verspäteter Serverantwort wurde mangels Browserumgebung nicht simuliert. Ein nicht eindeutig bestätigter Vorgang wird zur identischen Wiederholung angeboten, nicht einfach als erfolgreich ausgegeben.
4. Freie 5.5e-Sonderfälle und besondere Rastvoraussetzungen bleiben Spielleitungsentscheidungen. Der Cloud-Spielmodus ruft keine beliebigen Zaubereffekte, Konzentrationsautomatik oder Hausregeln automatisch auf.
5. Die in B02 geprüften Firestore-Regeln sind weiterhin **nicht live veröffentlicht**. Für produktiven Mehrspielereinsatz ist später ihre kontrollierte Freigabe erforderlich.

## Anti-Bloat und Design-Review

- **0 neue Laufzeitpakete, 0 neue Datenspeicher, 0 zusätzliche SRD-Datenkopien, 0 separate 5.5e-Formelsätze.** Ein kleiner gemeinsamer Aktionsadapter ersetzte zwei Studio-Ableitungen; der bestehende Firebase-Client führt den einzigen aktiven Listener und dieselben Transaktionen aus.
- Bestehende grüne Palette, Buttons, Eingabefelder, Labels und Listen weiterverwendet. Kein neues Branding, keine Fantasy-Generatorkulisse, keine künstlichen Metriken, keine leere „Hero“-Fläche.
- [Anti-KI-Look-Prüfliste](DESIGN_ANTI_AI_LOOK.md): Warnsignale 1–7 in neuem Markup und Text statisch unauffällig; Signal 8 (echte mobile/zugängliche Bedienung) **offen** bis Browser-Screenshots und Nutzungsfluss geprüft sind. „KI-artig“ wird nicht pseudowissenschaftlich in Prozent gemessen.

## Referenz für verwendetes Verhalten

- [Firebase: Firestore-Transaktionen und automatisches Wiederholen bei Konkurrenz](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firebase: Live-Listener und Metadaten (`fromCache`, `hasPendingWrites`)](https://firebase.google.com/docs/firestore/query-data/listen)
- [Firebase: Sicherheitsregeln für Dokumentzugriffe](https://firebase.google.com/docs/firestore/security/rules-conditions)

**Releaseentscheidung:** B04-Codeblock **technisch umgesetzt**, interne Browser-Abnahme **nicht abgeschlossen**. Noch **12 geplante Batches B05–B16** plus offene B01/B03/B04-Browsernachweise. **Kein Live-Deployment, kein Testauftrag an den Nutzer.**
