// Opaque single-use tokens for email verification / password reset. Same model
// as sessions: the token travels in the email link; only its SHA-256 is stored.

import { sha256hex } from './_session.js'

function b64urlEncode(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Returns { token, tokenHash }: put `token` in the link, store `tokenHash`.
export async function newToken() {
  const token = b64urlEncode(crypto.getRandomValues(new Uint8Array(32)))
  const tokenHash = await sha256hex(token)
  return { token, tokenHash }
}

export async function hashToken(token) {
  return sha256hex(token)
}
