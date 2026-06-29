#!/usr/bin/env python3
"""
Scrapes Mercadona's API for all food products in two phases:
  Phase 1: Download all product data + nutrition label images (fast, no AI)
  Phase 2: Extract macros from images via Groq + Gemini in parallel

Usage:
  export GROQ_API_KEY="your-key"
  export GEMINI_API_KEY="key1,key2"  (optional, comma-separated)
  python3 scripts/scrape-mercadona.py

Output: scripts/mercadona_products.json
"""

import json
import os
import sys
import time
import base64
import subprocess
import concurrent.futures
import threading
import urllib.request
import urllib.error

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GEMINI_API_KEYS = [k.strip() for k in os.environ.get("GEMINI_API_KEY", "").split(",") if k.strip()]

GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_MODEL = "gemini-2.5-flash-lite"
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

MERCADONA_API = "https://tienda.mercadona.es/api"
FOOD_CATEGORY_IDS = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(SCRIPT_DIR, "mercadona_images")
CATALOG_FILE = os.path.join(SCRIPT_DIR, "mercadona_catalog.json")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "mercadona_products.json")

# Rate limiting per provider
_groq_lock = threading.Lock()
_groq_last = 0.0
_gemini_locks = {i: threading.Lock() for i in range(10)}
_gemini_last = [0.0] * 10
_gemini_idx = 0
_gemini_idx_lock = threading.Lock()

GROQ_MIN_INTERVAL = 3.0   # 30 RPM → 2s + safe margin
GEMINI_MIN_INTERVAL = 4.2  # gemini-2.5-flash-lite: 15 RPM per key + small margin


def curl_get_json(url):
    try:
        r = subprocess.run(["curl", "-s", url, "-H", "Accept: application/json"],
                           capture_output=True, text=True, timeout=20)
        return json.loads(r.stdout) if r.stdout.strip() else None
    except Exception as e:
        print(f"  [ERR] {url}: {e}")
        return None


def curl_post_json(url, payload, headers):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    for k, v in headers.items():
        req.add_header(k, v)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except:
            return None
    except Exception as e:
        print(f"  [ERR] POST: {type(e).__name__}: {e}")
        return None


def download_image(url, path):
    try:
        subprocess.run(["curl", "-s", "-o", path, url], timeout=15, check=True)
        return os.path.exists(path) and os.path.getsize(path) > 1000
    except:
        return False


# ─── Phase 1: Catalog + Images ───────────────────────────────────────────────

def phase1_catalog():
    """Download all product data and label images from Mercadona."""
    print("═══ Phase 1: Download catalog + images ═══\n")
    os.makedirs(IMAGES_DIR, exist_ok=True)

    # Load existing catalog
    catalog = []
    existing_ids = set()
    if os.path.exists(CATALOG_FILE):
        with open(CATALOG_FILE) as f:
            catalog = json.load(f)
        existing_ids = {p["id"] for p in catalog}
        print(f"Existing catalog: {len(catalog)} products\n")

    # Get subcategories
    data = curl_get_json(f"{MERCADONA_API}/categories/")
    subcats = []
    for cat in data["results"]:
        if cat["id"] in FOOD_CATEGORY_IDS:
            for sub in cat.get("categories", []):
                subcats.append({"id": sub["id"], "name": sub["name"], "parent": cat["name"]})
    print(f"Subcategories: {len(subcats)}\n")

    new_count = 0
    for i, sc in enumerate(subcats):
        print(f"[{i+1}/{len(subcats)}] {sc['parent']} > {sc['name']}", end="", flush=True)
        time.sleep(0.2)
        sub_data = curl_get_json(f"{MERCADONA_API}/categories/{sc['id']}/")
        if not sub_data:
            print(" — failed")
            continue

        prods = []
        for cat in sub_data.get("categories", []):
            prods.extend(cat.get("products", []))
        prods.extend(sub_data.get("products", []))

        added = 0
        for prod in prods:
            pid = str(prod["id"])
            if pid in existing_ids:
                continue

            time.sleep(0.15)
            detail = curl_get_json(f"{MERCADONA_API}/products/{pid}/")
            if not detail:
                continue

            pi = detail.get("price_instructions", {})
            label_url = None
            for photo in detail.get("photos", []):
                if photo.get("perspective") == 9:
                    label_url = photo["regular"]
                    break

            img_file = None
            if label_url:
                img_file = f"{pid}.jpg"
                img_path = os.path.join(IMAGES_DIR, img_file)
                if not os.path.exists(img_path):
                    download_image(label_url, img_path)
                    if not os.path.exists(img_path):
                        img_file = None

            catalog.append({
                "id": pid,
                "name": detail.get("display_name", ""),
                "brand": detail.get("brand", ""),
                "category": sc["parent"],
                "subcategory": sc["name"],
                "price": float(pi.get("unit_price") or 0),
                "size": float(pi.get("unit_size") or 0),
                "size_format": pi.get("size_format", ""),
                "price_per_kg": float(pi.get("reference_price") or 0),
                "price_format": pi.get("reference_format", ""),
                "image_file": img_file,
                "nutrition": None,
            })
            existing_ids.add(pid)
            added += 1
            new_count += 1

        print(f" — {added} new" if added else "")

        # Save every few subcategories
        if new_count > 0 and (i + 1) % 5 == 0:
            with open(CATALOG_FILE, "w") as f:
                json.dump(catalog, f, ensure_ascii=False)

    with open(CATALOG_FILE, "w") as f:
        json.dump(catalog, f, ensure_ascii=False)

    with_img = sum(1 for p in catalog if p.get("image_file"))
    print(f"\nPhase 1 done: {len(catalog)} products, {with_img} with label images\n")
    return catalog


# ─── Phase 2: Extract nutrition via AI ────────────────────────────────────────

def _call_groq(img_b64):
    global _groq_last
    with _groq_lock:
        elapsed = time.time() - _groq_last
        if elapsed < GROQ_MIN_INTERVAL:
            time.sleep(GROQ_MIN_INTERVAL - elapsed)
        _groq_last = time.time()

    payload = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
            {"type": "text", "text": "Read the nutrition table on this food label. Return ONLY a JSON object with per 100g values: {\"kcal\": number, \"fat\": number, \"saturated_fat\": number, \"carbs\": number, \"sugars\": number, \"fiber\": number, \"protein\": number, \"salt\": number}. If not readable, use null. Output ONLY raw JSON."}
        ]}],
        "temperature": 0.1, "max_tokens": 200,
        "response_format": {"type": "json_object"}
    }
    result = curl_post_json(GROQ_ENDPOINT, payload, {
        "Authorization": f"Bearer {GROQ_API_KEY}"
    })
    if not result or "error" in result:
        return None
    try:
        text = result["choices"][0]["message"]["content"]
        if "{" in text:
            text = text[text.index("{"):text.rindex("}") + 1]
        return json.loads(text)
    except:
        return None


def _call_gemini(img_b64, key_idx):
    key = GEMINI_API_KEYS[key_idx]
    lock = _gemini_locks[key_idx]
    with lock:
        elapsed = time.time() - _gemini_last[key_idx]
        if elapsed < GEMINI_MIN_INTERVAL:
            time.sleep(GEMINI_MIN_INTERVAL - elapsed)
        _gemini_last[key_idx] = time.time()

    payload = {
        "contents": [{"parts": [
            {"inlineData": {"mimeType": "image/jpeg", "data": img_b64}},
            {"text": "Read the nutrition table on this food label. Return ONLY a JSON object with per 100g values: {\"kcal\": number, \"fat\": number, \"saturated_fat\": number, \"carbs\": number, \"sugars\": number, \"fiber\": number, \"protein\": number, \"salt\": number}. If not readable, use null. Output ONLY JSON."}
        ]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 256, "responseMimeType": "application/json"}
    }
    result = curl_post_json(f"{GEMINI_ENDPOINT}?key={key}", payload, {})
    if not result or "error" in result:
        return None
    try:
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        if "{" in text:
            text = text[text.index("{"):text.rindex("}") + 1]
        return json.loads(text)
    except:
        return None


def extract_nutrition(img_b64):
    """Pick whichever provider is available soonest. Try the other on failure."""
    now = time.time()
    candidates = []
    if GROQ_API_KEY:
        wait = max(0.0, _groq_last + GROQ_MIN_INTERVAL - now)
        candidates.append((wait, "groq", None))
    for i in range(len(GEMINI_API_KEYS)):
        wait = max(0.0, _gemini_last[i] + GEMINI_MIN_INTERVAL - now)
        candidates.append((wait, "gemini", i))

    if not candidates:
        return None, None

    candidates.sort(key=lambda x: x[0])

    for _, provider, idx in candidates:
        if provider == "groq":
            result = _call_groq(img_b64)
        else:
            result = _call_gemini(img_b64, idx)
        if result:
            return result, provider if provider == "groq" else f"gemini{idx}"

    return None, None


def process_one(product):
    """Process a single product: read image, extract nutrition."""
    if product.get("nutrition"):
        return product  # already done

    img_file = product.get("image_file")
    if not img_file:
        return product

    img_path = os.path.join(IMAGES_DIR, img_file)
    if not os.path.exists(img_path):
        return product

    with open(img_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    nutrition, provider = extract_nutrition(img_b64)
    if nutrition:
        kcal = nutrition.get("kcal")
        if kcal and kcal > 900:
            # Probably read kJ instead of kcal
            nutrition["kcal"] = round(kcal / 4.184)
        product["nutrition"] = nutrition
        print(f"  ✓ [{provider}] {product['name']}: {nutrition.get('kcal', '?')} kcal")
    else:
        print(f"  ✗ {product['name']}: extraction failed")

    return product


def phase2_nutrition(catalog):
    """Extract nutrition from all downloaded images using AI."""
    print("═══ Phase 2: Extract nutrition from images ═══\n")

    pending = [p for p in catalog if not p.get("nutrition") and p.get("image_file")]
    done = sum(1 for p in catalog if p.get("nutrition"))
    print(f"Already done: {done} | Pending: {len(pending)} | No image: {len(catalog) - done - len(pending)}\n")

    if not pending:
        print("Nothing to process!")
        return catalog

    # Count available providers
    providers = []
    if GROQ_API_KEY:
        providers.append("Groq")
    for i in range(len(GEMINI_API_KEYS)):
        providers.append(f"Gemini key {i+1}")
    print(f"Providers: {', '.join(providers) or 'NONE'}")

    if not providers:
        print("ERROR: No API keys available")
        return catalog

    # One worker per available provider — each provider has its own rate-limit lock
    max_workers = (1 if GROQ_API_KEY else 0) + len(GEMINI_API_KEYS)
    print(f"Workers: {max_workers} (1 per provider, each rate-limited independently)\n")

    processed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(process_one, p): p for p in pending}
        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()
            except Exception as e:
                print(f"  [ERR] {e}")
            processed += 1
            if processed % 25 == 0:
                with open(CATALOG_FILE, "w") as f:
                    json.dump(catalog, f, ensure_ascii=False)
                total_done = sum(1 for p in catalog if p.get("nutrition"))
                print(f"  [Saved: {total_done}/{len(catalog)} with nutrition]")

    return catalog


def main():
    if not GROQ_API_KEY and not GEMINI_API_KEYS:
        print("ERROR: Set at least one of GROQ_API_KEY or GEMINI_API_KEY")
        sys.exit(1)

    # Phase 1: always run to pick up newly-added products / categories.
    # phase1_catalog skips IDs that already exist in the catalog and skips
    # downloads for images that already exist on disk, so re-running is cheap.
    catalog = phase1_catalog()

    # Phase 2: AI extraction (parallelized)
    catalog = phase2_nutrition(catalog)

    # Final output
    with open(CATALOG_FILE, "w") as f:
        json.dump(catalog, f, ensure_ascii=False)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    total = len(catalog)
    with_n = sum(1 for p in catalog if p.get("nutrition"))
    print(f"\n═══ Done ═══")
    print(f"Total: {total} | With nutrition: {with_n} | Without: {total - with_n}")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
