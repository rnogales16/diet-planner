// Returns a meal label localized to the active language whenever the
// user is still using a known seeded default. If they have customized
// the label to anything else, we respect their choice.

const KNOWN_DEFAULTS = {
  breakfast: ['Breakfast', 'Desayuno'],
  morning_snack: ['Morning Snack', 'Morning snack', 'Almuerzo', 'Media mañana', 'Tentempié'],
  lunch: ['Lunch', 'Comida', 'Almuerzo'],
  afternoon_snack: ['Afternoon Snack', 'Afternoon snack', 'Merienda'],
  dinner: ['Dinner', 'Cena'],
}

function isKnownDefault(type, label) {
  const list = KNOWN_DEFAULTS[type]
  if (!list) return false
  return list.includes(String(label || '').trim())
}

export function localizedMealLabel(meal, t) {
  if (!meal) return ''
  if (isKnownDefault(meal.type, meal.label)) {
    return t(`mealTypes.${meal.type}`)
  }
  return meal.label || meal.type
}
