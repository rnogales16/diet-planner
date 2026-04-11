<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, Check, AlertTriangle } from 'lucide-vue-next'
import { sumDays } from '@/utils/nutritionHelpers'
import PreviewDayCard from './PreviewDayCard.vue'

const { t, locale } = useI18n()

const props = defineProps({
  plan: { type: Object, required: true },
  weekRange: { type: String, required: true },
})

const emit = defineEmits(['apply', 'back'])

// Use Intl for localized weekday names
const dayNames = computed(() => {
  const fmt = new Intl.DateTimeFormat(locale.value, { weekday: 'long' })
  // Use Monday-Sunday based on a known reference week
  return [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = new Date(2024, 0, 1 + i) // 2024-01-01 is a Monday
    return fmt.format(d).charAt(0).toUpperCase() + fmt.format(d).slice(1)
  })
})

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
  <div class="preview">
    <div v-if="plan.warnings && plan.warnings.length" class="preview__warnings">
      <div class="preview__warnings-head">
        <AlertTriangle :size="16" />
        <div>
          <p class="preview__warnings-title">{{ t('generate.warningsTitle') }}</p>
          <p class="preview__warnings-sub">{{ t('generate.warningsSub') }}</p>
        </div>
      </div>
      <ul class="preview__warnings-list">
        <li v-for="(w, i) in plan.warnings" :key="i">{{ w }}</li>
      </ul>
    </div>

    <header class="preview__head">
      <div>
        <h2 class="preview__title font-display">{{ t('generate.preview.title') }}</h2>
        <p class="preview__sub">{{ t('generate.preview.subtitle', { range: weekRange }) }}</p>
        <p v-if="plan.model" class="preview__model">{{ plan.model }}</p>
      </div>
      <div class="preview__stats">
        <div class="stat">
          <span class="stat__label">{{ t('generate.preview.avgPerDay') }}</span>
          <span class="stat__value tabular">{{ dailyAvg.calories }} {{ t('common.kcal') }}</span>
        </div>
        <div class="stat">
          <span class="stat__label">P</span>
          <span class="stat__value tabular">{{ dailyAvg.protein }}{{ t('common.g') }}</span>
        </div>
        <div class="stat">
          <span class="stat__label">C</span>
          <span class="stat__value tabular">{{ dailyAvg.carbs }}{{ t('common.g') }}</span>
        </div>
        <div class="stat">
          <span class="stat__label">F</span>
          <span class="stat__value tabular">{{ dailyAvg.fat }}{{ t('common.g') }}</span>
        </div>
      </div>
    </header>

    <div class="preview__grid">
      <PreviewDayCard
        v-for="day in plan.days"
        :key="day.dayIndex"
        :day="day"
        :day-name="dayNames[day.dayIndex]"
      />
    </div>

    <footer class="preview__footer">
      <button type="button" class="app-btn app-btn--secondary" @click="emit('back')">
        <ChevronLeft :size="14" />
        {{ t('generate.preview.back') }}
      </button>
      <button type="button" class="app-btn app-btn--primary app-btn--lg" @click="emit('apply')">
        <Check :size="14" />
        {{ t('generate.preview.apply') }}
      </button>
    </footer>

    <p class="preview__note">{{ t('generate.preview.warning') }}</p>
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.preview__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.preview__title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.preview__sub {
  font-size: 12px;
  color: var(--text-faint);
  margin-top: 2px;
}

.preview__model {
  display: inline-block;
  margin-top: 6px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-family: ui-monospace, monospace;
}

.preview__stats {
  display: inline-flex;
  gap: 16px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.stat__label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

.stat__value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.preview__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.preview__footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.preview__note {
  text-align: center;
  font-size: 11px;
  color: var(--text-faint);
}

.preview__warnings {
  padding: 14px 16px;
  background-color: var(--danger-tint);
  border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
  border-radius: var(--radius-sm);
  color: var(--danger);
}

.preview__warnings-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.preview__warnings-title {
  font-size: 13px;
  font-weight: 700;
}

.preview__warnings-sub {
  font-size: 12px;
  opacity: 0.85;
  margin-top: 2px;
}

.preview__warnings-list {
  list-style: disc;
  padding-left: 28px;
  margin-top: 8px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

@media (min-width: 1024px) {
  .preview__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
