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
      <component :is="link.icon" :size="18" />
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
    padding: 2px 8px;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    justify-content: space-around;
    gap: 4px;
  }

  /* A thin extension below the nav covers any sub-pixel gap between the
     safe-area bottom and the physical screen edge. Keep it small (20px)
     so it doesn't create visible padding when Chrome hides its bar. */
  .mobile-nav::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -20px;
    height: 20px;
    background-color: var(--surface);
    pointer-events: none;
  }

  .mobile-nav__link {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    color: var(--text-faint);
    text-decoration: none;
    font-size: 9px;
    font-weight: 600;
    min-width: 48px;
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
