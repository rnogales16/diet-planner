// Resolve the authenticated user's email from a request.
//
// Primary path: the `Cf-Access-Authenticated-User-Email` header. Cloudflare
// Access injects this after it has verified the user, so it is trusted as-is.
//
// Fallback path: the `CF_Authorization` JWT cookie. Custom domains sometimes
// don't forward the header, but the cookie is always present after login.
// This token is attacker-controllable, so we cryptographically verify it
// (RS256 signature against the team's JWKS, plus exp/nbf/aud) before trusting
// any claim. Anything that doesn't fully verify fails closed (returns null).

const JWKS_TTL_MS = 10 * 60 * 1000 // 10 minutes

// In-memory JWKS cache, scoped to the worker isolate.
let jwksCache = { url: null, keys: null, fetchedAt: 0 }

export async function emailFromRequest(request, env) {
  // Primary: the header Access adds — trusted, no verification needed.
  const direct = request.headers.get('Cf-Access-Authenticated-User-Email')
  if (direct) return direct.toLowerCase()

  // Fallback: the JWT cookie — must be cryptographically verified.
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(/CF_Authorization=([^;]+)/)
  if (!match) return null

  try {
    return await verifyAccessJWT(match[1], env)
  } catch {
    return null
  }
}

// Verify a Cloudflare Access JWT and return its lowercased email, or null.
export async function verifyAccessJWT(token, env) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts

  let header, payload
  try {
    header = JSON.parse(decodeUtf8(base64urlToBytes(headerB64)))
    payload = JSON.parse(decodeUtf8(base64urlToBytes(payloadB64)))
  } catch {
    return null
  }

  if (header.alg !== 'RS256') return null
  if (!header.kid) return null

  const certsUrl = resolveCertsUrl(env)
  if (!certsUrl) return null // misconfigured: fail closed

  // Look up the signing key by kid. If it's missing from the cached set the
  // keys may have rotated, so force a single re-fetch and try again.
  let jwk = await findKey(certsUrl, header.kid, false)
  if (!jwk) jwk = await findKey(certsUrl, header.kid, true)
  if (!jwk) return null

  const ok = await verifySignature(jwk, `${headerB64}.${payloadB64}`, sigB64)
  if (!ok) return null

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === 'number' && payload.exp < now) return null
  if (typeof payload.nbf === 'number' && payload.nbf > now) return null

  // Validate the audience when an expected AUD is configured.
  const expectedAud = env && env.ACCESS_AUD
  if (expectedAud) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
    if (!aud.includes(expectedAud)) return null
  }

  if (!payload.email) return null
  return String(payload.email).toLowerCase()
}

function resolveCertsUrl(env) {
  if (!env) return null
  if (env.ACCESS_CERTS_URL) return env.ACCESS_CERTS_URL
  const team = env.ACCESS_TEAM_DOMAIN
  if (!team) return null
  // Accept either "myteam" or "myteam.cloudflareaccess.com".
  const host = team.includes('.') ? team : `${team}.cloudflareaccess.com`
  return `https://${host}/cdn-cgi/access/certs`
}

async function findKey(certsUrl, kid, forceRefresh) {
  const keys = await getJWKS(certsUrl, forceRefresh)
  return keys.find((k) => k.kid === kid) || null
}

async function getJWKS(certsUrl, forceRefresh) {
  const now = Date.now()
  const fresh =
    jwksCache.keys &&
    jwksCache.url === certsUrl &&
    now - jwksCache.fetchedAt < JWKS_TTL_MS
  if (!forceRefresh && fresh) return jwksCache.keys

  const res = await fetch(certsUrl)
  if (!res.ok) throw new Error(`JWKS fetch failed (${res.status})`)
  const body = await res.json()
  const keys = Array.isArray(body.keys) ? body.keys : []
  jwksCache = { url: certsUrl, keys, fetchedAt: now }
  return keys
}

async function verifySignature(jwk, signedData, sigB64) {
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const sig = base64urlToBytes(sigB64)
  const data = new TextEncoder().encode(signedData)
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data)
}

function base64urlToBytes(s) {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  if (pad) b64 += '='.repeat(4 - pad)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function decodeUtf8(bytes) {
  return new TextDecoder().decode(bytes)
}
