// GET /api/auth/google/start — begin Google sign-in. Creates the anti-CSRF
// state + PKCE flow, sets the flow cookie, and redirects to Google's consent.

import { createOAuthFlow, flowCookie } from '../../_oauth.js'
import { isSecureRequest } from '../../_session.js'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin
  if (!env.GOOGLE_CLIENT_ID) {
    return Response.redirect(`${origin}/login?error=oauth`, 302)
  }

  const { flowToken, state, codeChallenge } = await createOAuthFlow(env)

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'online',
    prompt: 'select_account',
  })

  const headers = new Headers({ Location: `${GOOGLE_AUTH_URL}?${params.toString()}` })
  headers.append('Set-Cookie', flowCookie(flowToken, isSecureRequest(request)))
  return new Response(null, { status: 302, headers })
}
