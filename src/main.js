import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import './assets/main.css'
import { useDietStore } from './stores/dietStore'
import {
  loadFromServer,
  scheduleSave,
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

async function bootstrap() {
  let serverData = null
  try {
    serverData = await loadFromServer()
  } catch {
    // Network or auth error: leave the store empty for now and let the
    // user retry. The status indicator already shows the error.
  }

  if (serverData) {
    store.hydrate(serverData)
  } else {
    // First run for this user. If we have something in the old localStorage
    // copy from before the server sync existed, push it up so it survives.
    const legacy = readLegacyLocalStorage()
    if (legacy && legacy.weeks && Object.keys(legacy.weeks).length) {
      store.hydrate(legacy)
      // Force an immediate save so the user keeps their data right away.
      scheduleSave(() => store.serialize())
      clearLegacyLocalStorage()
    } else {
      store.hydrate(null)
    }
  }

  // Save on every state change once we're done hydrating.
  store.$subscribe(() => {
    if (!store.hydrated) return
    if (syncStatus.value === 'loading') return
    scheduleSave(() => store.serialize())
  })

  app.mount('#app')
}

bootstrap()
