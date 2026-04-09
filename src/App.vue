<script setup>
import AppHeader from '@/components/layout/AppHeader.vue'
import { useTheme } from '@/composables/useTheme'

useTheme()
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 font-sans text-gray-900 dark:text-gray-100 transition-colors">
    <AppHeader />
    <main class="max-w-[1480px] mx-auto px-4 sm:px-6 py-6">
      <RouterView />
    </main>
  </div>
</template>
