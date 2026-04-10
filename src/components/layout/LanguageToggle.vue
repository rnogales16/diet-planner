<script setup>
import { useI18n } from 'vue-i18n'
import { useLanguage } from '@/composables/useLanguage'

const { t } = useI18n()
const { locale, setLanguage, locales } = useLanguage()
</script>

<template>
  <div class="lang-toggle" role="radiogroup" :aria-label="t('language.label')">
    <button
      v-for="loc in locales"
      :key="loc"
      type="button"
      role="radio"
      :aria-checked="locale === loc"
      :title="t(`language.${loc}`)"
      class="lang-toggle__btn"
      :class="{ 'is-active': locale === loc }"
      @click="setLanguage(loc)"
    >
      {{ loc.toUpperCase() }}
    </button>
  </div>
</template>

<style scoped>
.lang-toggle {
  display: inline-flex;
  align-items: center;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
  gap: 2px;
}

.lang-toggle__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 26px;
  padding: 0 8px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.lang-toggle__btn:hover {
  color: var(--text-muted);
}

.lang-toggle__btn.is-active {
  background-color: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}
</style>
