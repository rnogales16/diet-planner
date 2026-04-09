const STORAGE_KEY_API = 'nutriplan_groq_api_key'
const STORAGE_KEY_MODEL = 'nutriplan_groq_model'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

export function getApiKey() {
  return localStorage.getItem(STORAGE_KEY_API) || ''
}

export function setApiKey(key) {
  if (key) {
    localStorage.setItem(STORAGE_KEY_API, key.trim())
  } else {
    localStorage.removeItem(STORAGE_KEY_API)
  }
}

export function getModel() {
  return localStorage.getItem(STORAGE_KEY_MODEL) || DEFAULT_MODEL
}

export function setModel(model) {
  localStorage.setItem(STORAGE_KEY_MODEL, model || DEFAULT_MODEL)
}

const MEAL_TYPES = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']

const DEFAULT_TIMES = {
  breakfast: '08:00',
  morning_snack: '10:30',
  lunch: '13:00',
  afternoon_snack: '16:00',
  dinner: '20:00',
}

function buildSystemPrompt() {
  return `You are a professional nutritionist and meal planner. Generate a complete 7-day meal plan.

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
}

function buildUserPrompt({ preferences, fridgeContents, favourites, restrictions, calorieTarget, proteinTarget, carbsTarget, fatTarget }) {
  const parts = ['Generate a 7-day meal plan with the following requirements:']

  if (preferences) parts.push(`\nDietary preferences: ${preferences}`)
  if (fridgeContents) parts.push(`\nAvailable ingredients / fridge contents: ${fridgeContents}`)
  if (favourites) parts.push(`\nFavourite ingredients / foods: ${favourites}`)
  if (restrictions) parts.push(`\nRestrictions / allergies: ${restrictions}`)

  const targets = []
  if (calorieTarget) targets.push(`~${calorieTarget} kcal/day`)
  if (proteinTarget) targets.push(`~${proteinTarget}g protein/day`)
  if (carbsTarget) targets.push(`~${carbsTarget}g carbs/day`)
  if (fatTarget) targets.push(`~${fatTarget}g fat/day`)
  if (targets.length) parts.push(`\nDaily nutrition targets: ${targets.join(', ')}`)

  parts.push('\n\nRespond with ONLY the JSON object.')

  return parts.join('')
}

function validateAndNormalize(raw) {
  if (!raw || !Array.isArray(raw.days) || raw.days.length === 0) {
    return { success: false, error: 'Invalid response structure: missing days array.' }
  }

  const days = []

  for (let i = 0; i < 7; i++) {
    const srcDay = raw.days[i] || raw.days[raw.days.length - 1]
    const meals = []

    for (const type of MEAL_TYPES) {
      const srcMeal = srcDay.meals?.find((m) => m.type === type)
      const dish = srcMeal?.dish || {}

      meals.push({
        type,
        dish: {
          name: dish.name || `${type.replace('_', ' ')} dish`,
          time: /^\d{2}:\d{2}$/.test(dish.time) ? dish.time : DEFAULT_TIMES[type],
          calories: Math.round(Math.abs(Number(dish.calories)) || 0),
          protein: Math.round(Math.abs(Number(dish.protein)) || 0),
          carbs: Math.round(Math.abs(Number(dish.carbs)) || 0),
          fat: Math.round(Math.abs(Number(dish.fat)) || 0),
          notes: dish.notes || '',
          prepTime: Math.round(Math.abs(Number(dish.prepTime)) || 0),
          cookTime: Math.round(Math.abs(Number(dish.cookTime)) || 0),
          servings: Math.max(1, Math.round(Number(dish.servings)) || 1),
          ingredients: Array.isArray(dish.ingredients)
            ? dish.ingredients.map((ing) => ({
                name: String(ing.name || ''),
                amount: String(ing.amount || ''),
              })).filter((ing) => ing.name)
            : [],
          instructions: Array.isArray(dish.instructions)
            ? dish.instructions.map((s) => String(s)).filter(Boolean)
            : [],
        },
      })
    }

    days.push({ dayIndex: i, meals })
  }

  return { success: true, data: { days } }
}

function extractJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    // Fall through
  }

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim())
    } catch {
      // Fall through
    }
  }

  const braceStart = text.indexOf('{')
  const braceEnd = text.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(text.slice(braceStart, braceEnd + 1))
    } catch {
      // Fall through
    }
  }

  return null
}

export async function generateMealPlan(formData, signal) {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { success: false, error: 'No API key configured. Add your Groq API key in Settings.' }
  }

  const model = getModel()

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(formData) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      }),
      signal,
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Invalid API key. Please check your key in Settings.' }
      }
      if (response.status === 429) {
        return { success: false, error: 'Rate limit exceeded. Please wait a moment and try again.' }
      }
      const errorBody = await response.text().catch(() => '')
      return { success: false, error: `API error (${response.status}): ${errorBody || response.statusText}` }
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content

    if (!content) {
      return { success: false, error: 'Empty response from API.' }
    }

    const parsed = extractJson(content)
    if (!parsed) {
      return { success: false, error: 'Failed to parse API response as JSON.' }
    }

    return validateAndNormalize(parsed)
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Generation cancelled.' }
    }
    return { success: false, error: `Network error: ${err.message}` }
  }
}
