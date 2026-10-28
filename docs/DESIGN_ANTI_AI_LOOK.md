# Würfelbund – Designguide gegen generisch wirkende KI-Ästhetik

Stand: 26.10.2026. Gilt für Hauptseite, Regelstudio, Charakterbogen, Kampagnenverwaltung und alle künftigen Module.

## Was tatsächlich als Konsens gelten kann

Es gibt **keinen anerkannten, zuverlässigen Design-Test**, der zweifelsfrei belegt, eine Website „sehe nach KI aus“. Gradient, abgerundete Karte, dunkles Theme oder generierte Grafik sind **für sich** kein solches Indiz. Gestalterische Qualität beurteilt man anhand nachvollziehbarer UX-Grundsätze, bewusster Produktidentität und Tests mit echten Nutzern.

Gut belegt ist dagegen, dass unspezifische KI-Prototypen zu austauschbaren Mainstream-Mustern neigen, während **Hierarchie, Typografie, Balance, Kontrast, Konsistenz und kontextbezogene Inhalte** zu erkennbarer und brauchbarer Gestaltung beitragen. Eine visuell schöne Seite kann Bedienmängel verschleiern: Ästhetik ersetzt keine erfolgreichen Aufgaben.

Quellen: [NN/g – AI Prototyping in Real Design Contexts](https://www.nngroup.com/articles/ai-prototyping/), [NN/g – Why Does a Design Look Good?](https://www.nngroup.com/articles/why-does-design-look-good/), [NN/g – 5 Principles of Visual Design](https://www.nngroup.com/articles/principles-visual-design/), [NN/g – Aesthetic-Usability Effect](https://www.nngroup.com/articles/aesthetic-usability-effect/), [Material Design – meaningful motion](https://m1.material.io/material-design/introduction.html), [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## Acht Warnsignale und konkrete Gegenmaßnahmen

| Warnsignal – **Verdacht**, keine KI-Erkennung | Bevorzugte Gegenmaßnahme | Prüffrage |
| --- | --- | --- |
| 1. Austauschbarer Werbetext („Erlebe grenzenlose Möglichkeiten“) statt konkretem Zweck | Handlungsnah schreiben: „Erstelle deinen SRD-5.2.1-Charakter auf Stufe 1–20.“ | Weiß ein neuer Spieler nach drei Sekunden, was hier möglich ist? |
| 2. Überall gleiche Karten mit Icon, Verlauf und allgemeinem Text | Karten nur für tatsächlich unterschiedliche auswählbare Objekte; sonst Liste, Formular oder kompakte Zeile | Hat jede Karte eine eigene Information oder Handlung? |
| 3. Glows, Glasflächen, violette/mehrfarbige Gradienten und animierte Partikel als Selbstzweck | Vorhandene Würfelbund-Palette, klare Ebenen und sparsame Akzente nutzen | Unterstützt der Effekt Fokus, Zustand oder Wiedererkennung? |
| 4. Zufällige Symbole, Emojis, „✨“-Dekoration und uneinheitliche Icons | Konsistente vorhandene SVG-Symbole mit funktionaler Bedeutung; dekorative Motive reduzieren | Hat das Icon dieselbe Bedeutung in jedem Bereich? |
| 5. Gleichförmige Typografie und optisch laute Hierarchie | Wenige definierte Schriftgrößen/-gewichte; nur eine dominante Aktion pro Ansicht; klare Abstände und Raster | Kann man Hauptaktion, Status und Nebentext sofort unterscheiden? |
| 6. Generische Fantasy-KI-Bilder mit unstimmigen Details oder wechselnden Stilen | Keine Pflichtbilder. Nur geprüfte, lizenzierte und stilistisch passende Illustrationen/Symbole; auffällige Artefakte vor Nutzung entfernen | Liefert das Bild Kontext, den Text/Code nicht klarer vermittelt? |
| 7. Erfundene Statistiken, Blindtexte, scheinbare Fortschrittswerte oder funktionslose Schaltflächen | Ausschließlich reale Daten; unfertige Funktion sichtbar als „geplant“ oder gar nicht zeigen; ehrliche leere Zustände | Ist jede sichtbare Zahl und Aktion aus dem System belegbar? |
| 8. Schöne Mockup-Oberfläche, aber verwirrende Formulare, Fehlermeldungen oder Mobilansicht | Nutzerziel priorisieren; native Felder/Fehleranker; 320-px-Reflow, Tastatur, Screenreader-Stichprobe | Kann ein echter Spieler die Aufgabe ohne fremde Hilfe beenden? |

**Keine pauschalen Stilverbote:** Ein sauberer Verlauf oder eine Karte ist legitim, wenn sie zum vorhandenen Design passt und einen Zweck erfüllt. „Weniger KI-Look“ heißt für Würfelbund **bewusste, wiedererkennbare und nachvollziehbare Entscheidungen**, nicht zwanghaft altmodische Gestaltung.

## Würfelbund-spezifische Identität

1. **Ruhiges Fantasy-Werkzeug statt generisches SaaS-Dashboard:** Die bereits vorhandene dunkle Grüntönung, warmer Goldakzent und dezente Würfel-/Buchmotive bleiben Orientierung, kein Anlass für neue Materialeffekte auf jeder Oberfläche.
2. **Daten und Handlungen vor Kulisse:** Beim Charakterbogen stehen Stufe, Klasse, TP, Ressourcen, Zauber und nächste Aktion im Zentrum. Für die Spielleitung stehen Rechte, Gruppe und Zustand zuerst. Edras ist **optional** und darf nicht jeden Bereich visuell dominieren.
3. **Echte Regelbegriffe und präzise Texte:** „Trefferwürfel“, „Zauberplätze“ und „Noch 2 Wahlen offen“ statt vager „Power“, „Magic“ oder generischer Motivationstexte. Quelle/Version nennen, wenn sie Entscheidung oder Ergebnis beeinflussen.
4. **Keine künstliche Eigenständigkeit:** Wiederverwendbare Gestaltungstokens und bestehende Buttons vor neuen Einzelkomponenten. Eigenständig durch Ton, Typografie, sinnvolle Details und Spielkontext werden, nicht durch zusätzliche Komplexität.
5. **Manuelle Freigabe von Assets:** Bilder und Icons auf anatomische/logische Fehler, einheitliche Stilführung und Rechte prüfen. Ein Bildgenerator ist kein Ersatz für visuelle Qualitätskontrolle.

## Verbindlicher Review je neuem UI-Batch

1. **Vorher:** Ein Satz zum wichtigsten Nutzerziel, vorhandene Design-Tokens/Komponenten und mindestens ein vorhandenes Muster benennen. Keine neue Karte nur, weil ein Generator das vorschlägt.
2. **Nachher:** Aktuelle Ansichten als Desktop- und schmaler Mobil-Screenshot betrachten; acht Warnsignale einzeln prüfen. Drei-Sekunden-Verständnistest: Ein nicht eingeweihter Mensch kann Zweck und nächsten Schritt benennen.
3. **Funktionsbeweis:** Hauptaktion, Fehlerkorrektur, Ladezustand, leerer Zustand, Zurück/Abbrechen und Tastaturfluss tatsächlich betätigen. Keine dekorative Scheinbedienung.
4. **Zugänglichkeit:** Kontrast, Schriftlesbarkeit, sichtbarer Fokus, Reduktion unnötiger Bewegung und Zoom prüfen. WCAG-Kriterien sind **objektive** Prüfpunkte; „KI-Look“ bleibt eine **redaktionelle** Bewertung.
5. **Befund dokumentieren:** Je Warnsignal `unauffällig / prüfen / korrigieren` mit einem konkreten Screenshot- oder Textbeleg. Keine erfundene prozentuale „KI-Wahrscheinlichkeit“ und kein bloßes KI-Detektor-Tool.

### Stop-Regeln

- **Release blockiert**, wenn eine wesentliche Funktion nur als funktionslose Attrappe existiert, Nutzerdaten/Status erfunden werden, ein schwerer Bedien- oder Kontrastfehler vorliegt oder ein Bild rechtlich/inhaltlich ungeprüft ist.
- **Überarbeitung vor Release**, wenn mehr als zwei Warnsignale ohne erkennbaren Zweck auftreten oder wiederholte Spieler-Tests dieselbe Verwirrung zeigen.
- **Kein Automatismus:** Ein einzelner Verlauf, eine abgerundete Karte oder eine ästhetische Präferenz blockiert die Veröffentlichung nicht.

## Rhythmus

- **Jeder UI-Batch:** kurzer Warnsignal- und Funktionscheck der **geänderten Oberflächen**.
- **B01/B11/B13 und Gate C:** vollständiger visueller Rundgang durch Startseite, Studio, Charakterbogen und Kampagnenansicht mit repräsentativen Nutzungsaufgaben.
- **Reine Regel-/Testbatches ohne UI-Änderung:** kein unnötiges erneutes Designaudit; frühere erfolgreiche Designchecks bleiben gültig.
