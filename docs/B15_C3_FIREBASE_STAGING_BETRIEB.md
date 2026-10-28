# B15-C3 – Betreiberanleitung: kostenloses, isoliertes Firebase-Staging

**Ziel:** Einen echten Kampagnen-/Berechtigungstest mit **drei neuen Testkonten** gegen ein völlig unabhängiges Firebase-Projekt durchführen. **Keine Produktionsdaten, kein Hosting, keine GitHub-Pages-Veröffentlichung.** Der einmalige große manuelle Test ist erst in B16 vorgesehen.

## 1. Separates Projekt in Firebase anlegen

1. Im Browser [Firebase Console](https://console.firebase.google.com/) öffnen und **Neues Projekt hinzufügen** wählen. **Nicht** das bestehende Projekt `wuerfelbund` öffnen oder übernehmen.
2. Eine weltweit eindeutige Projekt-ID wählen, die ausdrücklich `staging` enthält, z. B. `wuerfelbund-staging-deinname`. Die im Dialog angezeigte endgültige **Projekt-ID genau notieren**. Sie ist nach Anlage nicht beliebig umbenennbar.
3. Den **Spark-Tarif (kostenlos)** verwenden; kein Billing-/Blaze-Upgrade und kein kostenpflichtiges Google-Cloud-Projekt verknüpfen. Google Analytics ist für diese Tests nicht nötig.
4. In **Build → Firestore Database** eine Datenbank im Native Mode erstellen. Eine passende EU-Region auswählen, da diese Entscheidung dauerhaft ist. Mit restriktiven Regeln starten; die Würfelbund-Testregeln werden in Schritt 3 gezielt auf dieses Projekt übertragen.
5. In **Build → Authentication → Sign-in method** nur **E-Mail/Passwort** aktivieren. Andere Login-Methoden sind für C3 unnötig.
6. Unter **Projekteinstellungen → Allgemein** eine **Web-App** registrieren (ohne Hosting). Aus der Web-App-Konfiguration nur die Felder `projectId` und `apiKey` für Schritt 3 entnehmen. Der Web-API-Key ist eine Client-Konfiguration, **kein Admin-Schlüssel**; trotzdem wird er hier nicht im Repository oder ZIP gespeichert.
7. Überprüfen: In der Konsole steht als ausgewähltes Projekt wirklich die neue ID mit `staging` und der Tarif lautet Spark. Keine bestehenden Nutzer oder Daten aus Produktion importieren.

## 2. Lokale Werkzeuge vorbereiten

- Node.js 22 oder neuer, npm, **Java 21** und Git/Terminal bereitstellen.
- Das **gesamte** neue C3-Projekt entpacken, darin ein Terminal öffnen und `npm ci` ausführen.
- Mit `npx firebase login` im Browser bei Firebase anmelden. Die Anmeldung wird von der Firebase-CLI lokal verwaltet; keine Token oder Anmeldedaten in Projektdateien kopieren.
- Zur Vorprüfung `npm run test:c3:emulator` ausführen. Dieser Befehl benutzt ausschließlich die Auth- und Firestore-Emulatoren von `demo-wuerfelbund`. **Kein Internet-Firebase-Ziel.**

## 3. Staging-Ziel ausdrücklich angeben

Im macOS-/Linux-Terminal (Bash/Zsh) in der Projektmappe:

```bash
export WB_C3_PROJECT_ID='wuerfelbund-staging-deinname'
export WB_C3_CONFIRM="STAGING:$WB_C3_PROJECT_ID"
read -r -s -p 'Web-API-Key des Staging-Projekts: ' WB_C3_API_KEY
echo
export WB_C3_API_KEY
```

**Ersetzen:** `wuerfelbund-staging-deinname` muss exakt die ID aus der Firebase Console sein. Der API-Key wird verdeckt eingegeben; seine Eingabe soll nicht in der Shell-History auftauchen. Diese Variablen werden nur für die aktuelle Shell gesetzt. Nicht als `.env`, Screenshot, Issue, ZIP oder Git-Commit weitergeben. Niemals Service-Account-JSON herunterladen.

Windows PowerShell (statt des Bash-Blocks):

```powershell
$env:WB_C3_PROJECT_ID = 'wuerfelbund-staging-deinname'
$env:WB_C3_CONFIRM = "STAGING:$env:WB_C3_PROJECT_ID"
$secret = Read-Host 'Web-API-Key des Staging-Projekts' -AsSecureString
$env:WB_C3_API_KEY = [System.Net.NetworkCredential]::new('', $secret).Password
```

Die Projektprüfung verweigert `wuerfelbund`, `demo-*`, Namen ohne `staging`, fehlende exakte Bestätigung sowie abweichende Cloud-/Emulator-Umgebungsvariablen. Vor jeder echten Aktion deshalb die **Projekt-ID noch einmal sichtbar mit der Firebase Console vergleichen**.

## 4. Nur Firestore-Regeln nach Staging übertragen

```bash
npm run staging:deploy-rules
```

Dieses Skript prüft die Ziel-ID und ruft ausschließlich den Firebase-CLI-Befehl `deploy --only firestore:rules --project <staging-id>` auf. Es führt **keinen** Hosting-, Pages-, Auth-Konfigurations- oder Produktiv-Deploy aus. Die Regeldatei `firestore.rules` stammt aus der C3-ZIP. Nach Erfolg in der Firebase Console unter **Firestore → Rules** kontrollieren, dass die Staging-Regeln eingetragen sind.

Falls die CLI einen fehlenden Berechtigungszugriff meldet, Firebase-Login und Projektmitgliedschaft überprüfen; **nicht** auf Produktion ausweichen.

## 5. Reale C3-Prüfung starten

```bash
npm run test:c3:staging
```

Der Lauf erzeugt drei zufällige, voneinander unabhängige Auth-Konten mit temporären Passwörtern **im Arbeitsspeicher**, eine Testkampagne, Mitgliedschaften, eine Figur, eine private SL-Notiz und einen Sperreintrag. Er verifiziert:

1. Drei echte Registrierungen und spätere Anmeldung.
2. Atomare Kampagnenerstellung und zwei Einladungsbeitritte.
3. Besitzer-/Spielerrollen, manipulationsgeschützte Indizes, unbekannte Kampagnen.
4. Charakterbesitz, verweigerte Fremdzugriffe und private SL-Dokumente.
5. Firestore-Live-Listener und zwei gleichzeitige Transaktionen ohne verlorene Aktualisierung.
6. Charakterpersistenz nach Ab- und Wiederanmeldung.
7. Cache-Lesung während Netztrennung, verweigerten Serverzugriff und Wiederverbindung.
8. Sperrung, Entzug der Mitgliedschaft und verweigerten erneuten Beitritt mit demselben Einladungscode.

**Erwartetes Ergebnis:** `tests 9`, `pass 9`, `fail 0`. Eine gescheiterte Berechtigungsprobe wird intern als erwartetes `permission-denied` protokolliert. Ein Fehler in einem positiven Szenario ist dagegen ein echter Testfehler. Der Lauf wird bewusst **nicht** durch GitHub Actions mit echten Cloud-Credentials gestartet.

## 6. Aufräumen, Kosten und Nachweis

- Der Test versucht seine drei kurzlebigen Auth-Konten zu löschen. **Bei Fehlern** in Authentication → Users kontrollieren und Restkonten manuell löschen.
- Die Firestore-Regeln **verbieten Kampagnenlöschung** als Sicherheitsmaßnahme. Deshalb bleiben Testkampagne, Figur, Mitglieder-/Indexdokumente und private Notiz **bewusst** für die Prüfung zurück. Nach Abnahme ausschließlich **im Staging-Projekt** über die Firebase Console löschen; alternativ das gesamte unabhängige Testprojekt entfernen, wenn es nicht weiter gebraucht wird. Das nicht unkontrolliert mehrfach ausführen.
- Vor weiteren Läufen die kostenlose Spark-Nutzung in der Firebase Console prüfen. Kein Billing-Konto verbinden, keine dauerhaften Testnutzer, keine produktiven Daten.
- Den Terminal-Testbericht mit Datum, exakter Staging-Projekt-ID, Prüfzähler und Exitcode (ohne API-Key/Passwörter) als Nachweis für B15-C3 aufbewahren. Die C3-Dokumentation erst **nach** realem Erfolg auf „Staging bestätigt“ setzen.
- Nach dem Test in der Shell `unset WB_C3_API_KEY WB_C3_PROJECT_ID WB_C3_CONFIRM` (Bash/Zsh) beziehungsweise `Remove-Item Env:WB_C3_*` (PowerShell) ausführen.

## Bewusste Grenzen

- Das Live-Staging-Skript prüft Firebase Auth und Firestore **über das echte Firebase-JavaScript-SDK**, nicht die komplette Benutzeroberfläche unter einer gehosteten Staging-Domain. Die vorhandene UI-Dreikontenprüfung läuft separat im Browser gegen lokale Emulatoren. Eine echte Staging-URL wird nicht erstellt; es gibt keinerlei öffentliche Veröffentlichung.
- Lokal gespeicherte Figuren bleiben nach Netzunterbrechung erhalten. **Offline-Cloud-Schreibwarteschlangen** werden nicht zugesagt: die UI sperrt Cloud-Aktionen offline bewusst. Automatische Tests ersetzen weder einen echten Screenreader noch B16.
- Die Einladung ist derzeit ein geheimer 20-stelliger Kampagnen-Code, keine serverseitige E-Mail-Einladungsverwaltung. Links nur mit den vorgesehenen Mitspielern teilen.
- Firestore-Tests beweisen die hier bereitgestellte Regelversion. Nach jeder manuellen Regeländerung auf Staging müssen sie erneut laufen.
