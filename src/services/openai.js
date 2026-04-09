// Calls the Cloudflare Pages Function at /api/generate-meal-plan, which
// proxies to Groq with a server-side API key. The browser never sees the key.

const STORAGE_KEY_MODEL = 'nutriplan_groq_model'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

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
  let response
  try {
    response = await fetch('/api/generate-meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, model: getModel() }),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Generation cancelled.' }
    }
    return { success: false, error: `Network error: ${err.message}` }
  }

  // Cloudflare Access returns a redirect/HTML page when the session expires.
  if (response.status === 401 || response.status === 302) {
    return { success: false, error: 'Your session has expired. Please refresh the page to log in again.' }
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    return { success: false, error: 'Invalid response from server.' }
  }

  if (!response.ok || !payload.success) {
    return { success: false, error: payload.error || `Server error (${response.status}).` }
  }

  const parsed = extractJson(payload.content)
  if (!parsed) {
    return { success: false, error: 'Failed to parse meal plan as JSON.' }
  }

  return validateAndNormalize(parsed)
}
