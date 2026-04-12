<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TrendingUp } from 'lucide-vue-next'
import { useDietStore } from '@/stores/dietStore'
import { sumDays } from '@/utils/nutritionHelpers'

const { t } = useI18n()
const store = useDietStore()

const weekData = computed(() => {
  const entries = []
  const sortedKeys = Object.keys(store.weeks).sort()
  for (const key of sortedKeys) {
    const week = store.weeks[key]
    const daysWithFood = week.days.filter((d) => d.meals.some((m) => m.dishes.length > 0))
    if (daysWithFood.length === 0) continue
    const totals = sumDays(week.days)
    const n = daysWithFood.length
    entries.push({
      key,
      range: `${week.startDate || ''} → ${week.endDate || ''}`,
      days: n,
      avg: {
        calories: Math.round(totals.calories / n),
        protein: Math.round(totals.protein / n),
        carbs: Math.round(totals.carbs / n),
        fat: Math.round(totals.fat / n),
        vegetables: Math.round((totals.vegetables || 0) / n),
      },
    })
  }
  return entries
})

const maxKcal = computed(() => {
  let max = 0
  for (const w of weekData.value) if (w.avg.calories > max) max = w.avg.calories
  return max || 1
})
</script>

<template>
  <div class="history">
    <header class="history__head">
      <div class="history__icon">
        <TrendingUp :size="20" />
      </div>
      <div>
        <h1 class="history__title font-display">{{ t('history.title') }}</h1>
        <p class="history__sub">{{ t('history.subtitle') }}</p>
      </div>
    </header>

    <div v-if="weekData.length === 0" class="history__empty app-card">
      <TrendingUp :size="28" />
      <p>{{ t('history.empty') }}</p>
    </div>

    <div v-else class="history__chart">
      <div v-for="w in weekData" :key="w.key" class="history__row app-card">
        <div class="history__label">
          <span class="history__week font-display">{{ w.key }}</span>
          <span class="history__days tabular">{{ w.days }}d</span>
        </div>
        <div class="history__bar-wrap">
          <div class="history__bar" :style="{ width: (w.avg.calories / maxKcal * 100) + '%' }">
            <span class="history__bar-label tabular">{{ w.avg.calories }} {{ t('common.kcal') }}</span>
          </div>
        </div>
        <div class="history__macros tabular">
          <span>P{{ w.avg.protein }}</span>
          <span>C{{ w.avg.carbs }}</span>
          <span>F{{ w.avg.fat }}</span>
          <span>V{{ w.avg.vegetables }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 880px;
  margin: 0 auto;
}

.history__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history__icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background-color: var(--accent-tint);
  color: var(--accent);
}

.history__title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.history__sub {
  font-size: 13px;
  color: var(--text-faint);
}

.history__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 24px;
  color: var(--text-faint);
  text-align: center;
}

.history__chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history__row {
  display: grid;
  grid-template-columns: 120px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}

.history__label {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.history__week {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.history__days {
  font-size: 10px;
  color: var(--text-faint);
}

.history__bar-wrap {
  height: 24px;
  background-color: var(--surface-2);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.history__bar {
  height: 100%;
  background-color: var(--accent);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  padding: 0 8px;
  min-width: 60px;
  transition: width 0.4s ease;
}

.history__bar-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-fg);
  white-space: nowrap;
}

.history__macros {
  display: flex;
  gap: 6px;
  font-size: 10px;
  color: var(--text-faint);
  font-weight: 500;
}

@media (max-width: 768px) {
  .history__row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .history__macros {
    justify-content: flex-start;
  }
}
</style>
