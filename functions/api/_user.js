// resolveUser: the transition shim. Prefers the app's own session; falls back
// to Cloudflare Access (the current mechanism). Always returns an `email` when
// authenticated, so endpoints that are still keyed by email (e.g. data.js) keep
// working unchanged whether the user arrived via session or via Access. `userId`
// is only present for own-session users (used later when data is migrated to
// user_id). Returns null when neither mechanism authenticates the request.

import { getSession } from './_session.js'
import { emailFromRequest } from './_auth.js'

export async function resolveUser(request, env) {
  // 1) Own session.
  const s = await getSession(env, request)
  if (s) {
    const row = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(s.userId).first()
    if (row) return { userId: s.userId, email: row.email, via: 'session' }
  }

  // 2) Cloudflare Access fallback (shim; removed from user routes at the end).
  const email = await emailFromRequest(request, env)
  if (email) return { userId: null, email, via: 'access' }

  return null
}
