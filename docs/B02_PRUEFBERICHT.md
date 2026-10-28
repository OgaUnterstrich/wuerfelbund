# B02 · Firestore-Rechte und Mehrspieler-Datenmodell

Stand: 26.10.2026. **Internes Emulator-Gate bestanden; nicht produktiv ausgerollt.**

## Umgesetzt

- `firestore.rules` als vollständige Regelquelle; `firebase.json` für den Emulator.
- Bestehende Zwei-Dokumente-Batches für Kampagnenerstellung und Beitritt funktionieren. Der persönliche Index verleiht niemals Berechtigungen.
- Festgelegte Rollen, Eigentums- und Zeitstempelschutz, begrenzte Kampagnenänderungen.
- Besitzerseitige Sperren verhindern erneutes Beitreten über bekannte Einladungslinks.
- Eignergebundene Cloud-Charakterdokumente mit Version und unverändertem Profil; SL-private Dokumente sind getrennt.
- Persönliche Hausregelpakete bleiben privat. Cloud-Speichern sendet nur freigegebene Felder.
- Keine zusätzlichen Laufzeit-Abhängigkeiten der GitHub-Pages-App; Testwerkzeuge nur als Dev-Abhängigkeiten.

## Nachgewiesene Tests

`LD_LIBRARY_PATH=/usr/lib/jvm/java-17-openjdk-amd64/lib npm run test:firestore`

**12/12 Firestore-Emulator-Tests bestanden.** Tatsächlich ausgeführter Firestore-Emulator mit Testkonten `alice` (SL), `bob` und `carol` (Spieler), `mallory` (außenstehend) und anonym. Isoliertes Demo-Projekt `demo-wuerfelbund`, keine produktiven Nutzerinhalte. Erwartete `PERMISSION_DENIED`-Logs gehören zu den negativen Testfällen.

| Prüfung | Ergebnis |
| --- | --- |
| Owner-/Member-Batches mit `getAfter` | bestanden |
| Rollenspoofing, Rechte bei get/list/create/update/delete | verboten wie vorgesehen |
| Fremdzugriff, zwei Kampagnen, geänderte Eigentümer-ID | verweigert |
| Mitglied löschen, Sperren und Wiederbeitritt mit bekanntem Link | gesichert |
| Figurenbesitz, fremde Bearbeitung, Schema und Listenfilter | bestanden |
| SL-private Daten und persönliche Hausregeln | nur für Berechtigte |
| Alle unbekannten Dokumentpfade | gesperrt |

Der neue Emulator-Test liegt bewusst als `*.emulator.mjs` vor und läuft separat, damit normale Node-Regeltests ohne Firestore-Dienst nicht versehentlich als Sicherheitsnachweis gelten.

## Offene Grenzen

- **Kein Live-Deployment.** Das tatsächliche Firebase-Projekt muss vor Veröffentlichung in Staging überprüft werden.
- **Keine Cloud-Charakteroberfläche** – B03 verbindet die vorhandenen Profile mit dem vorbereiteten Dokumentformat.
- **Kein SL-Sperrdialog** – die gesicherte Sperr-Operation ist noch nicht über die Website bedienbar.
- `dmPrivate` ist ein geschützter Speicherbereich, noch keine fertig implementierte Edras-Seed-/Geheimwerterzeugung.
- Echte Browser-/Mehrgeräte- und Live-Staging-Tests folgen in B03/B04/B14/B15. Bis dahin kein Nutzertest notwendig.

## Anti-Bloat

Eine Rules-Datei, eine Emulator-Konfiguration und eine Sicherheitstestsuite; ausschließlich offizielle Entwicklerpakete. Keine neue Cloud-Abstraktionsbibliothek, keine Client-Rollen-Engine, kein paralleles D&D-Charaktermodell, keine zusätzlichen UI-Elemente.
