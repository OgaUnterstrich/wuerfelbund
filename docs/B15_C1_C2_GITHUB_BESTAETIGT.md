# B15-C1/C2 – bestätigter GitHub-Actions-Nachweis

**Stand: 28.10.2026.** Die bisher als ausstehend dokumentierte Erstbestätigung ist durch den neueren, vom Projektinhaber übermittelten GitHub-Actions-Ergebnisnachweis ersetzt. Vorherige historische Protokolle werden nicht rückwirkend umgeschrieben.

| Angabe | Nachweis des Projektinhabers |
| --- | --- |
| Repository | `ogaunterstrich/wuerfelbund` |
| Entwicklungszweig | `b15-gate-c-ci-ux` |
| Commit | `360a53b` |
| Workflow | `Würfelbund · interne Prüfungen` |
| Ergebnis | **Success** |
| Dauer | **2 Minuten, 11 Sekunden** |
| Jobs | **Logik, Chromium, Firefox – alle erfolgreich** |
| Browserartefakte | **Zwei** erstellt |

Damit gelten **B15-C1 und die in diesem Lauf tatsächlich automatisierten B15-C2-Prüfungen als auf GitHub bestanden**. Es ist falsch, sie in späteren Berichten wieder als ungeprüft zu markieren. Eine Run-URL wurde nicht mitgeliefert; der Nachweis ist deshalb als **Betreiberangabe über ein GitHub-Ergebnis** gekennzeichnet und nicht als hier unabhängig über die GitHub-API abgerufener Lauf. Keine weiteren Pass-Zahlen pro Job werden erfunden.

## Nachfolgende, noch nicht GitHub-bestätigte Weiterentwicklung

Die C3-Ausgabe aktualisiert die Versionsreferenzen der Actions auf Node-24-kompatible Majors, pinnt Ubuntu 24.04 und fügt einen ausschließlich gegen `demo-wuerfelbund` laufenden Auth-/Firestore-C3-Test in den **bestehenden** Logikjob ein. Diese neuen Änderungen sind zunächst **nur lokal geprüft**; sie dürfen den Erfolg des älteren Commits `360a53b` nicht als eigenen GitHub-Nachweis ausgeben.

**Verbleibende B15-C2-Grenzen:** Eine native 200-%-Browserzoom-Probe und eine echte gesprochene Screenreader-Stichprobe lassen sich nicht aus Axe-/CSS-Zoom-Tests ableiten. Sie bleiben getrennt von den erfolgreich automatisierten C2-Prüfungen dokumentiert. Der große manuelle Nutzer-Abschlusstest bleibt B16 vorbehalten.

**Freigabe:** B15-C3 und B15-C4 sind keine Produktionsfreigabe. GitHub Pages und die produktive Firebase-Datenbank bleiben unverändert.
