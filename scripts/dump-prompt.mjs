// Dumps the exact system + user prompt that the meal-plan endpoint sends
// to Anthropic, so a human can audit it. Mirrors the logic in
// functions/api/generate-meal-plan.js — keep both in sync when the prompt
// changes.
//
// Run: node scripts/dump-prompt.mjs

import { MERCADONA_MENU } from '../functions/api/_mercadona-menu.js'
import fs from 'fs'

// ─── User profile (load from the saved state) ────────────────────────────────
const state = JSON.parse(fs.readFileSync(new URL('./my-state-full.json', import.meta.url)))
const profile = state.profile
const language = state.language || 'es'
const enabledMealTypes = (state.mealTypes || [])
  .filter((m) => m.enabled)
  .map((m) => m.type)
const fridgeContents = ''
const weeklyExtras = ''

// ─── Constants from generate-meal-plan.js ────────────────────────────────────
const GOAL_LABELS = { lose_weight: 'lose weight', gain_muscle: 'gain muscle', maintain: 'maintain weight', health: 'general health' }
const STYLE_LABELS = { omnivore: 'omnivore', vegetarian: 'vegetarian', vegan: 'vegan', pescatarian: 'pescatarian', mediterranean: 'mediterranean', keto: 'keto', paleo: 'paleo', other: 'unspecified' }
const LANGUAGE_NAMES = { en: 'English', es: 'Spanish (español)' }

const MEAL_SHARE_BY_MODE = {
  general:   { breakfast: 25, morning_snack: 10, lunch: 33, afternoon_snack: 10, dinner: 22 },
  endurance: { breakfast: 22, morning_snack: 10, lunch: 25, afternoon_snack: 10, dinner: 33 },
  strength:  { breakfast: 22, morning_snack: 12, lunch: 28, afternoon_snack: 12, dinner: 26 },
}
const shareTableFor = (mode) => MEAL_SHARE_BY_MODE[mode] || MEAL_SHARE_BY_MODE.general

function computePerMealTargets(allPeople, enabledMealTypes) {
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
      const personShare = (shareTable[type] || 0) / totalShare
      const personKcal = Math.round((person.calorieTarget || 0) * personShare)
      kcal += personKcal
      parts.push(`${person.name || 'Person'} ${personKcal}`)
    }
    if (kcal > 0) result.push({ type, kcal, breakdown: parts.length > 1 ? parts.join(' + ') : parts[0] || `${kcal}` })
  }
  return result
}

// ─── buildSystemPrompt (copy of the function) ────────────────────────────────
function buildSystemPrompt(language, enabledMealTypes) {
  const langName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en
  const typesJoined = enabledMealTypes.join(', ')
  return `You are a meticulous nutritionist and home cook. You design realistic, varied, healthy weekly meal plans for one person at a time. You respect every constraint the user gives you without exception. The user's profile is a hard contract, not a suggestion.

LANGUAGE: All human-readable strings in your response (dish names, notes, ingredient names and amounts, instructions, shopping list) MUST be written in ${langName}. Do not translate the JSON keys themselves — those must stay in English exactly as specified below. The "type" field of each meal must also stay in English.

## Hard rules

Format:
- Output ONLY a single valid JSON object — no markdown, no code fences, no commentary.
- Exactly 7 days, dayIndex 0..6 (Monday..Sunday).
- Exactly ${enabledMealTypes.length} meal(s) per day, with these exact types in this order: ${typesJoined}.
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
  * For every dish you MUST output a "macroBreakdown" array with one entry per ingredient containing { ingredient, grams, kcal, protein, carbs, fat }. The grams field is the AS-SOLD weight (matches the "amount" field). The kcal/P/C/F are this ingredient's contribution to the dish total. Writing this is non-negotiable — it forces explicit math.
  * Verify after each dish: sum of macroBreakdown[*].kcal must equal dish.calories within ±10%. If not, fix the quantities and rewrite the breakdown.
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
              { "ingredient": "string (matches an ingredient name)", "grams": number, "kcal": number, "protein": number, "carbs": number, "fat": number }
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
}

// ─── buildUserPrompt (copy of the function) ──────────────────────────────────
function buildUserPrompt({ profile, fridgeContents, weeklyExtras, enabledMealTypes }) {
  const p = profile || {}
  const lines = [
    `Generate a 7-day meal plan tailored to this person. Each day must have exactly ${enabledMealTypes.length} meal(s): ${enabledMealTypes.join(', ')}.`,
    '',
    '**Treat every line of this profile as a HARD REQUIREMENT.** Do not second-guess the user. Do not soften their constraints toward "normal" values. Do not skip any of the listed targets.',
  ]
  const allergiesRaw = (p.allergiesAndIntolerances || '').trim()
  const disliked = Array.isArray(p.dislikedIngredients) ? p.dislikedIngredients : []
  const forbidden = [...(allergiesRaw ? allergiesRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : []), ...disliked]
  if (forbidden.length) {
    lines.push('', '## FORBIDDEN INGREDIENTS — ABSOLUTE RULE',
      'The following ingredients MUST NOT appear anywhere in the response — not in dish names, not in ingredients lists, not in instructions, not even in trace amounts. This is a zero-tolerance rule. If you are about to include one of these, pick a different ingredient instead.')
    for (const it of forbidden) lines.push(`- ${it}`)
    lines.push('Before outputting the JSON, scan every dish name and every ingredient to make sure NONE of the forbidden items appear.')
  }
  lines.push('\n## Diet profile')
  if (Array.isArray(p.goals) && p.goals.length) lines.push(`- Goals: ${p.goals.map((g) => GOAL_LABELS[g] || g).join(' AND ')}`)
  if (p.dietaryStyle) lines.push(`- Dietary style: ${STYLE_LABELS[p.dietaryStyle] || p.dietaryStyle}`)
  if (p.favourites) lines.push(`- Favourite foods (use often): ${p.favourites}`)
  if (p.cuisines) lines.push(`- Preferred cuisines: ${p.cuisines}`)

  const targets = []
  if (p.calorieTarget) targets.push(`${p.calorieTarget} kcal`)
  if (p.proteinTarget) targets.push(`${p.proteinTarget}g protein`)
  if (p.carbsTarget) targets.push(`${p.carbsTarget}g carbs`)
  if (p.fatTarget) targets.push(`${p.fatTarget}g fat`)
  if (p.vegetableTarget) targets.push(`${p.vegetableTarget}g vegetables`)

  const primaryMeals = (p.enabledMeals && p.enabledMeals.length) ? p.enabledMeals : enabledMealTypes
  const allPeople = [{ name: 'Person 1', calorieTarget: p.calorieTarget, proteinTarget: p.proteinTarget, carbsTarget: p.carbsTarget, fatTarget: p.fatTarget, vegetableTarget: p.vegetableTarget, enabledMeals: primaryMeals, outsideMeals: Array.isArray(p.outsideMeals) ? p.outsideMeals : [], trainingMode: p.trainingMode || 'general' }]
  if (Array.isArray(p.people)) for (const person of p.people) if (person.name || person.calorieTarget) allPeople.push({ ...person, outsideMeals: Array.isArray(person.outsideMeals) ? person.outsideMeals : [], trainingMode: person.trainingMode || 'general' })

  if (allPeople.length > 1) {
    lines.push('', `### COOKING FOR ${allPeople.length} PEOPLE — each person has different targets AND may not eat every meal`, '')
    for (let i = 0; i < allPeople.length; i++) {
      const person = allPeople[i]
      const name = person.name || `Person ${i + 1}`
      const pt = []
      if (person.calorieTarget) pt.push(`${person.calorieTarget} kcal`)
      if (person.proteinTarget) pt.push(`${person.proteinTarget}g P`)
      if (person.carbsTarget) pt.push(`${person.carbsTarget}g C`)
      if (person.fatTarget) pt.push(`${person.fatTarget}g F`)
      if (person.vegetableTarget) pt.push(`${person.vegetableTarget}g V`)
      const meals = (person.enabledMeals && person.enabledMeals.length) ? person.enabledMeals.join(', ') : 'all meals'
      const modeNote = person.trainingMode && person.trainingMode !== 'general'
        ? ` — training mode: ${person.trainingMode} (carb-loading evening for endurance / spread protein for strength)`
        : ''
      lines.push(`- ${name}: ${pt.join(' · ')} — eats: ${meals}${modeNote}`)
    }
    lines.push('', 'PER-MEAL INSTRUCTIONS:')
    for (const mealType of enabledMealTypes) {
      const eaters = []
      for (let i = 0; i < allPeople.length; i++) {
        const person = allPeople[i]
        const name = person.name || `Person ${i + 1}`
        const personMeals = Array.isArray(person.enabledMeals) ? person.enabledMeals : enabledMealTypes
        if (personMeals.includes(mealType)) eaters.push(name)
      }
      if (eaters.length === 0) lines.push(`- ${mealType}: no one eats this — skip it.`)
      else if (eaters.length === 1) lines.push(`- ${mealType}: only ${eaters[0]} eats this. Size the dish for 1 person only.`)
      else lines.push(`- ${mealType}: ${eaters.join(' + ')} eat this. Size the dish for ${eaters.length} people combined. Each ingredient amount must show total + per-person split, e.g. "250g (150g + 100g)". Notes must contain per-person macro summary.`)
    }
    lines.push('', 'The dish macros must reflect the TOTAL for everyone eating that specific meal.', 'The cookedWeight must also show per-person amounts for multi-person meals.', 'Do NOT normalize these toward typical ratios. Each person picked their targets on purpose.')

    const mealTargets = computePerMealTargets(allPeople, enabledMealTypes)
    const dayTotal = mealTargets.reduce((s, m) => s + m.kcal, 0)
    if (dayTotal > 0) {
      lines.push('', '### EXACT PER-MEAL KCAL TARGETS — dish.calories MUST hit these (±10% per dish, ±5% on day total)')
      for (const m of mealTargets) lines.push(`- ${m.type}: ${m.kcal} kcal  (${m.breakdown})`)
      lines.push(`- DAY TOTAL: ${dayTotal} kcal  (must be within ±5%)`)
    }
  } else if (targets.length) {
    lines.push('', `### MANDATORY DAILY TARGETS — must be met within ±10% every day`, `${targets.join(' · ')}`)
    if (p.calorieTarget && p.proteinTarget && p.carbsTarget && p.fatTarget) {
      const macroKcal = p.proteinTarget * 4 + p.carbsTarget * 4 + p.fatTarget * 9
      const gap = Math.abs(macroKcal - p.calorieTarget)
      if (gap > p.calorieTarget * 0.05) {
        const scale = p.calorieTarget / macroKcal
        lines.push('', `IMPORTANT: the stated macros add up to ~${macroKcal} kcal, but the target is ${p.calorieTarget} kcal. THE CALORIE TARGET IS PRIMARY. Use adjusted macros: ~${Math.round(p.proteinTarget * scale)}g P, ~${Math.round(p.carbsTarget * scale)}g C, ~${Math.round(p.fatTarget * scale)}g F.`)
      }
    }
    lines.push('Do NOT normalize these toward typical ratios. The user picked these targets on purpose.')

    const onlyPerson = [{ name: 'Person 1', calorieTarget: p.calorieTarget, enabledMeals: primaryMeals, outsideMeals: Array.isArray(p.outsideMeals) ? p.outsideMeals : [], trainingMode: p.trainingMode || 'general' }]
    const mealTargets = computePerMealTargets(onlyPerson, enabledMealTypes)
    const dayTotal = mealTargets.reduce((s, m) => s + m.kcal, 0)
    if (dayTotal > 0) {
      lines.push('', '### EXACT PER-MEAL KCAL TARGETS — dish.calories MUST hit these (±10% per dish, ±5% on day total)')
      for (const m of mealTargets) lines.push(`- ${m.type}: ${m.kcal} kcal  (${m.breakdown})`)
      lines.push(`- DAY TOTAL: ${dayTotal} kcal  (must be within ±5%)`)
    }
  }
  if (p.maxCookTime) lines.push(`- Max time per meal (prep + cook combined): ${p.maxCookTime} minutes`)
  if (p.notes) lines.push(`- Additional notes: ${p.notes}`)
  if (lines.length === 2) lines.push('- (no profile set, use balanced defaults)')
  if (fridgeContents || weeklyExtras) {
    lines.push('\n## This week')
    if (fridgeContents) lines.push(`- Already in the fridge / pantry (build around this when reasonable): ${fridgeContents}`)
    if (weeklyExtras) lines.push(`- Special context for this week: ${weeklyExtras}`)
  }
  lines.push('\nRespond with ONLY the JSON object described in the system prompt.')
  return lines.join('\n')
}

const sys = buildSystemPrompt(language, enabledMealTypes)
const usr = buildUserPrompt({ profile, fridgeContents, weeklyExtras, enabledMealTypes })

const baseDir = new URL('.', import.meta.url).pathname
fs.writeFileSync(baseDir + 'prompt-system.txt', sys)
fs.writeFileSync(baseDir + 'prompt-user.txt', usr)
fs.writeFileSync(baseDir + 'prompt-full.txt',
  '════════════════════════════════════════════════════════════\n' +
  '  SYSTEM PROMPT (' + sys.length + ' chars, ~' + Math.round(sys.length / 4) + ' tokens)\n' +
  '════════════════════════════════════════════════════════════\n\n' +
  sys + '\n\n' +
  '════════════════════════════════════════════════════════════\n' +
  '  USER PROMPT (' + usr.length + ' chars, ~' + Math.round(usr.length / 4) + ' tokens)\n' +
  '════════════════════════════════════════════════════════════\n\n' +
  usr
)

console.log('Generated:')
console.log('  scripts/prompt-system.txt — ' + sys.length + ' chars (~' + Math.round(sys.length / 4) + ' tokens)')
console.log('  scripts/prompt-user.txt — ' + usr.length + ' chars (~' + Math.round(usr.length / 4) + ' tokens)')
console.log('  scripts/prompt-full.txt — ambos en uno')
