// Generates a 7-day meal plan.
//
// Primary model for meal plan generation with fallback to Gemini.
// If the primary fails we fall back to Gemini on the free-tier key.
// — never the billed key — so failed attempts never cost money. The
// billed Gemini key is reserved for the chat and translate endpoints.

import { callGeminiWithFallback } from './_gemini.js'
import { callPrimaryLLM } from './_llm.js'
import { MERCADONA_MENU } from './_mercadona-menu.js'
import { recalculatePlan } from './_recalculate.js'
import { resolveUser } from './_user.js'

const PRIMARY_MODEL = 'claude-sonnet-4-6'
const GEMINI_FALLBACK_MODELS = ['gemini-2.5-pro']

// --- Per-user rate limiting --------------------------------------------------
// Generation is the only paid operation, so cap it per authenticated user to
// protect the LLM quota. Exceeding EITHER window returns 429. Tune here.
const RATE_LIMIT_WINDOWS = [
  { id: 'h', label: 'hora', max: 10, windowMs: 60 * 60 * 1000 },
  { id: 'd', label: 'día',  max: 30, windowMs: 24 * 60 * 60 * 1000 },
]

const GOAL_LABELS = {
  lose_weight: 'lose weight',
  gain_muscle: 'gain muscle',
  maintain: 'maintain weight',
  health: 'general health',
}

const STYLE_LABELS = {
  omnivore: 'omnivore',
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  pescatarian: 'pescatarian',
  mediterranean: 'mediterranean',
  keto: 'keto',
  paleo: 'paleo',
  other: 'unspecified',
}

const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish (español)',
}

const SUPPORTED_LANGS = new Set(['en', 'es'])

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function trim(value, max = 1500) {
  if (typeof value !== 'string') return ''
  return value.slice(0, max).trim()
}

function num(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(n, 10000)
}

// Static, catalog-bearing system prompt. No per-request interpolation, so it is
// byte-identical across every generation and forms a stable, cacheable prefix
// for prompt caching. The variable bits (language, meal types) live in
// buildSystemVariable and are appended AFTER this block (after the catalog).
const SYSTEM_STATIC = `You are a meticulous nutritionist and home cook. You design realistic, varied, healthy weekly meal plans for one person at a time. You respect every constraint the user gives you without exception. The user's profile is a hard contract, not a suggestion.

## Hard rules

Format:
- Output ONLY a single valid JSON object — no markdown, no code fences, no commentary.
- Exactly 7 days, dayIndex 0..6 (Monday..Sunday).
- Do NOT include any other meal types. Do NOT skip any of the listed types.
- Each meal has exactly 1 dish. Times in "HH:MM" 24h. All numeric fields are positive numbers.
- Ingredients are { "name": "...", "amount": "..." } with realistic weighable quantities (grams, ml, units).

BREVITY RULES (IMPORTANT — output must fit in a single response):
- Dish names: max 6 words. No marketing adjectives.
- Ingredient names: the common cooking name only (e.g. "chicken breast", not "organic boneless skinless chicken breast"). Max 4 words.
- Instructions: 3 to 5 short steps per dish, each step max 18 words. No introductions, no "enjoy", no "tips".
- Notes field: for single-person meals leave empty unless strictly necessary. For multi-person meals, use the notes field for per-person macro breakdown (see MULTI-PERSON rules below).
- Shopping list entries: name max 3 words, amount compact ("350g", "2 units", "500ml").
- No duplicate dish names across the week. Vary cuisines, cooking methods and main proteins.
- Allergies and dietary restrictions are absolute. Never include a forbidden ingredient.
- Disliked ingredients listed by the user are also absolute. Never include them, not even in trace amounts, not even in smoothies, dressings or garnishes. Treat them as if they were poisonous to the user. Check every ingredient name and dish name before finalising.

COOKED WEIGHT ESTIMATE:
- Each dish must include a "cookedWeight" string field estimating the total weight of the finished dish after cooking.
- For 1 person: just the weight, e.g. "380g".
- For multiple people: total + per-person split, e.g. "Total: 650g (Person 1: 380g, Person 2: 270g)".
- This is an estimate based on typical water loss/gain during cooking. Pasta and rice gain weight, meat loses weight.
- Write it in the user's language.

MULTI-PERSON INGREDIENT & MACRO BREAKDOWN:
When a meal is eaten by more than one person:
- Each ingredient's "amount" field MUST show the total followed by the per-person split in parentheses. Format: "250g (150g + 100g)" where the first number is Person 1's share and the second is Person 2's share, in the same order as the people are listed. This lets each person know exactly how much to eat if they end up eating separately.
- The dish's top-level macro fields (calories, protein, carbs, fat, vegetables) are the TOTAL for all people combined.
- The "notes" field MUST contain a per-person macro summary, e.g.: "Person 1: 480 kcal, 35g P, 50g C, 15g F | Julia: 320 kcal, 25g P, 35g C, 10g F". Keep it on one line, compact.
- The "cookedWeight" field shows total + per-person split as described above.
- For single-person meals, do NOT add any of this — just use normal amounts.

CATALOG WEIGHTS — "AS SOLD":
- The catalog macros are for the product AS SOLD. Use them directly without any cooked/raw conversion.
- Most products are sold raw/dry: pasta (361 kcal/100g dry), rice (352 kcal/100g dry), fresh chicken breast (108 kcal/100g raw), etc. For these, the ingredient weight you write is the weight BEFORE cooking.
- A few products are sold pre-cooked and have lower kcal: e.g. "Garbanzo cocido Hacendado" (90 kcal/100g, ready to eat from the can) vs "Garbanzo Hacendado" (348 kcal/100g, dry — needs soaking + cooking). Same for "Lenteja cocida" vs "Lenteja", "Patatas cocidas", "Huevos cocidos". Pick the form that matches your recipe and weigh AS SOLD.
- Do NOT use cooked weights for products that are sold raw/dry — write 100g of dry pasta if the recipe uses 100g pasta, never 250g of "cooked pasta".
- Do NOT mentally drain canned fish in oil: if the catalog says 363 kcal/100g for "Atún en aceite de oliva", that is the macros INCLUDING the oil; don't subtract it. If you want a leaner protein, use "Atún claro al natural" or "Salmón al natural" instead.

## Macro targets (CRITICAL)

The user provides daily targets for calories, protein, carbs, fat AND vegetables. These are HARD CONSTRAINTS.

- TIGHT TOLERANCES — both must be satisfied:
  * Each individual dish: stated calories MUST equal the sum of ingredient contributions within ±10% (i.e. the macroBreakdown you write must add up to the dish's calories field within 10%).
  * Each day's total (sum of all dish calories): MUST land within ±5% of the user's combined daily target — for calories, protein, carbs, fat AND vegetables.
  * If any constraint is violated, FIX the quantities before outputting. Do not output a plan that fails these.
- Do NOT normalize the user's macro split toward a "typical" distribution. If the user asks for a high-carb low-fat plan, deliver exactly that. If they ask for keto, deliver that. The targets always win over your defaults.
- Per-meal distribution: the user prompt provides exact per-meal kcal targets if available. Use those as primary guide. Otherwise default hierarchy:
  * LUNCH biggest (~30-35% of daily kcal), BREAKFAST second (~22-25%), DINNER lighter than lunch (~20-25%), SNACKS small (~8-12% each). When snacks disabled, redistribute their share to lunch and breakfast — NOT to dinner.
- INGREDIENT SOURCING — MERCADONA ONLY:
  * The user shops exclusively at Mercadona (Spanish supermarket). You will receive a catalog of available products at the end of this prompt.
  * Every single ingredient you use MUST come from that catalog. Do NOT invent ingredients, do NOT use brands or products not listed.
  * Each ingredient's "name" field must match the product name from the catalog as closely as possible (you may shorten it for readability — e.g. "Pechuga de pollo Hacendado" → "Pechuga de pollo" — but never invent products that aren't there).
  * If a desired ingredient (e.g. a specific spice or sauce) isn't in the catalog, pick the closest equivalent that IS in the catalog. Never use a placeholder.
- FORBIDDEN INGREDIENTS — DERIVATIVES INCLUDED:
  * If the user lists "lentejas" as forbidden, ALSO exclude derivatives: pasta de lentejas, harina de lentejas, hummus de lentejas, etc.
  * If "coliflor" is forbidden, exclude products that contain coliflor in their composition (e.g. "Migas de coliflor"). Skip the entire product, do not try to reuse it.
  * Apply this expansion to every forbidden item: prohibition covers the ingredient, its derivatives (flours, pastas, milks), and any catalog product whose name or composition includes it.
- MACRO MATH — USE THE CATALOG VALUES + WRITE THE BREAKDOWN:
  * The catalog gives macros per 100g (or per 100ml for liquids) for each product. Multiply each ingredient's weight × the per-100g value to get its contribution. Sum to get the dish total.
  * For every dish you MUST output a "macroBreakdown" array with one entry per ingredient using COMPACT KEYS to save tokens: { "i": ingredient_name, "g": grams, "k": kcal, "p": protein, "c": carbs, "f": fat }. The "g" field is the AS-SOLD weight (matches the "amount" field). The k/p/c/f are this ingredient's contribution to the dish total. Writing this is non-negotiable — it forces explicit math.
  * Verify after each dish: sum of macroBreakdown[*].k must equal dish.calories within ±10%. If not, fix the quantities and rewrite the breakdown.
  * Common mistake: 100g dry pasta ≈ 350 kcal, NOT 150 kcal. Use the catalog's per-100g value, never your memory.

VEGETABLES FIELD:
- Each dish has a numeric "vegetables" field representing the total grams of vegetables (raw weight) inside that dish.
- A "vegetable" for this purpose is any plant-based ingredient that isn't a fruit, nut, seed, grain, legume, herb-as-spice or starch tuber prepared as a starch (e.g. french fries don't count). Leafy greens, brassicas, peppers, onions, tomato, cucumber, courgette, carrots, mushrooms, etc. all count.
- Sum the raw grams of those ingredients and report it accurately in the vegetables field for each dish.

If no targets are provided, default to ≈2000 kcal/day with a balanced 30P / 45C / 25F split and ~400g of vegetables per day.

## Shopping list

At the end of the JSON, include a "shoppingList" array that aggregates every ingredient used across all 7 days into a single grocery list. Rules:
- Merge duplicates across dishes and days: if Monday lunch uses 150g of chicken breast and Wednesday dinner uses 200g, the shopping list has one "chicken breast" entry with "350g" total.
- Use RAW weights (same as the dish ingredients). The user will buy and weigh raw.
- Round quantities to sensible shopping amounts (whole grams, 50g or 100g steps where it makes sense, whole units for things like eggs/lemons).
- Normalise names to the shoppable form (e.g. "red pepper" not "sliced red pepper"). Keep names in the user's language.
- Classify each item in a "category": "vegetables", "fruits", "protein", "dairy", "grains_and_pasta", "legumes", "nuts_and_seeds", "pantry", "herbs_and_spices", "oils_and_condiments", "frozen", "beverages", "bakery", "other". Use exactly one of these keys.
- Do NOT include tap water, salt, or pepper in the shopping list.

Output JSON shape (exact field names, order does not matter):
{
  "days": [
    {
      "dayIndex": 0,
      "meals": [
        {
          "type": "breakfast",
          "dish": {
            "name": "string",
            "time": "HH:MM",
            "calories": number,
            "protein": number,
            "carbs": number,
            "fat": number,
            "vegetables": number,
            "cookedWeight": "string — estimated total cooked weight of the finished dish, e.g. '380g' for 1 person or 'Total: 650g (Person 1: 380g, Person 2: 270g)' for multiple",
            "notes": "string (may be empty)",
            "prepTime": number,
            "cookTime": number,
            "servings": number,
            "ingredients": [{ "name": "string", "amount": "string" }],
            "macroBreakdown": [
              { "i": "string (matches an ingredient name)", "g": number, "k": number, "p": number, "c": number, "f": number }
            ],
            "instructions": ["string", "..."]
          }
        }
      ]
    }
  ],
  "shoppingList": [
    { "name": "string", "amount": "string", "category": "vegetables" }
  ]
}

---

${MERCADONA_MENU}

---

REMINDER: every ingredient you use across all 7 days must come from the Mercadona catalog above. Use the per-100g macro values printed there to compute each dish's calories, protein, carbs and fat — do not estimate from memory. The shopping list at the end of your response must aggregate items using names that map back to catalog products.`

// The small per-request variable part: language + enabled meal types. Kept out
// of SYSTEM_STATIC so that prefix stays cacheable; appended after the catalog.
export function buildSystemVariable(language, enabledMealTypes) {
  const langName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en
  const typesJoined = enabledMealTypes.join(', ')
  return `LANGUAGE: All human-readable strings in your response (dish names, notes, ingredient names and amounts, instructions, shopping list) MUST be written in ${langName}. Do not translate the JSON keys themselves — those must stay in English exactly as specified below. The "type" field of each meal must also stay in English.

- Exactly ${enabledMealTypes.length} meal(s) per day, with these exact types in this order: ${typesJoined}.`
}

// Full system prompt = stable prefix + variable suffix. Same content as before,
// just reordered so the stable/catalog part comes first (cacheable).
export function buildSystemPrompt(language, enabledMealTypes) {
  return `${SYSTEM_STATIC}

${buildSystemVariable(language, enabledMealTypes)}`
}

// Per-meal calorie share by training mode. Each table sums to 100 across
// the standard 5 meal slots; values get renormalised to whatever subset
// of meals the person actually eats.
//   general   — balanced, lunch-heaviest, lighter dinner (insulin/sleep)
//   endurance — carb-loaded dinner for next-day morning training
//   strength  — protein-spread, snacks slightly bigger
const MEAL_SHARE_BY_MODE = {
  general:   { breakfast: 25, morning_snack: 10, lunch: 33, afternoon_snack: 10, dinner: 22 },
  endurance: { breakfast: 22, morning_snack: 10, lunch: 25, afternoon_snack: 10, dinner: 33 },
  strength:  { breakfast: 22, morning_snack: 12, lunch: 28, afternoon_snack: 12, dinner: 26 },
}

function shareTableFor(mode) {
  return MEAL_SHARE_BY_MODE[mode] || MEAL_SHARE_BY_MODE.general
}

function computePerMealTargets(allPeople, enabledMealTypes) {
  // For each meal type, sum the calorie portion from each person who eats it,
  // using THAT person's training-mode share table.
  //
  // A person's daily target distributes across ALL meals they actually eat
  // (in-plan + outside-plan). Meals they eat outside this app subtract their
  // share from the in-plan totals — so e.g. Julia 1250 kcal eating breakfast
  // outside doesn't dump 1250 into just lunch+dinner.
  const result = []
  for (const type of enabledMealTypes) {
    let kcal = 0
    const parts = []
    for (const person of allPeople) {
      const inPlan = (person.enabledMeals && person.enabledMeals.length) ? person.enabledMeals : enabledMealTypes
      if (!inPlan.includes(type)) continue
      const outside = Array.isArray(person.outsideMeals) ? person.outsideMeals : []
      const allEats = Array.from(new Set([...inPlan, ...outside]))
      const shareTable = shareTableFor(person.trainingMode)
      const totalShare = allEats.reduce((s, m) => s + (shareTable[m] || 0), 0)
      // Edge case: none of the meals this person eats has a share in their
      // training-mode table (totalShare === 0). This can happen when the
      // enabledMeals/outsideMeals combination leaves a subset with no mapped
      // shares. Dividing by zero would yield NaN and poison the kcal targets,
      // so fall back to an even split (1/n) across the meals they actually eat.
      const personShare = totalShare > 0
        ? (shareTable[type] || 0) / totalShare
        : 1 / allEats.length
      const personKcal = Math.round((person.calorieTarget || 0) * personShare)
      kcal += personKcal
      parts.push(`${person.name || 'Person'} ${personKcal}`)
    }
    if (kcal > 0) {
      result.push({
        type,
        kcal,
        breakdown: parts.length > 1 ? parts.join(' + ') : parts[0] || `${kcal}`,
      })
    }
  }
  return result
}

export function buildUserPrompt({ profile, fridgeContents, weeklyExtras, enabledMealTypes, correctiveNote, language }) {
  const p = profile || {}
  const langName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en

  const lines = [
    `Generate a 7-day meal plan tailored to this person. Each day must have exactly ${enabledMealTypes.length} meal(s): ${enabledMealTypes.join(', ')}.`,
    `Write all human-readable text (dish names, ingredients, instructions, shopping list) in ${langName}.`,
    '',
    '**Treat every line of this profile as a HARD REQUIREMENT.** Do not second-guess the user. Do not soften their constraints toward "normal" values. Do not skip any of the listed targets.',
  ]

  // Disliked / forbidden ingredients go first, in an impossible-to-miss block.
  const allergiesRaw = (p.allergiesAndIntolerances || p.allergies || '').trim()
  const disliked = Array.isArray(p.dislikedIngredients) ? p.dislikedIngredients : []
  const forbidden = [
    ...(allergiesRaw ? allergiesRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : []),
    ...disliked,
  ]
  if (forbidden.length) {
    lines.push('')
    lines.push('## FORBIDDEN INGREDIENTS — ABSOLUTE RULE')
    lines.push('The following ingredients MUST NOT appear anywhere in the response — not in dish names, not in ingredients lists, not in instructions, not even in trace amounts. This is a zero-tolerance rule. If you are about to include one of these, pick a different ingredient instead.')
    for (const item of forbidden) {
      lines.push(`- ${item}`)
    }
    lines.push('Before outputting the JSON, scan every dish name and every ingredient to make sure NONE of the forbidden items appear.')
  }

  // Profile section
  lines.push('\n## Diet profile')

  if (Array.isArray(p.goals) && p.goals.length) {
    const labels = p.goals.map((g) => GOAL_LABELS[g] || g)
    lines.push(`- Goals: ${labels.join(' AND ')}`)
  }
  if (p.dietaryStyle) lines.push(`- Dietary style: ${STYLE_LABELS[p.dietaryStyle] || p.dietaryStyle}`)
  if (p.favourites) lines.push(`- Favourite foods (use often): ${p.favourites}`)
  if (p.cuisines) lines.push(`- Preferred cuisines: ${p.cuisines}`)

  const targets = []
  if (p.calorieTarget) targets.push(`${p.calorieTarget} kcal`)
  if (p.proteinTarget) targets.push(`${p.proteinTarget}g protein`)
  if (p.carbsTarget) targets.push(`${p.carbsTarget}g carbs`)
  if (p.fatTarget) targets.push(`${p.fatTarget}g fat`)
  if (p.vegetableTarget) targets.push(`${p.vegetableTarget}g vegetables`)
  // Build the people list: primary user + any additional people
  const primaryMeals = Array.isArray(p.enabledMeals) && p.enabledMeals.length > 0
    ? p.enabledMeals
    : enabledMealTypes
  const allPeople = [{
    name: 'Person 1',
    calorieTarget: p.calorieTarget,
    proteinTarget: p.proteinTarget,
    carbsTarget: p.carbsTarget,
    fatTarget: p.fatTarget,
    vegetableTarget: p.vegetableTarget,
    enabledMeals: primaryMeals,
    outsideMeals: Array.isArray(p.outsideMeals) ? p.outsideMeals : [],
    trainingMode: p.trainingMode || 'general',
  }]
  if (Array.isArray(p.people)) {
    for (const person of p.people) {
      if (person.name || person.calorieTarget) {
        allPeople.push({
          ...person,
          outsideMeals: Array.isArray(person.outsideMeals) ? person.outsideMeals : [],
          trainingMode: person.trainingMode || 'general',
        })
      }
    }
  }

  if (allPeople.length > 1) {
    lines.push('')
    lines.push(`### COOKING FOR ${allPeople.length} PEOPLE — each person has different targets AND may not eat every meal`)
    lines.push('')

    // List each person with their targets and meals
    for (let i = 0; i < allPeople.length; i++) {
      const person = allPeople[i]
      const name = person.name || `Person ${i + 1}`
      const personTargets = []
      if (person.calorieTarget) personTargets.push(`${person.calorieTarget} kcal`)
      if (person.proteinTarget) personTargets.push(`${person.proteinTarget}g P`)
      if (person.carbsTarget) personTargets.push(`${person.carbsTarget}g C`)
      if (person.fatTarget) personTargets.push(`${person.fatTarget}g F`)
      if (person.vegetableTarget) personTargets.push(`${person.vegetableTarget}g V`)

      const meals = Array.isArray(person.enabledMeals) && person.enabledMeals.length > 0
        ? person.enabledMeals.join(', ')
        : 'all meals'
      const modeNote = person.trainingMode && person.trainingMode !== 'general'
        ? ` — training mode: ${person.trainingMode} (carb-loading evening for endurance / spread protein for strength)`
        : ''
      lines.push(`- ${name}: ${personTargets.join(' · ')} — eats: ${meals}${modeNote}`)
    }

    // Per-meal breakdown: who eats what
    lines.push('')
    lines.push('PER-MEAL INSTRUCTIONS:')
    for (const mealType of enabledMealTypes) {
      const eaters = []
      for (let i = 0; i < allPeople.length; i++) {
        const person = allPeople[i]
        const name = person.name || `Person ${i + 1}`
        const personMeals = Array.isArray(person.enabledMeals) ? person.enabledMeals : enabledMealTypes
        if (personMeals.includes(mealType)) eaters.push(name)
      }
      if (eaters.length === 0) {
        lines.push(`- ${mealType}: no one eats this — skip it.`)
      } else if (eaters.length === 1) {
        lines.push(`- ${mealType}: only ${eaters[0]} eats this. Size the dish for 1 person only.`)
      } else {
        lines.push(`- ${mealType}: ${eaters.join(' + ')} eat this. Size the dish for ${eaters.length} people combined. Each ingredient amount must show total + per-person split, e.g. "250g (150g + 100g)". Notes must contain per-person macro summary.`)
      }
    }

    lines.push('')
    lines.push('The dish macros must reflect the TOTAL for everyone eating that specific meal.')
    lines.push('The cookedWeight must also show per-person amounts for multi-person meals.')
    lines.push('Do NOT normalize these toward typical ratios. Each person picked their targets on purpose.')

    // Per-meal exact kcal targets — sum across all people that eat each meal.
    const mealTargets = computePerMealTargets(allPeople, enabledMealTypes)
    const dayTotal = mealTargets.reduce((s, m) => s + m.kcal, 0)
    if (dayTotal > 0) {
      lines.push('')
      lines.push('### EXACT PER-MEAL KCAL TARGETS — dish.calories MUST hit these (±10% per dish, ±5% on day total)')
      for (const m of mealTargets) {
        lines.push(`- ${m.type}: ${m.kcal} kcal  (${m.breakdown})`)
      }
      lines.push(`- DAY TOTAL: ${dayTotal} kcal  (must be within ±5%)`)
    }
  } else if (targets.length) {
    lines.push('')
    lines.push(`### MANDATORY DAILY TARGETS — must be met within ±10% every day`)
    lines.push(`${targets.join(' · ')}`)
    if (p.calorieTarget && p.proteinTarget && p.carbsTarget && p.fatTarget) {
      const macroKcal = p.proteinTarget * 4 + p.carbsTarget * 4 + p.fatTarget * 9
      const gap = Math.abs(macroKcal - p.calorieTarget)
      if (gap > p.calorieTarget * 0.05) {
        const scale = p.calorieTarget / macroKcal
        const adjP = Math.round(p.proteinTarget * scale)
        const adjC = Math.round(p.carbsTarget * scale)
        const adjF = Math.round(p.fatTarget * scale)
        lines.push('')
        lines.push(`IMPORTANT: the stated macros add up to ~${macroKcal} kcal, but the target is ${p.calorieTarget} kcal. THE CALORIE TARGET IS PRIMARY. Use adjusted macros: ~${adjP}g P, ~${adjC}g C, ~${adjF}g F.`)
      }
    }
    lines.push('Do NOT normalize these toward typical ratios. The user picked these targets on purpose.')

    // Per-meal exact kcal targets for the single-person case.
    const onlyPerson = [{ name: 'Person 1', calorieTarget: p.calorieTarget, enabledMeals: primaryMeals, outsideMeals: Array.isArray(p.outsideMeals) ? p.outsideMeals : [], trainingMode: p.trainingMode || 'general' }]
    const mealTargets = computePerMealTargets(onlyPerson, enabledMealTypes)
    const dayTotal = mealTargets.reduce((s, m) => s + m.kcal, 0)
    if (dayTotal > 0) {
      lines.push('')
      lines.push('### EXACT PER-MEAL KCAL TARGETS — dish.calories MUST hit these (±10% per dish, ±5% on day total)')
      for (const m of mealTargets) {
        lines.push(`- ${m.type}: ${m.kcal} kcal  (${m.breakdown})`)
      }
      lines.push(`- DAY TOTAL: ${dayTotal} kcal  (must be within ±5%)`)
    }
  }
  if (p.maxCookTime) {
    lines.push(`- Max time per meal (prep + cook combined): ${p.maxCookTime} minutes`)
  }
  if (p.notes) lines.push(`- Additional notes: ${p.notes}`)

  if (lines.length === 2) {
    lines.push('- (no profile set, use balanced defaults)')
  }

  if (correctiveNote) {
    lines.push('')
    lines.push('## CORRECTION FROM PREVIOUS ATTEMPT')
    lines.push(correctiveNote)
    lines.push('Generate the plan again from scratch. Do NOT repeat the mistake.')
  }

  // Weekly context
  if (fridgeContents || weeklyExtras) {
    lines.push('\n## This week')
    if (fridgeContents) lines.push(`- Already in the fridge / pantry (build around this when reasonable): ${fridgeContents}`)
    if (weeklyExtras) lines.push(`- Special context for this week: ${weeklyExtras}`)
  }

  lines.push('\nRespond with ONLY the JSON object described in the system prompt.')
  return lines.join('\n')
}

const VALID_GOALS = new Set(['lose_weight', 'gain_muscle', 'maintain', 'health'])
const VALID_TRAINING_MODES = new Set(['general', 'endurance', 'strength'])

function sanitizeTrainingMode(raw) {
  return VALID_TRAINING_MODES.has(raw) ? raw : 'general'
}

function sanitizePerson(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    name: trim(raw.name, 60),
    calorieTarget: num(raw.calorieTarget),
    proteinTarget: num(raw.proteinTarget),
    carbsTarget: num(raw.carbsTarget),
    fatTarget: num(raw.fatTarget),
    vegetableTarget: num(raw.vegetableTarget),
    enabledMeals: Array.isArray(raw.enabledMeals) ? raw.enabledMeals.filter((m) => typeof m === 'string') : null,
    outsideMeals: Array.isArray(raw.outsideMeals) ? raw.outsideMeals.filter((m) => typeof m === 'string') : [],
    trainingMode: sanitizeTrainingMode(raw.trainingMode),
  }
}

function sanitizeGoals(raw) {
  if (Array.isArray(raw)) {
    return raw.filter((g) => typeof g === 'string' && VALID_GOALS.has(g)).slice(0, 4)
  }
  // Legacy single-string goal
  if (typeof raw === 'string' && VALID_GOALS.has(raw)) return [raw]
  return []
}

// Validate that each dish's macroBreakdown sums to its stated calories
// within ±10%. Returns a list of violations to feed back to the LLM.
function validateMacroBreakdown(plan) {
  const violations = []
  if (!plan || !Array.isArray(plan.days)) return violations
  for (const day of plan.days) {
    if (!Array.isArray(day.meals)) continue
    for (const meal of day.meals) {
      const dish = meal?.dish
      if (!dish) continue
      const stated = Number(dish.calories) || 0
      if (stated < 50) continue  // skip negligible dishes
      if (!Array.isArray(dish.macroBreakdown) || dish.macroBreakdown.length === 0) {
        violations.push({
          dayIndex: day.dayIndex,
          mealType: meal.type,
          dishName: dish.name || '(unnamed)',
          reason: 'macroBreakdown is missing or empty',
        })
        continue
      }
      const sumKcal = dish.macroBreakdown.reduce((s, b) => s + (Number(b.k ?? b.kcal) || 0), 0)
      const drift = Math.abs(sumKcal - stated) / stated
      if (drift > 0.10) {
        violations.push({
          dayIndex: day.dayIndex,
          mealType: meal.type,
          dishName: dish.name || '(unnamed)',
          stated,
          breakdownSum: Math.round(sumKcal),
          driftPct: Math.round((sumKcal - stated) / stated * 100),
        })
      }
    }
  }
  return violations
}

function buildBreakdownCorrectiveNote(violations) {
  const lines = [
    'Your previous response had macroBreakdown values that did not match the dish calories. Fix every violation listed below and re-output the entire plan.',
    'For each dish: sum(macroBreakdown[*].kcal) MUST equal dish.calories within ±10%. Either adjust the breakdown numbers (if the calories are correct) or adjust the ingredient quantities (if the breakdown is correct). Then keep both consistent.',
    '',
  ]
  for (const v of violations.slice(0, 15)) {
    if (v.reason) {
      lines.push(`- Day ${v.dayIndex} ${v.mealType} "${v.dishName}": ${v.reason}`)
    } else {
      lines.push(`- Day ${v.dayIndex} ${v.mealType} "${v.dishName}": dish.calories=${v.stated} but macroBreakdown sums to ${v.breakdownSum} (drift ${v.driftPct >= 0 ? '+' : ''}${v.driftPct}%)`)
    }
  }
  if (violations.length > 15) lines.push(`- (and ${violations.length - 15} more — fix all of them)`)
  return lines.join('\n')
}

export function extractJsonLoose(text) {
  try { return JSON.parse(text) } catch { /* */ }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) {
    try { return JSON.parse(fence[1].trim()) } catch { /* */ }
  }
  const a = text.indexOf('{')
  const b = text.lastIndexOf('}')
  if (a !== -1 && b > a) {
    try { return JSON.parse(text.slice(a, b + 1)) } catch { /* */ }
  }
  // Last resort: the response was truncated mid-stream. Try to repair by
  // dropping the trailing incomplete fragment and closing open brackets.
  // Strip a leading ```json fence (with or without closing) and salvage
  // everything from the first '{' to the last balanced position.
  let body = text.replace(/^[\s\S]*?```(?:json)?\s*/, '').replace(/```[\s\S]*$/, '')
  const start = body.indexOf('{')
  if (start === -1) return null
  body = body.slice(start)
  // Walk the string, tracking nesting; cut at the last position where the
  // structure was syntactically valid (after a complete value).
  let depth = 0
  let inStr = false
  let esc = false
  let lastSafe = -1
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (esc) { esc = false; continue }
    if (ch === '\\') { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) lastSafe = i
    }
    // After a comma at depth 1+, the previous element was complete — safe to cut.
    else if (ch === ',' && depth > 0) lastSafe = i - 1
  }
  if (lastSafe < 0) return null
  // Try increasing-precision repair: cut at lastSafe and append closing brackets.
  let candidate = body.slice(0, lastSafe + 1)
  // Re-count nesting to know how many brackets to close.
  let d = 0
  let stack = []
  inStr = false; esc = false
  for (const ch of candidate) {
    if (esc) { esc = false; continue }
    if (ch === '\\') { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }
  // Trim a trailing comma if present, then close all open brackets.
  candidate = candidate.replace(/,\s*$/, '')
  while (stack.length) candidate += stack.pop()
  try { return JSON.parse(candidate) } catch { return null }
}

// Normalise for matching: lowercase, strip diacritics, collapse whitespace.
function normaliseText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Scans every dish in the plan for any of the forbidden terms. Returns a
// short list of { term, where } violations so the caller can feed them back
// to the model in a corrective retry.
function scanForForbidden(plan, forbiddenList) {
  if (!plan || !Array.isArray(plan.days) || forbiddenList.length === 0) return []
  const needles = forbiddenList
    .map((t) => normaliseText(t))
    .filter(Boolean)
  if (needles.length === 0) return []

  const hits = []
  for (const day of plan.days) {
    if (!Array.isArray(day.meals)) continue
    for (const meal of day.meals) {
      const dish = meal?.dish || {}
      const haystacks = []
      if (dish.name) haystacks.push(['name', dish.name])
      if (Array.isArray(dish.ingredients)) {
        for (const ing of dish.ingredients) {
          if (ing?.name) haystacks.push(['ingredient', ing.name])
        }
      }
      if (Array.isArray(dish.instructions)) {
        for (const step of dish.instructions) {
          if (step) haystacks.push(['instruction', step])
        }
      }
      for (const [where, haystack] of haystacks) {
        const normalised = normaliseText(haystack)
        for (const needle of needles) {
          // Word-ish boundary check: the needle must appear surrounded by
          // non-letter characters (or at string edges). This avoids false
          // positives like 'ajo' matching 'ajonjolí'.
          const re = new RegExp(`(^|[^a-zA-Z])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zA-Z]|$)`)
          if (re.test(normalised)) {
            hits.push({ term: needle, where, dish: dish.name || '(unnamed)' })
            break
          }
        }
      }
    }
  }
  // Dedupe by (term, dish)
  const seen = new Set()
  return hits.filter((h) => {
    const key = `${h.term}|${h.dish}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function sanitizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return {}
  // favourites: accept both string (legacy) and array
  let favourites = ''
  if (Array.isArray(raw.favourites)) {
    favourites = raw.favourites.map((s) => trim(s, 100)).filter(Boolean).join(', ')
  } else {
    favourites = trim(raw.favourites, 500)
  }
  return {
    goals: sanitizeGoals(raw.goals ?? raw.goal),
    dietaryStyle: trim(raw.dietaryStyle, 40),
    allergiesAndIntolerances: trim(raw.allergiesAndIntolerances || raw.allergies || '', 500),
    favourites,
    cuisines: trim(raw.cuisines, 500),
    calorieTarget: num(raw.calorieTarget),
    proteinTarget: num(raw.proteinTarget),
    carbsTarget: num(raw.carbsTarget),
    fatTarget: num(raw.fatTarget),
    vegetableTarget: num(raw.vegetableTarget),
    enabledMeals: Array.isArray(raw.enabledMeals) ? raw.enabledMeals.filter((m) => typeof m === 'string') : null,
    outsideMeals: Array.isArray(raw.outsideMeals) ? raw.outsideMeals.filter((m) => typeof m === 'string') : [],
    servings: num(raw.servings) || 1,
    maxCookTime: num(raw.maxCookTime),
    notes: trim(raw.notes, 1000),
    dislikedIngredients: Array.isArray(raw.dislikedIngredients)
      ? raw.dislikedIngredients
          .map((s) => trim(s, 100))
          .filter(Boolean)
          .slice(0, 100)
      : [],
    trainingMode: sanitizeTrainingMode(raw.trainingMode),
    people: Array.isArray(raw.people)
      ? raw.people.map(sanitizePerson).filter(Boolean)
      : [],
  }
}

export async function onRequestPost({ request, env }) {
  // Authenticate first — we need the email to rate-limit per user, and the
  // verification status to cap generation.
  const auth = await resolveUser(request, env)
  if (!auth) return json({ success: false, error: 'Not authenticated.' }, 401)
  // Cap the paid operation until the email is verified. Access users are treated
  // as verified (see resolveUser). Returns a clear 403, never an LLM call.
  if (!auth.emailVerified) {
    return json({
      success: false,
      code: 'email_not_verified',
      error: 'Verifica tu email para generar planes. Te enviamos un enlace al registrarte; revisa tu correo o pide reenviarlo.',
    }, 403)
  }
  const email = auth.email

  let body
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400)
  }

  const profile = sanitizeProfile(body.profile)
  const fridgeContents = trim(body.fridgeContents, 2000)
  const weeklyExtras = trim(body.weeklyExtras, 2000)
  const language = SUPPORTED_LANGS.has(body.language) ? body.language : 'en'

  const VALID_MEAL_TYPES = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']
  let enabledMealTypes = Array.isArray(body.enabledMealTypes)
    ? body.enabledMealTypes.filter((t) => VALID_MEAL_TYPES.includes(t))
    : VALID_MEAL_TYPES
  if (enabledMealTypes.length === 0) enabledMealTypes = VALID_MEAL_TYPES
  enabledMealTypes = VALID_MEAL_TYPES.filter((t) => enabledMealTypes.includes(t))

  const systemPrompt = buildSystemPrompt(language, enabledMealTypes)

  const allergyList = (profile.allergiesAndIntolerances || profile.allergies || '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const forbiddenList = [...allergyList, ...(profile.dislikedIngredients || [])]

  const userPrompt = buildUserPrompt({ profile, fridgeContents, weeklyExtras, enabledMealTypes, language })

  // Per-user rate limit. Bumped here, BEFORE any LLM call, so it counts paid
  // attempts (cost is incurred on the call) — a run of LLM failures still
  // consumes quota, which is intentional for a cost guard rail.
  const rl = await checkAndIncrement(env, email)
  if (!rl.ok) {
    return new Response(JSON.stringify({
      success: false,
      error: `Has alcanzado el límite de generaciones (${rl.max}/${rl.label}). Inténtalo de nuevo en ${formatRetryAfter(rl.retryAfter)}.`,
      retryAfter: rl.retryAfter,
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
    })
  }

  // --- SSE streaming response ---
  // Return headers immediately so Cloudflare's 100s proxy timeout never fires.
  // Send keepalive comments every 10s while the LLM generates, then send the
  // final result as a single SSE "data" event.

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  const write = (str) => writer.write(encoder.encode(str))

  // Start the keepalive + LLM work in the background
  const keepaliveInterval = setInterval(() => {
    write(': keepalive\n\n').catch(() => {})
  }, 10000)

  // Run the LLM calls and write the final result
  ;(async () => {
    try {
      const allAttempts = []
      const providerErrors = []

      const primaryResult = await callPrimaryLLM({
        env,
        model: PRIMARY_MODEL,
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.7,
        maxTokens: 32000,
        cacheSystem: true,
      })
      allAttempts.push({
        model: PRIMARY_MODEL,
        keyIndex: 0,
        status: primaryResult.ok ? 200 : primaryResult.status,
        error: primaryResult.error || null,
      })
      if (!primaryResult.ok) {
        providerErrors.push(`PRIMARY LLM ERROR → status=${primaryResult.status} body=${primaryResult.error || 'unknown'}`)
      }

      let result = primaryResult
      let usedProvider = 'primary'

      if (!result.ok) {
        result = await callGeminiWithFallback({
          env,
          models: GEMINI_FALLBACK_MODELS,
          freeOnly: true,
          timeoutMs: 18000,
          payload: {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.7,
              topP: 0.9,
              responseMimeType: 'application/json',
              maxOutputTokens: 16384,
            },
          },
        })
        usedProvider = 'gemini'
        if (result.attempts) {
          allAttempts.push(...result.attempts)
          for (const a of result.attempts) {
            if (a.status >= 400) {
              providerErrors.push(`${a.model}/k${a.keyIndex}: ${a.status}`)
            }
          }
        }
      }

      let payload

      if (!result.ok) {
        const summary = allAttempts.map((a) => `${a.model}/k${a.keyIndex}=${a.status}`).join(' ')
        const lastError = result.error || 'unknown'
        const detailLines = providerErrors.length > 0
          ? ` | Details: ${providerErrors.join(' || ')}`
          : ''
        payload = { success: false, error: `Upstream error: ${lastError} [${summary}]${detailLines}`, attempts: allAttempts, providerErrors }
      } else {
        let warnings = []
        let content = result.content
        let macroAudit = null
        let breakdownRetry = null

        let plan = extractJsonLoose(result.content)

        // Validate macroBreakdown coherence for telemetry only. The recalculator
        // + day-level scaling below already correct any LLM macro drift, so a
        // second LLM call would double the wall time without improving
        // accuracy — it was causing browser/proxy timeouts.
        if (plan) {
          const violations = validateMacroBreakdown(plan)
          breakdownRetry = { initial: violations.length }
        }

        if (plan) {
          if (forbiddenList.length > 0) {
            const hits = scanForForbidden(plan, forbiddenList)
            if (hits.length > 0) {
              warnings = hits.map((h) =>
                `Dish "${h.dish}" contains forbidden term "${h.term}" (in ${h.where}). Click Regenerate to try again.`
              )
            }
          }

          // Recompute every dish's kcal/P/C/F from the Mercadona catalog so
          // the LLM's drift gets corrected. Strip per-dish audit blobs from
          // the plan we send to the client (keep only the summary).
          try {
            const { plan: corrected, summary } = recalculatePlan(plan, {
              profile,
              enabledMealTypes,
              scaleToTarget: true,
            })
            for (const day of corrected.days || []) {
              for (const meal of day.meals || []) {
                if (Array.isArray(meal.dishes)) {
                  for (const dish of meal.dishes) delete dish._macroAudit
                }
                if (meal.dish && typeof meal.dish === 'object') {
                  delete meal.dish._macroAudit
                }
              }
            }
            content = JSON.stringify(corrected)
            macroAudit = summary
          } catch (e) {
            // If recalculation fails for any reason, fall back to the raw
            // LLM output rather than breaking the response.
            macroAudit = { error: String(e?.message || e) }
          }
        }

        payload = {
          success: true,
          content,
          model: result.model,
          provider: usedProvider,
          warnings,
          attempts: allAttempts,
          providerErrors,
          macroAudit,
          breakdownRetry,
        }
      }

      await write(`data: ${JSON.stringify(payload)}\n\n`)

      // Persist aggregate recalculation health metrics. Best-effort and only
      // for successful generations (LLM/upstream failures are a different
      // concern, handled elsewhere). Never blocks or breaks the response.
      if (payload.success) {
        await recordGenerationMetrics(env, payload)
      }
    } catch (err) {
      const errPayload = { success: false, error: `Internal error: ${err.message}` }
      await write(`data: ${JSON.stringify(errPayload)}\n\n`).catch(() => {})
    } finally {
      clearInterval(keepaliveInterval)
      await writer.close().catch(() => {})
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// Best-effort telemetry: record aggregate, numeric-only recalculation metrics
// for a successful generation. Mirrors the maybeBackup pattern in data.js — a
// failure here must never bubble up. Stores NO personal data and NO plan
// content. Always inserts a row (gated on payload.success) so the recalc
// failure rate is observable: a table of only successes always looks healthy.
async function recordGenerationMetrics(env, payload) {
  try {
    const a = payload.macroAudit
    let outcome
    let dishesTotal = null
    let dishesFullyMatched = null
    let avgDriftKcal = null
    let scalingsCount = null

    if (a && typeof a.dishesTotal === 'number') {
      // Real aggregate metrics from the recalculator.
      outcome = 'ok'
      const drifts = Array.isArray(a.drifts) ? a.drifts : []
      dishesTotal = a.dishesTotal || 0
      dishesFullyMatched = a.dishesFullyMatched || 0
      avgDriftKcal = drifts.length
        ? Math.round(drifts.reduce((s, d) => s + Math.abs(d.delta || 0), 0) / drifts.length)
        : 0
      scalingsCount = Array.isArray(a.scalings) ? a.scalings.length : 0
    } else if (a && a.error != null) {
      // Recalculation threw — counters to 0, but we still record the failure.
      outcome = 'recalc_failed'
      dishesTotal = 0
      dishesFullyMatched = 0
      avgDriftKcal = 0
      scalingsCount = 0
    } else {
      // Plan never parsed (extractJsonLoose returned null) — counters null.
      outcome = 'parse_failed'
    }

    await env.DB
      .prepare(`
        INSERT INTO generation_metrics
          (created_at, model, provider, outcome, dishes_total,
           dishes_fully_matched, avg_drift_kcal, scalings_count, forbidden_hits)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        Date.now(),
        payload.model || null,
        payload.provider || null,
        outcome,
        dishesTotal,
        dishesFullyMatched,
        avgDriftKcal,
        scalingsCount,
        Array.isArray(payload.warnings) ? payload.warnings.length : 0,
      )
      .run()
  } catch {
    // Best-effort telemetry: swallow everything.
  }
}

// Atomically bump this user's per-window counters and decide whether to allow
// the generation. Returns { ok: true } to allow, or { ok: false, retryAfter,
// label, max } describing the BINDING window — the one the user must wait
// longest for (so the 429 message/Retry-After match the bucket that actually
// tripped, not necessarily the hourly one). Fails OPEN: any D1 hiccup allows
// the request rather than blocking a legitimate user.
// Human-friendly wait string: minutes under an hour, whole hours above. The
// Retry-After header still carries exact seconds.
function formatRetryAfter(seconds) {
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`
  return `~${Math.ceil(seconds / 3600)} h`
}

async function checkAndIncrement(env, email) {
  const now = Date.now()
  try {
    // One atomic upsert per window; RETURNING gives us the post-increment count
    // without a separate read (no read-modify-write race).
    const stmts = RATE_LIMIT_WINDOWS.map((w) => {
      const windowStart = Math.floor(now / w.windowMs) * w.windowMs
      const bucket = `${w.id}:${windowStart}`
      return env.DB
        .prepare(`
          INSERT INTO rate_limits (email, bucket, count, window_start)
          VALUES (?, ?, 1, ?)
          ON CONFLICT(email, bucket) DO UPDATE SET count = count + 1
          RETURNING count
        `)
        .bind(email, bucket, windowStart)
    })
    const results = await env.DB.batch(stmts)

    // Pick the binding constraint among any exceeded windows = the one with the
    // longest wait (you stay blocked until the slowest window resets).
    let blocking = null
    RATE_LIMIT_WINDOWS.forEach((w, i) => {
      const count = results[i]?.results?.[0]?.count ?? 0
      if (count > w.max) {
        const windowStart = Math.floor(now / w.windowMs) * w.windowMs
        const retryAfter = Math.ceil((windowStart + w.windowMs - now) / 1000)
        if (!blocking || retryAfter > blocking.retryAfter) {
          blocking = { retryAfter, label: w.label, max: w.max }
        }
      }
    })

    // Best-effort prune of buckets older than the largest window.
    const maxWindowMs = Math.max(...RATE_LIMIT_WINDOWS.map((w) => w.windowMs))
    env.DB
      .prepare('DELETE FROM rate_limits WHERE window_start < ?')
      .bind(now - maxWindowMs)
      .run()
      .catch(() => {})

    return blocking ? { ok: false, ...blocking } : { ok: true }
  } catch {
    // Fail-open: a limiter failure must not block legitimate generations.
    return { ok: true }
  }
}

export function onRequest({ request }) {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed.' }, 405)
  }
  return json({ success: false, error: 'Unhandled request.' }, 500)
}
