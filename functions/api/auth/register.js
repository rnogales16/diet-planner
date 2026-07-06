// POST /api/auth/register  { email, password, displayName? }
// Creates a user + password identity and starts a session. Generic response when
// the email already exists (no enumeration). Rate-limited by IP, Origin-checked.
// No email verification is sent in piece (a): users are created email_verified=0.

import { json, originAllowed } from '../_http.js'
import { hashPassword } from '../_password.js'
import { createSession, sessionCookie } from '../_session.js'
import { rateLimit } from '../_ratelimit.js'
import { newToken } from '../_token.js'
import { sendEmail, verificationEmail } from '../_email.js'

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

// Create a verification token and email the link. Best-effort: an email failure
// must never fail registration (the user is already created with a session and
// can request a resend).
async function sendVerification(env, request, userId, email) {
  try {
    const { token, tokenHash } = await newToken()
    const now = Date.now()
    await env.DB
      .prepare('INSERT INTO email_verification_tokens (id, user_id, token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), userId, tokenHash, email, now, now + VERIFICATION_TTL_MS)
      .run()
    const link = `${new URL(request.url).origin}/api/auth/verify-email?token=${token}`
    await sendEmail(env, { to: email, ...verificationEmail(link) })
  } catch {
    /* best-effort: ignore */
  }
}

const MIN_PW = 8
const MAX_PW = 1024
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return json({ success: false, error: 'Bad origin.' }, 403)

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const rl = await rateLimit(env, `ip:${ip}`, 'register', { max: 5, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return json({ success: false, error: 'Too many registrations. Try again later.' }, 429, {
      'Retry-After': String(rl.retryAfter),
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Invalid request.' }, 400)
  }
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const displayName = body.displayName ? String(body.displayName).slice(0, 100) : null

  if (!EMAIL_RE.test(email) || password.length < MIN_PW || password.length > MAX_PW) {
    return json({ success: false, error: 'Enter a valid email and a password of at least 8 characters.' }, 400)
  }

  // If the email already exists, respond generically without creating or
  // revealing existence. (UX is refined in step b when email is available.)
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) {
    return json({ success: true, message: 'If the email is available, the account was created. Try logging in.' })
  }

  const now = Date.now()
  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)

  await env.DB.batch([
    env.DB
      .prepare('INSERT INTO users (id, email, email_verified, display_name, status, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?)')
      .bind(userId, email, displayName, 'active', now, now),
    env.DB
      .prepare('INSERT INTO identities (id, user_id, provider, provider_subject, email, email_verified, password_hash, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)')
      .bind(crypto.randomUUID(), userId, 'password', userId, email, passwordHash, now, now),
  ])

  await sendVerification(env, request, userId, email)

  const { token, expiresAt } = await createSession(env, userId, {
    userAgent: request.headers.get('User-Agent'),
  })

  return json(
    { success: true, user: { id: userId, email, emailVerified: false } },
    200,
    { 'Set-Cookie': sessionCookie(token, expiresAt) },
  )
}
