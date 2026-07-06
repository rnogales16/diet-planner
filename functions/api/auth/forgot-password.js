// POST /api/auth/forgot-password { email }
// Always responds generically (no user enumeration). Issues a reset token only
// when a password identity exists (social-only accounts get no reset email).
// Rate-limited by EMAIL first (spam vector), IP second. Email send is best-effort
// and never changes the response.

import { json, originAllowed } from '../_http.js'
import { rateLimit } from '../_ratelimit.js'
import { newToken } from '../_token.js'
import { sendEmail, resetEmail } from '../_email.js'

const RESET_TTL_MS = 60 * 60 * 1000
const GENERIC = {
  success: true,
  message: 'Si el email existe, te hemos enviado un enlace para restablecer la contraseña.',
}

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return json({ success: false, error: 'Bad origin.' }, 403)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Invalid request.' }, 400)
  }
  const email = String(body.email || '').trim().toLowerCase()

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const emailRl = await rateLimit(env, `email:${email}`, 'forgot', { max: 3, windowMs: 60 * 60 * 1000 })
  const ipRl = await rateLimit(env, `ip:${ip}`, 'forgot', { max: 10, windowMs: 60 * 60 * 1000 })
  if (!emailRl.ok || !ipRl.ok) {
    return json({ success: false, error: 'Too many requests. Try again later.' }, 429, {
      'Retry-After': String(Math.max(emailRl.retryAfter || 0, ipRl.retryAfter || 0)),
    })
  }

  try {
    const identity = await env.DB
      .prepare(`
        SELECT i.user_id FROM identities i JOIN users u ON u.id = i.user_id
        WHERE i.provider = 'password' AND u.email = ?
      `)
      .bind(email)
      .first()
    if (identity) {
      const { token, tokenHash } = await newToken()
      const now = Date.now()
      await env.DB
        .prepare('INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), identity.user_id, tokenHash, now, now + RESET_TTL_MS)
        .run()
      const link = `${new URL(request.url).origin}/reset-password?token=${token}`
      await sendEmail(env, { to: email, ...resetEmail(link) })
    }
  } catch {
    /* best-effort: never changes the generic response */
  }

  return json(GENERIC)
}
