// Lazy loader + matcher for the Mercadona product catalog.
// Catalog is fetched once and cached in memory for the session.

let catalogPromise = null
let tokenIndex = null

const STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'y', 'con', 'en', 'al', 'del',
  'sin', 'a', 'para', 'por', 'un', 'una', 'unos', 'unas',
  'sabor', 'tipo', 'estilo', 'hacendado',
])

function stem(t) {
  // Crude singular/plural stem: strip trailing 's' or 'es' (>=4 char roots).
  if (t.length > 5 && t.endsWith('es')) return t.slice(0, -2)
  if (t.length > 4 && t.endsWith('s')) return t.slice(0, -1)
  return t
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map(stem)
}

async function loadCatalog() {
  if (catalogPromise) return catalogPromise
  catalogPromise = fetch('/mercadona-catalog.json')
    .then((r) => r.json())
    .then((products) => {
      tokenIndex = products.map((p) => ({
        product: p,
        tokens: new Set(normalize(p.name)),
      }))
      return products
    })
    .catch((e) => {
      console.warn('Failed to load Mercadona catalog', e)
      tokenIndex = []
      return []
    })
  return catalogPromise
}

// Match an ingredient name against the catalog.
// Returns the best-scoring product or null.
function matchProduct(ingredientName) {
  if (!tokenIndex || tokenIndex.length === 0) return null
  const queryTokens = normalize(ingredientName)
  if (queryTokens.length === 0) return null
  const querySet = new Set(queryTokens)

  let best = null
  let bestScore = 0
  for (const entry of tokenIndex) {
    let overlap = 0
    for (const t of querySet) if (entry.tokens.has(t)) overlap++
    if (overlap === 0) continue
    // Jaccard-like: rewards covering the query AND penalizes products with
    // many extra tokens (so "Arroz redondo" beats "Tortitas de arroz con
    // chocolate" for query "arroz").
    const union = querySet.size + entry.tokens.size - overlap
    const coverage = overlap / querySet.size
    const score = coverage * (overlap / union)
    if (score > bestScore) {
      bestScore = score
      best = entry.product
    }
  }
  // Require all query tokens covered (or at least half if query is large)
  const minScore = querySet.size <= 2 ? 0.25 : 0.15
  if (bestScore < minScore) return null
  return best
}

export async function getCatalog() {
  return loadCatalog()
}

export async function findMercadonaProduct(name) {
  await loadCatalog()
  return matchProduct(name)
}

// Synchronous version — assumes catalog is already loaded.
export function findMercadonaProductSync(name) {
  return matchProduct(name)
}
