// Batch-translates a list of dishes to a target language using Gemini.
// Each dish keeps its id so the client can re-attach the translation
// to the right place in the store.

// Translation is a simple, well-defined task — Flash is more than enough,
// and its free tier (15 RPM / 1500 RPD) gives us 60x the room of 2.5 Pro.
// We keep 2.5 Pro for the actual recipe generation in /api/generate-meal-plan
// where the extra reasoning is worth it.
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish (español)',
}
const SUPPORTED_LANGS = new Set(['en', 'es'])

const MAX_DISHES_PER_REQUEST = 50

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function buildSystemPrompt(targetLang) {
  const langName = LANGUAGE_NAMES[targetLang]
  return `You are a culinary translator. You translate recipe text into ${langName} accurately and naturally, as a native ${langName} cookbook would phrase it.

Rules:
- Output ONLY a single valid JSON object — no markdown, no commentary.
- Translate dish names idiomatically (do not transliterate).
- Translate ingredient names and amounts (units like "g", "ml", "cups" stay as-is or use the natural equivalent in ${langName}).
- Translate every step in instructions, keeping the order.
- Translate notes if present.
- Do NOT change the dish ids — return them exactly as received.
- Do NOT translate proper nouns of brands (e.g. "Greek yogurt" can stay or become "yogur griego" — use natural usage).
- Keep the JSON shape exactly:
{
  "dishes": [
    {
      "id": "string (same as input)",
      "name": "translated string",
      "notes": "translated string (may be empty)",
      "ingredients": [{ "name": "translated", "amount": "translated" }],
      "instructions": ["translated step 1", "translated step 2"]
    }
  ]
}`
}

function buildUserPrompt(dishes) {
  // Send only the fields that need translation, plus the id
  const slim = dishes.map((d) => ({
    id: d.id,
    name: d.name || '',
    notes: d.notes || '',
    ingredients: Array.isArray(d.ingredients) ? d.ingredients.map((i) => ({ name: i.name || '', amount: i.amount || '' })) : [],
    instructions: Array.isArray(d.instructions) ? d.instructions.map((s) => String(s)) : [],
  }))
  return `Translate the following ${slim.length} dishes. Respond with ONLY the JSON object described in the system prompt.\n\n${JSON.stringify({ dishes: slim }, null, 2)}`
}

function extractJson(text) {
  try { return JSON.parse(text) } catch { /* */ }
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (m) {
    try { return JSON.parse(m[1].trim()) } catch { /* */ }
  }
  const a = text.indexOf('{')
  const b = text.lastIndexOf('}')
  if (a !== -1 && b > a) {
    try { return JSON.parse(text.slice(a, b + 1)) } catch { /* */ }
  }
  return null
}

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) {
    return json({ success: false, error: 'Server is not configured (missing GEMINI_API_KEY).' }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400)
  }

  const targetLang = SUPPORTED_LANGS.has(body.targetLanguage) ? body.targetLanguage : null
  if (!targetLang) {
    return json({ success: false, error: 'Missing or unsupported targetLanguage.' }, 400)
  }

  const dishes = Array.isArray(body.dishes) ? body.dishes : []
  if (dishes.length === 0) {
    return json({ success: true, translations: [] })
  }
  if (dishes.length > MAX_DISHES_PER_REQUEST) {
    return json({ success: false, error: `Too many dishes in one request (max ${MAX_DISHES_PER_REQUEST}).` }, 400)
  }

  const systemPrompt = buildSystemPrompt(targetLang)
  const userPrompt = buildUserPrompt(dishes)

  let upstream
  try {
    upstream = await fetch(`${GEMINI_ENDPOINT}?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          { role: 'user', parts: [{ text: userPrompt }] },
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          responseMimeType: 'application/json',
          maxOutputTokens: 32768,
        },
      }),
    })
  } catch (err) {
    return json({ success: false, error: `Upstream network error: ${err.message}` }, 502)
  }

  if (!upstream.ok) {
    const errorBody = await upstream.text().catch(() => '')
    if (upstream.status === 401 || upstream.status === 403) {
      return json({ success: false, error: 'Server API key is invalid.' }, 500)
    }
    if (upstream.status === 429) {
      return json({ success: false, error: 'Free tier rate limit reached. Try again in a minute.' }, 429)
    }
    return json({ success: false, error: `Upstream error (${upstream.status}): ${errorBody.slice(0, 300) || upstream.statusText}` }, 502)
  }

  const result = await upstream.json()
  const content = result?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
  if (!content) {
    const reason = result?.candidates?.[0]?.finishReason || 'unknown'
    return json({ success: false, error: `Empty response from model (finish reason: ${reason}).` }, 502)
  }

  const parsed = extractJson(content)
  if (!parsed || !Array.isArray(parsed.dishes)) {
    return json({ success: false, error: 'Failed to parse translation response.' }, 502)
  }

  // Sanitize and pass through
  const translations = parsed.dishes
    .filter((d) => d && typeof d.id === 'string')
    .map((d) => ({
      id: d.id,
      name: typeof d.name === 'string' ? d.name : '',
      notes: typeof d.notes === 'string' ? d.notes : '',
      ingredients: Array.isArray(d.ingredients)
        ? d.ingredients.map((ing) => ({
            name: String(ing?.name || ''),
            amount: String(ing?.amount || ''),
          })).filter((ing) => ing.name)
        : [],
      instructions: Array.isArray(d.instructions)
        ? d.instructions.map((s) => String(s)).filter(Boolean)
        : [],
    }))

  return json({ success: true, translations })
}

export function onRequest({ request }) {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed.' }, 405)
  }
  return json({ success: false, error: 'Unhandled request.' }, 500)
}
