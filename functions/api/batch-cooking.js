// Analyzes a week's dishes and suggests batch cooking opportunities.

import { callPrimaryLLM } from './_llm.js'
import { resolveUser } from './_user.js'
import { callGeminiWithFallback } from './_gemini.js'

const PRIMARY_MODEL = 'claude-sonnet-4-6'

const LANGUAGE_NAMES = { en: 'English', es: 'Spanish (español)' }
const SUPPORTED_LANGS = new Set(['en', 'es'])

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function onRequestPost({ request, env }) {
  const auth = await resolveUser(request, env)
  if (!auth) return json({ success: false, error: 'Not authenticated.' }, 401)

  let body
  try { body = await request.json() } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400)
  }

  const dishes = Array.isArray(body.dishes) ? body.dishes : []
  if (dishes.length === 0) return json({ success: true, suggestions: [] })

  const language = SUPPORTED_LANGS.has(body.language) ? body.language : 'en'
  const langName = LANGUAGE_NAMES[language]

  const systemPrompt = `You are a meal prep expert. Analyze the week's dishes and suggest batch cooking opportunities.

Respond in ${langName}. Output ONLY a JSON array of suggestions:
[
  {
    "ingredient": "string — the shared ingredient",
    "dishes": ["dish name 1", "dish name 2"],
    "suggestion": "string — what to prep and when, max 2 sentences"
  }
]

Rules:
- Only suggest ingredients that appear in 2+ dishes across different days.
- Focus on proteins, grains, legumes and sauces — not spices or oils.
- Keep suggestions practical and time-saving.
- Max 6 suggestions.`

  const dishSummary = dishes.map((d) => `${d.day}: ${d.name} (${(d.ingredients || []).map((i) => i.name).join(', ')})`).join('\n')

  let result = await callPrimaryLLM({
    env,
    model: PRIMARY_MODEL,
    systemPrompt,
    messages: [{ role: 'user', content: `Analyze these dishes:\n${dishSummary}` }],
    temperature: 0.4,
    maxTokens: 2000,
  })

  if (!result.ok) {
    result = await callGeminiWithFallback({
      env,
      models: ['gemini-2.5-flash-lite'],
      freeOnly: true,
      timeoutMs: 15000,
      payload: {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `Analyze these dishes:\n${dishSummary}` }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json', maxOutputTokens: 2000 },
      },
    })
  }

  if (!result.ok) return json({ success: false, error: result.error || 'AI failed.' }, 502)

  let suggestions = []
  try {
    const parsed = JSON.parse(result.content)
    suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || [])
  } catch {
    const match = result.content.match(/\[[\s\S]*\]/)
    if (match) try { suggestions = JSON.parse(match[0]) } catch { /* */ }
  }

  return json({ success: true, suggestions })
}

export function onRequest({ request }) {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405)
  return json({ success: false, error: 'Unhandled.' }, 500)
}
