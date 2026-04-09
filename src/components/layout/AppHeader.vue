<script setup>
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const route = useRoute()
const { isDark, toggle } = useTheme()
const isPlanner = computed(() => route.path === '/')
const isGenerate = computed(() => route.path === '/generate')
const isSettings = computed(() => route.path === '/settings')
</script>

<template>
  <header class="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
    <div class="max-w-[1480px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <RouterLink to="/" class="flex items-center gap-2.5 group">
        <div class="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
          <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke-linecap="round"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke-linecap="round"/>
            <circle cx="9" cy="10" r="0.5" fill="currentColor" stroke="none"/>
            <circle cx="15" cy="10" r="0.5" fill="currentColor" stroke="none"/>
          </svg>
        </div>
        <span class="text-xl font-extrabold text-white tracking-tight">NutriPlan</span>
      </RouterLink>
      <div class="flex items-center gap-2">
        <nav class="flex items-center bg-white/15 backdrop-blur-sm rounded-full p-1">
          <RouterLink
            to="/"
            class="px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-200"
            :class="isPlanner ? 'bg-white text-emerald-700 shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'"
          >
            Planner
          </RouterLink>
          <RouterLink
            to="/generate"
            class="px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-200"
            :class="isGenerate ? 'bg-white text-emerald-700 shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'"
          >
            Generate
          </RouterLink>
          <RouterLink
            to="/settings"
            class="px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-200"
            :class="isSettings ? 'bg-white text-emerald-700 shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'"
          >
            Settings
          </RouterLink>
        </nav>
        <button
          @click="toggle"
          class="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-white/80 hover:text-white hover:bg-white/25 transition-all cursor-pointer"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>
