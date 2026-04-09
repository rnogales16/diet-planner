<script setup>
import { computed } from 'vue'
import { sumDays } from '@/utils/nutritionHelpers'

const props = defineProps({
  week: { type: Object, default: null },
})

const totals = computed(() => (props.week ? sumDays(props.week.days) : { calories: 0, protein: 0, carbs: 0, fat: 0 }))
const hasDishes = computed(() =>
  props.week ? props.week.days.some((d) => d.meals.some((m) => m.dishes.length > 0)) : false,
)

const daysWithFood = computed(() =>
  props.week ? props.week.days.filter((d) => d.meals.some((m) => m.dishes.length > 0)).length : 0,
)

const dailyAvg = computed(() => {
  if (daysWithFood.value === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 }
  return {
    calories: Math.round(totals.value.calories / daysWithFood.value),
    protein: Math.round(totals.value.protein / daysWithFood.value),
    carbs: Math.round(totals.value.carbs / daysWithFood.value),
    fat: Math.round(totals.value.fat / daysWithFood.value),
  }
})

const cards = computed(() => [
  {
    label: 'Calories',
    total: totals.value.calories,
    avg: dailyAvg.value.calories,
    unit: 'kcal',
    gradient: 'from-orange-500 to-amber-500',
    bgLight: 'bg-orange-50',
    icon: '🔥',
  },
  {
    label: 'Protein',
    total: totals.value.protein,
    avg: dailyAvg.value.protein,
    unit: 'g',
    gradient: 'from-blue-500 to-cyan-500',
    bgLight: 'bg-blue-50',
    icon: '💪',
  },
  {
    label: 'Carbs',
    total: totals.value.carbs,
    avg: dailyAvg.value.carbs,
    unit: 'g',
    gradient: 'from-amber-500 to-yellow-500',
    bgLight: 'bg-amber-50',
    icon: '⚡',
  },
  {
    label: 'Fat',
    total: totals.value.fat,
    avg: dailyAvg.value.fat,
    unit: 'g',
    gradient: 'from-rose-500 to-pink-500',
    bgLight: 'bg-rose-50',
    icon: '🫒',
  },
])
</script>

<template>
  <div v-if="week" class="mt-6">
    <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
      <span class="w-7 h-7 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center text-white text-xs">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </span>
      Weekly Summary
      <span v-if="daysWithFood > 0" class="text-xs font-medium text-gray-400 dark:text-gray-500 ml-1">
        {{ daysWithFood }} day{{ daysWithFood > 1 ? 's' : '' }} tracked
      </span>
    </h3>

    <div v-if="hasDishes" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        v-for="card in cards"
        :key="card.label"
        class="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-4 hover:shadow-md transition-shadow"
      >
        <div class="absolute top-0 right-0 w-20 h-20 rounded-full opacity-5 dark:opacity-10 -translate-y-6 translate-x-6 bg-gradient-to-br" :class="card.gradient" />
        <div class="flex items-start justify-between mb-2">
          <span class="text-2xl">{{ card.icon }}</span>
          <span class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{{ card.label }}</span>
        </div>
        <p class="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
          {{ card.total }}<span class="text-sm font-semibold text-gray-400 dark:text-gray-500 ml-0.5">{{ card.unit }}</span>
        </p>
        <div class="mt-2 flex items-center gap-1.5">
          <div class="h-1 flex-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r transition-all duration-500" :class="card.gradient" :style="{ width: Math.min(100, card.avg / (card.label === 'Calories' ? 25 : 2)) + '%' }" />
          </div>
          <span class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
            avg {{ card.avg }}{{ card.unit }}/day
          </span>
        </div>
      </div>
    </div>

    <div v-else class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
      <p class="text-4xl mb-2">🥗</p>
      <p class="text-sm text-gray-400 dark:text-gray-500">Add some dishes to see your weekly nutrition summary</p>
    </div>
  </div>
</template>
