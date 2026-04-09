<script setup>
import { computed } from 'vue'
import { sumMeals } from '@/utils/nutritionHelpers'

const props = defineProps({
  day: { type: Object, required: true },
  dayName: { type: String, required: true },
})

const dayTotals = computed(() => sumMeals(
  props.day.meals.map((m) => ({ dishes: [m.dish] }))
))

const mealLabels = {
  breakfast: 'Breakfast',
  morning_snack: 'Snack',
  lunch: 'Lunch',
  afternoon_snack: 'Snack',
  dinner: 'Dinner',
}

const mealColors = {
  breakfast: 'border-l-amber-400',
  morning_snack: 'border-l-rose-300',
  lunch: 'border-l-blue-400',
  afternoon_snack: 'border-l-violet-300',
  dinner: 'border-l-indigo-400',
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
    <!-- Day header -->
    <div class="px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
      <h3 class="text-sm font-bold text-gray-800 dark:text-gray-200">{{ dayName }}</h3>
      <p class="text-xs text-gray-400 dark:text-gray-400">{{ dayTotals.calories }} kcal</p>
    </div>

    <!-- Meals -->
    <div class="p-3 space-y-2 flex-1">
      <div
        v-for="meal in day.meals"
        :key="meal.type"
        class="p-2.5 rounded-lg bg-gray-50/70 dark:bg-gray-700/50 border-l-[3px] transition-colors"
        :class="mealColors[meal.type]"
      >
        <p class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">
          {{ mealLabels[meal.type] }}
        </p>
        <p class="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug">{{ meal.dish.name }}</p>
        <div class="flex items-center gap-2 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
          <span>{{ meal.dish.calories }} kcal</span>
          <span>&middot;</span>
          <span>{{ meal.dish.ingredients.length }} ing.</span>
        </div>
      </div>
    </div>

    <!-- Day footer -->
    <div class="px-4 py-2 bg-gray-50/50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700 flex justify-between text-[10px] font-medium">
      <span class="text-blue-500 dark:text-blue-400">P {{ dayTotals.protein }}g</span>
      <span class="text-amber-500 dark:text-amber-400">C {{ dayTotals.carbs }}g</span>
      <span class="text-rose-500 dark:text-rose-400">F {{ dayTotals.fat }}g</span>
    </div>
  </div>
</template>
