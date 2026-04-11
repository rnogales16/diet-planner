// Conversational chat about a single dish.
// The model can either reply with text only, or also return an updated
// version of the dish that the client will save in place. Used for things
// like "swap chickpeas for lentils" or "is this celiac safe?".
//
// Cloudflare Access protects this endpoint. API keys live as Pages secrets.

import { callGeminiWithFallback } from './_gemini.js'

// Pro by default for quality. Flash and Flash-Lite sit behind it as safety
// nets — separate serving pools inside Google, so when Pro is congested
// they often still work.
const MODEL_CASCADE = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']

const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish (español)',
}

const SUPPORTED_LANGS = new Set(['en', 'es'])

const MAX_HISTORY = 12 // last 12 turns kept

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function trim(value, max = 1500) {
  if (typeof value !== 'string') return ''
  return value.slice(0, max).trim()
}

function buildSystemPrompt(language) {
  const langName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en
  return `You are a helpful nutritionist and home cook. The user is looking at a single dish in their weekly meal plan and may want to ask questions about it, request substitutions, swap ingredients, change cooking method, or adjust serving size.

LANGUAGE: Always reply in ${langName}. If you return an updated dish, write its text fields in ${langName} as well.

You will receive:
1. The current dish (name, ingredients, instructions, macros, times, vegetables grams).
2. The user's diet profile (allergies, restrictions, disliked ingredients, targets, etc.).
3. The conversation so far.

Your output is ALWAYS a single JSON object with this exact shape:
{
  "reply": "string — the message to show the user, in ${langName}",
  "updatedDish": null OR {
    "name": "string",
    "notes": "string (may be empty)",
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "vegetables": number,
    "prepTime": number,
    "cookTime": number,
    "servings": number,
    "ingredients": [{ "name": "string", "amount": "string" }],
    "instructions": ["string", ...]
  }
}

Rules:
- Set "updatedDish" to null when the user is just asking a question and you don't need to change the dish.
- Set "updatedDish" to a full updated copy whenever you change ANYTHING in the dish (ingredients, steps, name, macros, times, servings). Always return the COMPLETE dish, not a partial diff.
- When you change an ingredient, recalculate calories, protein, carbs, fat AND vegetables grams so they stay realistic. Don't lie.
- NEVER add an ingredient that conflicts with the user's allergies. Hard rule.
- NEVER add an ingredient from the user's "disliked ingredients" list. Hard rule, even in trace amounts.
- Respect dietary style and restrictions in the profile.
- RAW WEIGHTS: all ingredient quantities MUST refer to the raw, uncooked form. 100g of pasta = 100g dry. 200g of chicken = 200g raw. Calculate macros against raw values too.
- The "vegetables" field is the total grams of raw vegetables in the dish (leafy greens, brassicas, peppers, onion, tomato, courgette, mushrooms, etc., excluding fruits, nuts, seeds, grains, legumes, herbs and starchy fries).
- Keep "reply" short and natural — like a friendly cook, not a wall of text. Acknowledge the change you made if you made one.
- If the user asks something you can't or shouldn't do, say so politely in "reply" and leave "updatedDish" null.
- Output ONLY the JSON object. No markdown, no code fences, no commentary outside the JSON.`
}

function buildContextMessage(dish, profile) {
  const lines = ['## Current dish']
  lines.push(JSON.stringify({
    name: dish.name,
    notes: dish.notes || '',
    time: dish.time,
    calories: dish.calories,
    protein: dish.protein,
    carbs: dish.carbs,
    fat: dish.fat,
    vegetables: dish.vegetables || 0,
    prepTime: dish.prepTime,
    cookTime: dish.cookTime,
    servings: dish.servings,
    ingredients: dish.ingredients || [],
    instructions: dish.instructions || [],
  }, null, 2))

  if (profile && typeof profile === 'object') {
    lines.push('\n## User diet profile')
    const p = {}
    if (Array.isArray(profile.goals) && profile.goals.length) p.goals = profile.goals
    else if (typeof profile.goal === 'string' && profile.goal) p.goals = [profile.goal]
    if (profile.dietaryStyle) p.dietaryStyle = profile.dietaryStyle
    if (profile.allergies) p.allergies = profile.allergies
    if (profile.restrictions) p.restrictions = profile.restrictions
    if (Array.isArray(profile.dislikedIngredients) && profile.dislikedIngredients.length) {
      p.dislikedIngredients = profile.dislikedIngredients
    }
    if (profile.favourites) p.favourites = profile.favourites
    if (profile.cuisines) p.cuisines = profile.cuisines
    if (profile.calorieTarget) p.calorieTarget = profile.calorieTarget
    if (profile.proteinTarget) p.proteinTarget = profile.proteinTarget
    if (profile.carbsTarget) p.carbsTarget = profile.carbsTarget
    if (profile.fatTarget) p.fatTarget = profile.fatTarget
    if (profile.vegetableTarget) p.vegetableTarget = profile.vegetableTarget
    if (profile.servings) p.servings = profile.servings
    if (profile.maxCookTime) p.maxCookTime = profile.maxCookTime
    if (profile.notes) p.notes = profile.notes
    lines.push(JSON.stringify(p, null, 2))
  }

  return lines.join('\n')
}

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string')
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 4000) }] }))
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

function sanitizeUpdatedDish(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 200) : '',
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 1000) : '',
    calories: Math.max(0, Math.round(Number(raw.calories) || 0)),
    protein: Math.max(0, Math.round(Number(raw.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(raw.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(raw.fat) || 0)),
    vegetables: Math.max(0, Math.round(Number(raw.vegetables) || 0)),
    prepTime: Math.max(0, Math.round(Number(raw.prepTime) || 0)),
    cookTime: Math.max(0, Math.round(Number(raw.cookTime) || 0)),
    servings: Math.max(1, Math.round(Number(raw.servings) || 1)),
    ingredients: Array.isArray(raw.ingredients)
      ? raw.ingredients.map((ing) => ({
          name: String(ing?.name || '').slice(0, 200),
          amount: String(ing?.amount || '').slice(0, 200),
        })).filter((ing) => ing.name)
      : [],
    instructions: Array.isArray(raw.instructions)
      ? raw.instructions.map((s) => String(s).slice(0, 1000)).filter(Boolean)
      : [],
  }
}

export async function onRequestPost({ request, env }) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400)
  }

  if (!body.dish || typeof body.dish !== 'object') {
    return json({ success: false, error: 'Missing dish.' }, 400)
  }

  const message = trim(body.message, 2000)
  if (!message) {
    return json({ success: false, error: 'Missing message.' }, 400)
  }

  const language = SUPPORTED_LANGS.has(body.language) ? body.language : 'en'
  const systemPrompt = buildSystemPrompt(language)
  const context = buildContextMessage(body.dish, body.profile)
  const history = sanitizeHistory(body.history)

  // Conversation: first turn is the context as a user message, then the
  // saved history (if any), then the new user message.
  const contents = [
    { role: 'user', parts: [{ text: context }] },
    { role: 'model', parts: [{ text: '{"reply":"Got it. Ready when you are.","updatedDish":null}' }] },
    ...history,
    { role: 'user', parts: [{ text: message }] },
  ]

  const result = await callGeminiWithFallback({
    env,
    models: MODEL_CASCADE,
    payload: {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.6,
        topP: 0.9,
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
      },
    },
  })

  if (!result.ok) {
    if (result.status === 429) {
      return json({ success: false, error: 'All Gemini quotas exhausted. Try again in a minute.' }, 429)
    }
    if (result.status === 503 || result.status === 500 || result.status === 502 || result.status === 504) {
      return json({ success: false, error: 'Google AI is temporarily overloaded. Please try again in a moment.' }, 503)
    }
    return json({ success: false, error: `Upstream error: ${result.error}` }, 502)
  }

  const parsed = extractJson(result.content)
  if (!parsed || typeof parsed.reply !== 'string') {
    return json({ success: false, error: 'Failed to parse chat response.' }, 502)
  }

  const updatedDish = parsed.updatedDish ? sanitizeUpdatedDish(parsed.updatedDish) : null

  return json({ success: true, reply: parsed.reply, updatedDish, model: result.model })
}

export function onRequest({ request }) {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed.' }, 405)
  }
  return json({ success: false, error: 'Unhandled request.' }, 500)
}
