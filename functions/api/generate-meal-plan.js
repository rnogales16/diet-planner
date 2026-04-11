// Generates a 7-day meal plan with Gemini.
// Cloudflare Access protects this endpoint, so the request is already
// authenticated by the time it gets here. API keys live as Pages secrets
// and never reach the browser.
//
// Pro is the default — meal generation deserves the best reasoning.
// Flash and Flash-Lite sit behind it as safety nets for when Pro is
// overloaded or both keys are rate-limited. Each step is a separate
// serving pool inside Google so when 2.5 Pro is congested 2.5 Flash
// (or 2.5 Flash-Lite) often still works. In normal conditions Pro
// answers on the first attempt.

import { callGeminiWithFallback } from './_gemini.js'

const MODEL_CASCADE = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']

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
- Instructions are step strings written like a real recipe.
- No duplicate dish names across the week. Vary cuisines, cooking methods and main proteins.
- Allergies and dietary restrictions are absolute. Never include a forbidden ingredient.
- Disliked ingredients listed by the user are also absolute. Never include them, not even in trace amounts.

RAW WEIGHTS (NON-NEGOTIABLE):
- All ingredient weights and volumes MUST refer to the RAW, UNCOOKED form. 100g of pasta means 100g of dry uncooked pasta. 150g of rice means 150g of dry rice. 200g of chicken means 200g of raw chicken.
- Do NOT use cooked or "as served" weights. The user needs to know how much to weigh BEFORE cooking.
- This applies to every ingredient: pasta, rice, beans, lentils, meats, fish, vegetables, etc.
- Calculate calories and macros based on the RAW values too (uncooked pasta has different kcal per gram than cooked pasta).

## Macro targets (CRITICAL)

The user provides daily targets for calories, protein, carbs, fat AND vegetables. These are HARD CONSTRAINTS.

- The total of the ${enabledMealTypes.length} meal(s) each day MUST land within ±10% of every provided target — calories, protein, carbs, fat AND vegetables. All five, every day.
- Do NOT normalize the user's macro split toward a "typical" distribution. If the user asks for a high-carb low-fat plan, deliver exactly that. If they ask for keto, deliver that. The targets always win over your defaults.
- Distribute the daily totals across the meals sensibly: main meals (breakfast, lunch, dinner) should carry the bulk of the calories and protein; snacks should be appropriately smaller. When the user has disabled snacks, shift that share to lunch and dinner — still respecting the daily target.
- Ingredient quantities MUST genuinely add up to the dish's stated macros. A dish that says 600 kcal / 40g protein / 80g vegetables must have ingredients whose real-world values total ~600 kcal / ~40g protein and contain ~80g of vegetables. Use accurate per-ingredient values from common nutrition tables.
- Before finalizing each day, mentally sum the 5 dishes' calories, protein, carbs, fat and vegetables. If any total drifts more than 10% from the daily target, adjust ingredient quantities (typically the staple carb, protein source, or veg portion) to bring it in line. Iterate until all five totals fit.

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
            "notes": "string (may be empty)",
            "prepTime": number,
            "cookTime": number,
            "servings": number,
            "ingredients": [{ "name": "string", "amount": "string" }],
            "instructions": ["string", "..."]
          }
        }
      ]
    }
  ],
  "shoppingList": [
    { "name": "string", "amount": "string", "category": "vegetables" }
  ]
}`
}

function buildUserPrompt({ profile, fridgeContents, weeklyExtras, enabledMealTypes }) {
  const lines = [
    `Generate a 7-day meal plan tailored to this person. Each day must have exactly ${enabledMealTypes.length} meal(s): ${enabledMealTypes.join(', ')}.`,
    '',
    '**Treat every line of this profile as a HARD REQUIREMENT.** If the profile says "no mushrooms", you never include mushrooms. If the profile says 2800 kcal and 170g protein, your daily totals match those numbers within ±10%. If the profile says vegetarian, no meat. Do not second-guess the user. Do not soften their constraints toward "normal" values. Do not skip any of the listed targets.',
  ]

  // Profile section
  const p = profile || {}
  lines.push('\n## Diet profile')

  if (Array.isArray(p.goals) && p.goals.length) {
    const labels = p.goals.map((g) => GOAL_LABELS[g] || g)
    lines.push(`- Goals: ${labels.join(' AND ')}`)
  }
  if (p.dietaryStyle) lines.push(`- Dietary style: ${STYLE_LABELS[p.dietaryStyle] || p.dietaryStyle}`)
  if (p.allergies) lines.push(`- Allergies (NEVER use): ${p.allergies}`)
  if (p.restrictions) lines.push(`- Restrictions and dislikes: ${p.restrictions}`)
  if (Array.isArray(p.dislikedIngredients) && p.dislikedIngredients.length) {
    lines.push(`- Disliked ingredients (NEVER use, hard rule): ${p.dislikedIngredients.join(', ')}`)
  }
  if (p.favourites) lines.push(`- Favourite foods (use often): ${p.favourites}`)
  if (p.cuisines) lines.push(`- Preferred cuisines: ${p.cuisines}`)

  const targets = []
  if (p.calorieTarget) targets.push(`${p.calorieTarget} kcal`)
  if (p.proteinTarget) targets.push(`${p.proteinTarget}g protein`)
  if (p.carbsTarget) targets.push(`${p.carbsTarget}g carbs`)
  if (p.fatTarget) targets.push(`${p.fatTarget}g fat`)
  if (p.vegetableTarget) targets.push(`${p.vegetableTarget}g vegetables`)
  if (targets.length) {
    lines.push('')
    lines.push(`### MANDATORY DAILY TARGETS — must be met within ±10% every day`)
    lines.push(`${targets.join(' · ')}`)
    if (p.calorieTarget && p.proteinTarget && p.carbsTarget && p.fatTarget) {
      // Sanity check the math: 1g protein = 4 kcal, 1g carb = 4 kcal, 1g fat = 9 kcal
      const macroKcal = p.proteinTarget * 4 + p.carbsTarget * 4 + p.fatTarget * 9
      lines.push(`(For reference, ${p.proteinTarget}P + ${p.carbsTarget}C + ${p.fatTarget}F adds up to about ${macroKcal} kcal — make sure your dish quantities respect this.)`)
    }
    lines.push('Do NOT normalize these toward typical ratios. The user picked these targets on purpose.')
  }

  if (p.servings && p.servings > 1) {
    lines.push(`- Cooking for ${p.servings} people (servings should reflect this)`)
  }
  if (p.maxCookTime) {
    lines.push(`- Max time per meal (prep + cook combined): ${p.maxCookTime} minutes`)
  }
  if (p.notes) lines.push(`- Additional notes: ${p.notes}`)

  if (lines.length === 2) {
    lines.push('- (no profile set, use balanced defaults)')
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

function sanitizeGoals(raw) {
  if (Array.isArray(raw)) {
    return raw.filter((g) => typeof g === 'string' && VALID_GOALS.has(g)).slice(0, 4)
  }
  // Legacy single-string goal
  if (typeof raw === 'string' && VALID_GOALS.has(raw)) return [raw]
  return []
}

function sanitizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return {}
  return {
    goals: sanitizeGoals(raw.goals ?? raw.goal),
    dietaryStyle: trim(raw.dietaryStyle, 40),
    allergies: trim(raw.allergies, 500),
    restrictions: trim(raw.restrictions, 500),
    favourites: trim(raw.favourites, 500),
    cuisines: trim(raw.cuisines, 500),
    calorieTarget: num(raw.calorieTarget),
    proteinTarget: num(raw.proteinTarget),
    carbsTarget: num(raw.carbsTarget),
    fatTarget: num(raw.fatTarget),
    vegetableTarget: num(raw.vegetableTarget),
    servings: num(raw.servings) || 1,
    maxCookTime: num(raw.maxCookTime),
    notes: trim(raw.notes, 1000),
    dislikedIngredients: Array.isArray(raw.dislikedIngredients)
      ? raw.dislikedIngredients
          .map((s) => trim(s, 100))
          .filter(Boolean)
          .slice(0, 100)
      : [],
  }
}

export async function onRequestPost({ request, env }) {
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
  // Keep the canonical order
  enabledMealTypes = VALID_MEAL_TYPES.filter((t) => enabledMealTypes.includes(t))

  const systemPrompt = buildSystemPrompt(language, enabledMealTypes)
  const userPrompt = buildUserPrompt({ profile, fridgeContents, weeklyExtras, enabledMealTypes })

  const result = await callGeminiWithFallback({
    env,
    models: MODEL_CASCADE,
    payload: {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        // Lower temperature so the model follows the macro targets more
        // strictly. Slight loss of variety vs 0.85 is worth the precision.
        temperature: 0.7,
        topP: 0.9,
        responseMimeType: 'application/json',
        maxOutputTokens: 16384,
      },
    },
  })

  if (!result.ok) {
    const summary = (result.attempts || []).map((a) => `${a.model}/k${a.keyIndex}=${a.status}`).join(' ')
    if (result.status === 429) {
      return json({ success: false, error: `All Gemini quotas exhausted. Try again in a minute. [${summary}]`, attempts: result.attempts }, 429)
    }
    if (result.status === 503 || result.status === 500 || result.status === 502 || result.status === 504) {
      return json({ success: false, error: `Google AI is temporarily overloaded. [${summary}] Last error: ${result.error}`, attempts: result.attempts }, 503)
    }
    return json({ success: false, error: `Upstream error: ${result.error} [${summary}]`, attempts: result.attempts }, 502)
  }

  return json({ success: true, content: result.content, model: result.model })
}

export function onRequest({ request }) {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed.' }, 405)
  }
  return json({ success: false, error: 'Unhandled request.' }, 500)
}
