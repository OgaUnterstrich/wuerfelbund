# B15-C1: GitHub Actions im sicheren Entwicklungszweig nachweisen

**Einmalige Übertragung durch den Repository-Inhaber.** Diese Schritte veröffentlichen keine Website und ändern keine produktiven Firebase-Daten oder -Regeln. Die eigentlichen Tests laufen nach dem Push automatisch in GitHub Actions; du musst sie nicht auf deinem Rechner ausführen.

## Aus der vollständigen Projekt-ZIP übertragen

1. Lade die zu diesem Bericht gehörende **vollständige Würfelbund-Projekt-ZIP** herunter und entpacke sie in einen neuen Ordner. Die ZIP enthält absichtlich **keinen** `.git`-Ordner und keine `node_modules`.
2. Installiere [GitHub Desktop](https://desktop.github.com/) und melde dich mit dem GitHub-Konto an, das das [Repository](https://github.com/ogaunterstrich/wuerfelbund) besitzt.
3. Wähle in GitHub Desktop **File → Clone repository → URL** und füge `https://github.com/ogaunterstrich/wuerfelbund` ein. Wähle einen leeren lokalen Zielordner und klicke **Clone**.
4. Wähle **Current branch → New branch**, Name **`b15-gate-c-ci-ux`**, Ausgangspunkt **`main`**. **Create branch** anklicken. Falls der Zweig schon existiert, nicht ungeprüft überschreiben: zunächst melden.
5. Öffne den eben geklonten Repository-Ordner über **Repository → Show in Explorer**. Kopiere **alle Inhalte** des entpackten Würfelbund-Projektordners dorthin, einschließlich `.github`, `js`, `data`, `docs`, `tests`, `ops`, `scripts`, `firestore.rules` und `package-lock.json`. Bestehende `index.html` und `README.md` durch die Dateien aus dieser geprüften ZIP ersetzen. **Den versteckten `.git`-Ordner des Klons nicht anfassen.**
6. Wechsel zu GitHub Desktop. Kontrolliere links **Current branch: `b15-gate-c-ci-ux`** (nicht `main`). Unter **Changes** sollten viele neue Projektdateien erscheinen. Es dürfen keine `node_modules`, `.test-browsers`, `.test-tools`, `test-results` oder `dist` zum Commit anstehen.
7. Trage als Zusammenfassung **`B15: CI-Matrix und Accessibility-Nachweise für Gate C`** ein. Klicke **Commit to b15-gate-c-ci-ux**, danach **Publish branch** oder **Push origin**. **Keinen Pull Request mergen, keine Deploy-Workflows starten.**

## Den echten GitHub-Actions-Lauf prüfen

8. Öffne [Actions im Würfelbund-Repository](https://github.com/ogaunterstrich/wuerfelbund/actions). Der neue Push sollte **„Würfelbund · interne Prüfungen“** starten. Falls GitHub Actions für das Repository noch deaktiviert ist, siehe [Settings → Actions → General](https://github.com/ogaunterstrich/wuerfelbund/settings/actions) und aktiviere die Verwendung der benötigten offiziellen Actions. Dafür ist **kein Firebase-Abrechnungskonto** nötig.
9. Öffne den neuen Lauf für den Zweig `b15-gate-c-ci-ux`. Die Pflichtjobs sind **`logic`**, **`Browser · chromium`**, **`Browser · firefox`**. Die Browserjobs laufen unabhängig in derselben Matrix und verwenden jeweils isolierte `demo-wuerfelbund`-Emulatoren.
10. Schicke mir **nur den direkten Link zum GitHub-Actions-Lauf** (z. B. `https://github.com/ogaunterstrich/wuerfelbund/actions/runs/...`). Ich werte die Ausführung und ggf. Fehlerprotokolle aus. **Keine manuelle Website-Testsession erforderlich.**

Wenn ein Job scheitert, in GitHub Actions unter **Artifacts** die vorhandene Datei `b15-browser-chromium` oder `b15-browser-firefox` herunterladen und hier anhängen. Diese Artefakte enthalten Fehlerscreenshots und Playwright-Traces. Keine produktiven Anmeldedaten oder echten Kampagnendaten hineinkopieren.

## Sicherheitskontrollen

- `.github/workflows/verify.yml` reagiert auf Push/PR und liest ausschließlich den Branch; der Workflow enthält **keine Deployment-Aktion** und setzt **keine GitHub-/Firebase-Geheimnisse** voraus.
- `.github/workflows/pages-release.yml` ist nur manuell per `workflow_dispatch` freigegeben und besitzt eine eigene Bestätigungssperre. **Nicht starten.**
- `firebase emulators:exec` verwendet ausschließlich `--project demo-wuerfelbund`, nicht `wuerfelbund`.
- Nach einem erfolgreichen CI-Lauf ist **B15-C1 erst dann nachgewiesen**, nicht automatisch B15 oder B16 veröffentlicht.
