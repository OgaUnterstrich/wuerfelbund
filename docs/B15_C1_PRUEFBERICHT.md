# B15-C1 · reproduzierbare Testinfrastruktur und Dependency-Audit

**Stand: 27.10.2026. B15 bleibt GESPERRT.** Dies ist ein Arbeitspaket im bestehenden B15, kein neuer Hauptbatch. Keine Live-Daten, Produktionsregeln oder öffentlichen Seiten wurden verändert.

## Änderungen mit begrenztem Umfang

- `firebase-tools` von 13.35.1 auf **15.34.1**, mit gepinntem Lockfile; `@playwright/test` **1.64.1** als einziges neues Testpaket. Keine neuen produktiven npm-Abhängigkeiten und keine Framework-Migration.
- `@firebase/firestore` erhält die sicherheitskorrigierte transitive Version `@grpc/grpc-js` **1.14.6** statt 1.9.16. Keine erzwungenen Firebase-/SDK-Downgrades.
- Ein einziger gemeinsamer Firebase-Konfigurationspfad (`js/rules/firebase-runtime.mjs`) ersetzt zwei identische Konfigurationskopien. Bei `localhost`/`127.0.0.1` verbinden sich **Auth und Firestore ausschließlich mit Emulatoren** im nichtproduktiven `demo-wuerfelbund`-Projekt. Andere HTTP- oder `file:`-Hosts dürfen keine Produktionsverbindung aufbauen.
- Ein 127.0.0.1-HTTP-Server liefert **nur** den erlaubten öffentlichen `dist`-Build. Die Playwright-Tests sperren Anfragen an andere Ziele als Loopback und das statische Firebase-CDN `www.gstatic.com`.
- Die CI erhält Chromium, Firefox, lokale Auth-/Firestore-Emulatoren sowie Screenshot-/Trace-Artefakte. Sie veröffentlicht **nichts**; der Pages-Release-Workflow bleibt manuell gesperrt.
- Auch der weiterhin ausdrücklich manuelle Pages-Release-Workflow verlangt nun vor der Freigabe erfolgreiche Chromium-/Firefox-Tests; dies ist noch **nicht praktisch ausgeführt**.
- Erste echte Browser-Testfälle liegen vor: lokale Würfel-/Speicher-/Importwege, Studio-Navigation und Formularvalidierung, 320px, angenäherter 200%-CSS-Zoom, Tastatur-Dialog, drei getrennte Auth-Konten und Kampagnenbeitritt. **Das Vorhandensein der Tests ist kein bestandener Browsernachweis.**

## Reproduzierbarer Aufruf (Node 22, Java 21)

```sh
npm ci
npm run test:logic
npm run test:firestore
npm run build:public
npm run test:public
npx playwright install --with-deps chromium firefox
npm run test:browser:isolated
npm audit
npm audit --omit=dev
```

`npm run test:browser:isolated` startet lokal beide Emulatoren vor dem Browserlauf. Es benötigt **keine** Anmeldung an ein reales Firebase-Projekt. Der gleiche Weg liegt in `.github/workflows/verify.yml`; **dessen Ausführung in GitHub Actions ist noch nicht belegt**.

## Ausgeführte Prüfungen und Einschränkungen

| Bereich | Tatsächlicher Befund |
| --- | --- |
| Node-Funktionalität | **317/317 bestanden**, einschließlich drei neuer Firebase-Runtime-Sicherheitsinvarianten |
| Firestore-Rechtematrix | 25 Fälle lokal mit Java 17 und der vorherigen CLI 13.35.1 bestanden; neue CLI 15.34.1 benötigt Java 21 und lief hier deshalb nicht |
| Öffentlicher Build | 58 freigegebene Dateien; 7/7 bestehende Tests bestanden; HTTP-Testserver liefert 200 für freigegebene und 404 für unbekannte Ziele |
| Audit vorher | 8 mittel, 10 hoch, 1 kritisch = 19 Entwicklungs- und Testwerkzeugbefunde |
| Audit nach Update | **5 mittel, 0 hoch, 0 kritisch**; `--omit=dev` **0**; kein `--force` |
| Chromium/Firefox | **12 Testausführungen konfiguriert, 0 tatsächlich ausgeführt**: Download liefert wiederholt ungültiges 0-MiB-Archiv, auch nach erneuter Netzwerkfreigabe |
| CI / reale Screenshots / Screenreader | **NICHT AUSGEFÜHRT**; müssen als harte Gate-C-Kriterien bestehen bleiben |
| Echtes getrenntes Firebase-Staging | **NICHT ANGELEGT/GEPRÜFT**; Demo-Emulator ist kein Ersatz für echte Staging-Konten |

### Verbleibende fünf moderate Audit-Hinweise

Die verbleibenden Meldungen betreffen die Entwicklungs-/CLI-Kette `firebase-tools → @google-cloud/pubsub → @opentelemetry/core` und `firebase-tools → gaxios → uuid`. Die aktuell angebotenen automatischen Korrekturen führen laut Audit auf ältere **Hauptversionen** der CLI oder anderer SDKs. Solche Downgrades würden die neue Java-21-/Firebase-13-Testkombination brechen oder sind nicht peer-kompatibel. Deshalb **bewusst nicht per `npm audit fix --force` umgestellt**. Browserbuild enthält kein `node_modules`; produktive npm-Abhängigkeiten: Audit 0. Die fünf moderaten Einträge müssen bei neuen kompatiblen Releases erneut bewertet werden.

### Grenzen der eingeführten Tests

Die 200%-Ansicht wird derzeit über CSS-Zoom simuliert; das ersetzt keinen echten Browserzoom-/Screenreader-Test. Die Browserfälle decken nur einen Startteil der C2/C3-Matrix ab, nicht den vollständigen Charakter-/Zauber-/Stufen-/Kampf-/Cloud-Lebenszyklus. Screenshots wurden **noch nicht** erzeugt. GitHub Actions muss zuerst die Browser- und Mehrkonto-Testfälle tatsächlich ausführen. Anschließend echte Befunde beheben, Testmatrix ausbauen und einen separaten echten Firebase-Staging-Nachweis erbringen.

## Unveränderte Freigaberegel

B15 bleibt solange **GESPERRT**, wie C1–C4 nicht nachweisbar abgeschlossen sind. B16 beginnt erst nach bestandenem B15. Der Projektinhaber muss keine Zwischenprüfungen ausführen. Kein Deployment, keine Produktionsregeländerungen und keine Datenmigration ohne gesonderte Freigabe.

Quellen: [Playwright CI](https://playwright.dev/docs/ci) · [Firebase-Demoprojekte und Emulatoren](https://firebase.google.com/docs/emulator-suite/connect_firestore) · [Firebase Authentication Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth) · [Firebase CLI Releases](https://github.com/firebase/firebase-tools/releases).
