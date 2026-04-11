import { formatDate, getDayName } from './dateHelpers'

export const DEFAULT_MEAL_TYPES = [
  { type: 'breakfast', label: 'Breakfast', defaultTime: '08:00', enabled: true },
  { type: 'morning_snack', label: 'Morning Snack', defaultTime: '10:30', enabled: true },
  { type: 'lunch', label: 'Lunch', defaultTime: '13:00', enabled: true },
  { type: 'afternoon_snack', label: 'Afternoon Snack', defaultTime: '16:00', enabled: true },
  { type: 'dinner', label: 'Dinner', defaultTime: '20:00', enabled: true },
]

let nextId = Date.now()

export function generateId() {
  return String(nextId++)
}

export function createEmptyDish(mealType) {
  const meal = DEFAULT_MEAL_TYPES.find((m) => m.type === mealType)
  return {
    id: generateId(),
    name: '',
    time: meal?.defaultTime ?? '12:00',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    vegetables: 0,
    notes: '',
    prepTime: 0,
    cookTime: 0,
    servings: 1,
    ingredients: [],
    instructions: [],
  }
}

export function createEmptyMealSlot(mealType, customMealTypes) {
  const types = customMealTypes || DEFAULT_MEAL_TYPES
  const mt = types.find((m) => m.type === mealType.type) || mealType
  return {
    type: mt.type,
    label: mt.label,
    defaultTime: mt.defaultTime,
    dishes: [],
  }
}

export function createEmptyDay(date, mealTypes) {
  const types = mealTypes || DEFAULT_MEAL_TYPES
  return {
    date,
    meals: types.map((mt) => createEmptyMealSlot(mt, types)),
  }
}

export function createEmptyWeek(weekKey, dates, mealTypes) {
  return {
    weekKey,
    startDate: formatDate(dates[0]),
    endDate: formatDate(dates[6]),
    days: dates.map((d) => ({
      ...createEmptyDay(formatDate(d), mealTypes),
      dayName: getDayName(d),
    })),
  }
}
