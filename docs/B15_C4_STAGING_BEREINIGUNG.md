# C4 – sichere Bereinigung ausschließlich im Firebase-Staging

**Zielprojekt: `wuerfelbund-staging`.** Die C3-Prüfung dort ist am **28.10.2026 mit 9/9 Tests** bestanden (externer Betreiber-Nachweis). Das **Produktivprojekt `wuerfelbund` darf weder geöffnet noch verändert noch bereinigt werden**. Dieser Plan löst **kein automatisches Löschen** aus und gehört nicht zu den CI-Workflows.

## Vor jeder Löschung

1. Den erfolgreichen C3-Testnachweis (Datum, Ergebnis, gegebenenfalls Testprotokoll ohne Zugangsdaten) sichern. Erst danach Testdaten entfernen.
2. Die [Firebase Console](https://console.firebase.google.com/) öffnen und oben die **exakte Projekt-ID `wuerfelbund-staging`** kontrollieren. Nur dort **Firestore Database → Data** bzw. **Authentication → Users** öffnen.
3. **Wenn `wuerfelbund` statt `wuerfelbund-staging` erscheint: sofort abbrechen.** Kein CLI-Standardprojekt, keine Alias-/Glob-/Wildcard-Löschbefehle und keine projektweite Bereinigung verwenden.
4. Alle anderen Kampagnen/Nutzer im Staging als **nicht zugehörig** behandeln. Unklare Zuordnung bedeutet **nicht löschen**, sondern zunächst dokumentieren.

## C3-Testdaten eindeutig identifizieren

Das mitgelieferte `tests/staging/c3-staging.test.mjs` legt pro Lauf genau eine Kampagne an:

- `campaigns/{campaignId}` mit `name = "C3 Test <zufälliger 16-stelliger Hexwert>"` und `description = "Nur temporärer Staging-Sicherheitstest"`.
- Drei E-Mail/Passwort-Testkonten mit Muster `wb-c3-<gleicher Hexwert>-leitung@...`, `-spieler1@...`, `-spieler2@...`; die Auth-Konten werden durch den Test nach Möglichkeit bereits gelöscht.
- Unterkollektionen der Kampagne: `members`, `characters`, `dmPrivate`, `blockedUsers`; gegebenenfalls `rulePacks` **nur nach Prüfung des tatsächlichen Inhalts**.
- Persönliche Navigationsindizes unter `users/{testUid}/campaigns/{campaignId}`. Die UID-Werte stammen aus den C3-Testkonten und müssen zur identifizierten Kampagne passen.

Nur Datensätze mit **eindeutiger Übereinstimmung von Name, Beschreibung, Testzeitpunkt und Benutzer-IDs** sind bereinigbar. Ein zufällig ähnlich benannter Datensatz reicht nicht. Die genaue Kampagnen-ID und die drei UIDs vorab notieren.

## Reihenfolge in der Staging-Konsole

1. **Innerhalb des bestätigten C3-Kampagnendokuments** dessen zugehörige Dokumente in `characters`, `dmPrivate`, `blockedUsers`, `members` und gegebenenfalls `rulePacks` einzeln prüfen und gezielt löschen.
2. In `users/{testUid}/campaigns/` ausschließlich den Index zur **exakten C3-`campaignId`** je Test-UID entfernen. Andere Einträge nicht berühren.
3. Erst danach das zugehörige `campaigns/{campaignId}`-Hauptdokument entfernen. **Ein Firestore-Dokument zu löschen entfernt Unterkollektionen nicht automatisch.** Deshalb muss Schritt 1 tatsächlich kontrolliert sein.
4. Unter **Authentication → Users** prüfen, ob exakt die drei `wb-c3-...`-Testkonten noch vorhanden sind; nur diese gegebenenfalls löschen. Keine Massenlöschung von Auth-Benutzern.
5. Zum Schluss erneut `campaigns`, `users/{testUid}/campaigns` und Authentication prüfen: Die identifizierten C3-Reste sind weg, alle anderen Staging-Daten blieben erhalten.

**Wichtig:** Der normale Würfelbund-Webclient und die Firestore-Sicherheitsregeln verbieten absichtlich die Kampagnenlöschung. Die gezielte Bereinigung erfolgt daher ausschließlich mit Betreiberrechten **in der Staging-Firebase-Console**, nicht durch eine Lockerung der App-Regeln. Das ist ein kontrollierter Verwaltungsakt und **kein** neues Produktfeature. Es wird weder eine Service-Account-Datei noch ein Admin-Schlüssel in der Projekt-ZIP abgelegt.

## Wenn eine sichere Zuordnung nicht möglich ist

Die Dokumente unverändert lassen, IDs und Zeitpunkt ohne personenbezogene Zugangsdaten notieren und später gezielt prüfen. Ein kompletter Projekt-Reset wäre nur nach gesonderter, ausdrücklicher Entscheidung vertretbar, wenn `wuerfelbund-staging` tatsächlich ausschließlich wegwerfbare Testdaten enthält. **Kein automatisches Cleanup, kein rekursiver Collection-Löschbefehl, kein Zugriff auf Produktion.**

Quelle für das Unterkollektionsverhalten: [Firebase – Delete data from Cloud Firestore](https://firebase.google.com/docs/firestore/manage-data/delete-data).
