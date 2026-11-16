# Auswertung Kirwa

Kleines, statisches Dashboard für die Kirwa-Zahlen des Kirwaverein Drei Brücken Ettmannsdorf. Keine Server-Komponente, kein Build-Schritt für den Betrieb – `index.html` kann direkt im Browser geöffnet oder über einen beliebigen Static-File-Server ausgeliefert werden.

## Ansichten

- **Historie** – Umsatz, Kosten und Gewinn je Jahr, Umsatz nach Wochentag und Bereich, sowie Tabellen zu Kosten nach Lieferant/Posten und Musik-Kosten nach Band. Quelle: `data/kirwa_daten.csv`.
- **Nullrechnung** – Break-even-Rechner für die Getränke-Kalkulation: Fixkosten und Getränke (EK/VK/Anzahl) sind über Regler anpassbar, das Ergebnis (gedeckt/nicht gedeckt) aktualisiert sich live. Ausgangswerte stammen aus `data/KVE_Getraenke_Fest_Kalkulation_Regler.xlsx`.

## Projektstruktur

```
index.html              Einstiegspunkt, bindet Tabs und Scripts ein
assets/
  data.js                generiert aus data/kirwa_daten.csv (nicht manuell bearbeiten)
  charts.js              einfache SVG-Chart-Bausteine (Linie, Balken, gestapelt, Break-even)
  historie.js             Rendering der Historie-Ansicht
  nullrechnung.js          Break-even-Rechner inkl. Regler-Logik
  main.js                  Tab-Umschaltung, initiales Rendering
  style.css                 Styling
data/
  kirwa_daten.csv                               Rohdaten je Jahr/Kategorie/Posten
  KVE_Getraenke_Fest_Kalkulation_Regler.xlsx    Kalkulationsgrundlage für die Nullrechnung
scripts/
  build_data.py           erzeugt assets/data.js aus data/kirwa_daten.csv
```

## Daten aktualisieren

1. `data/kirwa_daten.csv` mit neuen Zahlen ergänzen (Spalten: `jahr,kategorie,posten,betrag_eur`).
2. Danach:

   ```bash
   python3 scripts/build_data.py
   ```

3. `assets/data.js` wird neu geschrieben – die Datei nicht händisch bearbeiten, da sie beim nächsten Lauf überschrieben wird.

Für die Nullrechnung müssen Fixkosten- und Getränke-Defaults bei Bedarf direkt in `assets/nullrechnung.js` (`FIXKOSTEN_DEFAULT`, `DRINKS_DEFAULT`) angepasst werden, passend zur Excel-Kalkulation.

## Lokal ansehen

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000` im Browser öffnen.
