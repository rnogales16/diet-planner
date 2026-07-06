// Primary LLM provider caller with native streaming support.

//
//  The HTTP request resolves as soon as the provider sends the first token,
//     which means Cloudflare's subrequest timeout can't fire on us while
//  the model is still generating about a long plan.
//  2. As long as tokens keep arriving we are actively reading and the
//  how long the model
//     takes to finish, not some fixed 45/70/80s number.
//
// We accumulate every text delta into a single string and return it the
// same way the non-streaming version did, so callers don't need to care.

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

// Absolute safety cap in case the stream hangs. Ten minutes is generous
// enough to never fire in practice but prevents leaks.
const ABSOLUTE_TIMEOUT_MS = 10 * 60 * 1000
// Inter-chunk safety cap. If we go this long without receiving a single
// new byte from the provider, something is wrong and we bail out.
const IDLE_TIMEOUT_MS = 60 * 1000

async function streamLLM(model, apiKey, { systemPrompt, messages, temperature, maxTokens, cacheSystem }) {
  const controller = new AbortController()
  const absoluteTimer = setTimeout(() => controller.abort(), ABSOLUTE_TIMEOUT_MS)

  // When cacheSystem is true, send the system prompt as a single cache_control
  // block so Anthropic re-uses the prefix across calls within the 5min TTL.
  const system = cacheSystem
    ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
    : systemPrompt

  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages,
        stream: true,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(absoluteTimer)
    if (err.name === 'AbortError') {
      return { ok: false, status: 504, error: `Aborted after ${ABSOLUTE_TIMEOUT_MS / 1000}s absolute cap` }
    }
    return { ok: false, status: 0, error: `Network error: ${err.message}` }
  }

  if (!response.ok) {
    clearTimeout(absoluteTimer)
    const errorBody = await response.text().catch(() => '')
    return { ok: false, status: response.status, error: errorBody.slice(0, 500) || response.statusText }
  }

  if (!response.body) {
    clearTimeout(absoluteTimer)
    return { ok: false, status: 461, error: 'No response body from LLM stream' }
  }

  // Parse the SSE stream. The provider sends events
  // separated by blank lines; each `data: ...` line carries a JSON payload.
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let stopReason = null
  // Token usage. Consistent shape across callers:
  //   { input, output, cacheRead, cacheWrite } in tokens.
  // `input` is UNCACHED prompt tokens; cacheRead/cacheWrite are the prompt-cache
  // read / creation tokens (kept separate so cache effectiveness is visible and
  // can be priced correctly). Anthropic reports these on message_start and the
  // final cumulative output on the last message_delta.
  let usage = null
  let lastChunkAt = Date.now()

  try {
    while (true) {
      // Watchdog: if it's been too long since the last byte, abort.
      if (Date.now() - lastChunkAt > IDLE_TIMEOUT_MS) {
        controller.abort()
        return { ok: false, status: 504, error: `Stream idle for ${IDLE_TIMEOUT_MS / 1000}s` }
      }

      const { done, value } = await reader.read()
      if (done) break
      lastChunkAt = Date.now()
      buffer += decoder.decode(value, { stream: true })

      // Drain complete SSE events from the buffer
      let sep
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)

        let data = null
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('data:')) {
            data = line.slice(5).trim()
          }
        }
        if (!data || data === '[DONE]') continue

        let parsed
        try {
          parsed = JSON.parse(data)
        } catch {
          continue
        }

        if (parsed.type === 'message_start' && parsed.message?.usage) {
          const u = parsed.message.usage
          usage = {
            input: u.input_tokens || 0,
            output: u.output_tokens || 0,
            cacheRead: u.cache_read_input_tokens || 0,
            cacheWrite: u.cache_creation_input_tokens || 0,
          }
        } else if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          fullText += parsed.delta.text
        } else if (parsed.type === 'message_delta') {
          if (parsed.delta?.stop_reason) stopReason = parsed.delta.stop_reason
          // message_delta carries the final cumulative output token count.
          if (parsed.usage?.output_tokens != null) {
            usage = usage || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
            usage.output = parsed.usage.output_tokens
          }
        } else if (parsed.type === 'error') {
          // Provider signalled an error mid-stream.
          return {
            ok: false,
            status: 500,
            error: `LLM stream error: ${JSON.stringify(parsed.error || parsed).slice(0, 400)}`,
          }
        }
      }
    }
  } catch (err) {
    return { ok: false, status: 0, error: `Stream read failed: ${err.message}` }
  } finally {
    clearTimeout(absoluteTimer)
    try { reader.releaseLock() } catch { /* */ }
  }

  if (!fullText) {
    return { ok: false, status: 461, error: `Empty response (stop_reason: ${stopReason || 'unknown'})` }
  }

  return { ok: true, content: fullText, model, stopReason, usage }
}

export async function callPrimaryLLM({ env, model, systemPrompt, messages, temperature, maxTokens, cacheSystem }) {
  if (!env.ANTHROPIC_API_KEY) {
    return { ok: false, status: 500, error: 'Primary LLM not configured (missing API key).' }
  }
  return streamLLM(model, env.ANTHROPIC_API_KEY, { systemPrompt, messages, temperature, maxTokens, cacheSystem })
}
