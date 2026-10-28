# B14 · v0.42 – Veröffentlichungssicherheit und Betrieb

**27.10.2026.** B14-Codeblock geprüft, **keine** Live-Veröffentlichung und keine Aussage über noch nicht ausgeführte Produktions-/Browserprüfungen.

## Reale Änderungen

- Versionierte **GitHub-Actions-Prüfung** für Node/Firestore-Emulator/öffentlichen Build; getrennte **manuelle** Pages-Freigabe. Normale Pushes veröffentlichen nichts. Der Release-Gate verweigert standardmäßig B14/B15-Versionen, fehlende Betreiber-/Feedback-/Datenschutzangaben und unbestätigtes Firebase-Staging.
- **Allowlist-Build**: 57 explizit ausgewählte Webdateien, SHA-256/Größeninventar, Verbot von Quell-Symlinks und versteckten Dateien. Interne Regeln, Tests, Dokumente, npm, Ops und Secrets kommen nicht in `dist`.
- Firestore-SL-Privatdokumente enger begrenzt: Felder, Notizen/Saaten und Größen. Bestehende Spieler-/SL-Rechte unverändert.
- Ehrliche Datenschutz-/Impressum-**Entwürfe** plus Account-Datenhinweis und Footerlinks. Fehlende echte Betreiber-/Lösch-/Feedbackangaben sperren die Freigabe. Externe Google-Webfonts im Studio entfernt: weniger Fremdanfragen, bestehende Farben und Bedienelemente erhalten.
- [Betriebsanleitung mit Freigabe-, Rückroll-, Backup- und Kostenkontrollen](B14_BETRIEB.md).

## Durchgeführt

| Technischer Nachweis | Ergebnis |
| --- | --- |
| `npm ci --ignore-scripts --prefer-offline --no-audit --no-fund` | **Erfolgreich**, bestehendes Lockfile; keine neuen Pakete |
| `node --test` für betroffene Website-/Cloud-/Accessibility-Verdrahtung | **26/26 bestanden** |
| Firestore-Emulator mit Java-17-Laufzeitbibliothek, `npm run test:firestore` | **24/24 bestanden**, einschließlich B14-Privatdatenlimits und Fremdzugriff |
| `npm run build:public` | **57 freigegebene Dateien** gebaut, keine externen Schreiboperationen |
| `npm run test:public` | **4/4 bestanden**: Allowlist, SHA-256, Quellen- und Rechtslinks, bewusste Releasesperre |
| ZIP-Integrität | Nach dem finalen Packen separat geprüft |

Frühere unveränderte Regelmodule mussten nicht erneut vollständig getestet werden; letzter vollständiger Node-Lauf aus B13: **311/311**. GitHub-Actions-Workflow ist **lokal auf seinen Inhalt geprüft**, noch nicht auf dem echten GitHub-Runner ausgeführt. `dist` ist ein **Prüf-Bundle**, kein bereits ausgerollter Standort.

## Design-/Anti-Bloat-Befund

- Keine neuen dekorativen Karten, KI-Bilder, sinnlosen Buttons oder Layoutsysteme; neue Rechtsseiten nutzen vorhandenes `studio.css` und die bestehende Navigation.
- Echte Online-/Lokaldaten werden nicht vermischt; Datenhinweis sitzt **vor** Kontoerstellung, die Legal-Links sind ohne Anmeldung zugänglich.
- Entfernte Webfonts sparen einen Fremddienst; keine zusätzliche Laufzeitabhängigkeit, keine geänderte Charakterspeicherlogik.
- Eine zentrale Freigabeliste statt paralleler Deploymentpfade; alle Prüfungen und Betriebsdokumente bleiben vom Web-Artefakt getrennt.
- **Offen:** echte Screenshots, 320 px/200 % Zoom, Screenreader, Kontrast-/Fokusprüfung, Drei-Sekunden-Test und offizieller GitHub-/Firebase-Staging-Lauf. Keine fingierte UX- oder DSGVO-Konformität.

## Freigabeentscheidung

**B14-Build und lokale Sicherheitsprüfungen erfolgreich; öffentliche Beta gesperrt.** Für B15 fehlen realer Browser-/Mehrkonto-/GitHub-Runner-Test und Gesamtabnahme. Für B16 zusätzlich persönliche Betreiberangaben, rechtlich geprüfte Hinweise, Datenschutz-/Löschverfahren, App-Check-/Kostenkonfiguration sowie die ausdrückliche Nutzerfreigabe.

**Danach verbleiben zwei geplante Batches: B15 (interner Gesamttest) und B16 (einzige Nutzer-Endabnahme / kontrollierte Beta-Freigabe).**
