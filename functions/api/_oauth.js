// OAuth flow state for Google sign-in: anti-CSRF `state` + PKCE, bound to the
// browser via an HttpOnly flow cookie and persisted single-use in oauth_states.
//
// What's stored where:
//   - flow cookie (browser, HttpOnly): opaque token; DB stores SHA-256(token).
//   - state: DB stores SHA-256(state); the cleartext travels in the OAuth URL
//     and is echoed back by Google, then compared by hash in the callback.
//   - code_verifier (PKCE): stored as-is — it MUST be sent to Google's token
//     endpoint, so it can't be hashed. Ephemeral (~10 min) and single-use.

import { sha256hex } from './_session.js'

const FLOW_COOKIE = 'oauth_flow'
const FLOW_TTL_MS = 10 * 60 * 1000

function b64url(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomToken(nBytes = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(nBytes)))
}

async function sha256base64url(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return b64url(new Uint8Array(buf))
}

function readCookie(request, name) {
  const cookie = request.headers.get('Cookie') || ''
  const m = cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`))
  return m ? m[1] : null
}

// Create a flow: persists (hashed) state + PKCE verifier, returns what /start
// needs — the flow-cookie token, the cleartext state, and the PKCE challenge.
export async function createOAuthFlow(env) {
  const flowToken = randomToken(32)
  const state = randomToken(32)
  const codeVerifier = randomToken(64) // ~86 chars, within PKCE's 43–128
  const codeChallenge = await sha256base64url(codeVerifier)
  const now = Date.now()
  await env.DB
    .prepare('INSERT INTO oauth_states (flow, state_hash, code_verifier, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256hex(flowToken), await sha256hex(state), codeVerifier, now, now + FLOW_TTL_MS)
    .run()
  return { flowToken, state, codeChallenge }
}

// Consume a flow in the callback: bind to the browser (flow cookie), validate
// the state (anti-CSRF), enforce single-use and TTL. Returns { codeVerifier } or
// null. Always deletes the row (single use) once found.
export async function consumeOAuthFlow(env, request, urlState) {
  const flowToken = readCookie(request, FLOW_COOKIE)
  if (!flowToken || !urlState) return null
  const flowHash = await sha256hex(flowToken)

  const row = await env.DB
    .prepare('SELECT state_hash, code_verifier, expires_at FROM oauth_states WHERE flow = ?')
    .bind(flowHash)
    .first()
  if (!row) return null

  // Single use: delete regardless of what we decide below.
  await env.DB.prepare('DELETE FROM oauth_states WHERE flow = ?').bind(flowHash).run()

  if (row.expires_at < Date.now()) return null
  const stateHash = await sha256hex(urlState)
  if (stateHash !== row.state_hash) return null

  return { codeVerifier: row.code_verifier }
}

export function flowCookie(flowToken, secure) {
  const maxAge = Math.floor(FLOW_TTL_MS / 1000)
  return `${FLOW_COOKIE}=${flowToken}; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export function clearFlowCookie(secure) {
  return `${FLOW_COOKIE}=; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=0`
}
