const NUTRITION_KEYS = ['calories', 'protein', 'carbs', 'fat', 'vegetables']

function emptyTotals() {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, vegetables: 0 }
}

export function sumDishes(dishes) {
  const totals = emptyTotals()
  for (const dish of dishes) {
    for (const key of NUTRITION_KEYS) {
      totals[key] += Number(dish[key]) || 0
    }
  }
  return totals
}

export function sumMeals(meals) {
  const totals = emptyTotals()
  for (const meal of meals) {
    const mealTotals = sumDishes(meal.dishes)
    for (const key of NUTRITION_KEYS) {
      totals[key] += mealTotals[key]
    }
  }
  return totals
}

export function sumDays(days) {
  const totals = emptyTotals()
  for (const day of days) {
    const dayTotals = sumMeals(day.meals)
    for (const key of NUTRITION_KEYS) {
      totals[key] += dayTotals[key]
    }
  }
  return totals
}

export function formatNutrition(value, unit = '') {
  const rounded = Math.round(value * 10) / 10
  return unit ? `${rounded}${unit}` : String(rounded)
}
