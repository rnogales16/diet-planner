// RS256 JWT verification against a JWKS. Extracted from the Cloudflare Access
// verifier so the same battle-tested logic (in-memory cache with TTL, a single
// forced re-fetch on a kid miss for key rotation, RSASSA-PKCS1-v1_5 via
// crypto.subtle) is reused for Google's id_token — no npm deps.
//
// Used by:
//   - _auth.js            (Cloudflare Access CF_Authorization cookie)
//   - auth/google/callback (Google OIDC id_token)

const JWKS_TTL_MS = 10 * 60 * 1000

// Cache keyed by JWKS URL so multiple issuers (Access, Google) coexist.
const jwksCache = new Map() // url -> { keys, fetchedAt }

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

async function fetchKeys(jwksUrl) {
  const res = await fetch(jwksUrl)
  if (!res.ok) throw new Error(`JWKS fetch failed (${res.status})`)
  const body = await res.json()
  const keys = Array.isArray(body.keys) ? body.keys : []
  jwksCache.set(jwksUrl, { keys, fetchedAt: Date.now() })
  return keys
}

async function getKeys(jwksUrl, forceRefresh) {
  const cached = jwksCache.get(jwksUrl)
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) {
    return cached.keys
  }
  return fetchKeys(jwksUrl)
}

// Find the signing key by kid. If it's missing from the cached set the keys may
// have rotated, so force a single re-fetch and try again.
async function findKey(jwksUrl, kid) {
  let keys = await getKeys(jwksUrl, false)
  let jwk = keys.find((k) => k.kid === kid)
  if (!jwk) {
    keys = await getKeys(jwksUrl, true)
    jwk = keys.find((k) => k.kid === kid)
  }
  return jwk || null
}

async function verifySignature(jwk, signedData, sigB64) {
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64urlToBytes(sigB64),
    new TextEncoder().encode(signedData),
  )
}

// Verify an RS256 JWT. Checks: alg=RS256, signature against the JWKS, exp/nbf,
// and — when provided — iss (string or array of accepted issuers) and aud.
// Returns the decoded payload object on success, or null on any failure. Never
// throws (fails closed).
export async function verifyRS256(token, { jwksUrl, iss, aud } = {}) {
  if (!token || !jwksUrl) return null
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

  if (header.alg !== 'RS256' || !header.kid) return null

  let jwk
  try {
    jwk = await findKey(jwksUrl, header.kid)
  } catch {
    return null // JWKS unreachable → fail closed
  }
  if (!jwk) return null

  let ok
  try {
    ok = await verifySignature(jwk, `${headerB64}.${payloadB64}`, sigB64)
  } catch {
    return null
  }
  if (!ok) return null

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === 'number' && payload.exp < now) return null
  if (typeof payload.nbf === 'number' && payload.nbf > now) return null

  if (iss) {
    const allowed = Array.isArray(iss) ? iss : [iss]
    if (!allowed.includes(payload.iss)) return null
  }
  if (aud) {
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
    if (!auds.includes(aud)) return null
  }

  return payload
}
