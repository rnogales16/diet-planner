<script setup>
import BaseButton from '@/components/ui/BaseButton.vue'

defineEmits(['cancel'])
</script>

<template>
  <div class="flex flex-col items-center justify-center py-20">
    <!-- Pulsing skeleton -->
    <div class="w-full max-w-md space-y-4 mb-8">
      <div v-for="i in 5" :key="i" class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-200 dark:from-emerald-800 to-teal-200 dark:to-teal-800 animate-pulse"
          :style="{ animationDelay: `${i * 150}ms` }"
        />
        <div class="flex-1 space-y-2">
          <div
            class="h-3 rounded-full bg-gradient-to-r from-emerald-100 dark:from-emerald-900 to-teal-100 dark:to-teal-900 animate-pulse"
            :style="{ width: `${60 + (i * 7) % 30}%`, animationDelay: `${i * 150 + 75}ms` }"
          />
          <div
            class="h-2 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse"
            :style="{ width: `${40 + (i * 11) % 40}%`, animationDelay: `${i * 150 + 150}ms` }"
          />
        </div>
      </div>
    </div>

    <!-- Status text -->
    <div class="text-center mb-6">
      <p class="text-lg font-semibold text-gray-800 dark:text-gray-200">Generating your meal plan...</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">This may take 15-30 seconds</p>
    </div>

    <!-- Cancel button -->
    <BaseButton variant="secondary" @click="$emit('cancel')">
      Cancel
    </BaseButton>
  </div>
</template>
