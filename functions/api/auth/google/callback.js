// GET /api/auth/google/callback — Google redirects here with ?code&state.
// Validates state (anti-CSRF, single-use), exchanges the code server-side using
// the client secret + PKCE verifier, verifies the id_token against Google's
// JWKS, then links/creates the user and starts our own session.

import { consumeOAuthFlow, clearFlowCookie } from '../../_oauth.js'
import { verifyRS256 } from '../../_jwt.js'
import { createSession, sessionCookie, isSecureRequest } from '../../_session.js'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISS = ['accounts.google.com', 'https://accounts.google.com']

// Redirect to an in-app path, always clearing the flow cookie.
function redirect(origin, path, secure, extraCookie) {
  const headers = new Headers({ Location: `${origin}${path}` })
  headers.append('Set-Cookie', clearFlowCookie(secure))
  if (extraCookie) headers.append('Set-Cookie', extraCookie)
  return new Response(null, { status: 302, headers })
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const origin = url.origin
  const secure = isSecureRequest(request)

  const code = url.searchParams.get('code')
  const urlState = url.searchParams.get('state')
  const providerError = url.searchParams.get('error') // e.g. access_denied

  if (providerError || !code || !urlState) return redirect(origin, '/login?error=oauth', secure)
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return redirect(origin, '/login?error=oauth', secure)

  // 1) Validate state + single-use flow, recover the PKCE verifier.
  const flow = await consumeOAuthFlow(env, request, urlState)
  if (!flow) return redirect(origin, '/login?error=oauth', secure)

  // 2) Exchange the code for tokens server-side (client_secret + PKCE verifier).
  let tokenJson
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
        code_verifier: flow.codeVerifier,
      }),
    })
    if (!res.ok) return redirect(origin, '/login?error=oauth', secure)
    tokenJson = await res.json()
  } catch {
    return redirect(origin, '/login?error=oauth', secure)
  }
  if (!tokenJson.id_token) return redirect(origin, '/login?error=oauth', secure)

  // 3) Verify the id_token: signature (Google JWKS) + iss + aud + exp.
  const payload = await verifyRS256(tokenJson.id_token, {
    jwksUrl: GOOGLE_CERTS,
    iss: GOOGLE_ISS,
    aud: env.GOOGLE_CLIENT_ID,
  })
  if (!payload || !payload.sub || !payload.email) return redirect(origin, '/login?error=oauth', secure)

  const sub = String(payload.sub)
  const email = String(payload.email).toLowerCase()
  const googleVerified = payload.email_verified === true || payload.email_verified === 'true'
  const name = typeof payload.name === 'string' ? payload.name.slice(0, 100) : null
  const now = Date.now()

  // Google must vouch for the email. If it can't, don't create a stuck capped
  // account — send the user back with a clear reason.
  if (!googleVerified) return redirect(origin, '/login?error=email_unverified', secure)

  // 4) Resolve / link / create the user.
  let userId
  const identity = await env.DB
    .prepare("SELECT user_id FROM identities WHERE provider = 'google' AND provider_subject = ?")
    .bind(sub)
    .first()

  if (identity) {
    // Returning Google user.
    userId = identity.user_id
    await env.DB
      .prepare("UPDATE identities SET last_login_at = ? WHERE provider = 'google' AND provider_subject = ?")
      .bind(now, sub)
      .run()
  } else {
    const existing = await env.DB.prepare('SELECT id, email_verified FROM users WHERE email = ?').bind(email).first()
    if (existing) {
      // Google side is already verified (guarded above). Link ONLY when the
      // local account is also verified (anti account-takeover); otherwise refuse.
      if (existing.email_verified === 1) {
        userId = existing.id
        await env.DB
          .prepare('INSERT INTO identities (id, user_id, provider, provider_subject, email, email_verified, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
          .bind(crypto.randomUUID(), userId, 'google', sub, email, now, now)
          .run()
      } else {
        return redirect(origin, '/login?error=account_exists_unverified', secure)
      }
    } else {
      // Brand-new user. Google verified the email → email_verified = 1, so these
      // users are not subject to the generation cap.
      userId = crypto.randomUUID()
      await env.DB.batch([
        env.DB
          .prepare('INSERT INTO users (id, email, email_verified, display_name, status, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?, ?)')
          .bind(userId, email, name, 'active', now, now),
        env.DB
          .prepare('INSERT INTO identities (id, user_id, provider, provider_subject, email, email_verified, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
          .bind(crypto.randomUUID(), userId, 'google', sub, email, now, now),
      ])
    }
  }

  // 5) Start our own session and land in the app.
  const { token, expiresAt } = await createSession(env, userId, { userAgent: request.headers.get('User-Agent') })
  return redirect(origin, '/', secure, sessionCookie(token, expiresAt, { secure }))
}
