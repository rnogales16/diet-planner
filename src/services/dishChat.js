// Client wrapper for /api/dish-chat.

export async function chatAboutDish({ dish, profile, history, message, language, signal }) {
  let response
  try {
    response = await fetch('/api/dish-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish, profile, history, message, language }),
      credentials: 'include',
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Cancelled.' }
    }
    return { success: false, error: `Network error: ${err.message}` }
  }

  if (response.status === 401 || response.status === 302) {
    return { success: false, error: 'Your session has expired. Please refresh to log in again.' }
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    return { success: false, error: 'Invalid response from server.' }
  }

  if (!response.ok || !payload.success) {
    return { success: false, error: payload.error || `Server error (${response.status}).` }
  }

  return {
    success: true,
    reply: payload.reply,
    updatedDish: payload.updatedDish || null,
  }
}
