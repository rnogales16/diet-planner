// Server sync for the diet store.
// Loads the user blob on app start, debounces saves on every mutation
// and migrates legacy localStorage data on first run.

import { ref } from 'vue'

const LEGACY_STORAGE_KEY = 'diet'
const DEBOUNCE_MS = 1500

export const syncStatus = ref('idle') // idle | loading | saving | saved | error
export const syncError = ref('')

let debounceTimer = null
let inFlight = null
let pending = null

export async function loadFromServer() {
  syncStatus.value = 'loading'
  syncError.value = ''
  try {
    const res = await fetch('/api/data', { credentials: 'include' })
    if (res.status === 401 || res.status === 302) {
      throw new Error('Session expired. Please refresh to log in.')
    }
    if (!res.ok) {
      throw new Error(`Server error (${res.status}).`)
    }
    const payload = await res.json()
    syncStatus.value = 'idle'
    return payload.data
  } catch (err) {
    syncStatus.value = 'error'
    syncError.value = err.message
    throw err
  }
}

async function pushNow(state) {
  syncStatus.value = 'saving'
  syncError.value = ''
  try {
    const res = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
      credentials: 'include',
    })
    if (!res.ok) throw new Error(`Server error (${res.status}).`)
    syncStatus.value = 'saved'
    setTimeout(() => {
      if (syncStatus.value === 'saved') syncStatus.value = 'idle'
    }, 1500)
  } catch (err) {
    syncStatus.value = 'error'
    syncError.value = err.message
    throw err
  }
}

export function scheduleSave(getState) {
  pending = getState
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    debounceTimer = null
    if (!pending) return
    const snapshot = pending()
    pending = null
    // If a save is already running, queue this one as the next
    if (inFlight) {
      try { await inFlight } catch { /* ignore */ }
    }
    inFlight = pushNow(snapshot)
    try {
      await inFlight
    } finally {
      inFlight = null
    }
  }, DEBOUNCE_MS)
}

// Read whatever the old persistedstate plugin left behind so we can
// upload it on first run and then forget about it.
export function readLegacyLocalStorage() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearLegacyLocalStorage() {
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}
