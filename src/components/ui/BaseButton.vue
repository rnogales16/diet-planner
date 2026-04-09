<script setup>
defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
})
</script>

<template>
  <button
    class="inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[
      variant === 'primary' && 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm shadow-emerald-500/25 hover:shadow-md hover:shadow-emerald-500/30 focus:ring-emerald-500 dark:focus:ring-emerald-500/50',
      variant === 'secondary' && 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-gray-500',
      variant === 'danger' && 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 shadow-sm shadow-red-500/25 focus:ring-red-500 dark:focus:ring-red-500/50',
      variant === 'ghost' && 'text-gray-600 hover:bg-gray-100 focus:ring-gray-400 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-500',
      size === 'sm' && 'px-3 py-1.5 text-xs',
      size === 'md' && 'px-5 py-2.5 text-sm',
      size === 'lg' && 'px-7 py-3 text-base',
    ]"
  >
    <slot />
  </button>
</template>
