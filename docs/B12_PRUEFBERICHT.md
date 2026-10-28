# B12 · v0.40 – optionaler Edras-Abgleich

Stand: 27.10.2026 · **Öffentlicher Spieltest implementiert; kanonischer geheimer Abgleich gesperrt. Kein Live-Deployment.**

## Geliefert

- Optionaler, im Normal-5.5e-Modus vollständig verborgener Edras-Fragebogen mit 16 Situationen und einer Erfahrungsfrage; alle Antworten beziehen sich auf Edras-Tendenzen, **niemals** auf D&D-Klasse, Unterklasse, Attribute oder Stufe.
- Offen benannte, **nicht-kanonische** vier Tendenzachsen (`Schutz`, `Erkenntnis`, `Wandel`, `Bindung`). Version `edras-public-draft-1`, öffentlicher Seed, deterministischer Gleichstands- und Technikvorschlag; Potenzial berechnet sich reproduzierbar ohne Seed. Die eigentliche Edras-Kanonmatrix ist **nicht bekannt**; diese Berechnung behauptet ausdrücklich nicht, sie zu ersetzen.
- Spieler entscheidet explizit, ob der öffentliche Vorschlag in die manuell wählbaren Werte übernommen wird. Bei späterem Editieren wird das öffentliche Protokoll wieder angezeigt; Antwort-, Seed-, Ergebnis- und Versionsmanipulation werden beim Profilnormalisieren abgewiesen. Die ursprünglichen manuellen Werte bleiben ohne Fragebogen weiterhin nutzbar.
- Getrennter W20-Zweig nur für angeforderte **Technikproben**: Belastung 2–4 führt Nachteil (mit normaler Vor-/Nachteil-Aufhebung) aus; Belastung 4 zeigt zusätzlich Technik-SG −2 für ggf. betroffene Ziel-SG, Belastung 5 sperrt die Probe. TP-Zustände und Erschöpfung aus der vorhandenen 2024-W20-Engine wirken wie zuvor. Basis-SG, zwingendes Technik-Attribut, Ziel-Effekt und Überzug-Folgewurf werden **nicht erfunden**.
- Keine neuen Laufzeitbibliotheken, Firestore-Pfade, Datenquellen, fremden Rechte oder eigenen SRD-Klassentabellen. Das bestehende Charakterprofil, dieselbe LE-Aktion und dieselben lokal/Cloud verwendeten Speicherroutinen bleiben maßgeblich.

## Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| Gesamte Node-Suite nach B12-Änderungen | **303/303 bestanden** |
| 17-Fragen-Schema, deterministische Wiederholung, verschiedene Seeds, echter Gleichstand | Bestanden |
| Schlechte Eingaben, Versionwechsel, gefälschte Ergebnisse und ungültige Kombination Potenzial/Technik | Zurückgewiesen |
| Öffentlicher Profil-Roundtrip bei LE-Einsatz/langer Rast, ohne Fragebogen weiterhin normal | Bestanden |
| Technik-W20: Belastung 0–5, Vorteil/Nachteil, Erschöpfung, Sperre; D&D ohne Weltmodul unverändert | Bestanden |
| Firestore-Emulator: Eigentümer darf SL-private Dokumente lesen/listen, Mitglieder/Fremde/Anonyme nicht | **23/23 Szenarien bestanden**, einschließlich B12-Geheimnisfall |
| Modul-/UI-Syntax, IDs, DOM-Einbindung und manuelle Übernahme | Statisch geprüft; kein Browser-E2E |
| Mobil, 320 px, 200-%-Zoom, Tastatur, tatsächliche Ausfüllung/Cloud-Übergabe | **Offen**, reale Browser-Testumgebung fehlte |

## Privatsphäre und Freigabegrenze

Der öffentliche Fragebogen speichert auf Wunsch **Antworten, öffentlichen Seed und öffentliche Vorschlagswerte im Charakterprofil**. Diese Informationen sind für den Besitzer bzw. berechtigte Kampagnenrollen zugänglich; sie sind **keine geheimen Werte**. Die bestehende `dmPrivate`-Firestore-Sammlung ist für die SL isoliert und im Emulator gegen Spieler-Lesen, -Listen und -Schreiben geprüft. **Es gibt weiterhin keinen autorisierten serverseitigen Geheim-Generator**; das Vorhandensein der Sammlung stellt ihn nicht dar.

Für einen **kanonischen** Edras-Abgleich fehlen Originalfragen/-gewichte, Resonanzmodell, Geheim-Saat-Strategie, Backend-Autorisierung und Fachabnahme. Er wird bis dahin nicht angeboten und darf für v1 nicht stillschweigend als fertig betrachtet werden. Der unverbindliche Vorschlag ist bewusst als Demonstrator beschriftet. Edras selbst kann vollständig deaktiviert werden; Standard-SRD bleibt verwendbar. Vor einer öffentlichen Edras-Releasefreigabe müssen die verbleibenden Fachfragen geschlossen oder die kanonische Funktion ausgeschaltet bleiben.

## Anti-Bloat / Designguide

- **Ziel:** In einer optionalen Weltprobe Edras-Tendenzen ausprobieren und ggf. in denselben Charakter übernehmen. Das vorhandene `details`-/Formularmuster wurde verwendet, keine neue App-Navigation.
- **Acht Warnsignale:** (1) Zweck konkret: unauffällig; (2) keine unzähligen Karten, sondern kompakte Fragezeilen: unauffällig; (3) keine Glows/Verläufe: unauffällig; (4) keine Deko-Icons: unauffällig; (5) Hierarchie und sichtbarer Resultat-Hinweis: statisch unauffällig; (6) keine künstlichen Bilder: unauffällig; (7) keine vermeintlich echte Resonanz, klare Entwurfswarnung: unauffällig; (8) natives Label/Select, Fehlermeldung, Button und Live-Status vorhanden – **echten Tastatur-/Mobil-Funktionsnachweis nachholen**.
- **Keine behauptete KI-Design-Erkennungsquote.** Screenshots und Drei-Sekunden-Aufgabentest für B13/B15 offen.

## Übergabe

**Vier weitere Batches B13–B16**: B13 UI/UX/Lokalisierung samt echtem Browserlauf; B14 Sicherheit/CI/Betrieb; B15 große interne End-to-End-Gesamtprüfung; B16 **ein** Nutzertest und kontrollierte Veröffentlichung **nur nach Freigabe**. Keine Nutzer-Zwischentests.
