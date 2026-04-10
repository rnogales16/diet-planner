<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sparkles } from 'lucide-vue-next'
import { sumDays } from '@/utils/nutritionHelpers'
import { useDietStore } from '@/stores/dietStore'

const { t } = useI18n()
const store = useDietStore()

const props = defineProps({
  week: { type: Object, default: null },
})

defineEmits(['generate'])

const totals = computed(() => (props.week ? sumDays(props.week.days) : { calories: 0, protein: 0, carbs: 0, fat: 0 }))

const daysWithFood = computed(() =>
  props.week ? props.week.days.filter((d) => d.meals.some((m) => m.dishes.length > 0)).length : 0,
)

const dailyAvg = computed(() => {
  const n = daysWithFood.value || 1
  return {
    calories: Math.round(totals.value.calories / n),
    protein: Math.round(totals.value.protein / n),
    carbs: Math.round(totals.value.carbs / n),
    fat: Math.round(totals.value.fat / n),
  }
})

// Pull targets from the user's profile when present, otherwise use sensible defaults.
const targets = computed(() => ({
  protein: store.profile.proteinTarget || 150,
  carbs: store.profile.carbsTarget || 220,
  fat: store.profile.fatTarget || 70,
}))

const macros = computed(() => [
  { key: 'protein', label: t('summary.protein'), value: dailyAvg.value.protein, target: targets.value.protein },
  { key: 'carbs', label: t('summary.carbs'), value: dailyAvg.value.carbs, target: targets.value.carbs },
  { key: 'fat', label: t('summary.fat'), value: dailyAvg.value.fat, target: targets.value.fat },
])
</script>

<template>
  <aside class="summary">
    <header class="summary__head">
      <h3 class="summary__title font-display">{{ t('summary.title') }}</h3>
      <p class="summary__sub" v-if="daysWithFood">{{ t('summary.daysPlanned', daysWithFood, { count: daysWithFood }) }}</p>
      <p class="summary__sub" v-else>{{ t('summary.noDishes') }}</p>
    </header>

    <div class="summary__kcal">
      <span class="summary__kcal-label">{{ t('summary.dailyAverage') }}</span>
      <span class="summary__kcal-value font-display tabular">{{ dailyAvg.calories.toLocaleString() }}</span>
      <span class="summary__kcal-unit">{{ t('common.kcal') }}</span>
    </div>

    <div class="summary__macros">
      <div v-for="m in macros" :key="m.key" class="macro">
        <div class="macro__row">
          <span class="macro__label">{{ m.label }}</span>
          <span class="macro__value tabular">{{ m.value }}<span class="macro__unit"> / {{ m.target }} g</span></span>
        </div>
        <div class="macro__bar">
          <div class="macro__fill" :style="{ width: Math.min(100, (m.value / m.target) * 100) + '%' }" />
        </div>
      </div>
    </div>

    <button type="button" class="app-btn app-btn--primary summary__cta" @click="$emit('generate')">
      <Sparkles :size="14" />
      {{ t('summary.generateWeek') }}
    </button>
  </aside>
</template>

<style scoped>
.summary {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: var(--shadow);
  position: sticky;
  top: 80px;
}

.summary__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.summary__sub {
  font-size: 12px;
  color: var(--text-faint);
}

.summary__kcal {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.summary__kcal-label {
  display: block;
  width: 100%;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  margin-bottom: 4px;
}

.summary__kcal-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}

.summary__kcal-unit {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.summary__macros {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.macro__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.macro__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}

.macro__value {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.macro__unit {
  color: var(--text-faint);
  font-weight: 500;
}

.macro__bar {
  height: 5px;
  background-color: var(--surface-2);
  border-radius: 999px;
  overflow: hidden;
}

.macro__fill {
  height: 100%;
  background-color: var(--accent);
  border-radius: 999px;
  transition: width 0.4s ease;
}

.summary__cta {
  width: 100%;
  margin-top: 4px;
}
</style>
