# B05 · Kampagnenquellen und Umschalter – Umsetzung und Prüfbericht

Stand: 26.10.2026 · Lokale Entwicklungsfassung, **nicht veröffentlicht**. Nach B05 verbleiben **11 geplante Batches B06–B16**. Die älteren offenen Browserprüfungen B01/B03/B04 und die neue B05-Browserprüfung kommen zusätzlich hinzu.

## Umsetzung

1. Die SRD-5.2.1-Basis ist immer aktiv. Kampagnen speichern nur `rules: { base, worlds, packs }`; alte Kampagnen ohne das Feld bleiben gültig und werden bewusst als SRD-only gelesen. Weder 2014-Regeldaten noch unbekannte Welten werden als auswählbare Basis akzeptiert.
2. Die Spielleitung kann Edras v1 pro Kampagne aktivieren/deaktivieren. Edras verändert niemals automatisch die D&D-Klasse oder den Charakterlevel.
3. Die Spielleitung kann ein **bereits bestehendes lokales Hausregelpaket** nach sichtbarer Rechtebestätigung als eigene versionierte Kopie `campaigns/{cid}/rulePacks/{id}` für die Gruppe veröffentlichen. Die Freigabe beschränkt sich auf höchstens 50 Fähigkeiten/60 KB je Paket und höchstens sechs aktive Pakete. Mitglieder können die aktivierten Pakete und ihre Regeln einsehen, aber nicht eigenmächtig veröffentlichen/umschalten. Private Regelpakete bleiben privat, solange sie nicht ausdrücklich freigegeben werden.
4. `js/rules/sources.mjs` prüft alle aktivierten Quellen zentral: fehlende/illegale Pakete, doppelte Fähigkeits-IDs, Edras an/aus sowie gepinnte Paketversionen. Die Hauptseite verwendet denselben Resolver **vor dem Cloud-Upload und vor jeder Live-Ressourcenänderung**. Die Firestore-Transaktion liest die aktuelle Kampagnenkonfiguration samt aktiven Paketen, damit ein zwischendurch deaktiviertes Modul nicht durch einen veralteten UI-Stand umgangen wird.
5. Beim Upload erhält das **bestehende** Charakterprofil ein schmales `sourceRefs`-Feld, das notwendige Welt-/Paketversionen fixiert. Eine Deaktivierung oder ein Paketupdate löscht keine alten Figurenwerte. Der Grund wird in der Kampagnenliste gezeigt, neue unzulässige Quellenbezüge werden serverseitig abgelehnt. Weitergehende Homebrew-Ausführungs-/Charakterzuordnung ist nicht Bestandteil dieses Quellverwaltungs-Batches.

## Tatsächlich ausgeführte Prüfungen

| Nachweis | Ergebnis |
| --- | --- |
| Lokale vollständige Node-/SRD-/Profil-/UI-/Importtests einschließlich fünf neuer Quellresolver-Fälle | **233/233 bestanden** |
| Offizieller Firestore-Emulator: B02–B04-Matrix plus drei neue B05-Quell- und Rollenfälle | **22/22 bestanden** |
| Standard SRD-only; Spieler dürfen Edras nicht aktivieren; SL darf es | **Bestanden** |
| Zweite Kampagne bleibt bei Änderung der ersten unverändert | **Bestanden** |
| Bestehender Edras-Zustand bleibt nach Abschaltung erhalten, neue Änderungen daran werden verweigert | **Bestanden** |
| Nur SL publiziert; nur höhere Paketversion, feste Publisher-ID, begrenzte Lizenzmarkierung | **Bestanden** |
| Fremder Spieler kann Pakete nicht veröffentlichen, fremder Account nicht lesen; private Pakete unverändert | **Bestanden** |
| Neue, nicht aktivierte Quellenreferenz abgewiesen; vorhandene unveränderte Referenz weiter lesbar/bearbeitbar | **Bestanden** |
| Fehlende Quelle, Versionsabweichung, doppelte Fähigkeit, falsche Regelbasis | **Bestanden** |
| Homepage-Inline-Modul und neue Bedienelemente/Imports auf Syntax und Verdrahtung geprüft | **Bestanden** |
| Echter Desktop-/Mobil-Browserablauf mit zwei Konten und Tastatur | **Offen** |

`PERMISSION_DENIED`-Meldungen sind bei absichtlich verbotenen Emulatorversuchen erwartet und zählen in diesen Negativfällen als erfolgreiche Sperren.

## Anti-Bloat und UX

- **Kein** zusätzliches Laufzeitpaket, Frontend-Framework, eigener Build-Schritt oder neues Regelsystem. Der eine kleine Quellenresolver ergänzt den bestehenden SRD- und Hausregel-Validator; die einzelne zusätzliche Firestore-Untersammlung speichert explizit geteilte Inhalte, statt private Pakete öffentlich zu machen.
- Die Kampagnenseite nutzt vorhandene Listen, Buttons, Farben und **native** Auswahl-/Checkbox-/Details-Elemente. Reale Quellen, Versionen, Rechteerklärungen und Konflikte ersetzen beliebige Werbe- oder Fantasiedaten. Keine neuen Icons, Glows, Bilder oder Dekorationskarten.
- Gemäß [Anti-KI-Look-Guide](DESIGN_ANTI_AI_LOOK.md) erscheinen Warnsignale 1–7 in den neuen Texten und Strukturen **statisch unauffällig**. Signal 8 (Tastaturfluss, 320 px, tatsächliche Screenshots) bleibt bis Browser-QA **offen**. Es wurde keine KI-Stil-Erkennungsquote behauptet.

## Bekannte Grenzen

- **Kein realer Browsernachweis:** `sites-preview start` scheitert weiterhin an fehlendem `sites-previewd`-Mailboxpfad. Firestore-Emulator und Node-Tests ersetzen kein UI-End-to-End. Diese Lücke ist spätestens vor B15 intern zu schließen. Der Nutzer testet zwischen Batches nichts.
- Ein lokaler Charakterentwurf darf Edras unabhängig von Online-Kampagnen verwenden; erst der Cloud-Upload in eine konkret ausgewählte Kampagne muss deren Regelquellen erfüllen. Es gibt daher keinen fälschlich globalen Welt-Schalter im Charakterlabor.
- B05 aktiviert und zeigt publizierte Hausregel**inhalte**, weist diese aber noch nicht automatisch einer Figur zu und erfindet keine ungetesteten 5.5e-Wechselwirkungen. Das bestehende Studio verwaltet weiterhin die persönlichen Definitionen.
- Firestore-Regeln kontrollieren Eigentümer, Form und erlaubte Quellenreferenzen. Sie können den materiellen Urheberstatus nicht beweisen und prüfen nicht jede einzelne Fähigkeit semantisch; ein berechtigter Kampagnenbesitzer kann per eigenem Client Rohdaten verändern. Die Website validiert vor Nutzung mit `validatePack`, und veröffentlicht nur nach ausdrücklicher Rechtebestätigung.
- Paketupdates schreiben den aktuellen Publikationsstand fort. Bestehende Figuren mit älterer Version behalten ihre ursprüngliche Referenz, werden aber **explizit als nicht kompatibel markiert**, bis ihre Quelle bewusst geklärt wurde. Kein stilles Umschreiben und keine erfundene alte Regelkopie.
- Die B02–B05-Firestore-Regeln sind **noch nicht** auf Firebase veröffentlicht. Eine reale Staging- und Rechteprüfung ist vor einem öffentlichen Release Pflicht.

**Ergebnis:** B05-Code und automatisierbare Prüfungen bestanden. Browsernachweis offen; keine Nutzertestpflicht, keine Veröffentlichung. **Noch 11 geplante Batches (B06–B16)** und die genannten offenen internen Browserprüfungen.
