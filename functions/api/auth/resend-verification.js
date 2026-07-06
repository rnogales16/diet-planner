// POST /api/auth/resend-verification — resend the verification email. Requires
// an own session (a logged-in but unverified user). Rate-limited by EMAIL first
// (the real spam vector: flooding a victim's inbox), IP second. Generic response.

import { json, originAllowed } from '../_http.js'
import { resolveUser } from '../_user.js'
import { rateLimit } from '../_ratelimit.js'
import { newToken } from '../_token.js'
import { sendEmail, verificationEmail } from '../_email.js'

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000
const GENERIC = { success: true, message: 'If applicable, a verification email was sent.' }

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return json({ success: false, error: 'Bad origin.' }, 403)

  const auth = await resolveUser(request, env)
  // Only own-session, still-unverified users need a resend. Everything else
  // (anonymous, Access user, already verified) gets the generic response.
  if (!auth || !auth.userId || auth.emailVerified) return json(GENERIC)

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const emailRl = await rateLimit(env, `email:${auth.email}`, 'verify', { max: 3, windowMs: 60 * 60 * 1000 })
  const ipRl = await rateLimit(env, `ip:${ip}`, 'verify', { max: 10, windowMs: 60 * 60 * 1000 })
  if (!emailRl.ok || !ipRl.ok) {
    return json({ success: false, error: 'Too many requests. Try again later.' }, 429, {
      'Retry-After': String(Math.max(emailRl.retryAfter || 0, ipRl.retryAfter || 0)),
    })
  }

  try {
    const { token, tokenHash } = await newToken()
    const now = Date.now()
    await env.DB
      .prepare('INSERT INTO email_verification_tokens (id, user_id, token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), auth.userId, tokenHash, auth.email, now, now + VERIFICATION_TTL_MS)
      .run()
    const link = `${new URL(request.url).origin}/api/auth/verify-email?token=${token}`
    await sendEmail(env, { to: auth.email, ...verificationEmail(link) })
  } catch {
    /* best-effort */
  }

  return json(GENERIC)
}
