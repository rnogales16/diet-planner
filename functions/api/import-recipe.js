// Fetches a recipe URL, extracts the HTML, and asks Claude to parse it
// into our dish format.

import { callClaude } from './_anthropic.js'
import { callGeminiWithFallback } from './_gemini.js'

const LANGUAGE_NAMES = { en: 'English', es: 'Spanish (español)' }
const SUPPORTED_LANGS = new Set(['en', 'es'])

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function onRequestPost({ request, env }) {
  let body
  try { body = await request.json() } catch {
    return json({ success: false, error: 'Invalid JSON.' }, 400)
  }

  const url = (body.url || '').trim()
  if (!url || !url.startsWith('http')) {
    return json({ success: false, error: 'Invalid URL.' }, 400)
  }

  const language = SUPPORTED_LANGS.has(body.language) ? body.language : 'en'
  const langName = LANGUAGE_NAMES[language]

  // Fetch the page
  let html
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 DietPlanner/1.0', Accept: 'text/html' },
    })
    if (!res.ok) return json({ success: false, error: `Could not fetch URL (${res.status}).` }, 400)
    html = await res.text()
  } catch (err) {
    return json({ success: false, error: `Fetch failed: ${err.message}` }, 502)
  }

  // Trim to a reasonable size for the AI
  const trimmed = html.slice(0, 30000)

  const systemPrompt = `Extract the recipe from the HTML and return it as a single JSON object in ${langName}.

JSON shape:
{
  "name": "string",
  "time": "HH:MM",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "vegetables": number,
  "cookedWeight": "string",
  "prepTime": number,
  "cookTime": number,
  "servings": number,
  "ingredients": [{"name":"string","amount":"string"}],
  "instructions": ["string"],
  "notes": ""
}

Rules:
- Extract the recipe name, ingredients with amounts, and step-by-step instructions from the HTML.
- Estimate calories, protein, carbs, fat and vegetables if not stated on the page.
- Ingredient amounts should be RAW weights.
- If servings are stated, use them. Otherwise default to 1.
- All text in ${langName}.
- Output ONLY the JSON, no markdown.`

  let result = await callClaude({
    env,
    model: 'claude-sonnet-4-6',
    systemPrompt,
    messages: [{ role: 'user', content: `Extract the recipe from this page:\n\n${trimmed}` }],
    temperature: 0.3,
    maxTokens: 4000,
  })

  if (!result.ok) {
    result = await callGeminiWithFallback({
      env,
      models: ['gemini-2.5-flash-lite'],
      freeOnly: true,
      timeoutMs: 20000,
      payload: {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `Extract the recipe:\n\n${trimmed}` }] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json', maxOutputTokens: 4000 },
      },
    })
  }

  if (!result.ok) return json({ success: false, error: result.error || 'AI failed.' }, 502)

  let dish
  try {
    dish = JSON.parse(result.content)
  } catch {
    const match = result.content.match(/\{[\s\S]*\}/)
    if (match) try { dish = JSON.parse(match[0]) } catch { /* */ }
  }

  if (!dish || !dish.name) return json({ success: false, error: 'Could not parse recipe.' }, 502)

  return json({ success: true, dish })
}

export function onRequest({ request }) {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405)
  return json({ success: false, error: 'Unhandled.' }, 500)
}
