// Cost estimation for shopping lists. Uses the real Mercadona catalog
// (lazy-loaded via mercadonaCatalog.js) when a product matches; falls back
// to the keyword table below for ingredients that don't match a product.

import { getCatalog, findMercadonaProductSync } from './mercadonaCatalog'

const PRICES = [
  // Protein (€/kg)
  { keyword: 'pollo', pricePerKg: 5.50 },
  { keyword: 'pechuga', pricePerKg: 7.50 },
  { keyword: 'ternera', pricePerKg: 12.00 },
  { keyword: 'cerdo', pricePerKg: 6.50 },
  { keyword: 'lomo', pricePerKg: 8.00 },
  { keyword: 'pavo', pricePerKg: 7.00 },
  { keyword: 'salmón', pricePerKg: 14.00 },
  { keyword: 'salmon', pricePerKg: 14.00 },
  { keyword: 'atún', pricePerKg: 16.00 },
  { keyword: 'atun', pricePerKg: 16.00 },
  { keyword: 'merluza', pricePerKg: 10.00 },
  { keyword: 'bacalao', pricePerKg: 11.00 },
  { keyword: 'dorada', pricePerKg: 9.00 },
  { keyword: 'lubina', pricePerKg: 10.00 },
  { keyword: 'gambas', pricePerKg: 12.00 },
  { keyword: 'huevo', pricePerUnit: 0.25 },
  { keyword: 'chorizo', pricePerKg: 8.00 },
  { keyword: 'jamón', pricePerKg: 15.00 },
  { keyword: 'jamon', pricePerKg: 15.00 },

  // Dairy (€/L or €/kg)
  { keyword: 'leche', pricePerL: 0.95 },
  { keyword: 'yogur', pricePerKg: 2.50 },
  { keyword: 'queso', pricePerKg: 9.00 },
  { keyword: 'mantequilla', pricePerKg: 8.00 },
  { keyword: 'nata', pricePerL: 3.00 },

  // Grains (€/kg)
  { keyword: 'arroz', pricePerKg: 1.30 },
  { keyword: 'pasta', pricePerKg: 1.20 },
  { keyword: 'macarrón', pricePerKg: 1.20 },
  { keyword: 'macarron', pricePerKg: 1.20 },
  { keyword: 'espagueti', pricePerKg: 1.20 },
  { keyword: 'avena', pricePerKg: 2.50 },
  { keyword: 'pan', pricePerKg: 3.00 },
  { keyword: 'harina', pricePerKg: 0.80 },
  { keyword: 'quinoa', pricePerKg: 6.00 },
  { keyword: 'granola', pricePerKg: 5.00 },

  // Legumes (€/kg)
  { keyword: 'lenteja', pricePerKg: 2.00 },
  { keyword: 'garbanzo', pricePerKg: 2.20 },
  { keyword: 'judión', pricePerKg: 3.50 },
  { keyword: 'judion', pricePerKg: 3.50 },
  { keyword: 'alubia', pricePerKg: 2.50 },

  // Vegetables (€/kg)
  { keyword: 'tomate', pricePerKg: 2.00 },
  { keyword: 'cebolla', pricePerKg: 1.20 },
  { keyword: 'ajo', pricePerKg: 5.00 },
  { keyword: 'pimiento', pricePerKg: 2.50 },
  { keyword: 'zanahoria', pricePerKg: 1.00 },
  { keyword: 'patata', pricePerKg: 1.10 },
  { keyword: 'boniato', pricePerKg: 2.00 },
  { keyword: 'calabacín', pricePerKg: 1.80 },
  { keyword: 'calabacin', pricePerKg: 1.80 },
  { keyword: 'espinaca', pricePerKg: 5.00 },
  { keyword: 'lechuga', pricePerKg: 2.00 },
  { keyword: 'brócoli', pricePerKg: 2.50 },
  { keyword: 'brocoli', pricePerKg: 2.50 },
  { keyword: 'champiñón', pricePerKg: 4.00 },
  { keyword: 'champinon', pricePerKg: 4.00 },
  { keyword: 'berenjena', pricePerKg: 2.00 },
  { keyword: 'espárrago', pricePerKg: 5.00 },
  { keyword: 'esparrago', pricePerKg: 5.00 },
  { keyword: 'puerro', pricePerKg: 2.50 },
  { keyword: 'aguacate', pricePerKg: 5.00 },

  // Fruits (€/kg)
  { keyword: 'manzana', pricePerKg: 2.00 },
  { keyword: 'plátano', pricePerKg: 1.30 },
  { keyword: 'platano', pricePerKg: 1.30 },
  { keyword: 'naranja', pricePerKg: 1.20 },
  { keyword: 'fresa', pricePerKg: 4.00 },
  { keyword: 'kiwi', pricePerKg: 3.50 },
  { keyword: 'limón', pricePerKg: 2.00 },
  { keyword: 'limon', pricePerKg: 2.00 },

  // Nuts (€/kg)
  { keyword: 'nuez', pricePerKg: 14.00 },
  { keyword: 'nueces', pricePerKg: 14.00 },
  { keyword: 'almendra', pricePerKg: 12.00 },
  { keyword: 'cacahuete', pricePerKg: 5.00 },

  // Oils (€/L)
  { keyword: 'aceite de oliva', pricePerL: 8.00 },
  { keyword: 'aceite', pricePerL: 5.00 },

  // Pantry
  { keyword: 'miel', pricePerKg: 6.00 },
  { keyword: 'azúcar', pricePerKg: 1.00 },
  { keyword: 'azucar', pricePerKg: 1.00 },
  { keyword: 'cacao', pricePerKg: 8.00 },
]

// Default price per kg for unrecognized ingredients
const DEFAULT_PRICE_PER_KG = 4.00

function parseAmount(amountStr) {
  if (!amountStr) return { grams: 0, ml: 0, units: 0 }
  const s = amountStr.toLowerCase().trim()

  const kgMatch = s.match(/(\d+(?:[.,]\d+)?)\s*kg/)
  if (kgMatch) return { grams: parseFloat(kgMatch[1].replace(',', '.')) * 1000, ml: 0, units: 0 }

  const gMatch = s.match(/(\d+(?:[.,]\d+)?)\s*g/)
  if (gMatch) return { grams: parseFloat(gMatch[1].replace(',', '.')), ml: 0, units: 0 }

  const lMatch = s.match(/(\d+(?:[.,]\d+)?)\s*l(?:itro)?s?(?:\b|$)/i)
  if (lMatch) return { grams: 0, ml: parseFloat(lMatch[1].replace(',', '.')) * 1000, units: 0 }

  const mlMatch = s.match(/(\d+(?:[.,]\d+)?)\s*ml/)
  if (mlMatch) return { grams: 0, ml: parseFloat(mlMatch[1].replace(',', '.')), units: 0 }

  const unitMatch = s.match(/(\d+)/)
  if (unitMatch) return { grams: 0, ml: 0, units: parseInt(unitMatch[1], 10) }

  return { grams: 100, ml: 0, units: 0 } // fallback: assume 100g
}

function costFromProduct(product, amount) {
  const ppk = product.pricePerKg || 0
  // pricePerKg in catalog is €/kg or €/L depending on size_format ("kg" or "l")
  const isLiquid = (product.priceFormat || '').toLowerCase().includes('l')
  if (isLiquid && amount.ml > 0) return (ppk / 1000) * amount.ml
  if (amount.grams > 0) return (ppk / 1000) * amount.grams
  if (amount.ml > 0) return (ppk / 1000) * amount.ml
  if (amount.units > 0 && product.price > 0) return product.price * amount.units
  return (ppk / 1000) * 100
}

function costFromKeyword(name, amount) {
  const rule = PRICES.find((p) => name.includes(p.keyword))
  if (!rule) {
    return (DEFAULT_PRICE_PER_KG / 1000) * (amount.grams || 100)
  }
  if (rule.pricePerUnit && amount.units > 0) return rule.pricePerUnit * amount.units
  if (rule.pricePerL && amount.ml > 0) return (rule.pricePerL / 1000) * amount.ml
  if (rule.pricePerKg && amount.grams > 0) return (rule.pricePerKg / 1000) * amount.grams
  if (rule.pricePerL && amount.grams > 0) return (rule.pricePerL / 1000) * amount.grams
  if (rule.pricePerKg) return (rule.pricePerKg / 1000) * (amount.grams || 100)
  return (DEFAULT_PRICE_PER_KG / 1000) * (amount.grams || 100)
}

export function estimateWeeklyCost(items) {
  let total = 0
  let matched = 0
  for (const item of items) {
    const name = (item.name || '').toLowerCase()
    const amount = parseAmount(item.amount)
    const product = findMercadonaProductSync(name)
    if (product && product.pricePerKg > 0) {
      total += costFromProduct(product, amount)
      matched++
    } else {
      total += costFromKeyword(name, amount)
    }
  }
  return Math.round(total * 100) / 100
}

// Kick off catalog load early so it's ready by the time the user opens
// the shopping view. Safe to call from anywhere; idempotent.
export function preloadCatalog() {
  return getCatalog()
}
