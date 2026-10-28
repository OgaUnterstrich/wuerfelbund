# Würfelbund – letzter B16-RC.1-Betriebsnachtrag: Prüfbericht

**Stand:** 28.10.2026 · **Verwendung:** technischer Release Candidate `1.0.0-rc.1` **mit dauerhaftem Firebase-Staging-Hosting** · **Produktivfreigabe: NEIN**.

## 1. Unveränderte Ausgangsbasis

- Ausgangsarchiv: `wuerfelbund-b16-v1.0.0-rc.1-2026-10-28.zip`, erfolgreich als ZIP validiert und vollständig ausgepackt. Die bisherige öffentliche Web-Runtime bleibt im Quellprojekt **unverändert**, damit die geltenden Release-Sperren fortbestehen.
- Bereits extern/seitens Betreiber bestätigt und nicht erneut als ungeklärt behandelt: C1/C2 erfolgreich; C3 **9/9** im echten `wuerfelbund-staging`; C4 GitHub erfolgreich, Commit `99d7bd8`; B16-RC.1: **327/327** Logik, **6/6** B16-Audit, **7/7** C4-Audit, **8/8** Public-Build und **0 bekannte Produktionsabhängigkeits-Schwachstellen**. Das sind **übernommene externe Bestätigungen** beziehungsweise die zuvor bereits dokumentierten lokalen B16-Ergebnisse, kein neues externes GitHub-/Staging-Zertifikat.
- Keine D&D-Funktionsänderung, keine UI-Neugestaltung, kein zusätzlicher Node-/Runtime-Paketbedarf, keine neue Datenbank und kein kostenpflichtiger Dienst. `package-lock.json` bleibt identisch.

## 2. Inhalt der kleinen Betriebsergänzung

1. **Dauerhafte Staging-Site statt sieben Tage Preview:** `npm run staging:site` erzeugt nur aus dem vorhandenen 60-Dateien-Public-Allowlist-Build ein **neues** `dist-staging-site`. Darin wird `js/rules/firebase-runtime.mjs` vollständig durch eine nur für `wuerfelbund-staging.web.app` geeignete Version ersetzt. Jeder fremde HTTP(S)-Host, `localhost` oder `wuerfelbund` wird zur Laufzeit verweigert.
2. **Öffentliche Firebase-Konfiguration ohne API-Key-Eingabe:** Die gepinnte Firebase-CLI liest unter **`--project wuerfelbund-staging`** die registrierten Web-Apps und `apps:sdkconfig WEB`. Projekt-ID, Hosting-Site, Host, App-Verknüpfung, App-ID, Auth-Domain und API-Key-Form werden vor jedem Upload überprüft. Ein nicht dazu passender oder ein zweiter Prod-Client im Bundle führt zum Abbruch.
3. **Zielpunkt explizit:** `firebase deploy --only hosting --project wuerfelbund-staging --config <lokale, einzelne Hosting-Site>`; andere Produkte und `wuerfelbund` sind ausgeschlossen. Der Upload aktualisiert **nur die öffentliche Hosting-Auslieferung im separaten Staging**, nie GitHub Pages oder die produktive Website. Die Ausgabe muss genau eine Version der geprüften Site bestätigen; anschließend werden HTTPS-Seite und Runtime vom festen Host nachgelesen.
4. **Keine versteckten Nebenwirkungen:** Kein Firestore-Rules-Deploy, keine Testdatenmutation, keine App-Check-Aktivierung, kein Firebase-Billing-Upgrade durch `staging:site`. Cache-/Robots-Header (`no-store`, `noindex`) sind gesetzt; die öffentliche Erreichbarkeit bleibt als Sicherheitsgrenze dokumentiert.
5. **Kontrollierter B16-R1-Smoke:** `npm run test:b16:smoke:emulator` verifiziert die neuen Rechte/Kontoaktionen ohne Cloud. `npm run staging:smoke` ist ein **separater, absichtlicher** echter Staging-Lauf; die Nutzung wird nicht durch GitHub Actions oder den Website-Befehl ausgelöst. Die in Staging erzeugten Testpfade/UIDs werden lokal in einer ausgeschlossenen JSON-Datei protokolliert, keine pauschale Datenlöschung.
6. **Getrennte B16-Staging-Rules-Option:** `npm run staging:rules` ist ein weiterer *expliziter* Befehl mit fest gepinnter Staging-Projekt-ID, der ausschließlich Firestore-Regeln im Staging aktualisieren kann. Er gehört **nicht** zum Hosting-Befehl.

## 3. Tatsächlich automatisiert überprüft – lokal

| Nachweis | Ergebnis | Umgebung |
| --- | --- | --- |
| Originale Würfelbund-Regellogik, Figuren und optionale Edras-Regeln | **327/327 bestanden** | Node lokal |
| Auth-/Firestore-Sicherheitsregeln, Fremd- und Rollenzugriffe | **30/30 bestanden** | Firebase-Emulator lokal |
| Bestehende Mehrbenutzer-Matrix C3 | **9/9 bestanden** | Auth-/Firestore-Emulator lokal; **nicht** echter C3-Staging-Nachweis |
| **Neuer B16-R1-Smoke**: drei Konten, Kampagne, Index, Geheimnisse, Rollen-/Löschschutz, eigener Kontolöschweg | **9/9 bestanden** | Echter SDK gegen lokale Demo-Emulatoren |
| Public-Allowlist-Build + Auslieferungsaudit | **60 Dateien, 8/8 bestanden** | Lokal |
| C4-/B16-Lizenz-, Sicherheits- und Release-Audits | **7/7 + 6/6 bestanden** | Lokal |
| **Neue Dauer-Staging-Sicherheitsprüfungen**: falsche Projekt-ID, Site/App/Host, abweichende SDK-Konfiguration, eingeschleuste Prod-Konfiguration, Zielargumente und Deploy-Antwort | **5/5 bestanden** | Lokal; Mock-Konfiguration, **kein echter Cloud-Deploy** |
| Chromium vollständige E2E-Matrix einschließlich 320px, Konten, Charakteren und Offline | **21/21 bestanden** | Echter Chromium mit Demo-Firebase |
| Firefox vollständige E2E-Matrix | **21/21 bestanden** | Echter Firefox mit Demo-Firebase |
| Öffentliche Freigabe | **Weiterhin absichtlich verweigert** | `npm run check:release` |

Die zusammenhängende Prüfkette `npm run test:b16:rc` umfasst jetzt **12 Prüfstufen** einschließlich der absichtlich geschlossenen Release-Sperre und speichert `test-results/b16-rc-summary.json` mit den tatsächlichen Exitcodes. Der Browser-Testcontainer benötigte wie beim ursprünglichen B16-Lauf lediglich lokal Firefox-kompatible Prozess-/Bibliotheksoptionen; die Produktiv- oder Firestore-Regeln wurden dafür **nicht** gelockert.

**Kein eigens durchgeführter echter Staging-Deploy:** In dieser Arbeitsumgebung wurde weder Hosting noch Firestore noch Auth von `wuerfelbund-staging` extern geändert. Die Nutzung vorhandener **Benutzer-CLI-Anmeldung auf Windows/Termux** und die erste echte HTTPS-Prüfung bleiben kontrolliert beim Betreiber. Die B16-spezifische echte Staging-Smokematrix ist deshalb **noch nicht extern bestanden** und nicht mit dem bestätigten C3-9/9-Ergebnis gleichzusetzen.

## 4. Zusätzliche Sicherheitsgrenzen

- Das **normale** `js/rules/firebase-runtime.mjs` enthält weiterhin den öffentlichen Produktiv-Client: **Das Standard-`dist` niemals als Staging-Hosting-Dateien hochladen.** Das Staging-Skript verwendet ausschließlich das eigens kontrollierte `dist-staging-site` und verifiziert dessen dynamisch erzeugte Runtime.
- Die Hosting-Deployment-Konfiguration enthält exakt **eine** Site. Kein impliziter Firebase-Standardprojektwert, kein globales `firebase deploy` ohne `--only hosting`, kein Pages-Workflow-Deploy und keine GitHub-Anmelde-/Push-Automation.
- Vor dem Upload werden Hosting-Site `projects/wuerfelbund-staging/sites/wuerfelbund-staging` und feste URL `https://wuerfelbund-staging.web.app` geprüft. Nach dem Upload werden Hosting-Versionspfad, derselbe Site-Eintrag und die tatsächlich ausgelieferte Runtime kontrolliert.
- Der Code behält einen **leeren App-Check-Site-Key**; ein gefüllter Key im erzeugten Staging-Bundle löst einen Abbruch aus. Keine kostenpflichtige reCAPTCHA-Einführung, kein Enforcement.
- Die Staging-Website selbst ist technisch **öffentlich zugänglich**. `noindex` ist **kein** Zugriffsschutz. Nur Testdaten, restriktive Firestore-Sicherheitsregeln und sparsames Teilen des Links verwenden.
- Der optionale echte R1-Smoke löscht bei positivem Kontolöschtest **nur exakt vorher selbst erzeugte** Spieler-/Charakter-/Indexdaten. Andere künstliche Testidentitäten und Kampagnendaten bleiben für gezielte, protokollierte Staging-Bereinigung stehen. Kein automatisches Admin-/Wildcard-Löschen.

## 5. Offene, bewusst manuelle Punkte bis zur Beta

1. **Einmalig auf Windows:** `npm ci && npm run staging:site` aus dem entpackten Ordner; bei fehlender Staging-Hosting-Site diese in der richtigen Firebase Console anlegen. Echte Staging-Deployment- und HTTPS-Verifikation abwarten. Keine API-Key-Kopie.
2. **Einmalig prüfen:** `wuerfelbund-staging.web.app` in **Staging-Authentication → Authorized domains**. Falls mehrere Staging-Web-Apps unverbunden sind, die öffentliche App-ID auswählen.
3. **Für die neuen SL-/Konto-Rechte:** B16-Firestore-Regeln im Staging bewusstermaßen mit `npm run staging:rules` aktualisieren; optional `npm run staging:smoke` (neue isolierte Testdaten und protokollierte Reste). Die bestätigten externen **C3 9/9** müssen dabei **nicht** wiederholt oder erneut bestätigt werden.
4. **Genau eine abschließende Nutzersitzung** auf PC und Xiaomi Redmi für echte Verifikations- und Reset-Mails, erfolgreiche Besitzerübertragung mit verifizierter E-Mail, reales Zoom-/TalkBack-Verhalten und subjektive UX; [Ablauf](B16_STAGING_DAUERBETRIEB.md).
5. Rechtliche Pflichtangaben, Retention, App-Check-Kosten/Kompatibilität, Firebase-Produktiv-/GitHub-Pages-Freigaben separat prüfen; **vorher keinerlei Produktivveröffentlichung**.

**Verbleibende Entwicklerbatches:** **0**. Dieser Nachtrag ist ausschließlich Betrieb/Sicherheit der bereits funktional fertiggestellten RC.1. Keine künstlichen Premium-Sperren oder neuen Featurebeschränkungen.

**Abschließende Bewertung:** `B16-RC.1 + Dauer-Staging-Betriebsweg: LOKAL TECHNISCH GEPRÜFT / STAGING-LIVE NOCH NICHT AUSGEFÜHRT / PRODUKTION GESPERRT`.
