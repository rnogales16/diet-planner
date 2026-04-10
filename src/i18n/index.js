import { createI18n } from 'vue-i18n'
import en from './en.json'
import es from './es.json'

export const SUPPORTED_LOCALES = ['en', 'es']
export const DEFAULT_LOCALE = 'en'

function detectInitial() {
  const stored = localStorage.getItem('nutriplan_language')
  if (SUPPORTED_LOCALES.includes(stored)) return stored
  const browser = (navigator.language || 'en').slice(0, 2)
  if (SUPPORTED_LOCALES.includes(browser)) return browser
  return DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitial(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, es },
  // Avoid noisy warnings during dev
  warnHtmlMessage: false,
  missingWarn: false,
  fallbackWarn: false,
})
