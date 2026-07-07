// Talks to /api/generate-meal-plan, which calls Gemini server-side.
// The browser never sees the API key.

import { useDietStore } from '@/stores/dietStore'

const DEFAULT_TIMES = {
  breakfast: '08:00',
  morning_snack: '10:30',
  lunch: '13:00',
  afternoon_snack: '16:00',
  dinner: '20:00',
}

function validateAndNormalize(raw, language = 'en', enabledMealTypes = null) {
  if (!raw || !Array.isArray(raw.days) || raw.days.length === 0) {
    return { success: false, error: 'Invalid response structure: missing days array.' }
  }

  const types = enabledMealTypes && enabledMealTypes.length
    ? enabledMealTypes
    : ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']

  const days = []

  for (let i = 0; i < 7; i++) {
    const srcDay = raw.days[i] || raw.days[raw.days.length - 1]
    const meals = []

    for (const type of types) {
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
          vegetables: Math.round(Math.abs(Number(dish.vegetables)) || 0),
          cookedWeight: typeof dish.cookedWeight === 'string' ? dish.cookedWeight : '',
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
          macroBreakdown: Array.isArray(dish.macroBreakdown)
            ? dish.macroBreakdown.map((b) => ({
                ingredient: String(b.i ?? b.ingredient ?? b.name ?? ''),
                grams: Math.round(Math.abs(Number(b.g ?? b.grams)) || 0),
                kcal: Math.round(Math.abs(Number(b.k ?? b.kcal)) || 0),
                protein: Math.round((Math.abs(Number(b.p ?? b.protein)) || 0) * 10) / 10,
                carbs: Math.round((Math.abs(Number(b.c ?? b.carbs)) || 0) * 10) / 10,
                fat: Math.round((Math.abs(Number(b.f ?? b.fat)) || 0) * 10) / 10,
              })).filter((b) => b.ingredient)
            : [],
          instructions: Array.isArray(dish.instructions)
            ? dish.instructions.map((s) => String(s)).filter(Boolean)
            : [],
          originalLang: language,
          translations: {},
        },
      })
    }

    days.push({ dayIndex: i, meals })
  }

  const shoppingList = Array.isArray(raw.shoppingList)
    ? raw.shoppingList
        .map((item) => ({
          name: String(item?.name || '').trim(),
          amount: String(item?.amount || '').trim(),
          category: String(item?.category || 'other').trim(),
        }))
        .filter((i) => i.name)
    : []

  return { success: true, data: { days, shoppingList } }
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
  const store = useDietStore()
  const language = store.language || 'en'
  const enabledMealTypes = store.enabledMealTypes
  const body = {
    fridgeContents: formData.fridgeContents || '',
    weeklyExtras: formData.weeklyExtras || '',
    profile: store.profile,
    language,
    enabledMealTypes,
  }

  let response
  try {
    response = await fetch('/api/generate-meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Generation cancelled.' }
    }
    return { success: false, error: `Network error: ${err.message}` }
  }

  if (response.status === 401 || response.status === 302) {
    return { success: false, error: 'Your session has expired. Please refresh the page to log in again.' }
  }

  // The server now returns SSE (text/event-stream) with keepalive comments
  // and a single "data:" event containing the JSON result.
  // Fall back to plain JSON parsing if the content-type isn't SSE.
  const contentType = response.headers.get('content-type') || ''
  let payload

  if (contentType.includes('text/event-stream')) {
    const rawText = await response.text()
    // Extract the last "data:" line (skip keepalive comments)
    let dataLine = null
    for (const line of rawText.split('\n')) {
      if (line.startsWith('data:')) {
        dataLine = line.slice(5).trim()
      }
    }
    if (!dataLine) {
      return { success: false, error: 'Server returned empty SSE stream.' }
    }
    try {
      payload = JSON.parse(dataLine)
    } catch {
      const snippet = dataLine.slice(0, 300).replace(/\s+/g, ' ')
      return { success: false, error: `Invalid SSE data: ${snippet}` }
    }
  } else {
    const rawText = await response.text()
    try {
      payload = JSON.parse(rawText)
    } catch {
      const snippet = rawText.slice(0, 300).replace(/\s+/g, ' ')
      return { success: false, error: `Invalid response from server (status ${response.status}): ${snippet || '(empty body)'}` }
    }
  }

  if (!payload.success) {
    // Propagate a machine-readable code (e.g. 'email_not_verified') so the UI
    // can react specifically instead of showing a generic error.
    return { success: false, code: payload.code || null, error: payload.error || `Server error (${response.status}).` }
  }

  const parsed = extractJson(payload.content)
  if (!parsed) {
    const rawStart = (payload.content || '').slice(0, 200)
    const rawEnd = (payload.content || '').slice(-200)
    const len = (payload.content || '').length
    const providerTag = payload.model ? ` [${payload.model}]` : ''
    return {
      success: false,
      error: `Failed to parse meal plan as JSON${providerTag} (content ${len} chars). Start: ${rawStart} … End: ${rawEnd}`,
    }
  }

  const result = validateAndNormalize(parsed, language, enabledMealTypes)
  if (result.success) {
    result.data.model = payload.model || null
    result.data.warnings = Array.isArray(payload.warnings) ? payload.warnings : []
    result.data.providerErrors = Array.isArray(payload.providerErrors) ? payload.providerErrors : []
  }
  return result
}
