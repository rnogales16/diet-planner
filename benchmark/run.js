// Internal LLM benchmark for meal-plan generation.
//
// Generates the SAME weekly plan (same prompt, same input) with several models,
// then records, per (profile × model): the full plan, real input/output tokens,
// computed cost, and generation latency. Reuses the production prompt builder,
// JSON extractor, profile sanitizer and macro recalculator — no duplication.
//
// This is a LOCAL tool. It does NOT touch production, /api, Access or D1. It
// calls the LLM providers directly with your keys and incurs real API cost.
//
// Usage:
//   npm run bench                 # all (non-skipped) profiles × all models
//   npm run bench -- --profile=weight-loss-deficit
//   npm run bench -- --repeats=3  # average latency/cost over N runs per cell

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { MODELS, GEN, PRICES_ARE_PLACEHOLDERS } from './models.config.js'
import { PROFILES } from './profiles.js'
import { callDeepSeek } from './providers/deepseek.js'
import { renderReport } from './report.js'

// Reused production code (additive exports; behaviour unchanged in prod).
import {
  buildSystemPrompt,
  buildUserPrompt,
  extractJsonLoose,
  sanitizeProfile,
} from '../functions/api/generate-meal-plan.js'
import { callPrimaryLLM } from '../functions/api/_llm.js'
import { callGeminiOnce } from '../functions/api/_gemini.js'
import { recalculatePlan } from '../functions/api/_recalculate.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const VALID_MEAL_TYPES = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']

// ---- env ----------------------------------------------------------------
function loadEnv() {
  const env = {}
  const devVars = join(HERE, '..', '.dev.vars')
  if (existsSync(devVars)) {
    for (const line of readFileSync(devVars, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i === -1) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      env[k] = v
    }
  }
  // process.env overrides .dev.vars
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GEMINI_API_KEY_BACKUP', 'DEEPSEEK_API_KEY']) {
    if (process.env[k]) env[k] = process.env[k]
  }
  return env
}

// ---- args ---------------------------------------------------------------
function parseArgs() {
  const out = { profile: null, repeats: 1 }
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)=(.*)$/.exec(a)
    if (!m) continue
    if (m[1] === 'profile') out.profile = m[2]
    if (m[1] === 'repeats') out.repeats = Math.max(1, parseInt(m[2], 10) || 1)
  }
  return out
}

function enabledMealTypesFor(profile) {
  const wanted = Array.isArray(profile.enabledMeals) && profile.enabledMeals.length
    ? profile.enabledMeals
    : VALID_MEAL_TYPES
  const ordered = VALID_MEAL_TYPES.filter((t) => wanted.includes(t))
  return ordered.length ? ordered : VALID_MEAL_TYPES
}

function costEur(usage, pricing) {
  if (!usage) return null
  return (usage.input / 1e6) * pricing.inputPerM + (usage.output / 1e6) * pricing.outputPerM
}

// ---- provider dispatch --------------------------------------------------
async function callModel(model, env, { systemPrompt, userPrompt }) {
  if (model.provider === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) return { ok: false, error: 'missing ANTHROPIC_API_KEY' }
    return callPrimaryLLM({
      env, model: model.model, systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: GEN.temperature, maxTokens: GEN.maxTokens, cacheSystem: false,
    })
  }
  if (model.provider === 'gemini') {
    if (!env.GEMINI_API_KEY) return { ok: false, error: 'missing GEMINI_API_KEY' }
    return callGeminiOnce({
      apiKey: env.GEMINI_API_KEY, model: model.model, timeoutMs: GEN.timeoutMs,
      payload: {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: GEN.temperature, topP: 0.9,
          responseMimeType: 'application/json', maxOutputTokens: 16384,
        },
      },
    })
  }
  if (model.provider === 'deepseek') {
    if (!env.DEEPSEEK_API_KEY) return { ok: false, error: 'missing DEEPSEEK_API_KEY' }
    return callDeepSeek({
      apiKey: env.DEEPSEEK_API_KEY, model: model.model, systemPrompt, userPrompt,
      temperature: GEN.temperature, maxTokens: 8192, timeoutMs: GEN.timeoutMs,
    })
  }
  return { ok: false, error: `unknown provider: ${model.provider}` }
}

// ---- one cell (profile × model), possibly averaged over repeats ---------
async function runCell(model, profileEntry, env, repeats) {
  const sanitized = sanitizeProfile(profileEntry.profile)
  const enabledMealTypes = enabledMealTypesFor(sanitized)
  const systemPrompt = buildSystemPrompt(GEN.language, enabledMealTypes)
  const userPrompt = buildUserPrompt({ profile: sanitized, fridgeContents: '', weeklyExtras: '', enabledMealTypes })

  const latencies = []
  let last = null

  for (let r = 0; r < repeats; r++) {
    const t0 = Date.now()
    const res = await callModel(model, env, { systemPrompt, userPrompt })
    const latencyMs = Date.now() - t0
    latencies.push(latencyMs)
    last = { res, latencyMs }
  }

  const { res, latencyMs } = last
  const avgLatencyMs = Math.round(latencies.reduce((s, x) => s + x, 0) / latencies.length)

  if (!res.ok) {
    return {
      modelId: model.id, ok: false, error: res.error || `status ${res.status}`,
      latencyMs: avgLatencyMs, usage: res.usage || null, costEur: costEur(res.usage, model.pricing),
    }
  }

  // Parse + recalc (reuse production logic) for an automated quality signal.
  let quality = null
  let renderPlan = null
  const parsed = extractJsonLoose(res.content)
  if (parsed) {
    try {
      const { plan: corrected, summary } = recalculatePlan(parsed, {
        profile: sanitized, enabledMealTypes, scaleToTarget: true,
      })
      renderPlan = corrected
      const drifts = summary?.drifts || []
      const avgDrift = drifts.length
        ? Math.round(drifts.reduce((s, d) => s + Math.abs(d.delta || 0), 0) / drifts.length)
        : 0
      quality = {
        parsedOk: true,
        dishesTotal: summary?.dishesTotal ?? 0,
        dishesFullyMatched: summary?.dishesFullyMatched ?? 0,
        matchPct: summary?.dishesTotal ? Math.round((summary.dishesFullyMatched / summary.dishesTotal) * 100) : 0,
        avgDriftKcal: avgDrift,
        scalingsCount: (summary?.scalings || []).length,
        dayTarget: summary?.dayTarget ?? 0,
      }
    } catch (e) {
      quality = { parsedOk: true, recalcError: String(e?.message || e) }
      renderPlan = parsed
    }
  } else {
    quality = { parsedOk: false }
  }

  return {
    modelId: model.id, ok: true,
    latencyMs: avgLatencyMs,
    usage: res.usage || null,
    costEur: costEur(res.usage, model.pricing),
    quality,
    plan: renderPlan,
    enabledMealTypes,
  }
}

// ---- main ---------------------------------------------------------------
async function main() {
  const env = loadEnv()
  const args = parseArgs()

  let profiles = PROFILES.filter((p) => !p.skip)
  if (args.profile) profiles = profiles.filter((p) => p.id === args.profile)
  if (profiles.length === 0) {
    console.error(`No profiles to run (filter: ${args.profile || 'none'}). Check --profile or the "skip" flags in profiles.js.`)
    process.exit(1)
  }

  console.log(`Benchmark: ${profiles.length} profile(s) × ${MODELS.length} model(s), repeats=${args.repeats}`)
  if (PRICES_ARE_PLACEHOLDERS) {
    console.log('⚠️  Prices in models.config.js are PLACEHOLDERS — computed costs are INVALID until you edit them.')
  }

  const results = [] // [{ profile: {id,label}, cells: [cell...] }]

  for (const p of profiles) {
    console.log(`\n▶ Profile: ${p.label} (${p.id})`)
    const cells = []
    for (const model of MODELS) {
      process.stdout.write(`  · ${model.label} … `)
      try {
        const cell = await runCell(model, p, env, args.repeats)
        cells.push(cell)
        if (cell.ok) {
          const c = cell.costEur == null ? 'n/a' : cell.costEur.toFixed(4)
          console.log(`ok  ${cell.latencyMs}ms  in/out=${cell.usage?.input ?? '?'}/${cell.usage?.output ?? '?'}  cost=${c}€  match=${cell.quality?.matchPct ?? '?'}%`)
        } else {
          console.log(`FAIL  ${cell.error}`)
        }
      } catch (e) {
        console.log(`ERROR  ${e?.message || e}`)
        cells.push({ modelId: model.id, ok: false, error: String(e?.message || e) })
      }
    }
    results.push({ profile: { id: p.id, label: p.label }, cells })
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    pricesArePlaceholders: PRICES_ARE_PLACEHOLDERS,
    repeats: args.repeats,
    models: MODELS,
  }

  const outDir = join(HERE, 'out')
  mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const htmlPath = join(outDir, `report-${stamp}.html`)
  const jsonPath = join(outDir, `report-${stamp}.json`)

  const { html } = renderReport(results, meta)
  writeFileSync(htmlPath, html)
  writeFileSync(jsonPath, JSON.stringify({ meta, results }, null, 2))

  console.log(`\n✅ Report written:\n   ${htmlPath}\n   ${jsonPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
