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
    padding: 6px 8px;
    padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
    justify-content: space-around;
    gap: 4px;
  }

  /* Extend the nav background past the bottom edge so there's never a
     gap when Chrome's address bar hides on iOS/Android. The pseudo-
     element covers any space below the safe-area inset all the way to
     the physical bottom of the screen. */
  .mobile-nav::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -100px;
    height: 100px;
    background-color: var(--surface);
    pointer-events: none;
  }

  .mobile-nav__link {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    color: var(--text-faint);
    text-decoration: none;
    font-size: 10px;
    font-weight: 600;
    min-width: 56px;
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
