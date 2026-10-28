# B16 – Datenschutz-, Aufbewahrungs- und Löschkonzept (Betreiberentwurf)

**Keine Rechtsberatung und keine fertige Datenschutzerklärung.** Vor der Veröffentlichung muss der tatsächliche Verantwortliche die Aussagen samt Rechtsgrundlagen, Fristen, Dienstleisterverträgen, Auftragsverarbeitung, Drittlandbezug und Kontakt fachlich bestätigen. Deshalb bleiben `datenschutz.html` und `impressum.html` ausdrücklich gesperrt (`RELEASE_BLOCKER`). Rechtliche Grundlage: https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en

## Dateninventar

| Datenart | Speicherung / Personenbezug | Einsicht / Handhabung | Vorschlag, noch nicht freigegeben |
| --- | --- | --- | --- |
| Browser-Spielstand, Würfe, Chronik, lokale Hausregeln | Lokales Gerät (`localStorage`) | Nur auf dem Gerät, JSON-Export und getrennte lokale Löschung | Bis der Nutzer sie selbst entfernt; keine Serveraufbewahrung durch Würfelbund |
| E-Mail, UID, Auth-Status, Reset-/Verifikationsereignisse | Firebase Authentication / Provider | Kontoansicht; Auth-Löschung nach sicherer Reauthentifizierung | Bis Kontolöschung; Provider-Logs nach nachzuprüfenden Google-Fristen |
| `/users/{uid}/campaigns` | Persönliche Kampagnen-Navigation | Nur Kontoinhaber | Austritt/Kontolöschung, soweit Daten zugänglich |
| `/users/{uid}/rulePacks` | Eigene private Homebrew-Inhalte | Nur Kontoinhaber | Bis eigenständige Löschung oder Kontolöschung |
| `/campaigns/{cid}` mit Eigentümer-UID | Gruppenkampagne | Aktuelle SL und Mitglieder | Bis bewusste Kampagnenauflösung; aktuell **kein** unsicheres Self-Service-Gesamtlöschen |
| `/campaigns/{cid}/members` und `/blockedUsers` | Mitgliedschaft/Blockierung, UID | Eigene Mitgliedschaft oder SL, Sperrliste nur SL | Solange für Kampagnenschutz nötig; Prüfung bei Austritt und Ende der Kampagne |
| `/campaigns/{cid}/characters` | Vom Spieler ausdrücklich hochgeladene Figur | Eigentümer und SL, ggf. gemeinsame Spielaktionen | Bei Austritt/Kontolöschung des Eigentümers, soweit noch zugänglich; bei entzogenen Rechten Betreiberweg |
| `/campaigns/{cid}/dmPrivate` | SL-Notizen/optionale geheimere Edras-Werte | Nur aktuelle SL | Vor Besitzübergabe prüfen und ggf. entfernen; gemeinsame Notizen nicht unbesehen überführen |
| `/campaigns/{cid}/rulePacks` | Kopien explizit publizierter Regelpakete mit Publisher-UID | SL/teilweise Teilnehmer | Deaktivieren statt Schema-brüchiger Löschung; Rückruf-/Entfernungsweg beim Betreiber |
| Zugriffs-, IP-, Fehler- und Abrechnungsdaten | GitHub/Google-Provider | Nicht im Client exportierbar | Anbieteraufbewahrung/Drittlandtransfer vor Veröffentlichung konkret ermitteln |

Keine Firestore-TTL oder automatische Backup-Funktion hinzuschalten: Diese können einen aktiven Billing-Plan erfordern und wären nicht durch die Spark-only-Anforderung gedeckt. Manuelle regelmäßige Sichtung nach vorab definiertem und genehmigtem Aufbewahrungszweck ist zunächst die schlanke Lösung.

## Auskunftsprozess

1. Nutzer öffnet **Einstellungen → Online-Konto und Cloud-Daten → Cloud-Auskunft als JSON**. Exportiert werden ausschließlich für das aktuelle Konto zugängliche Anwendungsdatensätze: E-Mail, UID, eigene Figuren, Kampagnenmetadaten, private Pakete und bei SL eigene private Notizen/veröffentlichte eigene Pakete. Kein Passwort, keine Daten fremder Spieler.
2. Wenn ein Index auf eine entzogene oder verwaiste Kampagne verweist, bricht die Aktion mit einer verständlichen Betreiberverweisung ab. Ein unvollständiges Archiv wird **nicht** als vollständige Auskunft bezeichnet.
3. Für Anbieterprotokolle, bereits beendete Mitgliedschaften, früher publizierte gemeinsame Inhalte und sonstige Daten muss eine authentifizierte Betreiberanfrage möglich sein. Vor Veröffentlichung Kontaktweg und Identitätsprüfung festlegen. Ohne Freigabe kein Versprechen vollständiger Art.-15-Auskunft allein durch die Downloadfunktion.

## Löschprozess – Nutzer und Betreiber

1. Vor jeder Löschung Export nach Wunsch erstellen. Die bewusste Kontoauflösung erfordert aktuelle E-Mail + Passwort-Reauthentifizierung und die Bestätigungsformel `KONTO LÖSCHEN`.
2. Die App prüft **vor Änderungen**, dass keine eigenen Kampagnen existieren und sämtliche im persönlichen Index erreichbaren Kampagnen lesbar sind. Als alleinige SL muss man zuerst mit einer realen Person den Besitz übergeben oder einen sicheren betreiberunterstützten Auflösungsweg beantragen.
3. Eigene Figuren jedes beigetretenen Kampagnenkontexts werden in begrenzten Batches gelöscht; danach wird die Mitgliedschaft samt Navigationsindex in einer Transaktion entfernt. Private Homebrew-Pakete werden gelöscht. Erst **danach** wird das Firebase-Auth-Konto entfernt. Bei Fehlern bleibt eine Möglichkeit zum erneuten Versuch; ein Teilvorgang wird als solcher gekennzeichnet.
4. **Grenze:** Nach Zugriffsrevokation, nach alten Datenfehlern, bei verwaisten Indizes/Unterkollektionen oder früher publizierten Inhalten ist vollständige Löschung ohne Administratorrechte nicht sicher. Der Betreiber muss anhand des verifizierten UID-Bezugs gezielt nacharbeiten; niemals fremde Figuren oder die gesamte Gruppe als Nebeneffekt löschen.
5. Bei Besitzübergabe erhält die nachfolgende SL Zugriff auf alle weiterhin vorhandenen privaten SL-Notizen und publizierten Quellen. Die abgebende SL soll private Notizen vor Übergabe prüfen. Gemeinsame Daten dürfen nicht pauschal als „gelöscht“ ausgegeben werden.
6. Nur der Betreiber entscheidet nach dem Einzelfall, welche rechtskonforme Datenerhaltung nötig ist, wie lange und mit welcher Information an andere Mitglieder. Ergebnis und Auskunfts-/Löschfrist dokumentieren; niemals unkontrolliert produktive Sammlungen leeren.

## Vor Beta zu entscheiden (Blocker)

- [ ] Name/Anschrift und nach deutschem Recht notwendige Verantwortlichen- und Kontaktangaben für Impressum.
- [ ] Erreichbare Adresse für Datenschutzfragen und Rechteanfragen, auch nach einer Kontolöschung.
- [ ] Rechtsgrundlagen je Verarbeitung (Registrierung, Vertrag/Nutzung, Sicherheit, optionale Kampagnen).
- [ ] Verifizierte Firebase-/GitHub-Verträge, Anbieter-/Hostingregionen, internationale Transfers, Cookies/LocalStorage, Datenschutzfolgen.
- [ ] Konkrete Retentionsfristen statt unverbindlicher „bis auf Widerruf“-Aussagen; geplante Behandlung inaktiver/ehemaliger Konten.
- [ ] Betreiberskript/Protokoll für Widerruf, Zugangsentzug, SL ohne Nachfolger, Löschen früherer Publisher-UIDs, Provider-Auskunft und gesetzliche Ausnahmen.
- [ ] Besonderheiten Minderjähriger, Einwilligungsalter und Community-Moderation, falls für die tatsächliche Zielgruppe relevant.
- [ ] Rechtsprüfung der finalen `datenschutz.html` und `impressum.html`; erst dann `privacyReviewed`, `imprintReviewed`, `retentionPolicyReviewed` nach echter Prüfung setzen.
