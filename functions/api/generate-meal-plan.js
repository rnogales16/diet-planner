// Proxy to Groq so we don't ship the API key to the browser.
// Cloudflare Access sits in front of this, so requests that get here
// are already authenticated.

const DEFAULT_MODEL = 'llama-3.3-70b-versatile'
const ALLOWED_MODELS = new Set(['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'])

const SYSTEM_PROMPT = `You are a professional nutritionist and meal planner. Generate a complete 7-day meal plan.

You MUST respond with ONLY a valid JSON object — no markdown, no code fences, no explanation, no text before or after. Just the raw JSON.

The JSON must follow this exact structure:
{
  "days": [
    {
      "dayIndex": 0,
      "meals": [
        {
          "type": "breakfast",
          "dish": {
            "name": "Dish Name",
            "time": "08:00",
            "calories": 350,
            "protein": 20,
            "carbs": 40,
            "fat": 12,
            "notes": "",
            "prepTime": 10,
            "cookTime": 15,
            "servings": 1,
            "ingredients": [
              { "name": "Ingredient", "amount": "100g" }
            ],
            "instructions": [
              "Step 1 instruction.",
              "Step 2 instruction."
            ]
          }
        }
      ]
    }
  ]
}

RULES:
- Exactly 7 days (dayIndex 0-6, Monday-Sunday)
- Exactly 5 meals per day with types: breakfast, morning_snack, lunch, afternoon_snack, dinner
- Each meal has exactly 1 dish with a full recipe
- All numeric values (calories, protein, carbs, fat, prepTime, cookTime, servings) must be positive numbers
- time must be in "HH:MM" 24-hour format
- ingredients must have both name and amount as strings
- instructions must be an array of step strings
- Make recipes realistic, varied, and nutritionally balanced
- Ensure daily totals are reasonable (1500-2500 kcal unless specified otherwise)
- ONLY output the JSON object, nothing else`

function buildUserPrompt(form) {
  const parts = ['Generate a 7-day meal plan with the following requirements:']
  if (form.preferences) parts.push(`\nDietary preferences: ${form.preferences}`)
  if (form.fridgeContents) parts.push(`\nAvailable ingredients / fridge contents: ${form.fridgeContents}`)
  if (form.favourites) parts.push(`\nFavourite ingredients / foods: ${form.favourites}`)
  if (form.restrictions) parts.push(`\nRestrictions / allergies: ${form.restrictions}`)

  const targets = []
  if (form.calorieTarget) targets.push(`~${form.calorieTarget} kcal/day`)
  if (form.proteinTarget) targets.push(`~${form.proteinTarget}g protein/day`)
  if (form.carbsTarget) targets.push(`~${form.carbsTarget}g carbs/day`)
  if (form.fatTarget) targets.push(`~${form.fatTarget}g fat/day`)
  if (targets.length) parts.push(`\nDaily nutrition targets: ${targets.join(', ')}`)

  parts.push('\n\nRespond with ONLY the JSON object.')
  return parts.join('')
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sanitizeString(value, maxLen = 500) {
  if (typeof value !== 'string') return ''
  return value.slice(0, maxLen)
}

function sanitizeNumber(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, 10000)
}

export async function onRequestPost({ request, env }) {
  if (!env.GROQ_API_KEY) {
    return json({ success: false, error: 'Server is not configured (missing GROQ_API_KEY).' }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400)
  }

  const form = {
    preferences: sanitizeString(body.preferences),
    fridgeContents: sanitizeString(body.fridgeContents, 2000),
    favourites: sanitizeString(body.favourites, 2000),
    restrictions: sanitizeString(body.restrictions),
    calorieTarget: sanitizeNumber(body.calorieTarget),
    proteinTarget: sanitizeNumber(body.proteinTarget),
    carbsTarget: sanitizeNumber(body.carbsTarget),
    fatTarget: sanitizeNumber(body.fatTarget),
  }

  const requestedModel = typeof body.model === 'string' ? body.model : DEFAULT_MODEL
  const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL

  let upstream
  try {
    upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(form) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      }),
    })
  } catch (err) {
    return json({ success: false, error: `Upstream network error: ${err.message}` }, 502)
  }

  if (!upstream.ok) {
    const errorBody = await upstream.text().catch(() => '')
    if (upstream.status === 401) {
      return json({ success: false, error: 'Server API key is invalid.' }, 500)
    }
    if (upstream.status === 429) {
      return json({ success: false, error: 'Rate limit exceeded. Please try again in a moment.' }, 429)
    }
    return json({ success: false, error: `Upstream error (${upstream.status}): ${errorBody || upstream.statusText}` }, 502)
  }

  const result = await upstream.json()
  const content = result.choices?.[0]?.message?.content
  if (!content) {
    return json({ success: false, error: 'Empty response from upstream.' }, 502)
  }

  return json({ success: true, content })
}

export function onRequest({ request }) {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed.' }, 405)
  }
  return json({ success: false, error: 'Unhandled request.' }, 500)
}
