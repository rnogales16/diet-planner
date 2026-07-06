// POST /api/auth/reset-password { token, newPassword }
// Validates a single-use reset token, sets the new password hash, marks the
// token used, and revokes ALL of the user's sessions (no auto-login — the user
// signs in again with the new password). Rate-limited by IP.

import { json, originAllowed } from '../_http.js'
import { hashToken } from '../_token.js'
import { hashPassword } from '../_password.js'
import { revokeAllSessions } from '../_session.js'
import { rateLimit } from '../_ratelimit.js'

const MIN_PW = 8
const MAX_PW = 1024

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return json({ success: false, error: 'Bad origin.' }, 403)

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const rl = await rateLimit(env, `ip:${ip}`, 'reset', { max: 20, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return json({ success: false, error: 'Too many requests. Try again later.' }, 429, {
      'Retry-After': String(rl.retryAfter),
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Invalid request.' }, 400)
  }
  const token = String(body.token || '')
  const newPassword = String(body.newPassword || '')
  if (!token || newPassword.length < MIN_PW || newPassword.length > MAX_PW) {
    return json({ success: false, error: 'Invalid token or password (min 8 characters).' }, 400)
  }

  const tokenHash = await hashToken(token)
  const now = Date.now()
  const row = await env.DB
    .prepare('SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
    .bind(tokenHash, now)
    .first()
  if (!row) return json({ success: false, error: 'Invalid or expired reset link.' }, 400)

  const passwordHash = await hashPassword(newPassword)
  await env.DB
    .prepare("UPDATE identities SET password_hash = ? WHERE user_id = ? AND provider = 'password'")
    .bind(passwordHash, row.user_id)
    .run()
  await env.DB
    .prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?')
    .bind(now, row.id)
    .run()
  await revokeAllSessions(env, row.user_id)

  return json({ success: true, message: 'Password updated. Please log in with your new password.' })
}
