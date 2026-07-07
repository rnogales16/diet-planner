<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import MobileNav from '@/components/layout/MobileNav.vue'
import GenerationBanner from '@/components/layout/GenerationBanner.vue'
import VerifyEmailBanner from '@/components/layout/VerifyEmailBanner.vue'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/authStore'

useTheme()
const route = useRoute()
const auth = useAuthStore()

// Auth screens use a bare layout (no header / nav / banners).
const bare = computed(() => !!route.meta.bare)

// After the user clicks the verification link (which opens the server page), a
// return to this tab re-checks /me so the verify banner clears without a reload.
function onFocus() {
  if (auth.needsVerification) auth.fetchMe()
}
onMounted(() => window.addEventListener('focus', onFocus))
onUnmounted(() => window.removeEventListener('focus', onFocus))
</script>

<template>
  <RouterView v-if="bare" />
  <div v-else class="app-shell">
    <AppHeader />
    <VerifyEmailBanner />
    <main class="app-main" role="main">
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
  max-width: 1920px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

@media (max-width: 768px) {
  .app-main {
    padding: 16px 12px;
    /* Space for the fixed bottom navigation bar */
    padding-bottom: 64px;
  }
}
</style>
