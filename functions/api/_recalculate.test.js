import { describe, it, expect } from 'vitest'
import {
  createRecalculator,
  amountToGrams,
  isPlausible,
  scaleAmount,
  computeDayTarget,
} from './_recalculate.js'

// Small deterministic catalog with round macros so assertions are exact.
// NOTE: tests for the matcher / recalculateDish use an instance built from
// THIS fixture — never the default named exports, which are bound to the real
// Mercadona catalog and would make the tests non-deterministic.
const MINI_CATALOG = [
  { id: 'p1', name: 'Pechuga de pollo',    kcal: 110, protein: 23, carbs: 0,  fat: 2 },
  { id: 'p2', name: 'Arroz blanco largo',  kcal: 130, protein: 3,  carbs: 28, fat: 0 },
  { id: 'p3', name: 'Huevo',               kcal: 140, protein: 13, carbs: 1,  fat: 10 },
  { id: 'p4', name: 'Plátano de Canarias', kcal: 90,  protein: 1,  carbs: 23, fat: 0 },
  { id: 'p5', name: 'Aceite de oliva',     kcal: 900, protein: 0,  carbs: 0,  fat: 100 },
  { id: 'p6', name: 'Tofu firme',          kcal: 100, protein: 10, carbs: 2,  fat: 6 },
  // Broken OCR row: filtered out by isPlausible (kcal > 920 and P+C+F > 105).
  { id: 'pBad', name: 'Producto roto OCR', kcal: 5000, protein: 80, carbs: 80, fat: 80 },
]

const recalc = createRecalculator(MINI_CATALOG)

describe('amountToGrams', () => {
  it('parses grams', () => {
    expect(amountToGrams('250g')).toBe(250)
  })
  it('parses kg with comma decimals', () => {
    expect(amountToGrams('1,5 kg')).toBe(1500)
  })
  it('parses ml (ml ≈ g)', () => {
    expect(amountToGrams('30ml')).toBe(30)
  })
  it('maps "2 unidades" via UNIT_WEIGHTS using the ingredient name', () => {
    expect(amountToGrams('2 unidades', 'huevo')).toBe(120) // 2 × 60g
  })
  it('falls back to 100g/unit when the name has no known unit weight', () => {
    expect(amountToGrams('2 unidades', 'lechuga')).toBe(200) // 2 × 100g fallback
  })
  it('handles a bare number + ingredient name', () => {
    expect(amountToGrams('2', 'manzana')).toBe(400) // 2 × 200g
  })
  it('takes the total before a parenthesised per-person breakdown', () => {
    expect(amountToGrams('250g (150g + 100g)')).toBe(250)
  })
  it('returns 0 for garbage / empty / null', () => {
    expect(amountToGrams('al gusto')).toBe(0)
    expect(amountToGrams('')).toBe(0)
    expect(amountToGrams(null)).toBe(0)
    expect(amountToGrams(undefined)).toBe(0)
  })
})

describe('findProduct', () => {
  it('returns a clear token match', () => {
    expect(recalc.findProduct('pechuga de pollo')?.id).toBe('p1')
  })
  it('matches across plural/stem differences', () => {
    expect(recalc.findProduct('plátanos')?.id).toBe('p4')
    expect(recalc.findProduct('huevos')?.id).toBe('p3')
  })
  it('returns null below the score threshold (no real match)', () => {
    expect(recalc.findProduct('quinoa ecológica')).toBeNull()
  })
  it('never returns an implausible (OCR-broken) product', () => {
    expect(recalc.findProduct('producto roto ocr')).toBeNull()
  })
})

describe('isPlausible', () => {
  it('accepts a normal entry', () => {
    expect(isPlausible({ kcal: 110, protein: 23, carbs: 0, fat: 2 })).toBe(true)
  })
  it('rejects P+C+F > 105', () => {
    expect(isPlausible({ kcal: 100, protein: 50, carbs: 50, fat: 10 })).toBe(false)
  })
  it('rejects kcal > 920', () => {
    expect(isPlausible({ kcal: 1000, protein: 0, carbs: 0, fat: 0 })).toBe(false)
  })
  it('rejects negative values', () => {
    expect(isPlausible({ kcal: -1, protein: 0, carbs: 0, fat: 0 })).toBe(false)
    expect(isPlausible({ kcal: 100, protein: -5, carbs: 0, fat: 0 })).toBe(false)
  })
  it('rejects null/undefined macros', () => {
    expect(isPlausible({ kcal: null, protein: 0, carbs: 0, fat: 0 })).toBe(false)
    expect(isPlausible({ kcal: 100, protein: 0, carbs: 0 })).toBe(false) // fat undefined
  })
  it('rejects the broken OCR fixture row', () => {
    expect(isPlausible(MINI_CATALOG.find((p) => p.id === 'pBad'))).toBe(false)
  })
})

describe('recalculateDish', () => {
  it('uses catalog macros when ≥85% of weight matches', () => {
    const dish = {
      name: 'Pollo con arroz',
      calories: 999, protein: 99, carbs: 99, fat: 99, // bogus LLM originals
      ingredients: [
        { name: 'Pechuga de pollo', amount: '200g' },   // p1 × 2 → 220 kcal
        { name: 'Arroz blanco largo', amount: '100g' },  // p2 × 1 → 130 kcal
      ],
    }
    const out = recalc.recalculateDish(dish)
    expect(out._macroAudit.used).toBe('catalog')
    expect(out.calories).toBe(350)  // 220 + 130
    expect(out.protein).toBe(49)    // 46 + 3
    expect(out.carbs).toBe(28)      // 0 + 28
    expect(out.fat).toBe(4)         // 4 + 0
    expect(out.macroBreakdown).toHaveLength(2)
  })

  it('falls back to LLM macros when most weight is unmatched', () => {
    const dish = {
      name: 'Plato raro',
      calories: 500, protein: 30, carbs: 40, fat: 20,
      ingredients: [
        { name: 'Quinoa ecológica', amount: '200g' }, // unmatched
        { name: 'Tofu ahumado', amount: '100g' },     // unmatched ("ahumado" ≠ "firme")
        { name: 'Pechuga de pollo', amount: '50g' },   // matched (only 50/350 g)
      ],
    }
    const out = recalc.recalculateDish(dish)
    expect(out._macroAudit.used).toBe('llm-fallback')
    // Originals preserved untouched.
    expect(out.calories).toBe(500)
    expect(out.protein).toBe(30)
    expect(out.carbs).toBe(40)
    expect(out.fat).toBe(20)
  })
})

describe('scaleAmount', () => {
  it('preserves units and structure (parenthesised split, kg+comma, units)', () => {
    expect(scaleAmount('250g (150g + 100g)', 2)).toBe('500g (300g + 200g)')
    expect(scaleAmount('1,5 kg', 2)).toBe('3 kg')
    expect(scaleAmount('2 unidades', 2)).toBe('4 unidades')
    expect(scaleAmount('30ml', 2)).toBe('60ml')
  })
  it('rounds to 5g steps for amounts ≥ 100', () => {
    expect(scaleAmount('100g', 1.07)).toBe('105g') // 107 → nearest 5
  })
  it('rounds to whole grams for 10–99', () => {
    expect(scaleAmount('20g', 1.07)).toBe('21g') // 21.4 → 21
  })
  it('keeps one decimal for 1–9', () => {
    expect(scaleAmount('3g', 1.5)).toBe('4.5g')
  })
  it('never goes below 1', () => {
    expect(scaleAmount('1g', 0.2)).toBe('1g') // 0.2 → floored to 1
  })

  // EXTRA: accumulated rounding bias in the per-person split. Each number is
  // rounded INDEPENDENTLY to the nearest 5g (≥100 branch), so the parenthesised
  // parts can drift away from the rounded total. We document the real behaviour
  // (it is bounded, not gross) — we are NOT fixing it here.
  it('documents per-person rounding drift under a non-integer factor', () => {
    const out = scaleAmount('250g (150g + 100g)', 1.07)
    // 250→267.5→270, 150→160.5→160, 100→107→105  (each snapped to /5 independently)
    expect(out).toBe('270g (160g + 105g)')

    const [total, a, b] = out.match(/\d+(?:[.,]\d+)?/g).map((s) => parseFloat(s.replace(',', '.')))
    const gap = Math.abs(total - (a + b))
    expect(gap).toBe(5)                 // off by exactly one 5g step…
    expect(gap).toBeLessThan(total * 0.05) // …i.e. < 5% of the total — bounded, not gross
  })
})

describe('recalculatePlan with scaleToTarget', () => {
  // Profile: single eater, 2000 kcal/day target.
  const profile = { calorieTarget: 2000, enabledMeals: ['lunch'], people: [] }

  function makePlan() {
    return {
      days: [
        { // Day 1: recalc = 1000 kcal → 100% off target → must be scaled.
          date: '2026-01-01',
          meals: [{ type: 'lunch', dishes: [
            { name: 'Día1', calories: 0, protein: 0, carbs: 0, fat: 0,
              ingredients: [{ name: 'Tofu firme', amount: '1000g' }] },
          ] }],
        },
        { // Day 2: recalc = 1980 kcal → within ±5% of 2000 → must NOT be touched.
          date: '2026-01-02',
          meals: [{ type: 'lunch', dishes: [
            { name: 'Día2', calories: 0, protein: 0, carbs: 0, fat: 0,
              ingredients: [{ name: 'Tofu firme', amount: '1980g' }] },
          ] }],
        },
      ],
    }
  }

  it('scales the off-target day and leaves the in-range day untouched', () => {
    const { plan, summary } = recalc.recalculatePlan(makePlan(), {
      profile,
      enabledMealTypes: ['lunch'],
      scaleToTarget: true,
    })

    expect(summary.dayTarget).toBe(2000)
    // Only day 1 appears in the scalings log.
    expect(summary.scalings.map((s) => s.date)).toEqual(['2026-01-01'])

    // Day 1 amount was scaled (factor 2.0): 1000g → 2000g, recalc → 2000 kcal.
    const d1 = plan.days[0].meals[0].dishes[0]
    expect(d1.ingredients[0].amount).toBe('2000g')
    expect(d1.calories).toBe(2000)

    // Day 2 left exactly as-is.
    const d2 = plan.days[1].meals[0].dishes[0]
    expect(d2.ingredients[0].amount).toBe('1980g')
    expect(d2.calories).toBe(1980)
  })
})
