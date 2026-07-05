// DeepSeek caller for the benchmark. DeepSeek exposes an OpenAI-compatible
// chat-completions API, so this is a thin wrapper. Returns the same shape as
// the production Anthropic/Gemini callers: { ok, content, model, usage } with
// usage = { input, output } in tokens.
//
// This lives under benchmark/ (not functions/) because production doesn't use
// DeepSeek. If it ever does, move it into functions/api/.

const ENDPOINT = 'https://api.deepseek.com/chat/completions'

export async function callDeepSeek({ apiKey, model, systemPrompt, userPrompt, temperature = 0.7, maxTokens = 8192, timeoutMs = 120000 }) {
  if (!apiKey) return { ok: false, status: 500, error: 'No DeepSeek API key provided.' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        stream: false,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') return { ok: false, status: 504, error: `Timed out after ${timeoutMs / 1000}s` }
    return { ok: false, status: 0, error: `Network error: ${err.message}` }
  }
  clearTimeout(timer)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, status: res.status, error: body.slice(0, 300) || res.statusText }
  }

  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content || ''
  const u = json?.usage
  const usage = u ? { input: u.prompt_tokens || 0, output: u.completion_tokens || 0 } : null
  if (!content) return { ok: false, status: 461, error: 'Empty response', usage }
  return { ok: true, content, model, usage }
}
