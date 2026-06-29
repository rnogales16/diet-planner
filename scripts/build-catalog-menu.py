#!/usr/bin/env python3
"""
Build a compact "menu" of representative Mercadona products for LLM injection.

Reads mercadona_catalog.json, picks a balanced subset per subcategory, and
writes:
  - public/mercadona-menu.json      (full structured data, used by post-processor)
  - public/mercadona-menu.txt       (human/LLM-readable, used in the prompt)

Selection heuristic per subcategory:
  1. Drop products without usable macros (kcal/protein/carbs/fat all present)
  2. Group by normalised first 2 tokens of the name (the "concept")
  3. For each concept group, keep the single product with the most complete
     nutrition + cheapest €/kg + shortest name (in that order)
  4. Cap at MAX_PER_SUBCAT items per subcategory
"""

import json
import os
import re
import unicodedata
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CATALOG = os.path.join(SCRIPT_DIR, "mercadona_catalog.json")
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
FUNCTIONS_DIR = os.path.join(ROOT_DIR, "functions", "api")
OUT_JSON = os.path.join(PUBLIC_DIR, "mercadona-menu.json")
OUT_TXT = os.path.join(PUBLIC_DIR, "mercadona-menu.txt")
OUT_JS = os.path.join(FUNCTIONS_DIR, "_mercadona-menu.js")
OUT_DATA_JS = os.path.join(FUNCTIONS_DIR, "_mercadona-data.js")

MAX_PER_SUBCAT = 40
REQUIRED_FIELDS = ("kcal", "protein", "carbs", "fat")

# Acceptable kcal-vs-macros mismatch: anything beyond this means the OCR
# read at least one field wrong (kJ vs kcal, decimal misread, per-serving
# value, etc). The Atwater factors (4·P + 4·C + 9·F) typically match the
# label kcal within ~5%; allow 12% to be generous.
COHERENCE_TOLERANCE = 0.12

# Products whose macros nearly all hide in non-Atwater calories (alcohol,
# polyols, fiber). Skip the 4/4/9 check for these subcategories.
COHERENCE_EXEMPT_SUBCATS = {
    "Caldo y consomé", "Sopa y caldo", "Té e infusiones",
    "Café molido y en grano", "Café cápsula y monodosis",
    "Café soluble y otras bebidas", "Cacao soluble y chocolate a la taza",
    "Especias",  # spices usually have negligible macros vs kcal
    "Aceite, vinagre y sal",
}

# Subcategories excluded from the LLM menu — products people don't (or
# shouldn't) plan a balanced diet around. The shopping app still has them
# in the catalog for shopping cost lookup; we just don't show them to the
# meal-plan model.
EXCLUDE_SUBCATS = {
    # Refrescos y alcohol
    "Refresco de cola", "Refresco de naranja y de limón",
    "Refresco de té y sin gas", "Tónica y bitter", "Isotónico y energético",
    # Snacks ultraprocesados / dulces
    "Patatas fritas y snacks", "Helados", "Tartas y churros",
    "Pizzas", "Bollería de horno", "Bollería envasada",
    "Tartas y pasteles", "Velas y decoración",
    "Chocolate", "Chicles y caramelos", "Golosinas",
    "Flan y natillas", "Gelatina y otros postres",
    "Yogures y postres infantiles",
    # Misc
    "Hielo", "Café cápsula y monodosis",
}

STOP = {"de","la","el","los","las","y","con","en","al","del","sin","a","para","por",
        "un","una","unos","unas","sabor","tipo","estilo","hacendado"}


def stem(t):
    if len(t) > 5 and t.endswith("es"): return t[:-2]
    if len(t) > 4 and t.endswith("s"): return t[:-1]
    return t


def normalise(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    tokens = [stem(t) for t in re.split(r"[^\w]+", s) if t and t not in STOP]
    return tokens


def concept_key(name):
    """First 2 meaningful tokens of the name — products with the same key are
    treated as variants of the same concept (e.g. 'Pechuga pollo Hacendado'
    and 'Pechuga pollo familiar' both → 'pechuga pollo')."""
    toks = normalise(name)
    return " ".join(toks[:2])


def macro_completeness(p):
    n = p.get("nutrition") or {}
    return sum(1 for k in ("kcal","protein","carbs","fat","saturated_fat","sugars","fiber","salt") if n.get(k) is not None)


def pick_best(group):
    """Pick the most representative product from a group of variants."""
    return min(
        group,
        key=lambda p: (
            -macro_completeness(p),
            p.get("price_per_kg") or 9999,
            len(p["name"]),
        ),
    )


def fmt_n(v, decimals=1):
    if v is None: return "?"
    if isinstance(v, (int, float)):
        s = f"{v:.{decimals}f}"
        return s.rstrip("0").rstrip(".") if "." in s else s
    return str(v)


def main():
    with open(CATALOG) as f:
        products = json.load(f)

    # Filter usable
    candidates = [p for p in products
                  if p.get("nutrition")
                  and all(p["nutrition"].get(k) is not None for k in REQUIRED_FIELDS)]

    # Drop products whose macros don't roughly satisfy 4·P + 4·C + 9·F ≈ kcal
    # (within COHERENCE_TOLERANCE). These are OCR errors that would mislead
    # the LLM into computing wrong dish totals.
    usable = []
    dropped_coherence = 0
    for p in candidates:
        n = p["nutrition"]
        kcal = n["kcal"]
        if p.get("subcategory") in COHERENCE_EXEMPT_SUBCATS:
            usable.append(p)
            continue
        # Skip very-low-kcal items (broths, etc) where macros×4/9 sum to
        # near zero — the relative diff is huge but the data is fine.
        if kcal < 25:
            usable.append(p)
            continue
        try:
            kcal_f = float(kcal)
            computed = 4 * float(n["protein"]) + 4 * float(n["carbs"]) + 9 * float(n["fat"])
        except (TypeError, ValueError):
            dropped_coherence += 1
            continue
        if abs(computed - kcal_f) / kcal_f > COHERENCE_TOLERANCE:
            dropped_coherence += 1
            continue
        usable.append(p)
    print(f"Productos descartados por incoherencia 4P+4C+9F vs kcal: {dropped_coherence}")

    # Group by subcategory, dropping excluded ones
    by_subcat = defaultdict(list)
    for p in usable:
        sub = p.get("subcategory", "?")
        if sub in EXCLUDE_SUBCATS:
            continue
        by_subcat[(p.get("category", "?"), sub)].append(p)

    menu_struct = []
    for (cat, sub), prods in sorted(by_subcat.items()):
        # Sort all products by €/kg, then by name length (basic variants first).
        # No concept-dedup — the user wants to see real variants (familiar vs
        # individual, marinated vs natural, integral vs refined, etc.).
        chosen = sorted(
            prods,
            key=lambda p: (p.get("price_per_kg") or 9999, len(p["name"])),
        )[:MAX_PER_SUBCAT]
        menu_struct.append({
            "category": cat,
            "subcategory": sub,
            "products": [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "brand": p.get("brand", ""),
                    "price": p.get("price"),
                    "size": p.get("size"),
                    "size_format": p.get("size_format", ""),
                    "price_per_kg": p.get("price_per_kg"),
                    "price_format": p.get("price_format", ""),
                    "nutrition": p["nutrition"],
                }
                for p in chosen
            ],
        })

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(menu_struct, f, ensure_ascii=False, separators=(",", ":"))

    # Compact text version for the LLM prompt
    lines = []
    lines.append("# CATÁLOGO MERCADONA")
    lines.append("# Formato por línea: Nombre | €/unidad | €/kg-L | kcal/P/C/F per 100g")
    lines.append("")
    total = 0
    for group in menu_struct:
        lines.append(f"## {group['category']} — {group['subcategory']}")
        for p in group["products"]:
            n = p["nutrition"]
            ppu = f"{p['price']:.2f}€" if p.get("price") else "?"
            ppk = f"{p['price_per_kg']:.2f}€/{p.get('price_format','kg')}" if p.get("price_per_kg") else "?"
            macros = f"{fmt_n(n.get('kcal'),0)}/{fmt_n(n.get('protein'))}/{fmt_n(n.get('carbs'))}/{fmt_n(n.get('fat'))}"
            lines.append(f"- {p['name']} | {ppu} | {ppk} | {macros}")
            total += 1
        lines.append("")

    text = "\n".join(lines)
    with open(OUT_TXT, "w", encoding="utf-8") as f:
        f.write(text)

    # JS module imported by Cloudflare Pages Functions
    js_escaped = text.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$")
    js = (
        "// Auto-generated by scripts/build-catalog-menu.py — do not edit manually.\n"
        "// Regenerate with: python3 scripts/build-catalog-menu.py\n"
        f"export const MERCADONA_MENU = `{js_escaped}`\n"
    )
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write(js)

    # Slim data module for the post-processor: every product with macros,
    # only the fields needed to recalculate dish totals.
    data = []
    for p in usable:
        n = p["nutrition"]
        data.append({
            "id": p["id"],
            "name": p["name"],
            "priceFormat": p.get("price_format", ""),
            "kcal": n.get("kcal"),
            "protein": n.get("protein"),
            "carbs": n.get("carbs"),
            "fat": n.get("fat"),
        })
    data_js = (
        "// Auto-generated by scripts/build-catalog-menu.py — do not edit manually.\n"
        "// Slim catalog used by _recalculate.js to fix LLM macro drift.\n"
        f"export const MERCADONA_DATA = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))}\n"
    )
    with open(OUT_DATA_JS, "w", encoding="utf-8") as f:
        f.write(data_js)

    txt_size = os.path.getsize(OUT_TXT)
    json_size = os.path.getsize(OUT_JSON)
    js_size = os.path.getsize(OUT_JS)
    data_js_size = os.path.getsize(OUT_DATA_JS)
    print(f"Menu generado:")
    print(f"  Productos válidos en catálogo: {len(usable)}/{len(products)}")
    print(f"  Subcategorías: {len(menu_struct)}")
    print(f"  Productos elegidos: {total}")
    print(f"  TXT: {OUT_TXT} ({txt_size/1024:.1f}KB, ~{txt_size/4:.0f} tokens)")
    print(f"  JSON: {OUT_JSON} ({json_size/1024:.1f}KB)")
    print(f"  JS (menu prompt): {OUT_JS} ({js_size/1024:.1f}KB)")
    print(f"  JS (recalc data): {OUT_DATA_JS} ({data_js_size/1024:.1f}KB, {len(data)} products)")


if __name__ == "__main__":
    main()
