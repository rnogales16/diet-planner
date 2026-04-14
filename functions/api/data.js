// Reads/writes the per-user blob in D1.

import { emailFromRequest } from './_auth.js'

const MAX_BODY_BYTES = 256 * 1024

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function onRequestGet({ request, env }) {
  const email = emailFromRequest(request)
  if (!email) return json({ success: false, error: 'Not authenticated.' }, 401)

  const row = await env.DB
    .prepare('SELECT data, updated_at FROM user_data WHERE email = ?')
    .bind(email)
    .first()

  if (!row) {
    return json({ success: true, data: null, updatedAt: null })
  }

  let parsed
  try {
    parsed = JSON.parse(row.data)
  } catch {
    return json({ success: false, error: 'Stored data is corrupted.' }, 500)
  }

  return json({ success: true, data: parsed, updatedAt: row.updated_at })
}

export async function onRequestPut({ request, env }) {
  const email = emailFromRequest(request)
  if (!email) return json({ success: false, error: 'Not authenticated.' }, 401)

  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) {
    return json({ success: false, error: 'Payload too large.' }, 413)
  }

  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400)
  }

  // The client always sends the full state object. We don't trust the shape
  // but we do require it to be a non-array object so JSON round-tripping is safe.
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ success: false, error: 'Body must be an object.' }, 400)
  }

  const now = Date.now()
  const serialised = JSON.stringify(payload)

  await env.DB
    .prepare(`
      INSERT INTO user_data (email, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `)
    .bind(email, serialised, now)
    .run()

  return json({ success: true, updatedAt: now })
}
