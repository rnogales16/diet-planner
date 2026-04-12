<script setup>
import AppHeader from '@/components/layout/AppHeader.vue'
import MobileNav from '@/components/layout/MobileNav.vue'
import GenerationBanner from '@/components/layout/GenerationBanner.vue'
import { useTheme } from '@/composables/useTheme'

useTheme()
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main class="app-main">
      <RouterView />
    </main>
    <MobileNav />
    <GenerationBanner />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background-color: var(--bg);
  color: var(--text);
}

.app-main {
  max-width: 1480px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

@media (max-width: 768px) {
  .app-main {
    padding: 16px 12px;
    /* Space for the fixed bottom navigation bar */
    padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
