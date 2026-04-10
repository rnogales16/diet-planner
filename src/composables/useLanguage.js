import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDietStore } from '@/stores/dietStore'
import { SUPPORTED_LOCALES } from '@/i18n'

const STORAGE_KEY = 'nutriplan_language'

let bootstrapped = false

export function useLanguage() {
  const i18n = useI18n()
  const store = useDietStore()

  // First time anyone calls this, sync localStorage <-> i18n.locale and
  // start watching for changes so we persist to both localStorage and the store.
  if (!bootstrapped) {
    bootstrapped = true

    // Apply the locale from the store if it has one (after hydration)
    watch(
      () => store.language,
      (lang) => {
        if (lang && SUPPORTED_LOCALES.includes(lang) && i18n.locale.value !== lang) {
          i18n.locale.value = lang
        }
      },
      { immediate: true },
    )

    // Persist any locale change to localStorage and the store
    watch(
      () => i18n.locale.value,
      (lang) => {
        localStorage.setItem(STORAGE_KEY, lang)
        document.documentElement.setAttribute('lang', lang)
        if (store.hydrated && store.language !== lang) {
          store.setLanguage(lang)
        }
      },
      { immediate: true },
    )
  }

  function setLanguage(next) {
    if (SUPPORTED_LOCALES.includes(next)) {
      i18n.locale.value = next
    }
  }

  return {
    locale: i18n.locale,
    setLanguage,
    locales: SUPPORTED_LOCALES,
  }
}
