<script setup>
import { computed } from 'vue'
import { sumMeals } from '@/utils/nutritionHelpers'

const props = defineProps({
  meals: { type: Array, required: true },
  isToday: { type: Boolean, default: false },
})

const totals = computed(() => sumMeals(props.meals))
const hasDishes = computed(() => props.meals.some((m) => m.dishes.length > 0))
</script>

<template>
  <div
    v-if="hasDishes"
    class="px-3 py-2 mt-auto border-t"
    :class="isToday ? 'bg-emerald-50/40 dark:bg-emerald-900/20 border-emerald-100/60 dark:border-emerald-800/40' : 'bg-gray-50/60 dark:bg-gray-700/40 border-gray-100 dark:border-gray-700'"
  >
    <div class="flex items-center justify-between text-[10px]">
      <div class="flex items-center gap-2">
        <span class="font-bold" :class="isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-500 dark:text-blue-400'">P{{ totals.protein }}g</span>
        <span class="font-bold" :class="isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'">C{{ totals.carbs }}g</span>
        <span class="font-bold" :class="isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-400 dark:text-rose-400'">F{{ totals.fat }}g</span>
      </div>
    </div>
  </div>
</template>
