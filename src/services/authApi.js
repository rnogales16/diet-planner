// Thin client wrappers for the own-auth endpoints. All requests send cookies
// (credentials: 'include') so the session cookie flows.

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })
  let data = {}
  try {
    data = await res.json()
  } catch {
    /* non-JSON or empty */
  }
  return { status: res.status, ok: res.ok, data }
}

export const authApi = {
  me: () => req('/api/auth/me'),
  login: (email, password) => req('/api/auth/login', { method: 'POST', body: { email, password } }),
  register: (email, password) => req('/api/auth/register', { method: 'POST', body: { email, password } }),
  logout: () => req('/api/auth/logout', { method: 'POST', body: {} }),
  forgot: (email) => req('/api/auth/forgot-password', { method: 'POST', body: { email } }),
  reset: (token, newPassword) => req('/api/auth/reset-password', { method: 'POST', body: { token, newPassword } }),
  resend: () => req('/api/auth/resend-verification', { method: 'POST', body: {} }),
}
