<script setup>
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ThemeToggle from './ThemeToggle.vue'
import SyncIndicator from './SyncIndicator.vue'
import LanguageToggle from './LanguageToggle.vue'
import { useLanguage } from '@/composables/useLanguage'

useLanguage() // bootstrap locale <-> store sync
const { t } = useI18n()
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <RouterLink to="/" class="brand">
        <span class="brand__dot" />
        <span class="brand__name font-display">{{ t('header.brand') }}</span>
      </RouterLink>

      <nav class="app-nav">
        <RouterLink to="/" class="app-nav__link" active-class="is-active" exact-active-class="is-active">{{ t('header.planner') }}</RouterLink>
        <RouterLink to="/generate" class="app-nav__link" active-class="is-active">{{ t('header.generate') }}</RouterLink>
        <RouterLink to="/settings" class="app-nav__link" active-class="is-active">{{ t('header.settings') }}</RouterLink>
      </nav>

      <div class="app-header__right">
        <SyncIndicator />
        <LanguageToggle />
        <ThemeToggle />
        <div class="avatar">R</div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background-color: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 30;
  backdrop-filter: saturate(140%) blur(8px);
}

.app-header__inner {
  max-width: 1480px;
  margin: 0 auto;
  padding: 0 24px;
  height: 60px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
  justify-self: start;
}

.brand__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}

.brand__name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.015em;
}

.app-nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
}

.app-nav__link {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 999px;
  color: var(--text-muted);
  text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.app-nav__link:hover {
  color: var(--text);
}

.app-nav__link.is-active {
  background-color: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.app-header__right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  justify-self: end;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background-color: var(--accent-tint);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid var(--border);
}

@media (max-width: 720px) {
  .app-header__inner {
    grid-template-columns: 1fr auto;
    gap: 12px;
  }
  .app-nav {
    grid-column: 1 / -1;
    order: 3;
    justify-self: stretch;
    justify-content: space-between;
  }
  .app-header__inner {
    height: auto;
    padding: 12px 16px;
    grid-template-rows: auto auto;
  }
}
</style>
