// Shared Gemini caller with key + model cascade fallback.
// Both API keys live in different Google Cloud projects so they have
// independent quotas. We try every (model, key) combination once,
// with a hard per-call timeout so Cloudflare's 100s wall clock is safe.

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

// Default per-call timeout. Callers can override via options.timeoutMs.
const DEFAULT_TIMEOUT_MS = 45000

function getKeys(env, { freeOnly = false } = {}) {
  if (freeOnly) {
    // Only the primary (free-tier) key for fallback attempts
    // and we do NOT want to burn money on the billed backup key.
    return [env.GEMINI_API_KEY].filter(Boolean)
  }
  return [env.GEMINI_API_KEY, env.GEMINI_API_KEY_BACKUP].filter(Boolean)
}

async function callOnce(model, key, payload, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let upstream
  try {
    upstream = await fetch(`${ENDPOINT(model)}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      return { ok: false, status: 504, error: `Timed out after ${timeoutMs / 1000}s` }
    }
    return { ok: false, status: 0, error: `Network error: ${err.message}` }
  }
  clearTimeout(timeout)

  if (!upstream.ok) {
    const errorBody = await upstream.text().catch(() => '')
    return { ok: false, status: upstream.status, error: errorBody.slice(0, 300) || upstream.statusText }
  }

  const result = await upstream.json()
  const content = result?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
  if (!content) {
    const reason = result?.candidates?.[0]?.finishReason || 'unknown'
    // Use a non-5xx custom status so the cascade does NOT misclassify this
    // as an upstream overload. Empty content is a model-side decision.
    return { ok: false, status: 461, error: `Empty response (finish reason: ${reason})` }
  }
  return { ok: true, content, model }
}

// Try every (model, key) combo until one succeeds.
// Special case: if a (model, key) call times out, skip the remaining keys for
// the SAME model and go straight to the next model. A timeout almost always
// means Google's serving capacity for that model is overloaded — burning
// another 45s on the same model is wasted budget.
//
// Returns { ok, content, model, attempts, lastError }.
export async function callGeminiWithFallback({ env, payload, models, freeOnly = false, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const keys = getKeys(env, { freeOnly })
  if (keys.length === 0) {
    return { ok: false, status: 500, error: 'Server is not configured (no Gemini API keys).' }
  }

  let lastError = 'No attempts made.'
  let lastStatus = 500
  const attempts = []

  for (const model of models) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const result = await callOnce(model, key, payload, timeoutMs)
      attempts.push({ model, keyIndex: i, status: result.status || (result.ok ? 200 : 0) })

      if (result.ok) {
        return { ...result, attempts }
      }

      lastError = result.error
      lastStatus = result.status

      // Stop everything on timeout. A 504 means we burned the whole budget
      // on this combo and the next one would probably do the same, and each
      // aborted call may still cost money on a billed key.
      if (result.status === 504) {
        return { ok: false, status: lastStatus, error: lastError, attempts }
      }
    }
  }

  return { ok: false, status: lastStatus, error: lastError, attempts }
}
