<script setup>
import { computed } from 'vue'
import MealSlot from './MealSlot.vue'
import DailySummary from '@/components/summary/DailySummary.vue'
import { isToday, formatShortDate } from '@/utils/dateHelpers'

const props = defineProps({
  day: { type: Object, required: true },
  dayIndex: { type: Number, required: true },
})

defineEmits(['addDish', 'editDish', 'deleteDish', 'viewDish'])

const dateObj = computed(() => new Date(props.day.date))
const isTodayFlag = computed(() => isToday(dateObj.value))
const shortDate = computed(() => formatShortDate(dateObj.value))
const totalCals = computed(() =>
  props.day.meals.reduce((sum, m) => sum + m.dishes.reduce((s, d) => s + (Number(d.calories) || 0), 0), 0)
)
</script>

<template>
  <div
    class="flex flex-col rounded-2xl overflow-hidden transition-all duration-300"
    :class="isTodayFlag
      ? 'ring-2 ring-emerald-400/60 shadow-lg shadow-emerald-500/8 bg-white dark:bg-gray-800'
      : 'bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700 shadow-sm'"
  >
    <!-- Day header -->
    <div class="relative px-4 py-3.5" :class="isTodayFlag ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700'">
      <div class="flex items-baseline justify-between">
        <div>
          <p class="text-[13px] font-extrabold tracking-tight" :class="isTodayFlag ? 'text-white' : 'text-gray-900 dark:text-gray-100'">
            {{ day.dayName.slice(0, 3) }}
          </p>
          <p class="text-[11px] font-medium mt-0.5" :class="isTodayFlag ? 'text-emerald-100' : 'text-gray-400 dark:text-gray-500'">
            {{ shortDate }}
          </p>
        </div>
        <span
          v-if="totalCals > 0"
          class="text-[11px] font-bold px-2 py-0.5 rounded-full"
          :class="isTodayFlag ? 'bg-white/20 text-white' : 'bg-gray-200/60 dark:bg-gray-600/60 text-gray-500 dark:text-gray-400'"
        >
          {{ totalCals }} kcal
        </span>
      </div>
      <div v-if="isTodayFlag" class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-white dark:ring-gray-800" />
    </div>

    <!-- Meal slots -->
    <div class="flex-1 p-2 space-y-0.5">
      <MealSlot
        v-for="meal in day.meals"
        :key="meal.type"
        :meal="meal"
        @addDish="$emit('addDish', { dayIndex, mealType: $event })"
        @editDish="$emit('editDish', { dayIndex, ...$event })"
        @deleteDish="$emit('deleteDish', { dayIndex, ...$event })"
        @viewDish="$emit('viewDish', { dayIndex, ...$event })"
      />
    </div>

    <!-- Daily totals -->
    <DailySummary :meals="day.meals" :isToday="isTodayFlag" />
  </div>
</template>
