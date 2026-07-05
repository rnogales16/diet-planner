// Test profiles for the benchmark. Each is a RAW profile object (the same shape
// the app sends to /api/generate-meal-plan); the runner passes each through the
// production `sanitizeProfile()` before building the prompt, so what the models
// receive is identical to real app input.
//
// Fields (all optional, mirror the app):
//   goals: [] | string        calorieTarget/proteinTarget/carbsTarget/fatTarget/vegetableTarget: number
//   dietaryStyle: string       allergiesAndIntolerances: string   dislikedIngredients: [string]
//   trainingMode: string       enabledMeals: [mealType]           outsideMeals: [mealType]
//   servings: number           people: [{ name, calorieTarget, enabledMeals, ... }]
//   notes: string
// Meal types: breakfast, morning_snack, lunch, afternoon_snack, dinner.

export const PROFILES = [
  {
    id: 'bulking-athlete',
    label: 'Deportista en volumen (1p)',
    profile: {
      goals: ['gain_muscle'],
      dietaryStyle: 'omnivore',
      trainingMode: 'strength',
      calorieTarget: 3200,
      proteinTarget: 200,
      carbsTarget: 380,
      fatTarget: 90,
      vegetableTarget: 400,
      enabledMeals: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'],
      servings: 1,
      notes: 'Entreno fuerza 5 días/semana. Comidas saciantes y altas en proteína.',
    },
  },

  {
    id: 'family-of-4',
    label: 'Familia de 4 (comidas compartidas)',
    profile: {
      goals: ['maintain'],
      dietaryStyle: 'omnivore',
      trainingMode: 'general',
      calorieTarget: 2200, // persona principal
      proteinTarget: 120,
      enabledMeals: ['breakfast', 'lunch', 'afternoon_snack', 'dinner'],
      servings: 4,
      people: [
        { name: 'Adulto 2', calorieTarget: 2000, enabledMeals: ['breakfast', 'lunch', 'afternoon_snack', 'dinner'] },
        { name: 'Niño 1', calorieTarget: 1500, enabledMeals: ['breakfast', 'lunch', 'afternoon_snack', 'dinner'] },
        { name: 'Niño 2', calorieTarget: 1300, enabledMeals: ['breakfast', 'lunch', 'afternoon_snack', 'dinner'] },
      ],
      notes: 'Comidas familiares, recetas que funcionen para adultos y niños.',
    },
  },

  {
    id: 'weight-loss-deficit',
    label: 'Déficit / pérdida de peso (1p)',
    profile: {
      goals: ['lose_weight'],
      dietaryStyle: 'omnivore',
      trainingMode: 'general',
      calorieTarget: 1500,
      proteinTarget: 130,
      carbsTarget: 120,
      fatTarget: 50,
      vegetableTarget: 600,
      enabledMeals: ['breakfast', 'lunch', 'afternoon_snack', 'dinner'],
      servings: 1,
      notes: 'Alta saciedad, mucha verdura y proteína, bajo en calorías.',
    },
  },

  {
    id: 'vegan-allergies',
    label: 'Vegano + alergias (restricciones)',
    profile: {
      goals: ['maintain', 'health'],
      dietaryStyle: 'vegan',
      trainingMode: 'general',
      calorieTarget: 2000,
      proteinTarget: 110,
      vegetableTarget: 500,
      allergiesAndIntolerances: 'frutos secos, soja',
      dislikedIngredients: ['seitán', 'tofu'],
      enabledMeals: ['breakfast', 'morning_snack', 'lunch', 'dinner'],
      servings: 1,
      notes: 'Estrés-test de restricciones: 100% vegano, sin frutos secos ni soja, sin seitán ni tofu.',
    },
  },

  // ==========================================================================
  //  PERFIL 5 — MI PERFIL REAL (familia). RELLENAR / REVISAR.
  //  Sustituye estos valores por tu configuración real (la que usas en la app:
  //  Ajustes → perfil). Cuantas más personas y restricciones reales, mejor
  //  refleja el caso que de verdad te importa. Deja `skip: true` para excluirlo
  //  de la corrida hasta que lo completes.
  // ==========================================================================
  {
    id: 'my-real-family',
    label: 'MI PERFIL REAL (rellenar)',
    skip: true, // ← pon false cuando lo hayas completado
    profile: {
      goals: ['maintain'],          // RELLENAR
      dietaryStyle: 'omnivore',     // RELLENAR
      trainingMode: 'general',      // RELLENAR
      calorieTarget: null,          // RELLENAR (persona principal)
      proteinTarget: null,          // RELLENAR
      enabledMeals: ['breakfast', 'lunch', 'afternoon_snack', 'dinner'], // RELLENAR
      outsideMeals: [],             // RELLENAR (comidas que hacéis fuera de la app)
      allergiesAndIntolerances: '', // RELLENAR
      dislikedIngredients: [],      // RELLENAR
      servings: 1,                  // RELLENAR
      people: [
        // { name: 'Julia', calorieTarget: null, enabledMeals: [...] },  // RELLENAR
      ],
      notes: '',                    // RELLENAR
    },
  },
]
