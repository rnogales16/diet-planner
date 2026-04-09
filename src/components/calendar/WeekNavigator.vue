<script setup>
defineProps({
  weekRange: { type: String, required: true },
})

defineEmits(['prev', 'next', 'today'])
</script>

<template>
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div class="flex items-center gap-2">
      <h2 class="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">My Week</h2>
      <span class="px-3 py-1 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold rounded-full border border-emerald-200 dark:border-emerald-800">
        {{ weekRange }}
      </span>
    </div>
    <div class="flex items-center gap-1.5">
      <button
        class="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 shadow-sm transition-all cursor-pointer"
        @click="$emit('prev')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        class="h-9 px-4 flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-sm shadow-emerald-500/25 hover:shadow-md hover:shadow-emerald-500/30 transition-all cursor-pointer"
        @click="$emit('today')"
      >
        Today
      </button>
      <button
        class="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 shadow-sm transition-all cursor-pointer"
        @click="$emit('next')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </div>
</template>
