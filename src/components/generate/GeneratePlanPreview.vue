<script setup>
import { computed } from 'vue'
import { sumDays } from '@/utils/nutritionHelpers'
import PreviewDayCard from './PreviewDayCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const props = defineProps({
  plan: { type: Object, required: true },
  weekRange: { type: String, required: true },
})

const emit = defineEmits(['apply', 'back'])

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Build a days structure compatible with sumDays
const daysForSum = computed(() =>
  props.plan.days.map((d) => ({
    meals: d.meals.map((m) => ({ dishes: [m.dish] })),
  }))
)

const weekTotals = computed(() => sumDays(daysForSum.value))
const dailyAvg = computed(() => ({
  calories: Math.round(weekTotals.value.calories / 7),
  protein: Math.round(weekTotals.value.protein / 7),
  carbs: Math.round(weekTotals.value.carbs / 7),
  fat: Math.round(weekTotals.value.fat / 7),
}))
</script>

<template>
  <div class="space-y-6">
    <!-- Summary bar -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden">
      <div class="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-b border-emerald-100 dark:border-emerald-800">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-bold text-gray-800 dark:text-gray-200">Generated Plan Preview</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ weekRange }} &middot; 35 dishes</p>
          </div>
          <div class="flex items-center gap-4 text-xs font-semibold">
            <span class="text-orange-600">~{{ dailyAvg.calories }} kcal/day</span>
            <span class="text-blue-600">P {{ dailyAvg.protein }}g</span>
            <span class="text-amber-600">C {{ dailyAvg.carbs }}g</span>
            <span class="text-rose-600">F {{ dailyAvg.fat }}g</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 7-day grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      <PreviewDayCard
        v-for="day in plan.days"
        :key="day.dayIndex"
        :day="day"
        :day-name="DAY_NAMES[day.dayIndex]"
      />
    </div>

    <!-- Action buttons -->
    <div class="flex items-center justify-center gap-4">
      <BaseButton variant="secondary" @click="emit('back')">
        Back to Form
      </BaseButton>
      <BaseButton
        @click="emit('apply')"
        class="!px-8"
      >
        Apply to Week
      </BaseButton>
    </div>

    <p class="text-center text-xs text-gray-400 dark:text-gray-500">
      Applying will replace all existing dishes for this week.
    </p>
  </div>
</template>
