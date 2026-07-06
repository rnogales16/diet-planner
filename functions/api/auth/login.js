// POST /api/auth/login  { email, password }
// Verifies a password identity and starts a new session. Generic errors (no user
// enumeration), rate-limited by IP and by email, Origin-checked.

import { json, originAllowed } from '../_http.js'
import { verifyPassword } from '../_password.js'
import { createSession, sessionCookie } from '../_session.js'
import { rateLimit } from '../_ratelimit.js'

// A valid-format hash to verify against when the user/identity doesn't exist, so
// login timing doesn't reveal whether an email is registered.
const DUMMY_HASH = 'pbkdf2$sha256$210000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const MAX_PW = 1024

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return json({ success: false, error: 'Bad origin.' }, 403)

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'

  let body
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Invalid request.' }, 400)
  }
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  // Rate limit BEFORE any DB/crypto work: per IP and per email.
  const ipRl = await rateLimit(env, `ip:${ip}`, 'login', { max: 30, windowMs: 15 * 60 * 1000 })
  const emailRl = await rateLimit(env, `email:${email}`, 'login', { max: 10, windowMs: 15 * 60 * 1000 })
  if (!ipRl.ok || !emailRl.ok) {
    const retryAfter = Math.max(ipRl.retryAfter || 0, emailRl.retryAfter || 0)
    return json({ success: false, error: 'Too many attempts. Try again later.' }, 429, {
      'Retry-After': String(retryAfter),
    })
  }

  if (!email || !password || password.length > MAX_PW) {
    return json({ success: false, error: 'Invalid credentials.' }, 401)
  }

  // Look up the password identity for this email.
  const identity = await env.DB
    .prepare(`
      SELECT i.id AS identity_id, i.user_id, i.password_hash
      FROM identities i
      JOIN users u ON u.id = i.user_id
      WHERE i.provider = 'password' AND u.email = ?
    `)
    .bind(email)
    .first()

  // Always run a verify (against a dummy hash if no user) to keep timing ~constant.
  const ok = await verifyPassword(password, identity?.password_hash || DUMMY_HASH)
  if (!identity || !ok) {
    return json({ success: false, error: 'Invalid credentials.' }, 401) // generic
  }

  // Success: rotate to a brand-new session token (no fixation).
  await env.DB
    .prepare('UPDATE identities SET last_login_at = ? WHERE id = ?')
    .bind(Date.now(), identity.identity_id)
    .run()

  const { token, expiresAt } = await createSession(env, identity.user_id, {
    userAgent: request.headers.get('User-Agent'),
  })

  const user = await env.DB
    .prepare('SELECT id, email, email_verified FROM users WHERE id = ?')
    .bind(identity.user_id)
    .first()

  return json(
    { success: true, user: { id: user.id, email: user.email, emailVerified: !!user.email_verified } },
    200,
    { 'Set-Cookie': sessionCookie(token, expiresAt) },
  )
}
