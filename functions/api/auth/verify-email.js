// GET /api/auth/verify-email?token=... — clicked from the verification email.
// The unguessable single-use token is the capability, so there is no Origin
// check (a link click carries no usable Origin). Returns a minimal HTML page.

import { hashToken } from '../_token.js'

function page(body, status = 200) {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Nutriplania</title>
<style>body{font:16px/1.5 system-ui,-apple-system,sans-serif;max-width:480px;margin:64px auto;padding:0 20px;text-align:center;color:#1c1d22}
h1{font-size:1.3rem;margin-bottom:8px}.ok{color:#16a34a}.bad{color:#dc2626}p{color:#4b5563}</style>
</head><body>${body}</body></html>`
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('token') || ''
  if (!token) return page('<h1 class="bad">Enlace no válido</h1><p>Falta el token.</p>', 400)

  const tokenHash = await hashToken(token)
  const now = Date.now()
  const row = await env.DB
    .prepare('SELECT id, user_id FROM email_verification_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
    .bind(tokenHash, now)
    .first()

  if (!row) {
    return page('<h1 class="bad">Enlace no válido o caducado</h1><p>Pide un nuevo enlace de verificación desde la app.</p>', 400)
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').bind(now, row.user_id),
    env.DB.prepare("UPDATE identities SET email_verified = 1 WHERE user_id = ? AND provider = 'password'").bind(row.user_id),
    env.DB.prepare('UPDATE email_verification_tokens SET used_at = ? WHERE id = ?').bind(now, row.id),
  ])

  return page('<h1 class="ok">Email verificado ✓</h1><p>Ya puedes generar planes en Nutriplania.</p>')
}
