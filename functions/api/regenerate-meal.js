// Regenerates a single meal (one dish) using the primary LLM, respecting the user's
// full profile. Much faster and cheaper than regenerating the whole week.

import { callPrimaryLLM } from './_llm.js'
import { resolveUser } from './_user.js'
import { callGeminiWithFallback } from './_gemini.js'

const PRIMARY_MODEL = 'claude-sonnet-4-6'
const GEMINI_FALLBACK = ['gemini-2.5-pro']

const LANGUAGE_NAMES = { en: 'English', es: 'Spanish (español)' }
const SUPPORTED_LANGS = new Set(['en', 'es'])

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function trim(v, max = 500) {
  return typeof v === 'string' ? v.slice(0, max).trim() : ''
}

export async function onRequestPost({ request, env }) {
  const auth = await resolveUser(request, env)
  if (!auth) return json({ success: false, error: 'Not authenticated.' }, 401)

  let body
  try { body = await request.json() } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400)
  }

  const mealType = trim(body.mealType, 40)
  const language = SUPPORTED_LANGS.has(body.language) ? body.language : 'en'
  const langName = LANGUAGE_NAMES[language]
  const profile = body.profile || {}
  const existingDishNames = Array.isArray(body.existingDishNames) ? body.existingDishNames : []

  const allergiesRaw = trim(profile.allergiesAndIntolerances || profile.allergies || '', 500)
  const disliked = Array.isArray(profile.dislikedIngredients) ? profile.dislikedIngredients : []
  const forbidden = [
    ...(allergiesRaw ? allergiesRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : []),
    ...disliked,
  ]

  const systemPrompt = `You are a nutritionist. Generate exactly ONE dish for the meal type "${mealType}".

LANGUAGE: All text must be in ${langName}. JSON keys stay in English.

Rules:
- Output ONLY a valid JSON object, no markdown.
- All ingredient weights are RAW/UNCOOKED.
- NEVER use these forbidden ingredients: ${forbidden.join(', ') || 'none'}.
- Do NOT reuse any of these dish names: ${existingDishNames.join(', ') || 'none'}.
- Respect the user's dietary style and targets.
- Instructions: 3-5 short steps, max 18 words each.
- Ingredient names: max 4 words.

JSON shape:
{
  "name": "string",
  "time": "HH:MM",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "vegetables": number,
  "cookedWeight": "string — estimated total cooked weight after cooking, e.g. '380g'",
  "notes": "",
  "prepTime": number,
  "cookTime": number,
  "servings": number,
  "ingredients": [{"name":"string","amount":"string"}],
  "instructions": ["string"]
}`

  const targets = []
  if (profile.calorieTarget) targets.push(`${profile.calorieTarget} kcal/day`)
  if (profile.proteinTarget) targets.push(`${profile.proteinTarget}g protein/day`)
  if (profile.goals?.length) targets.push(`Goals: ${profile.goals.join(', ')}`)
  if (profile.dietaryStyle) targets.push(`Style: ${profile.dietaryStyle}`)
  if (profile.maxCookTime) targets.push(`Max cook time: ${profile.maxCookTime} min`)

  const favourites = Array.isArray(profile.favourites) ? profile.favourites.join(', ') : (profile.favourites || '')
  const userPrompt = `Generate one ${mealType} dish. ${targets.length ? 'Daily targets: ' + targets.join(', ') + '.' : ''} ${favourites ? 'Favourite foods: ' + favourites + '.' : ''} ${profile.cuisines ? 'Preferred cuisines: ' + profile.cuisines + '.' : ''}`

  let result = await callPrimaryLLM({
    env,
    model: PRIMARY_MODEL,
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    temperature: 0.8,
    maxTokens: 2000,
  })

  if (!result.ok) {
    result = await callGeminiWithFallback({
      env,
      models: GEMINI_FALLBACK,
      freeOnly: true,
      timeoutMs: 20000,
      payload: {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: 'application/json',
          maxOutputTokens: 2000,
        },
      },
    })
  }

  if (!result.ok) {
    return json({ success: false, error: result.error || 'All providers failed.' }, 502)
  }

  return json({ success: true, content: result.content, model: result.model })
}

export function onRequest({ request }) {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405)
  return json({ success: false, error: 'Unhandled.' }, 500)
}
