<script setup>
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { CalendarDays, Sparkles, ShoppingCart, Settings } from 'lucide-vue-next'

const { t } = useI18n()

const links = [
  { to: '/', icon: CalendarDays, key: 'planner', exact: true },
  { to: '/generate', icon: Sparkles, key: 'generate' },
  { to: '/shopping', icon: ShoppingCart, key: 'shopping' },
  { to: '/settings', icon: Settings, key: 'settings' },
]
</script>

<template>
  <nav class="mobile-nav">
    <RouterLink
      v-for="link in links"
      :key="link.key"
      :to="link.to"
      class="mobile-nav__link"
      active-class="is-active"
      :exact-active-class="link.exact ? 'is-active' : undefined"
    >
      <component :is="link.icon" :size="20" />
      <span class="mobile-nav__label">{{ t(`header.${link.key}`) }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.mobile-nav {
  display: none;
}

@media (max-width: 768px) {
  .mobile-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 40;
    background-color: var(--surface);
    border-top: 1px solid var(--border);
    /* Fixed padding — NO env(safe-area-inset-bottom). Chrome on iOS
       already handles the home indicator, and the extra 34px of safe
       area padding was creating a visible gap when Chrome hid its
       toolbar. The ::after covers the home indicator for PWA mode. */
    padding: 6px 8px;
    justify-content: space-around;
    gap: 4px;
  }

  /* Background extension for PWA / Safari where there's no Chrome bar
     to cover the home indicator. Covers the physical bottom. */
  .mobile-nav::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    height: 40px;
    background-color: var(--surface);
    pointer-events: none;
  }

  .mobile-nav__link {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    color: var(--text-faint);
    text-decoration: none;
    font-size: 10px;
    font-weight: 600;
    min-width: 52px;
    transition: color 0.15s ease;
  }

  .mobile-nav__link.is-active {
    color: var(--accent);
  }

  .mobile-nav__label {
    white-space: nowrap;
  }
}
</style>
