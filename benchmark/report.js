// Renders the benchmark results as a self-contained HTML report (+ the runner
// also writes the raw JSON next to it). The cost-per-plan figure is the most
// prominent number, since it's the one that drives the SaaS economics.

const MEAL_LABELS = {
  breakfast: 'Desayuno', morning_snack: 'Almuerzo', lunch: 'Comida',
  afternoon_snack: 'Merienda', dinner: 'Cena',
}
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
const n = (v) => Math.round(Number(v) || 0)
const eur = (v) => (v == null ? 'n/a' : `${v.toFixed(4)} €`)

function dishesOf(meal) {
  if (Array.isArray(meal?.dishes)) return meal.dishes
  if (meal?.dish && typeof meal.dish === 'object') return [meal.dish]
  return []
}

function modelById(meta, id) {
  return meta.models.find((m) => m.id === id) || { label: id }
}

// ---- aggregate summary (per model, across profiles) ---------------------
function aggregate(results, meta) {
  const rows = []
  for (const model of meta.models) {
    const cells = results.map((r) => r.cells.find((c) => c.modelId === model.id)).filter(Boolean)
    const okCells = cells.filter((c) => c.ok)
    const avg = (arr, f) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : null)
    const costs = okCells.filter((c) => c.costEur != null)
    rows.push({
      model,
      okCount: okCells.length,
      total: cells.length,
      avgCost: avg(costs, (c) => c.costEur),
      avgLatency: avg(okCells, (c) => c.latencyMs),
      // raw input = uncached + cache read/write (apples-to-apples across models)
      avgIn: avg(okCells.filter((c) => c.usage), (c) => (c.usage.input || 0) + (c.usage.cacheRead || 0) + (c.usage.cacheWrite || 0)),
      avgOut: avg(okCells.filter((c) => c.usage), (c) => c.usage.output),
      avgMatch: avg(okCells.filter((c) => c.quality?.matchPct != null), (c) => c.quality.matchPct),
      avgDrift: avg(okCells.filter((c) => c.quality?.avgDriftKcal != null), (c) => c.quality.avgDriftKcal),
    })
  }
  return rows
}

function summaryTable(rows) {
  const body = rows.map((r) => `
    <tr>
      <td class="mname">${esc(r.model.label)}</td>
      <td class="cost-cell">${r.avgCost == null ? 'n/a' : `${r.avgCost.toFixed(4)}<span class="cur"> €</span>`}</td>
      <td>${r.avgLatency == null ? '—' : `${(r.avgLatency / 1000).toFixed(1)} s`}</td>
      <td>${r.avgIn == null ? '—' : n(r.avgIn)} / ${r.avgOut == null ? '—' : n(r.avgOut)}</td>
      <td>${r.avgMatch == null ? '—' : `${n(r.avgMatch)}%`}</td>
      <td>${r.avgDrift == null ? '—' : `${n(r.avgDrift)} kcal`}</td>
      <td>${r.okCount}/${r.total}</td>
    </tr>`).join('')
  return `
    <table class="summary">
      <thead><tr>
        <th>Modelo</th>
        <th class="cost-col">Coste / plan (medio)</th>
        <th>Latencia</th>
        <th>Tokens in/out</th>
        <th>Match catálogo</th>
        <th>Drift medio</th>
        <th>OK</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`
}

// ---- rendered plan ------------------------------------------------------
function renderDish(label, dish) {
  const parts = [
    `<div class="dh"><span class="ml">${esc(label)}</span>` +
    `<strong>${esc(dish.name || '—')}</strong>` +
    `<span class="mac">${n(dish.calories)} kcal · P${n(dish.protein)} C${n(dish.carbs)} F${n(dish.fat)} V${n(dish.vegetables)}</span></div>`,
  ]
  const ings = Array.isArray(dish.ingredients) ? dish.ingredients : []
  if (ings.length) {
    parts.push(`<ul class="ings">${ings.map((i) => `<li>${esc(i?.name || '—')} <span>${esc(i?.amount || '')}</span></li>`).join('')}</ul>`)
  }
  const steps = Array.isArray(dish.instructions) ? dish.instructions.filter((s) => s && String(s).trim()) : []
  if (steps.length) {
    parts.push(`<details><summary>Receta (${steps.length})</summary><ol>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>`)
  }
  return `<div class="dish">${parts.join('')}</div>`
}

function renderPlan(plan) {
  const days = Array.isArray(plan?.days) ? plan.days : []
  if (!days.length) return '<p class="empty">Sin plan.</p>'
  const sorted = [...days].sort((a, b) => (a.dayIndex ?? 0) - (b.dayIndex ?? 0))
  return sorted.map((day) => {
    const meals = Array.isArray(day.meals) ? day.meals : []
    const blocks = []
    for (const meal of meals) {
      for (const dish of dishesOf(meal)) {
        if (dish && (dish.name || n(dish.calories) > 0)) {
          blocks.push(renderDish(MEAL_LABELS[meal.type] || meal.type || '', dish))
        }
      }
    }
    return `<section class="day"><h4>${esc(WEEKDAYS[day.dayIndex] || `Día ${n(day.dayIndex) + 1}`)}</h4>${blocks.join('') || '<p class="empty">—</p>'}</section>`
  }).join('')
}

function cellColumn(cell, meta) {
  const model = modelById(meta, cell.modelId)
  if (!cell.ok) {
    return `<div class="col"><div class="col-head"><div class="cm">${esc(model.label)}</div>
      <div class="cost fail">FALLÓ</div><div class="err">${esc(cell.error || 'error')}</div></div></div>`
  }
  const q = cell.quality || {}
  const qline = q.parsedOk === false
    ? '<span class="bad">JSON no parseó</span>'
    : q.recalcError
      ? `<span class="bad">recalc: ${esc(q.recalcError)}</span>`
      : `match ${n(q.matchPct)}% · drift ${n(q.avgDriftKcal)} kcal · escalados ${n(q.scalingsCount)}`
  return `
    <div class="col">
      <div class="col-head">
        <div class="cm">${esc(model.label)}</div>
        <div class="cost">${cell.costEur == null ? 'n/a' : `${cell.costEur.toFixed(4)}<span class="cur"> €</span>`}<span class="cost-sub"> / plan</span></div>
        <div class="meta2">${(cell.latencyMs / 1000).toFixed(1)} s · ${cell.usage ? `${n((cell.usage.input || 0) + (cell.usage.cacheRead || 0) + (cell.usage.cacheWrite || 0))}/${n(cell.usage.output)} tok · cacheR/W ${n(cell.usage.cacheRead || 0)}/${n(cell.usage.cacheWrite || 0)}` : 'tok ?'}</div>
        <div class="qual">${qline}</div>
      </div>
      <div class="plan">${renderPlan(cell.plan)}</div>
    </div>`
}

export function renderReport(results, meta) {
  const banner = meta.pricesArePlaceholders
    ? `<div class="banner">⚠️ Los precios en <code>models.config.js</code> son PLACEHOLDERS — los costes mostrados son INVÁLIDOS hasta que pongas los precios reales de cada proveedor.</div>`
    : ''

  const profileSections = results.map((r) => `
    <section class="profile">
      <h2>${esc(r.profile.label)} <span class="pid">${esc(r.profile.id)}</span></h2>
      <div class="cols">${r.cells.map((c) => cellColumn(c, meta)).join('')}</div>
    </section>`).join('')

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Benchmark LLM · Nutriplania</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; padding:0 20px 60px; font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:#0f1115; color:#e7e7ea; }
  .wrap { max-width:1600px; margin:0 auto; }
  h1 { margin:24px 0 4px; }
  .sub { color:#9aa0aa; font-size:.85rem; margin-bottom:16px; }
  .banner { background:#3a1d1d; border:1px solid #7f1d1d; color:#fca5a5; padding:12px 16px; border-radius:8px; margin:12px 0 24px; font-weight:600; }
  code { background:#1c1f27; padding:1px 5px; border-radius:4px; }
  table.summary { width:100%; border-collapse:collapse; margin:8px 0 32px; background:#161922; border-radius:10px; overflow:hidden; }
  .summary th, .summary td { padding:10px 14px; text-align:left; border-bottom:1px solid #232733; }
  .summary th { font-size:.8rem; color:#9aa0aa; text-transform:uppercase; letter-spacing:.03em; }
  .summary .mname { font-weight:600; }
  .summary th.cost-col { color:#fbbf24; }
  .cost-cell { font-size:1.5rem; font-weight:800; color:#fbbf24; white-space:nowrap; }
  .cost-cell .cur { font-size:.9rem; font-weight:600; }
  .cols { display:flex; gap:14px; overflow-x:auto; padding-bottom:8px; align-items:flex-start; }
  .col { flex:0 0 340px; background:#161922; border:1px solid #232733; border-radius:12px; }
  .col-head { padding:12px 14px; border-bottom:1px solid #232733; position:sticky; top:0; background:#161922; }
  .cm { font-weight:700; font-size:.95rem; }
  .cost { font-size:1.9rem; font-weight:800; color:#fbbf24; line-height:1.1; margin-top:4px; }
  .cost .cur { font-size:1rem; }
  .cost.fail { color:#f87171; font-size:1.1rem; }
  .cost-sub { font-size:.8rem; color:#9aa0aa; font-weight:500; }
  .meta2 { color:#9aa0aa; font-size:.82rem; margin-top:4px; }
  .qual { font-size:.8rem; margin-top:4px; color:#a7b0bd; }
  .qual .bad { color:#f87171; }
  .err { color:#f87171; font-size:.82rem; margin-top:4px; }
  .plan { padding:8px 14px 14px; max-height:70vh; overflow-y:auto; }
  .day { margin-top:10px; }
  .day h4 { margin:0 0 4px; font-size:.9rem; color:#c7d2fe; }
  .dish { padding:6px 0; border-top:1px solid #232733; }
  .dh { display:flex; flex-wrap:wrap; gap:4px 8px; align-items:baseline; }
  .ml { color:#9aa0aa; font-size:.72rem; text-transform:uppercase; }
  .mac { color:#9aa0aa; font-size:.78rem; margin-left:auto; white-space:nowrap; }
  .ings { list-style:none; margin:4px 0 0; padding:0; font-size:.82rem; }
  .ings li { display:flex; justify-content:space-between; gap:10px; color:#cbd2db; }
  .ings li span { color:#8b93a0; }
  details { margin-top:4px; } summary { cursor:pointer; color:#93c5fd; font-size:.8rem; }
  details ol { margin:4px 0 0; padding-left:18px; font-size:.82rem; color:#cbd2db; }
  .empty { color:#6b7280; font-style:italic; }
  .profile { margin-top:36px; }
  .profile h2 { border-bottom:2px solid #232733; padding-bottom:6px; }
  .pid { color:#6b7280; font-size:.8rem; font-weight:400; }
</style></head>
<body><div class="wrap">
  <h1>Benchmark LLM — generación de planes</h1>
  <div class="sub">${esc(meta.generatedAt)} · repeats=${esc(meta.repeats)} · ${esc(meta.models.length)} modelos · ${esc(results.length)} perfiles</div>
  ${banner}
  <h2>Resumen (medias por modelo)</h2>
  ${summaryTable(aggregate(results, meta))}
  ${profileSections}
</div></body></html>`

  return { html }
}
