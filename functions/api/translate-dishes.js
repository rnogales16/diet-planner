// Batch-translates a list of dishes to a target language using Gemini.
// Each dish keeps its id so the client can re-attach the translation
// to the right place in the store.
//
// Translation is mechanical — Flash is plenty, and its free tier
// (15 RPM / 1500 RPD per project) gives 60x the room of 2.5 Pro.
// Keep this on Flash so we don't burn Pro quota on translations.

import { callGeminiWithFallback } from './_gemini.js'

const MODEL_CASCADE = ['gemini-2.5-flash']

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

  const upstream = await callGeminiWithFallback({
    env,
    models: MODEL_CASCADE,
    payload: {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        responseMimeType: 'application/json',
        maxOutputTokens: 32768,
      },
    },
  })

  if (!upstream.ok) {
    if (upstream.status === 429) {
      return json({ success: false, error: 'All Gemini quotas exhausted. Try again in a minute.' }, 429)
    }
    if (upstream.status === 503 || upstream.status === 500 || upstream.status === 502 || upstream.status === 504) {
      return json({ success: false, error: 'Google AI is temporarily overloaded. Please try again in a moment.' }, 503)
    }
    return json({ success: false, error: `Upstream error: ${upstream.error}` }, 502)
  }

  const parsed = extractJson(upstream.content)
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
