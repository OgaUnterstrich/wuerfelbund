# B07 · Klassenmerkmale und Unterklassen – Umsetzung und Prüfbericht

Stand: 27.10.2026 · v0.35, **lokale Entwicklungsfassung**, weder GitHub Pages noch Firebase wurden veröffentlicht. Danach folgen **neun Batches B08–B16**. Der Nutzer testet erst nach dem großen internen B15-Abschlusstest.

## Gebaut

1. `class-decisions.mjs` liest echte Klassen- und Unterklassenfreischaltungen aus `5e-SRD-Levels.json`. Keine zweite selbstgepflegte Stufenliste. Im Charakterlabor erscheinen stufengerechte Ordens-, Stil-, Taktik-, Affinitäts-, Resistenz- und Sprachwahlen. Bei Druiden ab Stufe 2 werden die gepinnten SRD-Monster nur bei Bedarf geladen und die bekannten Tierformen auf HG/Flug/Anzahl kontrolliert. Die weitere Schurkensprache stammt aus beiden regulären Sprachentabellen, mit Ausschluss bereits bekannter oder geheimer Klassensprachen.
2. Für alle erreichten Klassen ab **eigener** Stufe 3 lässt sich eine zugehörige Unterklasse speichern, einschließlich sekundärer Druiden-Zirkelgeländewahl. Stale/fremde und fehlende Entscheidungen werden vor Speichern abgewiesen; Bearbeiten/Export/Cloud-Übernahme nutzen bestehende Profile. Frühere reine Klassenfiguren benötigen kein neues Schemafeld.
3. Orden gewähren ihre nachgewiesenen Waffen-/Rüstungsübungen; daraus folgen RK-/Waffenübung. Ihre zusätzlichen Zaubertricks sind auch im bestehenden Casting verfügbar, ohne einen neuen Ressourcenpfad. Schurkenspezialmerkmal Slippery Mind gewährt ab Schurkenstufe 15 die beiden zusätzlichen Rettungswurfübungen.
4. Die sechs im SRD bestätigten Unterklassenmerkmale Intimidating Presence, Natural Recovery (zwei unabhängige Nutzungen), Wholeness of Body, Holy Nimbus, Dragon Companion und Dark One’s Own Luck sind im **vorhandenen** Ressourcen-/Rastsystem enthalten. Freischaltung und Häufigkeit kommen aus Quellenmerkmal bzw. WIS-/CHA-Modifikator. Sonderwiederherstellung gegen Raserei oder Zauberplatz wird nicht ungeprüft automatisch ausgelöst.
5. Bekannte Tierformen, Resistenzen, Kampfreaktionen, Beschwörungen und situationsabhängige Zielwirkungen bleiben sichtbar zur manuellen Spielleitungsprüfung. Es gibt **keinen** falschen Automatismus für Effekte, die der Browser mangels Spielweltzustand nicht entscheiden kann.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Gesamte Node-Suite nach Änderung gemeinsamer Module | **253/253 bestanden** |
| Alle 12 SRD-Klassen und alle 12 SRD-Unterklassen jeweils Klassenstufe 1–20 | **Bestanden**; Entscheidungsgruppen gültig und erfüllbar |
| Frühere Stufe, fehlende Wahl, fremde Unterklasse, ungültiger Wert und Zusatzzaubertrick-Doppelung | **Bestanden** |
| Tierformen Stufe 2/4/8; 4/6/8 Einträge, HG, Fliegen, doppelte/fremde Kreatur | **Bestanden** |
| Schurkensprachen normal/selten, bekannte und geheime Sprachen ausgeschlossen | **Bestanden** |
| Waffen-/Rüstungsübungen, Level-15-Rettungswürfe, gewirkte Bonuszaubertricks | **Bestanden** |
| Sechs Unterklassenressourcen: Freischaltstufe, Fähigkeitsmodifikator, Klassenzugehörigkeit und lange Rast | **Bestanden** |
| Sekundärunterklasse samt Ressourcen; bestehender lokaler Import/Cloud-Serializer | **Bestanden** |
| Statische DOM-Ziele, Formular- und Speicherdaten-Verdrahtung | **Bestanden** |
| Firestore-Emulator | **Nicht erneut gelaufen**, Regeln/Transaktionsberechtigungen unverändert |
| Echter Desktop-/Mobil-Browser, Tastaturbedienung, Formulardurchlauf | **Offen** – kein lokaler Browser/Preview-Daemon in der aktuellen Umgebung |

Die Node-Suite ist **kein** Ersatz für einen echten UI-Roundtrip. Vor B15 muss die offene Browserabnahme nachgeholt werden; kein automatisierter manueller Nutzertest zwischen Batches.

## Anti-Bloat und Design

- **Eine** Regelwahl-Funktion für zwölf Klassen, keine zwölf Spezialformulare, keine weiteren Paketabhängigkeiten, keine zusätzlichen Backend-Collections. Tierdaten lazy statt im allgemeinen Laden.
- Bestehende native `select`, `label` und einklappbare Gruppen, Fehleranker und Profilfunktionen; kein neues CSS-Design, keine dekorativen Fantasy-Karten, Emojis, künstlichen Statistiken oder Dummy-Buttons.
- [Anti-KI-Look-Guide](DESIGN_ANTI_AI_LOOK.md), Signale 1–7: Die geänderten Formulare enthalten konkrete SRD-Namen, echte Anzahlen und funktionierende Entscheidungen, keine generische Werbesprache. **Signal 8 offen**, weil tatsächliche Zoom-/320-px-/Tastatur-/Screenreader-Nutzung ohne Browser nicht beurteilt werden kann.

## Ehrliche Restgrenzen

- B07 bildet die **neu ergänzten expliziten Pflichtentscheidungen** stufengerecht ab; nicht alle rund 230 textuellen SRD-Merkmale sind vollautomatisch verrechnet. Teilweise bleiben spezielle Ersatzauswahlen und Wechselwirkungen bewusst manuell. Die v1-Regelabdeckung wird daher **nicht als vollständig zertifiziert** bezeichnet.
- Primärklassen-Zauberauswahl ist die bestehende Basis. Eigene Listen, vorbereitete Zauber und einige Unterklassen-/Klassen-Effekte von sekundären Klassen sind noch nicht durchgängig spielautomatisiert. B09/B10 schließen die konkreten Verbindungen. Ein echtes Multiclass-Komplettfeature ist noch offen.
- Druidische Formwerte wie Bewegungen/TP/Angriffe werden nicht blind in die menschlichen Werte umgerechnet; Wild Shape ist aktuell eine geprüfte **Auswahl und Ressource**, keine Kampfsimulation.
- Lizenzierter Umfang: [SRD 5.2.1 von Wizards of the Coast](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf), CC-BY-4.0. PHB-/Erweiterungsinhalte außerhalb des SRD sind nicht kopiert.

**Abgabe:** B07-Logik und automatisierbare Tests grün, Browserabnahme offen, **neun Batches B08–B16** verbleiben. Kein Live-Deployment und kein Nutzertest jetzt.
