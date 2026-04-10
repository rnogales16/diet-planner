// Generates a 7-day meal plan with Gemini 2.5 Pro.
// Cloudflare Access protects this endpoint, so the request is already
// authenticated by the time it gets here. The API key lives as a Pages
// secret (GEMINI_API_KEY) and never reaches the browser.

const GEMINI_MODEL = 'gemini-2.5-pro'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const GOAL_LABELS = {
  lose_weight: 'lose weight',
  gain_muscle: 'gain muscle',
  maintain: 'maintain weight',
  health: 'general health',
}

const STYLE_LABELS = {
  omnivore: 'omnivore',
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  pescatarian: 'pescatarian',
  mediterranean: 'mediterranean',
  keto: 'keto',
  paleo: 'paleo',
  other: 'unspecified',
}

const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish (español)',
}

const SUPPORTED_LANGS = new Set(['en', 'es'])

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

function num(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(n, 10000)
}

function buildSystemPrompt(language) {
  const langName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en
  return `You are a meticulous nutritionist and home cook. You design realistic, varied, healthy weekly meal plans for one person at a time.

LANGUAGE: All human-readable strings in your response (dish names, notes, ingredient names and amounts, instructions) MUST be written in ${langName}. Do not translate the JSON keys themselves — those must stay in English exactly as specified below. The "type" field of each meal must also stay in English (breakfast, morning_snack, lunch, afternoon_snack, dinner).

Hard rules:
- Output ONLY a single valid JSON object — no markdown, no code fences, no commentary.
- Exactly 7 days, dayIndex 0..6 (Monday..Sunday).
- Exactly 5 meals per day with these exact types: breakfast, morning_snack, lunch, afternoon_snack, dinner.
- Each meal has exactly 1 dish.
- Dish times must be "HH:MM" (24h). Use sensible times unless specified.
- Numeric fields (calories, protein, carbs, fat, prepTime, cookTime, servings) must be positive numbers.
- Ingredients are objects { "name": "...", "amount": "..." } with realistic, weighable quantities (grams, ml, units).
- Instructions are an array of step strings, written like a real recipe (clear, in order, beginner-friendly but precise).
- No duplicate dish names across the week. Vary cuisines, cooking methods and main proteins.
- Respect every dietary restriction, allergy and target you receive. They are non-negotiable.
- If a target is not provided, use sensible defaults (≈2000 kcal/day, balanced macros).
- Snacks should be appropriately small (~150-300 kcal). Lunch and dinner should be the substantial meals.
- All ingredient quantities must add up reasonably to the stated calorie and macro values.

Output JSON shape (exact field names, order does not matter):
{
  "days": [
    {
      "dayIndex": 0,
      "meals": [
        {
          "type": "breakfast",
          "dish": {
            "name": "string",
            "time": "HH:MM",
            "calories": number,
            "protein": number,
            "carbs": number,
            "fat": number,
            "notes": "string (may be empty)",
            "prepTime": number,
            "cookTime": number,
            "servings": number,
            "ingredients": [{ "name": "string", "amount": "string" }],
            "instructions": ["string", "..."]
          }
        }
      ]
    }
  ]
}`
}

function buildUserPrompt({ profile, fridgeContents, weeklyExtras }) {
  const lines = ['Generate a 7-day meal plan tailored to this person.']

  // Profile section
  const p = profile || {}
  lines.push('\n## Diet profile')

  if (p.goal) lines.push(`- Goal: ${GOAL_LABELS[p.goal] || p.goal}`)
  if (p.dietaryStyle) lines.push(`- Dietary style: ${STYLE_LABELS[p.dietaryStyle] || p.dietaryStyle}`)
  if (p.allergies) lines.push(`- Allergies (NEVER use): ${p.allergies}`)
  if (p.restrictions) lines.push(`- Restrictions and dislikes: ${p.restrictions}`)
  if (p.favourites) lines.push(`- Favourite foods (use often): ${p.favourites}`)
  if (p.cuisines) lines.push(`- Preferred cuisines: ${p.cuisines}`)

  const targets = []
  if (p.calorieTarget) targets.push(`${p.calorieTarget} kcal/day`)
  if (p.proteinTarget) targets.push(`${p.proteinTarget}g protein/day`)
  if (p.carbsTarget) targets.push(`${p.carbsTarget}g carbs/day`)
  if (p.fatTarget) targets.push(`${p.fatTarget}g fat/day`)
  if (targets.length) lines.push(`- Daily nutrition targets: ${targets.join(', ')}`)

  if (p.servings && p.servings > 1) {
    lines.push(`- Cooking for ${p.servings} people (servings should reflect this)`)
  }
  if (p.maxCookTime) {
    lines.push(`- Max time per meal (prep + cook combined): ${p.maxCookTime} minutes`)
  }
  if (p.notes) lines.push(`- Additional notes: ${p.notes}`)

  if (lines.length === 2) {
    lines.push('- (no profile set, use balanced defaults)')
  }

  // Weekly context
  if (fridgeContents || weeklyExtras) {
    lines.push('\n## This week')
    if (fridgeContents) lines.push(`- Already in the fridge / pantry (build around this when reasonable): ${fridgeContents}`)
    if (weeklyExtras) lines.push(`- Special context for this week: ${weeklyExtras}`)
  }

  lines.push('\nRespond with ONLY the JSON object described in the system prompt.')
  return lines.join('\n')
}

function sanitizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return {}
  return {
    goal: trim(raw.goal, 40),
    dietaryStyle: trim(raw.dietaryStyle, 40),
    allergies: trim(raw.allergies, 500),
    restrictions: trim(raw.restrictions, 500),
    favourites: trim(raw.favourites, 500),
    cuisines: trim(raw.cuisines, 500),
    calorieTarget: num(raw.calorieTarget),
    proteinTarget: num(raw.proteinTarget),
    carbsTarget: num(raw.carbsTarget),
    fatTarget: num(raw.fatTarget),
    servings: num(raw.servings) || 1,
    maxCookTime: num(raw.maxCookTime),
    notes: trim(raw.notes, 1000),
  }
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

  const profile = sanitizeProfile(body.profile)
  const fridgeContents = trim(body.fridgeContents, 2000)
  const weeklyExtras = trim(body.weeklyExtras, 2000)
  const language = SUPPORTED_LANGS.has(body.language) ? body.language : 'en'

  const systemPrompt = buildSystemPrompt(language)
  const userPrompt = buildUserPrompt({ profile, fridgeContents, weeklyExtras })

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
          temperature: 0.85,
          topP: 0.95,
          responseMimeType: 'application/json',
          maxOutputTokens: 16384,
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

  return json({ success: true, content })
}

export function onRequest({ request }) {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed.' }, 405)
  }
  return json({ success: false, error: 'Unhandled request.' }, 500)
}
