// Post-processor: recompute each dish's macros from a product catalog.
// The LLM tends to hallucinate dish totals even when given exact per-100g
// values in the prompt — this fixes the drift by treating the catalog as
// ground truth. Each ingredient is matched to a product, multiplied by its
// raw weight, and summed.
//
// The catalog-dependent logic lives in `createRecalculator(products)` so the
// recalculator can be bound to any catalog (Mercadona today, e.g. an Andorra
// catalog tomorrow) and so the matcher is unit-testable against a small
// fixture. The default export is bound to the real Mercadona catalog.

import { MERCADONA_DATA } from './_mercadona-data.js'
import { OVERRIDES } from './_catalog-overrides.js'

const STOP = new Set([
  'de','la','el','los','las','y','con','en','al','del','sin','a','para','por',
  'un','una','unos','unas','sabor','tipo','estilo','hacendado',
])

function stem(t) {
  if (t.length > 5 && t.endsWith('es')) return t.slice(0, -2)
  if (t.length > 4 && t.endsWith('s')) return t.slice(0, -1)
  return t
}

function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t))
    .map(stem)
}

// Sanity-check a catalog entry. OCR errors on Mercadona labels produce
// plausible-looking-but-wrong macros (kJ read as kcal, decimals dropped,
// per-serving values, etc). Drop anything that fails basic physical limits
// or whose macros don't add up — better to fall back to the LLM's number
// than to "correct" a dish using a broken reference.
export function isPlausible(p) {
  const { kcal, protein, carbs, fat } = p
  if (kcal == null || protein == null || carbs == null || fat == null) return false
  if (kcal < 0 || protein < 0 || carbs < 0 || fat < 0) return false
  // Mass per 100g can't exceed ~105g (water makes up the rest)
  if (protein + carbs + fat > 105) return false
  // Highest-calorie food in existence is pure oil at ~900 kcal/100g
  if (kcal > 920) return false
  return true
}

// Default raw weight per "unidad" for items the catalog gives by piece.
const UNIT_WEIGHTS = {
  huevo: 60, huevos: 60, egg: 60, eggs: 60,
  manzana: 200, plátano: 120, platano: 120, naranja: 200,
  banana: 120, apple: 200, orange: 200,
}

// Parse an amount string into grams (assumes ml ≈ g for liquids — accurate
// enough for cooking purposes). Handles forms like:
//   "250g"
//   "30ml"
//   "2 unidades"
//   "250g (150g + 100g)"   ← total before parenthesis
//   "1 unidad"
export function amountToGrams(amountStr, ingredientName) {
  if (!amountStr) return 0
  const s = String(amountStr).toLowerCase().trim()

  // Strip parenthesised per-person breakdown — the leading number is the total.
  const head = s.replace(/\s*\(.*?\)\s*$/, '').trim()

  const kg = head.match(/(\d+(?:[.,]\d+)?)\s*kg\b/)
  if (kg) return parseFloat(kg[1].replace(',', '.')) * 1000

  const g = head.match(/(\d+(?:[.,]\d+)?)\s*g\b/)
  if (g) return parseFloat(g[1].replace(',', '.'))

  const l = head.match(/(\d+(?:[.,]\d+)?)\s*l(?:itro)?s?\b/i)
  if (l) return parseFloat(l[1].replace(',', '.')) * 1000

  const ml = head.match(/(\d+(?:[.,]\d+)?)\s*ml\b/)
  if (ml) return parseFloat(ml[1].replace(',', '.'))

  // Units: try to map to a per-piece weight. Use the first matching keyword
  // from the ingredient name.
  const unitMatch = head.match(/(\d+(?:[.,]\d+)?)\s*(unidad|unidades|unit|units|uds?)\b/)
  const numOnly = head.match(/^(\d+(?:[.,]\d+)?)\s*$/)
  const n = unitMatch ? parseFloat(unitMatch[1].replace(',', '.'))
        : numOnly ? parseFloat(numOnly[1].replace(',', '.'))
        : null
  if (n != null) {
    const nameTokens = String(ingredientName || '').toLowerCase().split(/\s+/)
    for (const t of nameTokens) {
      if (UNIT_WEIGHTS[t] != null) return n * UNIT_WEIGHTS[t]
    }
    return n * 100  // fallback: assume 100g per "unit"
  }

  return 0
}

// Scale every number found in an amount string by `factor`, preserving the
// original units / structure (handles "250g", "30ml", "2 unidades",
// "250g (150g + 100g)", etc). Numbers are rounded to sensible cooking
// steps so weighing in real life isn't fiddly.
export function scaleAmount(amountStr, factor) {
  if (!amountStr || !Number.isFinite(factor) || factor <= 0) return amountStr
  return String(amountStr).replace(/(\d+(?:[.,]\d+)?)/g, (m) => {
    const n = parseFloat(m.replace(',', '.'))
    if (!Number.isFinite(n)) return m
    const scaled = n * factor
    let rounded
    if (scaled >= 100) rounded = Math.round(scaled / 5) * 5     // 5g steps for big amounts
    else if (scaled >= 10) rounded = Math.round(scaled)         // 1g steps for medium
    else if (scaled >= 1) rounded = Math.round(scaled * 10) / 10 // 1 decimal for small
    else rounded = Math.max(1, Math.round(scaled))              // never go below 1
    // Use comma decimal if original used it
    const useComma = m.includes(',')
    const out = String(rounded)
    return useComma ? out.replace('.', ',') : out
  })
}

// Compute the expected total dish-kcal for a single day, given the user's
// profile. Each person's daily kcal target lands in the dishes they eat;
// for shared meals the dish.calories is the total across people, so
// summing dish.calories over all meals equals sum(target across all people).
export function computeDayTarget(profile, enabledMealTypes) {
  if (!profile) return 0
  const primaryMeals = (profile.enabledMeals && profile.enabledMeals.length)
    ? profile.enabledMeals
    : enabledMealTypes
  const allPeople = [
    { calorieTarget: profile.calorieTarget, enabledMeals: primaryMeals },
    ...(Array.isArray(profile.people) ? profile.people : []),
  ]
  return allPeople.reduce((s, p) => s + (Number(p.calorieTarget) || 0), 0)
}

// Build a recalculator bound to a specific product catalog. `products` is the
// slim catalog array; `overrides` is an id→partial map applied on top (for
// catalog entries with broken OCR macros). Returns the catalog-dependent
// functions, all closing over a search index built once here.
export function createRecalculator(products, overrides = {}) {
  // Apply manual overrides for catalog entries with broken OCR macros.
  const PRODUCTS = (Array.isArray(products) ? products : []).map((p) => {
    const ov = overrides[p.id]
    return ov ? { ...p, ...ov } : p
  })

  // Build the search index once per recalculator.
  const INDEX = PRODUCTS
    .filter((p) => isPlausible(p))
    .map((p) => ({ product: p, tokens: new Set(tokens(p.name)) }))

  function findProduct(name) {
    const q = new Set(tokens(name))
    if (q.size === 0) return null
    let best = null
    let bestScore = 0
    for (const e of INDEX) {
      let overlap = 0
      for (const t of q) if (e.tokens.has(t)) overlap++
      if (overlap === 0) continue
      const union = q.size + e.tokens.size - overlap
      const cov = overlap / q.size
      const score = cov * (overlap / union)
      if (score > bestScore) {
        bestScore = score
        best = e.product
      }
    }
    const min = q.size <= 2 ? 0.25 : 0.15
    return bestScore < min ? null : best
  }

  // Recompute a single dish from its ingredients. Returns the updated dish
  // plus a per-dish info block describing what was matched.
  function recalculateDish(dish) {
    if (!dish || !Array.isArray(dish.ingredients)) return dish

    let kcal = 0, protein = 0, carbs = 0, fat = 0
    const matches = []
    let unmatchedGrams = 0

    for (const ing of dish.ingredients) {
      const grams = amountToGrams(ing.amount, ing.name)
      if (grams <= 0) continue

      const product = findProduct(ing.name)
      if (!product) {
        unmatchedGrams += grams
        matches.push({ name: ing.name, grams, matched: null })
        continue
      }

      const factor = grams / 100
      kcal += (product.kcal || 0) * factor
      protein += (product.protein || 0) * factor
      carbs += (product.carbs || 0) * factor
      fat += (product.fat || 0) * factor
      matches.push({
        name: ing.name,
        grams,
        matched: { id: product.id, name: product.name },
        contribution: {
          kcal: Math.round((product.kcal || 0) * factor),
          protein: Math.round((product.protein || 0) * factor * 10) / 10,
          carbs: Math.round((product.carbs || 0) * factor * 10) / 10,
          fat: Math.round((product.fat || 0) * factor * 10) / 10,
        },
      })
    }

    const original = {
      calories: dish.calories,
      protein: dish.protein,
      carbs: dish.carbs,
      fat: dish.fat,
    }
    const recalculated = {
      calories: Math.round(kcal),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
    }

    // Trust the recalculation when the matcher found a product for every
    // ingredient. The catalog (with overrides applied) is the source of truth.
    // Only fall back to the LLM when we missed enough weight in unmatched
    // ingredients that the recalc would clearly undercount.
    const totalGrams = matches.reduce((s, m) => s + (m.grams || 0), 0)
    const matchedFraction = totalGrams > 0 ? (totalGrams - unmatchedGrams) / totalGrams : 0
    const trustRecalc = recalculated.calories > 0 && matchedFraction >= 0.85
    const final = trustRecalc ? recalculated : original

    // Rebuild macroBreakdown from the matched contributions when we trust
    // the catalog. This way the breakdown shown to the user always matches
    // the displayed dish.calories.
    const breakdown = trustRecalc
      ? matches
          .filter((m) => m.matched)
          .map((m) => ({
            ingredient: m.name,
            grams: Math.round(m.grams),
            kcal: m.contribution.kcal,
            protein: m.contribution.protein,
            carbs: m.contribution.carbs,
            fat: m.contribution.fat,
          }))
      : (Array.isArray(dish.macroBreakdown) ? dish.macroBreakdown : [])

    return {
      ...dish,
      calories: final.calories,
      protein: final.protein,
      carbs: final.carbs,
      fat: final.fat,
      macroBreakdown: breakdown,
      _macroAudit: {
        original,
        recalculated,
        used: trustRecalc ? 'catalog' : 'llm-fallback',
        ingredients: matches,
        unmatchedGrams,
      },
    }
  }

  // Scale a single dish's ingredient amounts by `factor`, then recompute its
  // macros. Used by the day-level scaling pass.
  function scaleDish(dish, factor) {
    if (!dish || !Array.isArray(dish.ingredients) || !Number.isFinite(factor) || factor === 1) return dish
    const scaledIngredients = dish.ingredients.map((ing) => ({
      ...ing,
      amount: scaleAmount(ing.amount, factor),
    }))
    const updated = recalculateDish({ ...dish, ingredients: scaledIngredients })
    // Preserve the audit from the original recalc (just update used/recalculated)
    if (updated._macroAudit) {
      updated._macroAudit.scaledBy = Math.round(factor * 100) / 100
    }
    // Also scale the cookedWeight string if present
    if (typeof dish.cookedWeight === 'string') {
      updated.cookedWeight = scaleAmount(dish.cookedWeight, factor)
    }
    return updated
  }

  // Walk the whole plan and rewrite every dish. Returns the new plan plus
  // a summary the caller can include in the response.
  function recalculatePlan(plan, options = {}) {
    const { profile = null, enabledMealTypes = null, scaleToTarget = false } = options
    if (!plan || !Array.isArray(plan.days)) return { plan, summary: null }

    let dishesTotal = 0
    let dishesMatched = 0
    const drifts = []

    const processDish = (d) => {
      dishesTotal++
      const updated = recalculateDish(d)
      const audit = updated._macroAudit
      if (audit) {
        if (audit.unmatchedGrams === 0) dishesMatched++
        const drift = Math.abs(updated.calories - (audit.original.calories || 0))
        if (drift > 50) {
          drifts.push({
            dish: updated.name,
            original_kcal: audit.original.calories,
            new_kcal: updated.calories,
            delta: updated.calories - (audit.original.calories || 0),
          })
        }
      }
      return updated
    }

    const dayTarget = scaleToTarget ? computeDayTarget(profile, enabledMealTypes) : 0
    const scalings = []

    const days = plan.days.map((day) => {
      let meals = (day.meals || []).map((meal) => {
        // LLM responses use `meal.dish` (singular). The frontend later converts
        // it to `meal.dishes` (plural array). Handle both shapes so recalculation
        // works server-side (LLM raw) and on already-stored plans.
        if (Array.isArray(meal.dishes)) {
          return { ...meal, dishes: meal.dishes.map(processDish) }
        }
        if (meal.dish && typeof meal.dish === 'object') {
          return { ...meal, dish: processDish(meal.dish) }
        }
        return meal
      })

      // Day-level scaling pass: scale ingredient amounts so that the recalculated
      // day total matches the user's combined target. Skip if recalc had to fall
      // back to LLM values for any dish in the day (we don't have a reliable
      // baseline to scale from).
      if (scaleToTarget && dayTarget > 0) {
        let dayKcal = 0
        let allTrusted = true
        for (const meal of meals) {
          const list = Array.isArray(meal.dishes) ? meal.dishes : (meal.dish ? [meal.dish] : [])
          for (const d of list) {
            dayKcal += d?.calories || 0
            if (d?._macroAudit?.used !== 'catalog') allTrusted = false
          }
        }
        if (allTrusted && dayKcal > 0) {
          const factor = dayTarget / dayKcal
          // Only apply scaling when the drift is meaningful (>5%) to avoid
          // pointless recipe perturbations.
          if (Math.abs(1 - factor) > 0.05) {
            scalings.push({ date: day.date, before: dayKcal, target: dayTarget, factor: Math.round(factor * 100) / 100 })
            meals = meals.map((meal) => {
              if (Array.isArray(meal.dishes)) {
                return { ...meal, dishes: meal.dishes.map((d) => scaleDish(d, factor)) }
              }
              if (meal.dish && typeof meal.dish === 'object') {
                return { ...meal, dish: scaleDish(meal.dish, factor) }
              }
              return meal
            })
          }
        }
      }

      return { ...day, meals }
    })

    return {
      plan: { ...plan, days },
      summary: {
        dishesTotal,
        dishesFullyMatched: dishesMatched,
        drifts: drifts.slice(0, 50),
        scalings,
        dayTarget,
      },
    }
  }

  return { findProduct, recalculateDish, scaleDish, recalculatePlan, products: PRODUCTS }
}

// Default recalculator bound to the real Mercadona catalog + overrides.
// Named exports preserve the existing import sites (e.g. generate-meal-plan.js).
const _default = createRecalculator(MERCADONA_DATA, OVERRIDES)
export const findProduct = _default.findProduct
export const recalculateDish = _default.recalculateDish
export const scaleDish = _default.scaleDish
export const recalculatePlan = _default.recalculatePlan
