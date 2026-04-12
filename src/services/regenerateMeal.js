import { useDietStore } from '@/stores/dietStore'

export async function regenerateSingleMeal({ mealType, dayIndex, weekKey }) {
  const store = useDietStore()
  const language = store.language || 'en'
  const week = store.weeks[weekKey]

  // Collect existing dish names for the week so the AI avoids duplicates
  const existingDishNames = []
  if (week) {
    for (const day of week.days) {
      for (const meal of day.meals) {
        for (const dish of meal.dishes) {
          if (dish.name) existingDishNames.push(dish.name)
        }
      }
    }
  }

  let response
  try {
    response = await fetch('/api/regenerate-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mealType,
        language,
        profile: store.profile,
        existingDishNames,
      }),
      credentials: 'include',
    })
  } catch (err) {
    return { success: false, error: `Network error: ${err.message}` }
  }

  const rawText = await response.text()
  let payload
  try {
    payload = JSON.parse(rawText)
  } catch {
    return { success: false, error: `Invalid server response (${response.status})` }
  }

  if (!payload.success) {
    return { success: false, error: payload.error || 'Unknown error' }
  }

  // Parse the dish from the AI content
  let dish
  try {
    dish = typeof payload.content === 'string' ? JSON.parse(payload.content) : payload.content
  } catch {
    // Try extracting JSON from fences
    const match = payload.content?.match(/\{[\s\S]*\}/)
    if (match) {
      try { dish = JSON.parse(match[0]) } catch { /* */ }
    }
  }

  if (!dish || !dish.name) {
    return { success: false, error: 'Could not parse the generated dish.' }
  }

  dish.originalLang = language
  dish.translations = {}

  return { success: true, dish }
}
