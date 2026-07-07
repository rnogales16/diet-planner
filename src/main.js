import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import './assets/main.css'
import { useDietStore } from './stores/dietStore'
import { useAuthStore } from './stores/authStore'
import {
  loadFromServer,
  scheduleSave,
  enableSaving,
  readLegacyLocalStorage,
  clearLegacyLocalStorage,
  syncStatus,
} from './services/sync'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(i18n)

const store = useDietStore()
const authStore = useAuthStore()

// Load the user's diet data from the server and wire autosave. Only runs once we
// know the request is authenticated (own session or Access).
async function initDietStore() {
  let serverData = null
  let loadOk = false
  try {
    serverData = await loadFromServer()
    loadOk = true
  } catch {
    // Network or auth error. We must NOT enable saving in this case: the
    // store would fall back to an empty default state and the autosave would
    // overwrite the user's real server data. Leave the app in a read-only
    // error state (the sync indicator already shows the error) and bail.
  }

  if (!loadOk) {
    store.hydrate(null)
    return
  }

  if (serverData) {
    store.hydrate(serverData)
    // Load succeeded with data: saving is now safe.
    enableSaving()
  } else {
    // First run for this user. If we have something in the old localStorage
    // copy from before the server sync existed, push it up so it survives.
    const legacy = readLegacyLocalStorage()
    if (legacy && legacy.weeks && Object.keys(legacy.weeks).length) {
      store.hydrate(legacy)
      // Load succeeded; enable saving and force an immediate save so the
      // migrated data lands on the server right away.
      enableSaving()
      scheduleSave(() => store.serialize())
      clearLegacyLocalStorage()
    } else {
      // Genuine empty account: the load succeeded and returned nothing, so
      // it's safe to start fresh and persist from here.
      store.hydrate(null)
      enableSaving()
    }
  }

  // Save on every state change once we're done hydrating.
  store.$subscribe(() => {
    if (!store.hydrated) return
    if (syncStatus.value === 'loading') return
    scheduleSave(() => store.serialize())
  })
}

async function bootstrap() {
  // Resolve auth first (own session or Access). Only load the diet data when
  // authenticated; anonymous users are routed to /login by the router guard.
  try {
    await authStore.ensureLoaded()
  } catch {
    authStore.setAnonymous()
  }
  if (authStore.isAuthenticated) {
    await initDietStore()
  }
  app.mount('#app')
}

bootstrap()

// Register the service worker for PWA (offline shell + installability).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
