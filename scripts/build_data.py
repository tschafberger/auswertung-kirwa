#!/usr/bin/env python3
"""Liest data/kirwa_daten.csv ein und erzeugt assets/data.js fuer die Weboberflaeche.

Aufruf:  python3 scripts/build_data.py
Erneut ausfuehren, nachdem die CSV mit neuen Kirwa-Zahlen aktualisiert wurde.
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "kirwa_daten.csv"
OUT_PATH = ROOT / "assets" / "data.js"

# Kategorien, die im Dashboard dargestellt werden (Reihenfolge = Darstellungsreihenfolge).
CATEGORIES = [
    "umsatz_tag",
    "umsatz_bereich",
    "kosten_lieferant",
    "musik_band",
    "ergebnis",
]


def main() -> None:
    rows = []
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(
                {
                    "jahr": int(r["jahr"]),
                    "kategorie": r["kategorie"],
                    "posten": r["posten"],
                    "betrag": float(r["betrag_eur"]),
                }
            )

    years = sorted({r["jahr"] for r in rows})

    data = {"years": years}
    for kat in CATEGORIES:
        bucket: dict[str, dict[str, float]] = {}
        for r in rows:
            if r["kategorie"] != kat:
                continue
            bucket.setdefault(r["posten"], {})[str(r["jahr"])] = r["betrag"]
        data[kat] = bucket

    OUT_PATH.write_text(
        "// Automatisch generiert aus data/kirwa_daten.csv durch scripts/build_data.py\n"
        "// Nicht manuell bearbeiten - stattdessen CSV aendern und Skript erneut ausfuehren.\n"
        f"window.KIRWA_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};\n",
        encoding="utf-8",
    )
    print(f"geschrieben: {OUT_PATH.relative_to(ROOT)} ({len(rows)} Datensaetze, Jahre {years[0]}-{years[-1]})")


if __name__ == "__main__":
    main()
