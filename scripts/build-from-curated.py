#!/usr/bin/env python3
"""
Build the LLM menu and recalculator data module from the human-curated
catalog at scripts/curated-catalog.txt.

This bypasses the auto-curation in build-catalog-menu.py: the curated text
is treated as the source of truth (someone already filtered out junk and
verified the macros). Each line is parsed back into a structured product
record. Product IDs are taken from mercadona_catalog.json when a name
matches, otherwise a synthetic ID is generated so recalc keeps working.
"""

import json
import os
import re
import unicodedata
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
FUNCTIONS_DIR = os.path.join(ROOT_DIR, "functions", "api")

INPUT_TXT = os.path.join(SCRIPT_DIR, "curated-catalog.txt")
RAW_CATALOG = os.path.join(SCRIPT_DIR, "mercadona_catalog.json")

OUT_TXT = os.path.join(PUBLIC_DIR, "mercadona-menu.txt")
OUT_JSON = os.path.join(PUBLIC_DIR, "mercadona-menu.json")
OUT_MENU_JS = os.path.join(FUNCTIONS_DIR, "_mercadona-menu.js")
OUT_DATA_JS = os.path.join(FUNCTIONS_DIR, "_mercadona-data.js")


def normalise(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip()


def parse_curated(text):
    """Yield (category, name, price_unit_str, price_per_str, kcal, P, C, F)."""
    current_cat = None
    line_re = re.compile(
        r"^\s*-\s*(.+?)\s*\|\s*([\d.,]+)€\s*\|\s*([\d.,]+)€/(\S+)\s*\|\s*"
        r"([\d.,]+)/([\d.,]+)/([\d.,]+)/([\d.,]+)\s*$"
    )
    for raw in text.splitlines():
        line = raw.rstrip()
        if line.startswith("## "):
            current_cat = line[3:].strip()
            continue
        m = line_re.match(line)
        if not m:
            continue
        name, ppu, ppk, ppk_unit, kcal, p, c, f = m.groups()
        yield {
            "category": current_cat or "?",
            "name": name.strip(),
            "price": float(ppu.replace(",", ".")),
            "price_per_kg": float(ppk.replace(",", ".")),
            "price_format": ppk_unit,
            "kcal": float(kcal.replace(",", ".")),
            "protein": float(p.replace(",", ".")),
            "carbs": float(c.replace(",", ".")),
            "fat": float(f.replace(",", ".")),
        }


def main():
    with open(INPUT_TXT, encoding="utf-8") as f:
        text = f.read()

    with open(RAW_CATALOG, encoding="utf-8") as f:
        catalog = json.load(f)

    # Index raw catalog by normalised name for ID lookup
    name_to_id = {}
    for p in catalog:
        key = normalise(p.get("name", ""))
        if key and key not in name_to_id:
            name_to_id[key] = p["id"]

    # Parse curated entries
    entries = list(parse_curated(text))
    print(f"Productos parseados del curated catalog: {len(entries)}")

    # Attach IDs
    matched = 0
    next_synthetic = 1
    for e in entries:
        nk = normalise(e["name"])
        if nk in name_to_id:
            e["id"] = name_to_id[nk]
            matched += 1
        else:
            e["id"] = f"C{next_synthetic:04d}"
            next_synthetic += 1
    print(f"  - Matched a IDs reales del catálogo: {matched}")
    print(f"  - Sintéticos (sin match en catálogo): {len(entries) - matched}")

    # Group by category for menu generation
    by_cat = defaultdict(list)
    for e in entries:
        by_cat[e["category"]].append(e)

    # Build menu text — same format as input but normalised
    lines = ["# CATÁLOGO MERCADONA",
             "# Formato por línea: Nombre | €/unidad | €/kg-L | kcal/P/C/F per 100g",
             ""]

    def fmt_n(v, decimals=1):
        if v is None:
            return "?"
        if abs(v - round(v)) < 0.05:
            return str(int(round(v)))
        return f"{v:.{decimals}f}".rstrip("0").rstrip(".")

    for cat in by_cat:  # preserve original order
        lines.append(f"## {cat}")
        for e in by_cat[cat]:
            ppu = f"{e['price']:.2f}€"
            ppk = f"{e['price_per_kg']:.2f}€/{e['price_format']}"
            macros = f"{fmt_n(e['kcal'],0)}/{fmt_n(e['protein'])}/{fmt_n(e['carbs'])}/{fmt_n(e['fat'])}"
            lines.append(f"- {e['name']} | {ppu} | {ppk} | {macros}")
        lines.append("")

    menu_text = "\n".join(lines)

    # Write outputs
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    with open(OUT_TXT, "w", encoding="utf-8") as f:
        f.write(menu_text)

    # Structured JSON
    menu_struct = []
    for cat, items in by_cat.items():
        menu_struct.append({
            "category": cat,
            "products": [
                {
                    "id": e["id"],
                    "name": e["name"],
                    "price": e["price"],
                    "price_per_kg": e["price_per_kg"],
                    "price_format": e["price_format"],
                    "nutrition": {
                        "kcal": e["kcal"], "protein": e["protein"],
                        "carbs": e["carbs"], "fat": e["fat"],
                    },
                }
                for e in items
            ],
        })
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(menu_struct, f, ensure_ascii=False, separators=(",", ":"))

    # JS module: menu text for prompt injection
    js_escaped = menu_text.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$")
    with open(OUT_MENU_JS, "w", encoding="utf-8") as f:
        f.write(
            "// Auto-generated by scripts/build-from-curated.py — do not edit manually.\n"
            "// Regenerate with: python3 scripts/build-from-curated.py\n"
            f"export const MERCADONA_MENU = `{js_escaped}`\n"
        )

    # JS data module: slim records for the recalculator. Macros come from
    # the curated text (verified) — we don't trust the raw catalog values.
    data = [
        {
            "id": e["id"], "name": e["name"],
            "priceFormat": e["price_format"],
            "kcal": e["kcal"], "protein": e["protein"],
            "carbs": e["carbs"], "fat": e["fat"],
        }
        for e in entries
    ]
    with open(OUT_DATA_JS, "w", encoding="utf-8") as f:
        f.write(
            "// Auto-generated by scripts/build-from-curated.py — do not edit manually.\n"
            "// Slim catalog used by _recalculate.js. Macros are verified.\n"
            f"export const MERCADONA_DATA = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))}\n"
        )

    txt_size = os.path.getsize(OUT_TXT)
    json_size = os.path.getsize(OUT_JSON)
    menu_js_size = os.path.getsize(OUT_MENU_JS)
    data_js_size = os.path.getsize(OUT_DATA_JS)
    print()
    print(f"Generated:")
    print(f"  TXT: {OUT_TXT} ({txt_size/1024:.1f}KB, ~{txt_size/4:.0f} tokens)")
    print(f"  JSON: {OUT_JSON} ({json_size/1024:.1f}KB)")
    print(f"  JS (menu prompt): {OUT_MENU_JS} ({menu_js_size/1024:.1f}KB)")
    print(f"  JS (recalc data): {OUT_DATA_JS} ({data_js_size/1024:.1f}KB, {len(data)} products)")


if __name__ == "__main__":
    main()
