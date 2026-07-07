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

import { verifyRS256 } from './_jwt.js'

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
  const jwksUrl = resolveCertsUrl(env)
  if (!jwksUrl) return null // misconfigured: fail closed

  const payload = await verifyRS256(token, {
    jwksUrl,
    // Access tokens don't carry a fixed iss we pin here; aud is checked when the
    // application's AUD tag is configured (ACCESS_AUD).
    aud: env && env.ACCESS_AUD ? env.ACCESS_AUD : undefined,
  })
  if (!payload || !payload.email) return null
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
