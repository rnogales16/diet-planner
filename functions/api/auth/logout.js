// POST /api/auth/logout — revoke the current session and clear the cookie.

import { json, originAllowed } from '../_http.js'
import { revokeSession, clearSessionCookie } from '../_session.js'

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return json({ success: false, error: 'Bad origin.' }, 403)
  await revokeSession(env, request)
  return json({ success: true }, 200, { 'Set-Cookie': clearSessionCookie() })
}
