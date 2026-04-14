// Extract the authenticated user's email from either the Cloudflare Access
// header or the CF_Authorization JWT cookie. Custom domains sometimes don't
// forward the header, but the cookie is always present after login.

export function emailFromRequest(request) {
  // Primary: the header Access adds
  const direct = request.headers.get('Cf-Access-Authenticated-User-Email')
  if (direct) return direct.toLowerCase()

  // Fallback: decode the JWT cookie
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(/CF_Authorization=([^;]+)/)
  if (match) {
    try {
      const payload = match[1].split('.')[1]
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
      if (decoded.email) return decoded.email.toLowerCase()
    } catch { /* */ }
  }

  return null
}
