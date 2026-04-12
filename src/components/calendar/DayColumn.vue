<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MealSlot from './MealSlot.vue'
import { isToday } from '@/utils/dateHelpers'
import { sumMeals } from '@/utils/nutritionHelpers'
import { useDietStore } from '@/stores/dietStore'

const { t } = useI18n()
const store = useDietStore()

const props = defineProps({
  day: { type: Object, required: true },
  dayIndex: { type: Number, required: true },
})

defineEmits(['addDish', 'editDish', 'deleteDish', 'viewDish'])

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const dateObj = computed(() => new Date(props.day.date))
const isTodayFlag = computed(() => isToday(dateObj.value))
const dayNumber = computed(() => dateObj.value.getDate())
const weekdayShort = computed(() => t(`planner.weekday.${WEEKDAY_KEYS[props.dayIndex]}`))

// Only show meals whose type is currently enabled in the user's meal type
// config. If a meal has no matching type in the config (e.g. legacy data),
// we still show it so the user does not lose anything.
const enabledTypes = computed(() => {
  const set = new Set()
  for (const mt of store.mealTypes) {
    if (mt.enabled !== false) set.add(mt.type)
  }
  return set
})

const visibleMeals = computed(() =>
  props.day.meals.filter((m) => enabledTypes.value.has(m.type)),
)

const dayTotals = computed(() => sumMeals(visibleMeals.value))
const hasDishes = computed(() => visibleMeals.value.some((m) => m.dishes.length > 0))
</script>

<template>
  <div class="day-col" :class="{ 'is-today': isTodayFlag }">
    <header class="day-col__head">
      <span class="day-col__weekday">{{ weekdayShort }}</span>
      <span class="day-col__date font-display tabular">{{ dayNumber }}</span>
    </header>

    <div class="day-col__meals">
      <MealSlot
        v-for="meal in visibleMeals"
        :key="meal.type"
        :meal="meal"
        @addDish="$emit('addDish', { dayIndex, mealType: $event })"
        @editDish="$emit('editDish', { dayIndex, ...$event })"
        @deleteDish="$emit('deleteDish', { dayIndex, ...$event })"
        @viewDish="$emit('viewDish', { dayIndex, ...$event })"
      />
    </div>

    <footer v-if="hasDishes" class="day-col__footer">
      <span class="day-col__total tabular">{{ dayTotals.calories }} {{ t('common.kcal') }}</span>
      <div class="day-col__macros">
        <span class="tabular">P{{ dayTotals.protein }}</span>
        <span class="day-col__dot">·</span>
        <span class="tabular">C{{ dayTotals.carbs }}</span>
        <span class="day-col__dot">·</span>
        <span class="tabular">F{{ dayTotals.fat }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.day-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 10px;
  min-width: 0;
}

.day-col.is-today {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.day-col__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 4px 8px;
  border-bottom: 1px solid var(--border);
}

.day-col__weekday {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-faint);
}

.day-col.is-today .day-col__weekday {
  color: var(--accent);
}

.day-col__date {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}

.day-col__meals {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}

.day-col__footer {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 8px 4px 0;
  border-top: 1px solid var(--border);
  margin-top: auto;
}

.day-col__total {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
}

.day-col__macros {
  display: flex;
  align-items: baseline;
  gap: 3px;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-faint);
}

.day-col__dot {
  color: var(--border-strong);
}
</style>
