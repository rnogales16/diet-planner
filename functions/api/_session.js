// Session management for own-auth. The session token is an opaque random value
// sent in an HttpOnly cookie; only its SHA-256 is stored in D1, so a database
// leak never exposes usable tokens. 30-day expiry with throttled sliding renewal.

const COOKIE_NAME = 'session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000 // slide expiry at most once/day

function b64urlEncode(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomToken() {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(32)))
}

function readCookie(request, name) {
  const cookie = request.headers.get('Cookie') || ''
  const m = cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`))
  return m ? m[1] : null
}

// Create a fresh session (new token) for a user. Callers set the cookie from the
// returned token. A new token per login prevents session fixation.
export async function createSession(env, userId, { userAgent } = {}) {
  const token = randomToken()
  const tokenHash = await sha256hex(token)
  const now = Date.now()
  const expiresAt = now + SESSION_TTL_MS
  await env.DB
    .prepare(`INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent, revoked)
              VALUES (?, ?, ?, ?, ?, ?, ?, 0)`)
    .bind(crypto.randomUUID(), userId, tokenHash, now, expiresAt, now, (userAgent || '').slice(0, 256))
    .run()
  return { token, expiresAt }
}

// Resolve the session from the request cookie. Returns { userId, sessionId,
// refreshedExpiresAt } or null. Slides expiry at most once per RENEW_AFTER_MS.
export async function getSession(env, request) {
  const token = readCookie(request, COOKIE_NAME)
  if (!token) return null
  const tokenHash = await sha256hex(token)
  const now = Date.now()

  const row = await env.DB
    .prepare('SELECT id, user_id, expires_at, last_seen_at FROM sessions WHERE token_hash = ? AND revoked = 0')
    .bind(tokenHash)
    .first()
  if (!row || row.expires_at <= now) return null

  let refreshedExpiresAt = null
  if (!row.last_seen_at || now - row.last_seen_at > RENEW_AFTER_MS) {
    refreshedExpiresAt = now + SESSION_TTL_MS
    await env.DB
      .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
      .bind(now, refreshedExpiresAt, row.id)
      .run()
  }
  return { userId: row.user_id, sessionId: row.id, refreshedExpiresAt }
}

// Revoke the session referenced by the request cookie (logout).
export async function revokeSession(env, request) {
  const token = readCookie(request, COOKIE_NAME)
  if (!token) return
  const tokenHash = await sha256hex(token)
  await env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE token_hash = ?').bind(tokenHash).run()
}

// Revoke every session for a user (used after password reset — step b).
export async function revokeAllSessions(env, userId) {
  await env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').bind(userId).run()
}

// `secure` must be false over plain HTTP (local dev), because browsers refuse to
// store Secure cookies on http://localhost. In production (HTTPS) it's true.
export function sessionCookie(token, expiresAt, { secure = true } = {}) {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  return `${COOKIE_NAME}=${token}; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export function clearSessionCookie({ secure = true } = {}) {
  return `${COOKIE_NAME}=; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=0`
}

// Whether the request came over HTTPS (so the cookie should be Secure).
export function isSecureRequest(request) {
  try {
    return new URL(request.url).protocol === 'https:'
  } catch {
    return true // fail safe to Secure
  }
}
