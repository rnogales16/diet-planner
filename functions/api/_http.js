// Small HTTP helpers shared by the auth endpoints.

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

// CSRF defense for cookie-authenticated mutations: if the browser sent an
// Origin header, it must match the request Host. Requests without an Origin
// (same-origin navigations, curl, server-to-server) are allowed. Combined with
// the SameSite=Lax session cookie this blocks cross-site state-changing calls.
export function originAllowed(request) {
  const origin = request.headers.get('Origin')
  if (!origin) return true
  try {
    return new URL(origin).host === request.headers.get('Host')
  } catch {
    return false
  }
}
