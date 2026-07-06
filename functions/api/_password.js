// Password hashing with PBKDF2-HMAC-SHA256 via WebCrypto (crypto.subtle). The
// Workers/Pages runtime has no native bcrypt/scrypt/argon2, and PBKDF2 is the
// standard primitive available here. Stored format is versioned so the cost or
// algorithm can be upgraded later with rehash-on-login:
//
//   pbkdf2$sha256$<iterations>$<salt_b64url>$<hash_b64url>

const ALGO = 'pbkdf2'
const HASH = 'sha256'
const ITERATIONS = 210000 // OWASP 2023 minimum for PBKDF2-HMAC-SHA256
const SALT_BYTES = 16
const KEY_BITS = 256 // 32-byte derived key

function b64urlEncode(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0
  s += '='.repeat(pad)
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function deriveBits(password, salt, iterations, bits) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    bits,
  )
  return new Uint8Array(derived)
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await deriveBits(password, salt, ITERATIONS, KEY_BITS)
  return `${ALGO}$${HASH}$${ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(hash)}`
}

// Constant-time byte comparison — no early return on first differing byte, and
// arrays here are always the same length (derived to `expected.length`).
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// Verify a password against a stored `pbkdf2$...` string. Returns false on any
// malformed input rather than throwing.
export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 5) return false
  const [algo, hash, iterStr, saltB64, hashB64] = parts
  if (algo !== ALGO || hash !== HASH) return false
  const iterations = parseInt(iterStr, 10)
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 5_000_000) return false

  let salt, expected
  try {
    salt = b64urlDecode(saltB64)
    expected = b64urlDecode(hashB64)
  } catch {
    return false
  }
  if (expected.length === 0) return false

  const actual = await deriveBits(password, salt, iterations, expected.length * 8)
  return timingSafeEqual(actual, expected)
}
