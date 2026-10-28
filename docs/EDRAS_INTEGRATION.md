# Edras als optionales Würfelbund-Weltmodul

Stand: Regelstudio 0.40 · Edras-Regelmodul v0.1 · öffentlicher Implementierungsplan ohne Handlungsspoiler

## Grundsatz

**SRD 5.2.1 (D&D 5.5e) bleibt die einzige D&D-Regelbasis.** Edras ergänzt es mit einem **pro Charakter aktivierten**, versionierten Weltprofil (`edras-5.5-v0.1`). Andere Kampagnen benötigen das Modul nicht. Lebensenergie ersetzt weder Trefferpunkte noch Zauberplätze, Fokuspunkte oder Paktmagie. Ein eigenes allgemeines Kampfsystem wird nicht gebaut.

Die Arbeitsfassung `Die_Narben_der_Goetter_Edras_Digital_Regelwerk_v0_1.md` ist eine **Regelspezifikation**, kein zur Veröffentlichung freigegebener Roman oder Geheimniskatalog. Ein endgültiger Kanonabgleich braucht außerdem die Original-Kanondatei.

## Konkreter Funktionsumfang

| Edras-Funktion | Bereits umgesetzt | Noch umzusetzen |
| --- | --- | --- |
| Lebensenergie | Eigener Pool, 1-LE-Technik, einmalige kurze Rast, lange Rast. Der neue 2024-TP-/Trefferwürfelzustand liegt getrennt davon. | Serverseitig transaktionssicher statt lokal |
| Belastung | 0–5, Überzug +2, Potenzial-5-Folge, Genesung, Sperre bei 5. Technik-W20-Proben übernehmen Nachteil ab 2 und weisen Technik-SG −2 ab 4 aus. | Technik-SG erst bei belegtem Basis-SG auf Zielrettungen anwenden; situative Effekte bleiben SL-Aufgabe |
| Potenzial | 1–5 in manuellem *Spieltest-Entwurf*, +1 LE ab 4 | Verbindlich durch Abgleich, später nur mit bestätigtem Ereignis ändern |
| Acht Anfangstechniken | Alle acht Beschreibungen und maximal ein Einsatz pro Runde | Ziel, Schaden, Rettungswurf, Aktion/Reaktion über den vorhandenen deklarativen Effekt-Interpreter |
| Edras-Resonanz und Affinitäten | 16 frei sichtbare Situationsfragen mit vier **eigens für den Demonstrator gewählten** Tendenzachsen; Vorschlagswerte auf Wunsch manuell übernehmen. | Original-Kanonachsen und echte Affinitätsregeln erst mit freigegebener Regelmatrix |
| Charakter-Abgleich | **Öffentlicher, ausdrücklich nicht kanonischer v0.40-Test:** 16 Situationen + Erfahrungsfrage, versionierte deterministische Antworten und öffentlicher Seed, überprüfbarer Protokoll-Roundtrip im Edras-Profil. | Kanonischer Abgleich nur nach Originalmatrix mit nicht im Browser enthaltener Geheim-Saat und einem autorisierten Backend. Keine Klasse/Unterklasse aus Antworten ableiten |
| Höhere Startstufen | Standard-Charakterlabor erlaubt 1–20; voreingestellt 8 | Gruppenstartstufe als Kampagnenoption; Erfahrungsantworten als Empfehlung, **kein festes Maximum 3** |
| Öffentliche / wahre Resonanz | Nur öffentliche, **nicht kanonische** Tendenzen. `dmPrivate` schützt SL-Dokumente serverseitig; Spielerzugriff im Emulator verboten. | Wahre Resonanzen sind derzeit **nicht erzeugbar**; künftig nur serverseitig und niemals in öffentlich lesbaren Charakterdokumenten/JSON |
| Beschränkte Magie | Explizite Wiederbelebungs-, Wunsch- und Fernreisezauber **für Edras gesperrt**; auch Magical Discoveries, Magical Secrets, Mystic Arcanum, Spell Mastery und Signature Spells werden gefiltert. Gesperrte feste Unterklassenzauber werden als erforderliche Ersatzentscheidung angezeigt | Freizauber aus Talenten und sonstige Sonderwirkungen ebenfalls prüfen; D&D-Basisliste intakt |
| Belege, Schutz, Zustimmung und Orte | **Noch nicht implementiert** | Kleine, SL-geprüfte Zustandstypen statt vorgeschriebener Story-Entscheidungen |
| Kreaturenherkunft und Untersuchungen | **Noch nicht implementiert** | Geheime SL-Daten und begrenzte Befundausgabe statt allwissender Detektion |
| Chronik, Gruppendynamik, Verzweigungen | Vorhandene freie Notizen | Sichtbare und verborgene Chroniken, verzweigte Konsequenzen; Spielerentscheidungen bleiben völlig frei |

## Priorisierte Umsetzung ohne Bloat

1. **5.5e zuerst vollständig machen:** Zaubervorbereitung, regelwirksame Talente, Klassenentscheidungen, Startausrüstung, Trefferwürfel, Bedingungen, Trefferpunkte, Ruhepausen und Stufen 1–20. Nur verifizierte SRD-Daten als Basis, keine zweite Klassentabelle für Edras.
2. **Acht Techniken an bestehende Regeln anbinden:** Ziel- und Wirkungsdaten, `1W4`/`+2`, Technik-SG und Belastungsmodifikatoren; Spielleitungsentscheidungen bleiben frei. Acht Datenobjekte, keine acht Sonderprogramme.
3. **Den Edras-Abgleich verbindlich machen:** Öffentliche 17 Fragen; deterministischer, geprüfter Generator **nur für Edras-spezifische Werte** (Potenzial, Resonanz/Affinitäten und verwandte Weltmerkmale). Niemals Klasse, Unterklasse, Hintergrund oder D&D-Talente aus dem Fragebogen zuteilen. Geheime Auswertungsmatrix, SL-Saat und Ist-Resonanz ausschließlich in einem autorisierten Backend-Prozess. Hohe Startstufen und freie D&D-Klassenwahl bleiben möglich. Die jetzigen Dropdown-Entwürfe bleiben als *Simulation* gekennzeichnet.
4. **Online-Autorität ergänzen:** Authentifizierte Charakterbesitzer, echte SL-Rollen, atomare LE-Ausgaben, Ereignisprotokolle und strikt getrennte Firestore-Pfade. **Keine Geheimwerte in GitHub Pages, frei herunterladbaren JSONs oder für Spieler lesbaren Firestore-Dokumenten.** Der heutige Zähler ist nur lokal.
5. **Erst danach Kampagnenmechaniken:** Weltabhängige Zaubersperren, Handlungskonsequenzen, Beleg-/Schutz-/Zustimmungszustände und Chronik. Nur Werte hinzufügen, die konkrete Spielszenen benötigen. Keine Dialogbäume.

## Harte Produktgrenzen

- **Eine SRD-Quelle** (`dnd55.mjs`, gepinnte Regeldaten) und **eine lokale Charakterquelle** (`characters.mjs`). Edras (`edras.mjs`) kapselt nur zusätzliche Aktionen.
- Die Zauberliste später nur über referenzierte SRD-IDs filtern, nicht kopieren. Keine neue Bibliothek, Laufzeit, Datenbank oder Build-Pipeline für das Weltmodul.
- Jede automatische Regel beginnt als reine getestete Funktion und wird erst danach im UI verfügbar. Nicht abgedeckte Effekte sichtbar als **manuell** markieren.
- Öffentliche Spielregeln und Geheimnisse werden **physisch getrennt**, nicht über bloß versteckte HTML-Elemente oder clientseitige Flags.

## Bewusste Grenzen des Edras-Moduls

- Techniken verbrauchen LE, führen aber **noch nicht** ihre Zielwirkung aus. Die ausdrücklich gewählte Technik-W20-Probe nutzt bekannte Nachteile/Zustände/Erschöpfung plus Belastungsnachteil ab 2; ab 4 zeigt sie den **−2-Technik-SG-Hinweis**, ohne eine unbelegte Grund-SG-Formel oder Zielrettung zu erfinden. Überzug SG 12 und Erschöpfung nach Fehlschlag bleiben SL-Entscheidungen.
- „Neue Runde“, manuelle Belastungsänderungen und lange Rasten sind lokale Hilfen ohne Multiplayer-Autorität oder Echtzeit-/Rastfenster-Prüfung.
- Die 17 öffentlichen Fragen sind ein **eigener unverbindlicher Demonstrator, kein rekonstruiertes Geheimwissen**. Antwort/Seed/Ergebnis können lokal oder mit ausdrücklichem Upload im Spielerprofil erscheinen; nur nicht-geheime Testwerte dürfen dort hinein. **Keine** wahre Resonanz oder geheime Seed-Erzeugung existiert in der Clientfassung. Der verbindliche Abgleich bleibt für v1 deaktiviert, bis Kanonquelle, Backend und Rechteprüfung vorliegen. Zaubersperren erfassen belegte Quellen, nicht alle Sonderwirkungen.
- Außerhalb des frei veröffentlichten SRD darf proprietärer D&D-Inhalt nicht ungeprüft importiert werden: <https://www.dndbeyond.com/srd>.
