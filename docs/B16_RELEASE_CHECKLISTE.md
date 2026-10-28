# B16 – Veröffentlichungscheckliste (nur nach endgültiger Zustimmung)

## Vor dem einmaligen Nutzertest

- [ ] Nur `https://wuerfelbund-staging.web.app/` als **dauerhaften, isolierten Staging-Host** verwenden; das generierte `firebase-runtime.mjs` muss ausschließlich `projectId: wuerfelbund-staging` enthalten. [Dauer-Staging-Betrieb](B16_STAGING_DAUERBETRIEB.md).
- [ ] Bei echtem `npm run staging:smoke` die lokalen `test-results/b16-staging-smoke-*.json`-Ressourcenprotokolle aufbewahren. Keine unkontrollierten Testdatenlöschungen.

- [ ] ZIP/SHA-Version identisch zu geprüfter RC.
- [ ] B16-Logik, Firestore-Regeln, Auth-/Firestore-Emulator, öffentliche Build-Allowlist, C4- und B16-Audits ohne Fehler.
- [ ] Vollständige Browsermatrix Chromium **und** Firefox im isolierten Demo-Emulator.
- [ ] Android 320–390 px und vergrößerte Darstellung; echte Screenreader-Ausgabe nur dann als bestanden markieren, wenn tatsächlich gehört/geprüft.
- [ ] B16-spezifische Übergabe-/Auskunfts-/Löschwege in echtem getrennten Staging geprüft.
- [ ] Keine offenen kritischen Rechte-, Datenverlust- oder Game-Blocker.

## Vor einem öffentlichen Deploy

- [ ] Der Betreiber hat den **einzigen großen B16-Praxistest** abgenommen.
- [ ] Schriftliche Zustimmung zu **exakter Version und Commit** vorhanden.
- [ ] Impressum, Datenschutzerklärung, verantwortliche Person, Kontakt, Betroffenenrechte, Retention und AV-/Transferfragen fachlich genehmigt.
- [ ] Firebase `wuerfelbund` gegen `wuerfelbund-staging` und `demo-wuerfelbund` abgeglichen, separate Backups/Regelversionen gesichert.
- [ ] Auth-Domains und Reset-/Verifikations-E-Mail-Templates korrekt; Android-Login getestet.
- [ ] App Check (nur nach Staging-/Kosten-/Kompatibilitätsnachweis) und Firebase-Quoten/Betriebsüberwachung bewusst entschieden.
- [ ] Kein Geheimnis, kein privates Weltwissen, keine Test-Accounts oder Debug-Logs im Pages-`dist`.
- [ ] `ops/release-config.json`-Flags erst jetzt begründet gesetzt; `npm run check:release` grün.
- [ ] GitHub Pages Source `GitHub Actions`, `github-pages`-Environment geschützt und Branch `main` kontrolliert.
- [ ] `docs/B16_ROLLBACK.md` mit letzter funktionierender Version und Rules-Versionskennung aktualisiert.
- [ ] Pages-Release ausschließlich manuell `workflow_dispatch`; Firebase-Regeln **separat** und ausdrücklich freigegeben.

## Direkt nach autorisiertem Deploy

- [ ] Live-HTTPS und korrekter Pfad/Cache.
- [ ] Ein explizit freigegebenes Testkonto: Login, Regelrechte, Export, Cloud-Sync; keine echten Nutzerinhalte aus Testzwecken löschen.
- [ ] Firebase/Pages-Fehler- und Quotenmonitoring, Rückweg bei Fehlern.
- [ ] Öffentliche Versions- und Kontaktinformation, keine ungeprüften Beta-Versprechen.

**Stand RC:** Alle Veröffentlichungssperren bleiben absichtlich aktiv, die Punkte sind **keine** behaupteten Erfolge.
