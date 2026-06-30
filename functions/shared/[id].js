// Public, read-only HTML view of a shared week plan, served at /shared/:id
// (NOT under /api, NOT the SPA). Reads shared_plans from D1 directly and renders
// a self-contained page — inline CSS, no scripts, no SPA assets — so a logged-out
// visitor can open the link. Like /api/shared/*, the path /shared/* must be
// excluded (Bypass) from the Cloudflare Access policy.

const MEAL_LABELS = {
  breakfast: 'Desayuno',
  morning_snack: 'Almuerzo',
  lunch: 'Comida',
  afternoon_snack: 'Merienda',
  dinner: 'Cena',
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat', 'vegetables']

// Escape EVERY interpolated string — dish names/labels come from the LLM/user.
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const n = (v) => Math.round(Number(v) || 0)

// LLM raw uses meal.dish (singular); persisted plans use meal.dishes (array).
function dishesOf(meal) {
  if (Array.isArray(meal?.dishes)) return meal.dishes
  if (meal?.dish && typeof meal.dish === 'object') return [meal.dish]
  return []
}

function emptyTotals() {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, vegetables: 0 }
}

function addDishes(acc, dishes) {
  for (const d of dishes) {
    for (const k of MACRO_KEYS) acc[k] += Number(d[k]) || 0
  }
  return acc
}

function macroLine(t) {
  return `${n(t.calories)} kcal · P${n(t.protein)} C${n(t.carbs)} F${n(t.fat)} V${n(t.vegetables)}`
}

function parseYMD(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''))
  if (!m) return null
  return { y: +m[1], mo: +m[2], d: +m[3] }
}

function fmtDay(s) {
  const p = parseYMD(s)
  if (!p) return esc(String(s || ''))
  return `${p.d} ${MESES[p.mo - 1]}`
}

function fmtRange(start, end) {
  const a = parseYMD(start)
  const b = parseYMD(end)
  if (a && b) return `${a.d} ${MESES[a.mo - 1]} – ${b.d} ${MESES[b.mo - 1]} ${b.y}`
  if (a || b) return fmtDay(start || end)
  return ''
}

function weekday(s) {
  const p = parseYMD(s)
  if (!p) return ''
  return DIAS[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()]
}

function fmtShared(ms) {
  const t = Number(ms)
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return ''
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

const STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0 16px 48px;
    font: 16px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #f6f7f9; color: #1c1d22;
  }
  .wrap { max-width: 880px; margin: 0 auto; }
  header.site { padding: 24px 0 8px; }
  .brand { font-weight: 700; font-size: 1.25rem; letter-spacing: -0.01em; }
  .sub { color: #6b7280; font-size: 0.9rem; margin-top: 2px; }
  .week-total {
    margin: 16px 0 24px; padding: 12px 16px; border-radius: 10px;
    background: #eef2ff; color: #3730a3; font-weight: 600;
  }
  .day {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
    padding: 14px 16px; margin-bottom: 14px;
  }
  .day h2 {
    margin: 0 0 2px; font-size: 1.05rem; display: flex; gap: 8px; align-items: baseline;
  }
  .day h2 .date { color: #9ca3af; font-weight: 500; font-size: 0.9rem; }
  .day-total { color: #4b5563; font-size: 0.85rem; margin-bottom: 10px; }
  .meals { list-style: none; margin: 0; padding: 0; }
  .meals li {
    display: grid; grid-template-columns: 110px 1fr auto; gap: 8px;
    padding: 6px 0; border-top: 1px solid #f0f1f3; align-items: baseline;
  }
  .meal { color: #6b7280; font-size: 0.85rem; }
  .dishes { font-weight: 500; }
  .kcal { color: #4b5563; font-size: 0.85rem; white-space: nowrap; }
  .empty { color: #9ca3af; font-style: italic; }
  footer.site { color: #9ca3af; font-size: 0.8rem; text-align: center; padding: 24px 0; }
  .msg { text-align: center; padding: 64px 16px; }
  .msg h1 { font-size: 1.4rem; margin: 0 0 8px; }
  .msg p { color: #6b7280; margin: 0; }
  @media (prefers-color-scheme: dark) {
    body { background: #15161a; color: #e7e7ea; }
    .day { background: #1f2026; border-color: #2c2e36; }
    .week-total { background: #1e1b4b; color: #c7d2fe; }
    .day h2 .date, .day-total, .meal, .kcal { color: #9ca3af; }
    .meals li { border-color: #2c2e36; }
  }
`

function shell(title, inner) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>${STYLE}</style>
</head>
<body><div class="wrap">${inner}</div></body>
</html>`
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function errorPage(status, title, message) {
  const inner = `
    <header class="site"><div class="brand">Nutriplania</div></header>
    <div class="msg"><h1>${esc(title)}</h1><p>${esc(message)}</p></div>
    <footer class="site">Nutriplania</footer>`
  return htmlResponse(shell(`${title} · Nutriplania`, inner), status)
}

function renderPlan(payload) {
  const week = payload?.week || {}
  const days = Array.isArray(week.days) ? week.days : []

  const range = fmtRange(week.startDate, week.endDate)
  const shared = fmtShared(payload?.sharedAt)

  const weekTotals = emptyTotals()
  const dayBlocks = []

  for (const day of days) {
    const meals = Array.isArray(day?.meals) ? day.meals : []
    const dayTotals = emptyTotals()
    const rows = []

    for (const meal of meals) {
      const dishes = dishesOf(meal).filter((d) => d && (d.name || n(d.calories) > 0))
      if (dishes.length === 0) continue
      addDishes(dayTotals, dishes)
      const label = MEAL_LABELS[meal.type] || meal.label || meal.type || ''
      const names = dishes.map((d) => esc(d.name || '—')).join(', ')
      const kcal = dishes.reduce((s, d) => s + (Number(d.calories) || 0), 0)
      rows.push(
        `<li><span class="meal">${esc(label)}</span>` +
        `<span class="dishes">${names}</span>` +
        `<span class="kcal">${n(kcal)} kcal</span></li>`,
      )
    }

    for (const k of MACRO_KEYS) weekTotals[k] += dayTotals[k]

    const body = rows.length
      ? `<ul class="meals">${rows.join('')}</ul>`
      : `<p class="empty">Sin comidas</p>`
    dayBlocks.push(
      `<section class="day">` +
      `<h2>${esc(weekday(day.date))} <span class="date">${esc(fmtDay(day.date))}</span></h2>` +
      `<div class="day-total">${rows.length ? macroLine(dayTotals) : ''}</div>` +
      `${body}</section>`,
    )
  }

  const subParts = []
  if (range) subParts.push(esc(range))
  if (shared) subParts.push(`compartido el ${esc(shared)}`)

  const inner = `
    <header class="site">
      <div class="brand">Nutriplania</div>
      ${subParts.length ? `<div class="sub">${subParts.join(' · ')}</div>` : ''}
    </header>
    <div class="week-total">Semana: ${macroLine(weekTotals)}</div>
    ${dayBlocks.join('') || '<p class="empty">Este plan no tiene comidas.</p>'}
    <footer class="site">Plan compartido desde Nutriplania</footer>`

  return htmlResponse(shell('Plan semanal · Nutriplania', inner))
}

export async function onRequestGet({ params, env }) {
  const id = params.id
  if (!id || id.length > 20) {
    return errorPage(404, 'Plan no encontrado', 'El enlace no es válido.')
  }

  let row
  try {
    row = await env.DB
      .prepare('SELECT data, expires_at FROM shared_plans WHERE id = ?')
      .bind(id)
      .first()
  } catch {
    return errorPage(404, 'Plan no encontrado', 'No se pudo recuperar el plan.')
  }

  if (!row) {
    return errorPage(404, 'Plan no encontrado', 'Puede que el enlace sea incorrecto o que el plan ya no exista.')
  }

  if (row.expires_at && row.expires_at < Date.now()) {
    return errorPage(410, 'Enlace caducado', 'Este enlace para compartir ha caducado (los enlaces duran 30 días).')
  }

  let payload
  try {
    payload = JSON.parse(row.data)
  } catch {
    return errorPage(500, 'Error', 'No se pudo leer este plan compartido.')
  }

  return renderPlan(payload)
}
