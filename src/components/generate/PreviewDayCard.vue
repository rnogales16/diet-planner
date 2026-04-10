<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { sumMeals } from '@/utils/nutritionHelpers'
import { useDietStore } from '@/stores/dietStore'

const { t } = useI18n()
const store = useDietStore()

const props = defineProps({
  day: { type: Object, required: true },
  dayName: { type: String, required: true },
})

const dayTotals = computed(() => sumMeals(
  props.day.meals.map((m) => ({ dishes: [m.dish] }))
))

// Use the user's customized labels from the store, with sensible defaults.
const mealLabels = computed(() => {
  const map = {}
  for (const mt of store.mealTypes) {
    map[mt.type] = mt.label
  }
  return map
})
</script>

<template>
  <div class="preview-day">
    <header class="preview-day__head">
      <h3 class="preview-day__name font-display">{{ dayName }}</h3>
      <span class="preview-day__kcal tabular">{{ dayTotals.calories }} {{ t('common.kcal') }}</span>
    </header>

    <div class="preview-day__meals">
      <div v-for="meal in day.meals" :key="meal.type" class="preview-meal">
        <span class="preview-meal__label">{{ mealLabels[meal.type] || meal.type }}</span>
        <span class="preview-meal__name">{{ meal.dish.name }}</span>
        <span class="preview-meal__cals tabular">{{ meal.dish.calories }} {{ t('common.kcal') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-day {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-day__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.preview-day__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.preview-day__kcal {
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
}

.preview-day__meals {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-meal {
  display: grid;
  grid-template-columns: 70px 1fr auto;
  align-items: baseline;
  gap: 10px;
  font-size: 12px;
}

.preview-meal__label {
  color: var(--text-faint);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.preview-meal__name {
  color: var(--text);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-meal__cals {
  color: var(--text-muted);
  font-size: 11px;
}
</style>
