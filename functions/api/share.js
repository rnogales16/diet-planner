// Creates a temporary public share of a week plan by storing it in D1
// with a random key. The shared link bypasses Access because it hits
// a separate path (/api/shared/:id) that returns the plan as JSON.

import { emailFromRequest } from './_auth.js'

const MAX_SHARE_BYTES = 256 * 1024            // 256 KB — a single week plan is small
const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Unbiased random id. Rejection-samples bytes >= 252 (252 = 36*7) so every
// character in the 36-char alphabet is equally likely (no modulo bias).
function randomId(len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const buf = new Uint8Array(len)
  let id = ''
  while (id.length < len) {
    crypto.getRandomValues(buf)
    for (let i = 0; i < buf.length && id.length < len; i++) {
      const b = buf[i]
      if (b >= 252) continue
      id += chars[b % 36]
    }
  }
  return id
}

export async function onRequestPost({ request, env }) {
  const email = await emailFromRequest(request, env)
  if (!email) return json({ success: false, error: 'Not authenticated.' }, 401)

  const text = await request.text()
  if (text.length > MAX_SHARE_BYTES) {
    return json({ success: false, error: 'Payload too large.' }, 413)
  }

  let body
  try { body = JSON.parse(text) } catch {
    return json({ success: false, error: 'Invalid JSON.' }, 400)
  }

  if (!body.week) {
    return json({ success: false, error: 'Missing week data.' }, 400)
  }

  const id = randomId()
  const now = Date.now()
  const payload = JSON.stringify({
    // weekRange is optional and currently unused downstream; keep it on the
    // payload (defaulting to '') so the shape stays stable if a shared-plan
    // view starts consuming it later.
    weekRange: body.weekRange || '',
    week: body.week,
    sharedAt: now,
  })

  try {
    await env.DB.prepare(
      'INSERT INTO shared_plans (id, data, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(id, payload, email, now, now + SHARE_TTL_MS).run()
  } catch (e) {
    console.error('share INSERT failed:', e)
    return json({ success: false, error: 'Could not create share.' }, 500)
  }

  return json({ success: true, id })
}
