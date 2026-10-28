# B06 · Mehrklassen mit echter Stufenchronik – Umsetzung und Prüfbericht

Stand: 26.10.2026 · **lokale Entwicklungsfassung, nicht live veröffentlicht**. Nach B06 bleiben **10 geplante Batches B07–B16** plus die offenen internen Browsernachweise bis zum großen Abschlusstest B15. Kein manueller Nutzertest zwischen den Batches.

## Umgesetzt

1. Ein opt-in-Feld `profile.levelHistory` speichert die tatsächlich belegte Klasse jeder Gesamtstufe. Alte Single-Class-Profile ohne Feld bleiben unverändert. Klassenwechsel im bearbeiteten Profil werden bestätigt; Ressourcen, die ihre Bedeutung ändern, werden bewusst zurückgesetzt statt still übernommen.
2. Der reine Adapter `js/rules/multiclass.mjs` liest die **offiziellen SRD-5.2.1-Voraussetzungen** aus den zwölf vorhandenen Klassen-JSONs und validiert den Klassenbeitritt auf der damaligen Gesamtstufe. ASI-/Gabenwahlen folgen den tatsächlich erreichten **Klassenstufen**, nicht der gesamten Charakterstufe. `classId` und Gesamtstufe bleiben im bestehenden Profilformat.
3. TP wachsen ab Gesamtstufe 1 mit maximalem Starttrefferwürfel und danach mit dem Trefferwürfel der *jeweiligen* Klasse, als fester Wert oder einzeln protokollierter Wurf. Änderungen am KON-Modifikator werden über alle Stufen rückgerechnet. Die vorhandenen TP-/Rastfunktionen verbuchen Trefferwürfel nun getrennt nach W6/W8/W10/W12; die Hauptseite bietet für Cloud-Figuren denselben Würfeltyp an.
4. Multiclass-Zauberplätze benutzen die vorhandene SRD-Stufentabelle, nicht eine neue handgeschriebene Kopie. Voll- und Halbzauberer werden zusammengezählt, Paktmagie bleibt als **eigenständige kurzrastende Ressource** nutzbar. Die Klassen-Zauberauswahl respektiert die tatsächlich erreichte Primärklassenstufe und der Zauber-SG den Gesamtstufen-Übungsbonus. Höhergradige Slots schalten keine unverdienten Buchrituale oder Klassenfähigkeiten frei.
5. Zweitklassen erhalten nur die in ihren SRD-Multiclass-Daten vorgesehenen Übungen; zusätzliche Fertigkeits-/Werkzeugwahlen sind Pflichtentscheidungen. Es werden keine neuen Rettungswurf- oder Startübungen der Zweitklasse vergeben. Ressourcen tragen Klassenpräfixe, um gleichnamige Zustände nicht zu vermischen.
6. Charakterlabor, lokale Spielzustandsaktionen, Cloud-Transaktionen und Import/Export teilen **dieselben** Profilfelder und Kernfunktionen. Kein neuer Speicherort, keine neue Bibliothek, keine neue Framework-Schicht.

## Ausgeführte Tests

| Prüfung | Ergebnis |
| --- | --- |
| Vollständige Node-Regelsuite nach Änderung gemeinsamer Kernmodule | **245/245 bestanden** |
| B06-Neutests: alle 12 Klassen als Start-/Zweitklasse, Attributsvoraussetzungen positiv/negativ | **Bestanden** |
| Gesamtstufen 1/3/5/8/11/17/20, alle 12 Single-Class-ASI-Verläufe und gemischte Chronik | **Bestanden** |
| Start-TP/maximaler Wurf, gemischte feste/gewürfelte Klassenwürfel, KON-Rückrechnung, Würfelpoolgrenzen | **Bestanden** |
| Voll-/Halbwirker-Paare, Pakt+Vollwirker, Gesamtstufen-Übungsbonus, verbrauchte Paktplätze | **Bestanden** |
| Klassenübungen vs. Startrettungswürfe, namespacete Ressourcen, lokale und Cloud-Aktionen | **Bestanden** |
| Spielstand-JSON, Backup-Import, Cloud-Übernahme und Erhalt neuer Felder | **Bestanden** |
| Vorhandene Casting-/Herkunfts-/Bearbeitungs-Regressionstests an geänderte Logik angepasst | **Bestanden** |
| Firestore-Emulator | **Nicht erneut ausgeführt** – Sicherheitsregeln und Transaktionsberechtigungen unverändert; frühere B05-Prüfung 22/22 bleibt bestehen |
| Echter Desktop-/Mobil-Browserlauf | **Offen** – `sites-preview start` scheitert an fehlender `sites-previewd`-Mailbox |

Die Datenprüfung ersetzt **nicht** die Bedienprüfung im realen Browser. Der Browser-Gatepunkt aus B01/B03/B04/B05 bleibt offen und umfasst nun auch die B06-Stufenchronik.

## Grenzen und nächste geplante Umsetzung

- Die Benutzeroberfläche stellt zunächst die **Primärklasse** vollständig nach bereits vorhandenen Auswahlregeln dar. Zusätzliche eigene Zauberlisten, Unterklassen, vollständige Merkmalsentscheidungen und Spezialwirkungen der Zweitklassen sind **noch nicht automatisiert** und werden sichtbar als manuelle SL-Prüfung gekennzeichnet. B07/B09 schließen diese Bereiche schrittweise. Eine vollständig automatische Mehrklassen-Charaktererstellung wird ausdrücklich **nicht** behauptet.
- Unterklassen mit abweichendem Zauberfortschritt und situationsabhängige Kombo-Wirkungen sind noch nicht vollständig in der kombinierten Berechnung abgedeckt; nicht automatisch angewendete Effekte müssen an der Spielrunde bewertet werden. Keine 2014-Regel wird still beigemischt.
- Beim Wechsel der Klassenchronik ist der Ressourcen-Reset bewusst; vergangene einzelne Trefferwürfel-Verbräuche lassen sich beim Wechsel der Würfelverteilung nicht immer eindeutig einem Typ zuordnen. Die ursprünglichen Profilwerte bleiben vor der Bestätigung erhalten.
- **UX-/Anti-Bloat-Check:** Eine einklappbare Gruppe mit nativen beschrifteten Auswahlen pro Stufe; vorhandene Buttons, Farben, Regelkataloge und Formularfehler. Keine zusätzlichen dekorativen Karten, Icons, Pseudostatistiken, UI-Abhängigkeiten oder Frameworks. Die Warnsignale 1–7 aus `DESIGN_ANTI_AI_LOOK.md` sind in den geänderten UI-Texten und Strukturen statisch unauffällig. Warnsignal 8 (Tastatur, reale Ansicht bei 320 px, Zoom, echte Screenshots) bleibt mangels Preview **offen**.
- **Lizenz:** Weiter ausschließlich gepinnte freie 2024-SRD-Inhalte und vorhandene Quelldokumentation; keine PHB-/Erweiterungstexte neu importiert.

Grundlage: [Wizards of the Coast, offizielles SRD 5.2.1 (Mehrklassen, Trefferpunkte und Zauberplätze)](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf). Folgebatches, Testgates und offener Release-Status: [ROADMAP_V1.md](ROADMAP_V1.md).

**Ergebnis:** B06-Regellogik und automatisierbare Prüfungen bestanden; echte Browserabnahme offen. Kein Live-Deployment, kein Nutzer-Testaufruf. **Noch 10 Batches B07–B16.**
