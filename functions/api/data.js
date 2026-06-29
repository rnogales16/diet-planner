// Reads/writes the per-user blob in D1.

import { emailFromRequest } from './_auth.js'

const MAX_BODY_BYTES = 2 * 1024 * 1024  // 2 MB — fits ~50+ weeks of plans with macroBreakdown

// Safety net against accidental data loss. Before overwriting a user's blob
// we snapshot the previous one into user_data_backups when either:
//   - the new payload is meaningfully smaller (a likely data-loss event), or
//   - the last snapshot is older than BACKUP_MIN_INTERVAL_MS (periodic history).
// We keep the most recent BACKUP_KEEP snapshots per user and prune the rest.
const SHRINK_RATIO = 0.7                       // back up if new < 70% of old
const BACKUP_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000  // …or every 6h regardless
const BACKUP_KEEP = 20

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

  // Snapshot the previous version before overwriting, so any future bug or
  // bad write is recoverable without resorting to D1 Time Travel.
  await maybeBackup(env, email, serialised.length, now)

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

async function maybeBackup(env, email, newLen, now) {
  try {
    const existing = await env.DB
      .prepare('SELECT data, updated_at FROM user_data WHERE email = ?')
      .bind(email)
      .first()
    if (!existing) return  // nothing to back up yet

    const oldLen = existing.data.length
    const isShrink = newLen < oldLen * SHRINK_RATIO

    const last = await env.DB
      .prepare('SELECT backed_up_at FROM user_data_backups WHERE email = ? ORDER BY backed_up_at DESC LIMIT 1')
      .bind(email)
      .first()
    const isStale = !last || (now - last.backed_up_at) > BACKUP_MIN_INTERVAL_MS

    if (!isShrink && !isStale) return

    await env.DB
      .prepare('INSERT INTO user_data_backups (email, data, updated_at, backed_up_at, reason) VALUES (?, ?, ?, ?, ?)')
      .bind(email, existing.data, existing.updated_at, now, isShrink ? 'shrink' : 'periodic')
      .run()

    // Keep only the most recent BACKUP_KEEP snapshots per user.
    await env.DB
      .prepare(`
        DELETE FROM user_data_backups
        WHERE email = ? AND id NOT IN (
          SELECT id FROM user_data_backups WHERE email = ? ORDER BY backed_up_at DESC LIMIT ?
        )
      `)
      .bind(email, email, BACKUP_KEEP)
      .run()
  } catch {
    // Backups are best-effort: never block a legitimate save because the
    // safety net hiccupped.
  }
}
