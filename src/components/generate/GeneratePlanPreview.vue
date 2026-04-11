<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, Check, AlertTriangle, RotateCcw, Brain, Info, ChevronDown } from 'lucide-vue-next'
import { sumDays } from '@/utils/nutritionHelpers'
import PreviewDayCard from './PreviewDayCard.vue'

const { t, locale } = useI18n()

const props = defineProps({
  plan: { type: Object, required: true },
  weekRange: { type: String, required: true },
})

const emit = defineEmits(['apply', 'back', 'regenerate'])

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
  vegetables: Math.round((weekTotals.value.vegetables || 0) / 7),
}))

const debugExpanded = ref(false)
const hasProviderErrors = computed(() => Array.isArray(props.plan.providerErrors) && props.plan.providerErrors.length > 0)
</script>

<template>
  <div class="preview">
    <div v-if="plan.warnings && plan.warnings.length" class="preview__warnings">
      <div class="preview__warnings-head">
        <AlertTriangle :size="16" />
        <div class="preview__warnings-body">
          <p class="preview__warnings-title">{{ t('generate.warningsTitle') }}</p>
          <p class="preview__warnings-sub">{{ t('generate.warningsSub') }}</p>
        </div>
        <button type="button" class="preview__warnings-btn" @click="emit('regenerate')">
          <RotateCcw :size="13" />
          {{ t('generate.warningsRegenerate') }}
        </button>
      </div>
      <ul class="preview__warnings-list">
        <li v-for="(w, i) in plan.warnings" :key="i">{{ w }}</li>
      </ul>
    </div>

    <header class="preview__head">
      <div>
        <h2 class="preview__title font-display">{{ t('generate.preview.title') }}</h2>
        <p class="preview__sub">{{ t('generate.preview.subtitle', { range: weekRange }) }}</p>
        <div v-if="plan.model" class="preview__model-chip">
          <Brain :size="13" />
          <span class="preview__model-label">{{ t('generate.preview.generatedWith') }}</span>
          <span class="preview__model-name tabular">{{ plan.model }}</span>
          <button
            v-if="hasProviderErrors"
            type="button"
            class="preview__debug-toggle"
            :title="t('generate.preview.whyFallback')"
            @click="debugExpanded = !debugExpanded"
          >
            <Info :size="12" />
          </button>
        </div>
        <div v-if="hasProviderErrors && debugExpanded" class="preview__debug">
          <p class="preview__debug-title">{{ t('generate.preview.debugTitle') }}</p>
          <ul class="preview__debug-list">
            <li v-for="(e, i) in plan.providerErrors" :key="i">{{ e }}</li>
          </ul>
        </div>
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
        <div class="stat">
          <span class="stat__label">V</span>
          <span class="stat__value tabular">{{ dailyAvg.vegetables }}{{ t('common.g') }}</span>
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

.preview__model-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 6px 12px;
  background-color: var(--accent-tint);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 999px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}

[data-theme='dark'] .preview__model-chip {
  background-color: color-mix(in srgb, var(--accent) 14%, transparent);
}

.preview__model-label {
  opacity: 0.75;
  font-weight: 500;
}

.preview__model-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.preview__debug-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--accent);
  opacity: 0.7;
  cursor: pointer;
  border-radius: 999px;
}

.preview__debug-toggle:hover {
  opacity: 1;
  background-color: color-mix(in srgb, var(--accent) 20%, transparent);
}

.preview__debug {
  margin-top: 10px;
  padding: 12px 14px;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 11px;
}

.preview__debug-title {
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.preview__debug-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--text-muted);
  word-break: break-word;
}

.preview__debug-list li {
  padding: 4px 0;
  border-top: 1px solid var(--border);
}

.preview__debug-list li:first-child {
  border-top: none;
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

.preview__warnings-body {
  flex: 1;
}

.preview__warnings-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--danger);
  background-color: var(--surface);
  color: var(--danger);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease;
}

.preview__warnings-btn:hover {
  background-color: var(--danger-tint);
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
