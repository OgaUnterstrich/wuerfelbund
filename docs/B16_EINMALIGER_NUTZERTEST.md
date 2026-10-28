# Würfelbund B16 – ein einziger großer Nutzer-Praxistest (nach interner Freigabe)

**Noch nicht starten.** Dieses Protokoll wird dem Projektbetreiber erst nach bestandenen B16-Tests und bereitgestellter isolierter Freigabefassung zur einmaligen Abnahme übergeben. Die öffentliche Website bleibt bis zur anschließenden ausdrücklichen Zustimmung unverändert.

**Dauer-Staging-Nachtrag:** Die isolierte Test-URL ist nach erfolgreichem `npm run staging:site` fest `https://wuerfelbund-staging.web.app/`, ohne automatische Ablaufzeit. Siehe [B16_STAGING_DAUERBETRIEB.md](B16_STAGING_DAUERBETRIEB.md). Das ist ausdrücklich **nicht** die produktive Website.

## Vorbereitung (maximal 10 Minuten)

1. Finalen RC-Stand und dessen Prüfsumme mit dem Entwicklerbericht vergleichen. Kein ZIP unbekannter Herkunft, keine produktiven Geheimnisse in Termux.
2. Auf Android Chrome (oder bevorzugtem Android-Browser) die vereinbarte **isolierte** Test-URL öffnen. Ohne ausdrückliche Live-Freigabe keine produktiven Konto-/Datenänderungen auslösen. Falls nur lokale JSON-Prüfung freigegeben ist, Cloud-Schritte auslassen und als „Staging nicht eingerichtet“ dokumentieren.
3. Drei separate Testkonten für eine Staging-Kampagne verwenden – eine SL und zwei Spieler; niemals private Spielerdaten oder echte Passwörter in den Prüfbericht kopieren.
4. Ein lokales Export-Backup vor mutierenden Aktionen speichern. Bei Staging-Aufräumarbeiten nur die explizit markierten Testdaten erfassen.

## Ablauf als eine zusammenhängende Spielsitzung (ca. 60–90 Minuten)

| Reihenfolge | Praxisaufgabe | Erwartetes Ergebnis / Prüfkriterium |
| --- | --- | --- |
| 1 | Android-Hochformat mit 320–390 CSS-Pixeln starten, Navigation und Texte prüfen | Kein seitlicher Scrollzwang, Hauptaktionen erreichbar, keine Textüberlagerungen |
| 2 | Local-only Figur erstellen: SRD-Klasse, Herkunft, Attribute, Ausrüstung, Zauber falls relevant | Alle Eingaben nachvollziehbar; Fehler helfen direkt am Feld |
| 3 | Figur bearbeiten, Levelaufstieg durchführen, Multiclass bzw. Zauberoption prüfen | Entscheidungen bleiben nach Neustart erhalten; keine falschen Ressourcen |
| 4 | Spielbogen öffnen, W20/Schaden/Rasten/Zauberplätze/Inventar verwenden | Alle Anzeige- und Rechenwerte wirken plausibel; manuelle SL-Regeln kenntlich |
| 5 | JSON exportieren, lokalen Import/Restore mit Absicht durchführen | Original und Wiederherstellung nachvollziehbar, keine stille Überschreibung |
| 6 | Online anlegen/anmelden, E-Mail bestätigen, Passwortreset nur mit Staging-E-Mail | Verständliche Meldungen; keine doppelte Profilanlage |
| 7 | SL legt Kampagne an, zwei Spieler treten per Einladung bei | Nur erwartete Teilnehmer/Quellen sichtbar; fremde Figuren privat |
| 8 | Figuren ausdrücklich hochladen, zwei Spieler ändern Ressourcen nacheinander und gleichzeitig | Synchronisation und Konflikthinweise korrekt, keine verschluckten Änderungen |
| 9 | Kurz Offline-Modus/Flugmodus, lokale Ansicht, dann Wiederverbindung | Kein falsches „Cloud gespeichert“; Werte nach Wiederverbindung nachvollziehbar |
| 10 | Edras an-/ausschalten, Quellenkonflikt zeigen, dann auf reines SRD zurück | Optionales Weltmodul verändert keine grundlegenden Klassen |
| 11 | Spieler erstellt Cloud-JSON-Auskunft; verlässt eine Testkampagne | Nur eigene Figur entfernt; andere Spieler behalten Daten |
| 12 | Bestätigte SL übergibt an einen Spieler; alte SL wird Spieler | Neue SL sieht private SL-Daten, alte SL nicht mehr; Besitzwechsel nur bewusst |
| 13 | Testkonto ohne SL-Besitz löschen; anderen Beteiligten prüfen | Nur eigener Account/erreichbare eigene Cloud-Daten entfernt; andere bleiben |
| 14 | 200-%-Browserzoom, Tastatur/Fokus und soweit möglich TalkBack auf Android prüfen | Bedienreihenfolge, Beschriftungen und Handlungen ohne Maus; tatsächliche Sprachausgabe als echte Beobachtung notieren |

## Ergebniserfassung (einmalig)

Pro Schritt nur **bestanden / Problem / nicht geprüft**, Android-Version, Browser-/Version, Bildschirmbreite, kurze Reproduktionsschritte und optional **bereinigte** Screenshots ohne private Daten. Besonders melden: verlorene Charaktere, fremde Zugriffe, blockierte Kontoauflösung, unverständliche Cloud-/Offlinezustände und schwer erreichbare Touch-Ziele.

Danach an Entwickler zur gebündelten Korrektur zurückgeben. **Keine erneuten Einzelbatch-Zwischentests**. Bei kritischen Daten-/Rechtefehlern sofort Test stoppen und keine Produktion freigeben.

## Schlussentscheidung – nach Korrekturen

- [ ] Großtest ohne kritischen Daten-/Berechtigungs-/UX-Blocker bestanden.
- [ ] Noch offene Bedien- und Accessibility-Grenzen bewusst akzeptiert und dokumentiert.
- [ ] Betreiber bestätigt schriftlich, ob *genau dieser* RC-Stand öffentlich gehen darf.
- [ ] Rechts-/Kontakt-/App-Check-/Quoten-/Rollback-Gates unabhängig freigegeben.

**Ohne diese eindeutige Zustimmung bleibt das Release gesperrt.**
