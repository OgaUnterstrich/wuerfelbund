# Würfelbund B14 – Betrieb und Freigabeweg

Stand: 27.10.2026. **Noch keine öffentliche Freigabe**; diese Anleitung ist für den geplanten B16-Abschluss nach B15-Gesamtabnahme.

## Auslieferung ohne Entwicklungsdateien

1. `npm ci`, `npm run test:logic` und `npm run test:firestore` (isoliertes Firebase-Projekt `demo-wuerfelbund`).
2. `npm run build:public` erstellt `dist/` ausschließlich aus freigegebenen HTML-/CSS-/JS-/SRD-/Lizenzdateien. `node_modules`, `.github`, `tests`, `docs`, `ops`, Firestore-Regeln und Paketkonfiguration werden **nicht** ausgeliefert. Keine Symlinks; `public-manifest.json` enthält je Quelldatei SHA-256 und Größe. Das Manifest ist eine **Prüfsumme, keine digitale Signatur**.
3. `npm run test:public` prüft Inhalt, Hashes, Lizenz-/Datenschutzlinks und die gesperrte Standardfreigabe. Die CI führt diese Schritte nach den Emulator-Tests selbst aus.
4. Bei `Settings → Pages → Build and deployment` die Quelle **GitHub Actions** wählen. Nur das manuelle Workflow `pages-release.yml` kann später `dist/` hochladen und ausliefern. Normale Push-/PR-Prüfungen in `verify.yml` **veröffentlichen nichts**.
5. Nach bestandener interner B15-Abnahme und expliziter Zustimmung in B16: `ops/release-config.json` auf geprüfte v1-Angaben anpassen, die Texte `datenschutz.html`/`impressum.html` fachlich vervollständigen, `npm run check:release` muss grün sein; `github-pages`-Environment auf `main` beschränken und gegebenenfalls erforderliche Reviewer aktivieren. Dann erst den manuellen Workflow mit `PUBLIC-V1-CONFIRMED` auslösen.

**Wichtig:** `dist/` ist generiert und wird beim Neubau nur ersetzt, wenn es seinen eigenen Herkunftsmarker trägt. Es gehört nicht in die Entwicklungs-ZIP; der Build ist reproduzierbar.

## Firestore und Berechtigungen

- `firestore.rules` ist die maßgebliche **Projektdatei**, nicht automatisch die Konsole-/Live-Fassung. **Nie** bei einem Pages-Deploy automatisch Firebase-Regeln veröffentlichen.
- B14 begrenzt den zulässigen Inhalt unter `campaigns/{id}/dmPrivate/{id}` zusätzlich (Name/Notiz/Saat, Feld- und Zeichenlimits). Die Freigabematrix für Eigentümer, Spieler, ausgeschlossene Nutzer und anonyme Zugriffe bleibt bestehen.
- Vor einem **separaten** manuellen Firebase-Rules-Deployment: Emulatorgrün, identische Projekt-/Rules-Version, vorab gesicherte letzte veröffentlichte Regeln, isolierter Staging-Test mit zwei Spielerkonten und SL, bewusste Bestätigung der Projekt-ID. Keine Änderung der Auth-/Rules-Konsole durch dieses B14-Archiv.
- Firestore-Sicherheitsregeln begrenzen Datenformen und Rechte, **keine Anzahl neuer Konten oder Dokumente pro Stunde**. App Check (reCAPTCHA Enterprise) und Produkt-/Projektquoten müssen vor öffentlicher Öffnung konfiguriert, beobachtet und gegen legitime Zugriffe getestet werden. **Budgetwarnungen sind keine harte Kostenobergrenze.**
- Mit einem bekannten Einladungslink darf nach dem bestehenden Modell jeder angemeldete, nicht gesperrte Nutzer beitreten. Für vertrauliche Kampagnen Link vertraulich halten; ein späteres Einmal-/Bestätigungs-Einladungssystem wäre eine eigene Erweiterung.

## Datensicherung und Rückweg

1. **Webversion:** Vor Release Quellcommit, getestete vollständige Projekt-ZIP und `public-manifest.json`/SHA-256 der letzten funktionierenden Ausgabe aufbewahren. Im Fehlerfall den freigegebenen vorherigen Commit erneut **über denselben gesicherten manuellen Workflow** ausliefern; nicht einfach Produktionsdateien einzeln überschreiben.
2. **Regeln:** Letzte produktive `firestore.rules` sicher archivieren. Bei Fehlverhalten: Änderung im Emulator erneut durchspielen, dann nur die geprüfte Rules-Datei gezielt zurückrollen. Die Website-Version allein ändert keine Datenbankregeln.
3. **Nutzerdaten:** Die Download-ZIP ist **kein** Firestore-Backup. Lokale JSON-Exporte sichern nur lokale Spielstände. Für Cloud-Daten vor Live-Betrieb einen autorisierten, getesteten Firestore-Export-/Wiederherstellungsweg samt Aufbewahrung/Datenschutz organisieren. Export in Cloud Storage kann zusätzliche Kosten und Berechtigungen erfordern; nicht automatisch ausführen.
4. **Störung/Angriff:** Weitere Registrierungen/Cloud-Zugriff nur über bewusst konfigurierte Firebase-Administrationsmaßnahmen begrenzen; Zugangsdaten nicht in Issues oder Browserlogs legen. Keine destruktive Datenbankbereinigung ohne gesonderte Freigabe.

## Noch zu erfüllende Release-Sperren

- Betreibername, erreichbare Kontakt- und Feedbackadresse, gegebenenfalls ladungsfähige Anschrift, weitere fallabhängige Pflichtangaben.
- Rechtsgrundlagen, Datenempfänger, Speicherfristen, Auskunfts-/Löschweg, Firebase-Dienstleister-/Transferfragen prüfen. Die mitgelieferten HTML-Seiten sind **gekennzeichnete Entwürfe**, keine fertigen rechtsverbindlichen Texte.
- Konto-/Cloud-Löschung und Auskunftsprozess mit echten Konten sicher operationalisieren oder vor Public-Beta anderweitig rechtlich tragfähig lösen. Lokale Löschung entfernt Cloud-Daten nicht.
- Kostenwarnungen, App Check/Quoten, Missbrauchsalarme und Auth-Einstellungen am tatsächlichen Firebase-Projekt vor öffentlicher Öffnung nachweisen.
- Reale Staging-/GitHub-Actions-/Browser-/Mehrkonto-Prüfung in B15; B14 hat **nur lokal reproduzierte** CI-/Emulator-/Bundle-Tests, keinen behaupteten Produktionsnachweis.

## Verbindliche Qualität auch für B15/B16

Bei jeder Änderung: klares Spieler-/SL-Ziel, korrekte Terminologie, ehrliche Statusmeldungen, responsive Navigation, Tastatur/Fokus, Fehlerrückweg, [acht Anti-KI-Look-Warnsignale](DESIGN_ANTI_AI_LOOK.md), keine unnötigen Karten, Bilder, Abhängigkeiten oder zweite Datenspeicherung. Große visuelle Browserprüfung mit Screenshots findet in B15 statt – **nicht** als Nutzerpflicht zwischen Batches.

Quellen: [GitHub Pages Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [GitHub Deployment-Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments), [Firebase Emulator](https://firebase.google.com/docs/firestore/security/test-rules-emulator), [Firebase App Check](https://firebase.google.com/docs/app-check/web/recaptcha-provider), [Cloud-Budgetwarnungen](https://docs.cloud.google.com/billing/docs/how-to/budgets), [DSGVO Art. 13](https://eur-lex.europa.eu/eli/reg/2016/679/oj/deu).
