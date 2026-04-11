// Caller for Anthropic's Messages API (Claude).
// Same shape as _gemini.js so the rest of the codebase can swap providers
// without caring about HTTP details.

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// Hard per-call timeout. Long enough that Claude Sonnet can actually finish
// a full 7-day plan (typically 30-60s) without us prematurely aborting and
// burning tokens we still get charged for.
const CALL_TIMEOUT_MS = 70000

async function callOnce(model, apiKey, { systemPrompt, messages, temperature, maxTokens }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)

  let upstream
  try {
    upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages,
      }),
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
    return { ok: false, status: upstream.status, error: errorBody.slice(0, 500) || upstream.statusText }
  }

  const result = await upstream.json()
  // Claude returns { content: [{ type: 'text', text: '...' }, ...] }
  const content = Array.isArray(result?.content)
    ? result.content.filter((b) => b.type === 'text').map((b) => b.text || '').join('')
    : ''
  if (!content) {
    const reason = result?.stop_reason || 'unknown'
    return { ok: false, status: 461, error: `Empty response (stop_reason: ${reason})` }
  }
  return { ok: true, content, model }
}

export async function callClaude({ env, model, systemPrompt, messages, temperature, maxTokens }) {
  if (!env.ANTHROPIC_API_KEY) {
    return { ok: false, status: 500, error: 'Claude is not configured (no ANTHROPIC_API_KEY).' }
  }
  return callOnce(model, env.ANTHROPIC_API_KEY, { systemPrompt, messages, temperature, maxTokens })
}
