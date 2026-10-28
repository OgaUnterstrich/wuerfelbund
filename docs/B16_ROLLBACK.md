# B16 – Rückrollplan für GitHub Pages und Firebase

**Rollback ist eine Notfallmaßnahme nach einer späteren, ausdrücklich genehmigten Freigabe.** Bei dieser RC wurde weder eine Website noch eine produktive Datenbank verändert. Rollbacks dürfen niemals Tests von C3/C4 rückwirkend entwerten.

## Vor der Freigabe dokumentieren

1. Git-Commit/Tag und exakte SHA-256-Summe des freigegebenen `dist`-Artefakts notieren; letzte **nachweislich funktionierende** Pages-Version und deren CI-Artefakt/Commit getrennt aufbewahren.
2. Die vor dem Release in **`wuerfelbund`** wirksamen Firestore-Regeln und deren Rules-Versionskennung in der Firebase Console **nur lesend** sichern. Staging (`wuerfelbund-staging`) immer separat behandeln.
3. Änderungen am Datenmodell vermeiden, die ältere Clients inkompatibel machen. Für Rechts-/Datenschutzanfragen und Admin-Backups keine ungesicherten globalen Exporte im Entwicklerrechner durchführen.
4. Entscheiden, welche Störungsmeldung die Nutzer erhalten und wie sie erreichbar ist. Betreiberkontakt muss vor Produktivstart eingerichtet sein.

## Fall A – reine Website-Störung

1. Automatische Pages-Workflows deaktiviert lassen; keine weiteren Freigaben starten.
2. In GitHub Repository Actions den betroffenen Deploy-Job und die Logs sichten. Den geprüften alten Commit wieder als **neuen, bewusst freigegebenen** Rollback-Commit bereitstellen (keine destruktiven `git reset --hard`-Operationen im Benutzer-Repository).
3. Tests und `check:release` erneut ausführen. Nach Operatorgenehmigung den **manuellen** Pages-Release-Workflow auslösen.
4. HTTPS-Seite, Cache, Pfade, Anmeldung, Export und lokales Spiel in Browsern prüfen; alte JS-Dateien können noch gecacht sein. Nutzer gegebenenfalls zum Neuladen anhalten.
5. **Nicht automatisch Firestore-Regeln rückrollen:** neue Daten können alte Regeln oder alte Clients benötigen. Zunächst Rechte-/Schema-Verträglichkeit beurteilen.

## Fall B – fehlerhafte Firestore-Regeln oder unberechtigter Zugriff

1. Sofort weitere Rollouts stoppen, Zeitfenster, betroffene UIDs/Dokumente und Rules-Versionskennung protokollieren (keine Passwörter in Logs).
2. In der **richtigen** Firebase Console (`wuerfelbund` nur nach Freigabe) die bisherigen Rules-Versionen vergleichen; eine Rückkehr zur zuvor geprüften Version **nur** nach Prüfung, dass neue Daten-/Besitzwechsel dabei nicht gefährdet werden.
3. Falls Sicherheitsfehler akut und keine sichere Rückwärtskompatibilität gegeben: Cloud-Nutzung kontrolliert anhalten, den Datenschutzprozess aktivieren; kein pauschales `allow read/write: if true` als Notlösung.
4. Gleiche Regeländerung vor erneuter Freigabe zunächst im **Staging** mit echten positiven und negativen Szenarien testen. Dokumentieren, welcher Schutz bei Rollback erhalten bleibt.
5. Betroffene Nutzer und nötige Meldepflichten anhand eines fachlich geprüften Vorfallplans prüfen. Nicht automatisch echte Daten löschen.

## Fall C – App Check sperrt legitime Android-Browser

1. Betroffenen Firebase-Dienst im App-Check-Monitoring ermitteln, Metriken und Gerätetypen vergleichen.
2. Enforcement für **den betroffenen Dienst** in der korrekten Firebase-Console nach Betreiberentscheidung aussetzen; Token im Client nur nach geprüftem Rollback anpassen.
3. Staging mit Chrome auf Android, Firefox/Chromium Desktop und Datenschutz-/Tracking-Schutz prüfen; danach kontrolliert erneut aktivieren.

## Fall D – Datenpanne oder missglückte Kontoauflösung

1. Nicht versuchen, Firestore-Subcollections durch bloßes Löschen des Elterndokuments zu beseitigen – dies entfernt die Unterkollektionen nicht automatisch.
2. Nur betroffene Dokumentpfade/UIDs im korrekten Projekt identifizieren; ggf. Administratorunterstützung und rechtliche Folgen klären. **Kein** Wildcard-Löschbefehl, kein pauschales Rules-Öffnen.
3. Prüfen, ob bei Kontoauflösung Teiloperationen abgeschlossen sind; gezielt fehlende persönliche Datensätze schließen, fremde Figuren und SL-Inhalte erhalten.
4. Ergebnis, Zeitpunkt, Ansprechpartner und Nachprüfung im Betreiberprotokoll ohne unnötige personenbezogene Daten dokumentieren.

**Stoppregel:** Fehlt ein sicherer alter Build, eine kompatible Rules-Version oder die Betreiberfreigabe, keine riskanten Live-Aktionen ausführen. Zuerst Staging/CI reproduzieren, dann erneut entscheiden.
