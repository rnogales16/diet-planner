// GET /api/auth/me — returns the current authenticated user (via own session or
// the Access shim), so the SPA can know the login state. 401 when anonymous.

import { json } from '../_http.js'
import { resolveUser } from '../_user.js'

export async function onRequestGet({ request, env }) {
  const u = await resolveUser(request, env)
  if (!u) return json({ success: false, authenticated: false }, 401)
  return json({
    success: true,
    authenticated: true,
    user: { id: u.userId, email: u.email, via: u.via },
  })
}
