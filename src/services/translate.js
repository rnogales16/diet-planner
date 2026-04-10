// Client wrapper for /api/translate-dishes.

const BATCH_SIZE = 35

export async function translateDishes(dishes, targetLanguage) {
  if (!dishes || dishes.length === 0) {
    return { success: true, translations: [] }
  }

  // The endpoint accepts up to 50 per request, but we keep batches small
  // so the model has plenty of room for the response.
  const batches = []
  for (let i = 0; i < dishes.length; i += BATCH_SIZE) {
    batches.push(dishes.slice(i, i + BATCH_SIZE))
  }

  const out = []
  for (const batch of batches) {
    const slim = batch.map((d) => ({
      id: d.id,
      name: d.name || '',
      notes: d.notes || '',
      ingredients: d.ingredients || [],
      instructions: d.instructions || [],
    }))
    let res
    try {
      res = await fetch('/api/translate-dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLanguage, dishes: slim }),
        credentials: 'include',
      })
    } catch (err) {
      return { success: false, error: `Network error: ${err.message}` }
    }

    if (res.status === 401 || res.status === 302) {
      return { success: false, error: 'Your session has expired. Please refresh to log in again.' }
    }

    let payload
    try {
      payload = await res.json()
    } catch {
      return { success: false, error: 'Invalid response from server.' }
    }

    if (!res.ok || !payload.success) {
      return { success: false, error: payload.error || `Server error (${res.status}).` }
    }

    out.push(...(payload.translations || []))
  }

  return { success: true, translations: out }
}
