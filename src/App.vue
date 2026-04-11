<script setup>
import AppHeader from '@/components/layout/AppHeader.vue'
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

@media (max-width: 720px) {
  .app-main {
    padding: 20px 16px 48px;
  }
}
</style>
