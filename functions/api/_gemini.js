// Shared Gemini caller with key + model cascade fallback.
// Both API keys live in different Google Cloud projects so they have
// independent quotas. We try every (model, key) combination once,
// with a hard per-call timeout so Cloudflare's 100s wall clock is safe.

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

// Hard per-call timeout. Gemini Pro can take 30-60s on a complex meal plan,
// so we give it 45s and then move on. With 2 keys that's a worst case of 90s,
// safely under Cloudflare's 100s limit.
const CALL_TIMEOUT_MS = 45000

function getKeys(env) {
  return [env.GEMINI_API_KEY, env.GEMINI_API_KEY_BACKUP].filter(Boolean)
}

async function callOnce(model, key, payload) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)

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
      return { ok: false, status: 504, error: `Timed out after ${CALL_TIMEOUT_MS / 1000}s` }
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
    return { ok: false, status: 502, error: `Empty response (finish reason: ${reason})` }
  }
  return { ok: true, content, model }
}

// Try every (model, key) combo until one succeeds. Only retries on 429.
// Returns { ok, content, model, attempts, lastError }.
export async function callGeminiWithFallback({ env, payload, models }) {
  const keys = getKeys(env)
  if (keys.length === 0) {
    return { ok: false, status: 500, error: 'Server is not configured (no Gemini API keys).' }
  }

  let lastError = 'No attempts made.'
  let lastStatus = 500
  const attempts = []

  for (const model of models) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const result = await callOnce(model, key, payload)
      attempts.push({ model, keyIndex: i, status: result.status || (result.ok ? 200 : 0) })

      if (result.ok) {
        return { ...result, attempts }
      }

      lastError = result.error
      lastStatus = result.status

      // Auth errors are permanent: don't bother trying the next key with the same model
      if (result.status === 401 || result.status === 403) {
        // ...but we *do* want to try the next key, in case one of them is bad
        continue
      }

      // Rate limit: keep going through the cascade
      if (result.status === 429) continue

      // Any other error (5xx, 0 for network, etc.): same — keep trying, in case the next key works
      continue
    }
  }

  return { ok: false, status: lastStatus, error: lastError, attempts }
}
