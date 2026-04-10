import { defineStore } from 'pinia'
import { getWeekKey, getWeekDates } from '@/utils/dateHelpers'
import { DEFAULT_MEAL_TYPES, createEmptyWeek, generateId } from '@/utils/defaults'

const EXAMPLE_DISHES = [
  // Day 0 (Monday)
  {
    dayIndex: 0, mealType: 'breakfast',
    dish: {
      name: 'Oatmeal with Berries', time: '08:00', calories: 350, protein: 12, carbs: 55, fat: 8, notes: 'Use fresh berries when in season.',
      prepTime: 5, cookTime: 10, servings: 1,
      ingredients: [
        { name: 'Rolled oats', amount: '80g' },
        { name: 'Milk', amount: '200ml' },
        { name: 'Mixed berries', amount: '100g' },
        { name: 'Honey', amount: '1 tbsp' },
        { name: 'Chia seeds', amount: '1 tsp' },
      ],
      instructions: [
        'Bring milk to a simmer in a small saucepan.',
        'Stir in oats and cook for 5 minutes, stirring occasionally.',
        'Pour into a bowl and top with berries, honey, and chia seeds.',
      ],
    },
  },
  {
    dayIndex: 0, mealType: 'lunch',
    dish: {
      name: 'Grilled Chicken Salad', time: '13:00', calories: 480, protein: 42, carbs: 18, fat: 26, notes: '',
      prepTime: 15, cookTime: 12, servings: 1,
      ingredients: [
        { name: 'Chicken breast', amount: '180g' },
        { name: 'Mixed greens', amount: '100g' },
        { name: 'Cherry tomatoes', amount: '80g' },
        { name: 'Cucumber', amount: '60g' },
        { name: 'Olive oil', amount: '1 tbsp' },
        { name: 'Lemon juice', amount: '1 tbsp' },
        { name: 'Feta cheese', amount: '30g' },
      ],
      instructions: [
        'Season chicken breast with salt, pepper, and a drizzle of olive oil.',
        'Grill chicken on medium-high heat for 6 minutes per side until cooked through.',
        'Let chicken rest for 3 minutes, then slice.',
        'Toss greens, tomatoes, and cucumber in a bowl with lemon juice and olive oil.',
        'Top with sliced chicken and crumbled feta.',
      ],
    },
  },
  {
    dayIndex: 0, mealType: 'dinner',
    dish: {
      name: 'Salmon with Rice & Veggies', time: '20:00', calories: 580, protein: 38, carbs: 52, fat: 22, notes: '',
      prepTime: 10, cookTime: 20, servings: 1,
      ingredients: [
        { name: 'Salmon fillet', amount: '170g' },
        { name: 'Basmati rice', amount: '80g' },
        { name: 'Broccoli', amount: '100g' },
        { name: 'Soy sauce', amount: '1 tbsp' },
        { name: 'Garlic', amount: '2 cloves' },
        { name: 'Sesame oil', amount: '1 tsp' },
      ],
      instructions: [
        'Cook rice according to package instructions.',
        'Steam broccoli florets for 4 minutes until tender-crisp.',
        'Season salmon with soy sauce, minced garlic, and sesame oil.',
        'Pan-sear salmon skin-side down for 4 minutes, flip and cook 3 more minutes.',
        'Serve salmon over rice with steamed broccoli on the side.',
      ],
    },
  },
  // Day 1 (Tuesday)
  {
    dayIndex: 1, mealType: 'breakfast',
    dish: {
      name: 'Greek Yogurt Parfait', time: '08:00', calories: 310, protein: 22, carbs: 38, fat: 9, notes: '',
      prepTime: 5, cookTime: 0, servings: 1,
      ingredients: [
        { name: 'Greek yogurt', amount: '200g' },
        { name: 'Granola', amount: '40g' },
        { name: 'Banana', amount: '1 medium' },
        { name: 'Honey', amount: '1 tsp' },
      ],
      instructions: [
        'Slice the banana.',
        'Layer yogurt, granola, and banana slices in a glass or bowl.',
        'Drizzle with honey and serve immediately.',
      ],
    },
  },
  {
    dayIndex: 1, mealType: 'lunch',
    dish: {
      name: 'Turkey Wrap', time: '13:00', calories: 420, protein: 32, carbs: 40, fat: 14, notes: '',
      prepTime: 10, cookTime: 0, servings: 1,
      ingredients: [
        { name: 'Whole wheat tortilla', amount: '1 large' },
        { name: 'Turkey slices', amount: '120g' },
        { name: 'Lettuce', amount: '30g' },
        { name: 'Tomato', amount: '1 medium' },
        { name: 'Avocado', amount: '1/4' },
        { name: 'Mustard', amount: '1 tsp' },
      ],
      instructions: [
        'Lay tortilla flat and spread mustard down the center.',
        'Layer turkey slices, lettuce, sliced tomato, and avocado.',
        'Fold the sides in and roll tightly.',
        'Cut in half diagonally and serve.',
      ],
    },
  },
  {
    dayIndex: 1, mealType: 'afternoon_snack',
    dish: {
      name: 'Apple & Peanut Butter', time: '16:00', calories: 200, protein: 5, carbs: 24, fat: 10, notes: '',
      prepTime: 2, cookTime: 0, servings: 1,
      ingredients: [
        { name: 'Apple', amount: '1 medium' },
        { name: 'Peanut butter', amount: '1 tbsp' },
      ],
      instructions: [
        'Slice the apple into wedges.',
        'Serve with peanut butter for dipping.',
      ],
    },
  },
  {
    dayIndex: 1, mealType: 'dinner',
    dish: {
      name: 'Pasta Bolognese', time: '20:00', calories: 620, protein: 35, carbs: 68, fat: 20, notes: '',
      prepTime: 10, cookTime: 25, servings: 2,
      ingredients: [
        { name: 'Spaghetti', amount: '160g' },
        { name: 'Ground beef (lean)', amount: '200g' },
        { name: 'Crushed tomatoes', amount: '200ml' },
        { name: 'Onion', amount: '1 small' },
        { name: 'Garlic', amount: '2 cloves' },
        { name: 'Olive oil', amount: '1 tbsp' },
        { name: 'Parmesan', amount: '20g' },
      ],
      instructions: [
        'Cook spaghetti in salted boiling water according to package directions.',
        'Dice onion and mince garlic. Saut\u00e9 in olive oil over medium heat until soft.',
        'Add ground beef, break it up, and cook until browned.',
        'Pour in crushed tomatoes, season with salt and pepper, simmer 15 minutes.',
        'Drain pasta and toss with the sauce. Top with grated Parmesan.',
      ],
    },
  },
  // Day 2 (Wednesday)
  {
    dayIndex: 2, mealType: 'breakfast',
    dish: {
      name: 'Scrambled Eggs on Toast', time: '08:00', calories: 380, protein: 24, carbs: 30, fat: 18, notes: '',
      prepTime: 5, cookTime: 5, servings: 1,
      ingredients: [
        { name: 'Eggs', amount: '3' },
        { name: 'Whole wheat bread', amount: '2 slices' },
        { name: 'Butter', amount: '10g' },
        { name: 'Salt & pepper', amount: 'to taste' },
        { name: 'Chives', amount: '1 tbsp' },
      ],
      instructions: [
        'Toast the bread slices.',
        'Whisk eggs with a pinch of salt and pepper.',
        'Melt butter in a non-stick pan over low heat.',
        'Pour in eggs and stir gently with a spatula until just set.',
        'Serve eggs on toast and garnish with chopped chives.',
      ],
    },
  },
  {
    dayIndex: 2, mealType: 'morning_snack',
    dish: {
      name: 'Protein Smoothie', time: '10:30', calories: 250, protein: 28, carbs: 26, fat: 4, notes: 'Blend until smooth.',
      prepTime: 3, cookTime: 0, servings: 1,
      ingredients: [
        { name: 'Protein powder', amount: '1 scoop' },
        { name: 'Banana', amount: '1 medium' },
        { name: 'Milk', amount: '250ml' },
        { name: 'Ice cubes', amount: '4-5' },
      ],
      instructions: [
        'Add all ingredients to a blender.',
        'Blend on high for 30-45 seconds until smooth.',
        'Pour into a glass and serve immediately.',
      ],
    },
  },
  {
    dayIndex: 2, mealType: 'lunch',
    dish: {
      name: 'Tuna Poke Bowl', time: '13:00', calories: 520, protein: 36, carbs: 58, fat: 14, notes: '',
      prepTime: 15, cookTime: 15, servings: 1,
      ingredients: [
        { name: 'Sushi-grade tuna', amount: '150g' },
        { name: 'Sushi rice', amount: '100g' },
        { name: 'Soy sauce', amount: '2 tbsp' },
        { name: 'Sesame oil', amount: '1 tsp' },
        { name: 'Avocado', amount: '1/2' },
        { name: 'Edamame', amount: '50g' },
        { name: 'Nori strips', amount: 'handful' },
      ],
      instructions: [
        'Cook sushi rice and let it cool slightly.',
        'Cube the tuna and marinate in soy sauce and sesame oil for 10 minutes.',
        'Assemble bowl: rice on the bottom, then tuna, sliced avocado, and edamame.',
        'Top with nori strips and an extra drizzle of soy sauce.',
      ],
    },
  },
]

const DEFAULT_PROFILE = {
  goal: '',                // 'lose_weight' | 'gain_muscle' | 'maintain' | 'health'
  dietaryStyle: '',        // 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'mediterranean' | 'keto' | 'paleo' | 'other'
  allergies: '',           // free text
  restrictions: '',        // free text (dislikes, intolerances)
  favourites: '',          // free text (loved ingredients/cuisines)
  cuisines: '',            // free text (preferred cuisines)
  calorieTarget: null,
  proteinTarget: null,
  carbsTarget: null,
  fatTarget: null,
  servings: 1,             // people to cook for
  maxCookTime: null,       // minutes per meal, null means no limit
  notes: '',               // free text catch-all
}

export const useDietStore = defineStore('diet', {
  state: () => ({
    weeks: {},
    currentWeekKey: getWeekKey(new Date()),
    mealTypes: JSON.parse(JSON.stringify(DEFAULT_MEAL_TYPES)),
    profile: { ...DEFAULT_PROFILE },
    language: 'en',
    // True once the initial server load (or migration) has finished, so we
    // don't push back to the server while we're still hydrating local state.
    hydrated: false,
  }),

  getters: {
    currentWeek(state) {
      return state.weeks[state.currentWeekKey] || null
    },
  },

  actions: {
    ensureWeek(weekKey, referenceDate) {
      if (!this.weeks[weekKey]) {
        const dates = getWeekDates(referenceDate)
        this.weeks[weekKey] = createEmptyWeek(weekKey, dates, this.mealTypes)

        // Populate examples on first-ever load (no existing weeks before this one)
        const existingKeys = Object.keys(this.weeks)
        if (existingKeys.length === 1 && existingKeys[0] === weekKey) {
          this.populateExamples(weekKey)
        }
      }
    },

    populateExamples(weekKey) {
      const week = this.weeks[weekKey]
      if (!week) return

      for (const entry of EXAMPLE_DISHES) {
        const day = week.days[entry.dayIndex]
        if (!day) continue
        const meal = day.meals.find((m) => m.type === entry.mealType)
        if (!meal) continue
        meal.dishes.push({
          ...entry.dish,
          id: generateId(),
          ingredients: entry.dish.ingredients.map((i) => ({ ...i })),
          instructions: [...entry.dish.instructions],
        })
      }
    },

    setCurrentWeek(weekKey, referenceDate) {
      this.currentWeekKey = weekKey
      this.ensureWeek(weekKey, referenceDate)
    },

    addDish(weekKey, dayIndex, mealType, dish) {
      const week = this.weeks[weekKey]
      if (!week) return
      const day = week.days[dayIndex]
      if (!day) return
      const meal = day.meals.find((m) => m.type === mealType)
      if (!meal) return
      meal.dishes.push({ ...dish, id: dish.id || generateId() })
    },

    updateDish(weekKey, dayIndex, mealType, dishId, updates) {
      const week = this.weeks[weekKey]
      if (!week) return
      const day = week.days[dayIndex]
      if (!day) return
      const meal = day.meals.find((m) => m.type === mealType)
      if (!meal) return
      const idx = meal.dishes.findIndex((d) => d.id === dishId)
      if (idx === -1) return
      meal.dishes[idx] = { ...meal.dishes[idx], ...updates }
    },

    deleteDish(weekKey, dayIndex, mealType, dishId) {
      const week = this.weeks[weekKey]
      if (!week) return
      const day = week.days[dayIndex]
      if (!day) return
      const meal = day.meals.find((m) => m.type === mealType)
      if (!meal) return
      meal.dishes = meal.dishes.filter((d) => d.id !== dishId)
    },

    applyGeneratedPlan(weekKey, generatedDays) {
      const week = this.weeks[weekKey]
      if (!week) return

      for (const genDay of generatedDays) {
        const day = week.days[genDay.dayIndex]
        if (!day) continue

        for (const genMeal of genDay.meals) {
          const meal = day.meals.find((m) => m.type === genMeal.type)
          if (!meal) continue
          meal.dishes = [{
            ...genMeal.dish,
            id: generateId(),
            ingredients: genMeal.dish.ingredients.map((i) => ({ ...i })),
            instructions: [...genMeal.dish.instructions],
          }]
        }
      }
    },

    exportData() {
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        weeks: this.weeks,
        currentWeekKey: this.currentWeekKey,
        mealTypes: this.mealTypes,
        profile: this.profile,
      }
    },

    importData(payload) {
      if (!payload || typeof payload !== 'object') {
        return { success: false, error: 'Invalid file: not an object.' }
      }
      if (!payload.weeks || typeof payload.weeks !== 'object') {
        return { success: false, error: 'Invalid file: missing weeks.' }
      }
      if (!Array.isArray(payload.mealTypes)) {
        return { success: false, error: 'Invalid file: missing mealTypes.' }
      }
      this.weeks = payload.weeks
      this.mealTypes = payload.mealTypes
      if (typeof payload.currentWeekKey === 'string') {
        this.currentWeekKey = payload.currentWeekKey
      }
      if (payload.profile && typeof payload.profile === 'object') {
        this.profile = { ...DEFAULT_PROFILE, ...payload.profile }
      }
      return { success: true }
    },

    hydrate(payload) {
      if (payload && typeof payload === 'object') {
        if (payload.weeks && typeof payload.weeks === 'object') {
          this.weeks = payload.weeks
        }
        if (Array.isArray(payload.mealTypes) && payload.mealTypes.length) {
          this.mealTypes = payload.mealTypes
        }
        if (typeof payload.currentWeekKey === 'string') {
          this.currentWeekKey = payload.currentWeekKey
        }
        if (payload.profile && typeof payload.profile === 'object') {
          this.profile = { ...DEFAULT_PROFILE, ...payload.profile }
        }
        if (typeof payload.language === 'string') {
          this.language = payload.language
        }
      }
      this.hydrated = true
    },

    serialize() {
      return {
        version: 1,
        weeks: this.weeks,
        currentWeekKey: this.currentWeekKey,
        mealTypes: this.mealTypes,
        profile: this.profile,
        language: this.language,
      }
    },

    updateProfile(patch) {
      this.profile = { ...this.profile, ...patch }
    },

    setLanguage(language) {
      this.language = language
    },

    updateMealTypes(newMealTypes) {
      this.mealTypes = newMealTypes
      // Update existing weeks to reflect new meal type labels/times
      for (const weekKey in this.weeks) {
        const week = this.weeks[weekKey]
        for (const day of week.days) {
          for (const meal of day.meals) {
            const updated = newMealTypes.find((mt) => mt.type === meal.type)
            if (updated) {
              meal.label = updated.label
              meal.defaultTime = updated.defaultTime
            }
          }
        }
      }
    },
  },
})
