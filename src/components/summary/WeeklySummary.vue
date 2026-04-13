<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sparkles, Printer, ArrowRightLeft } from 'lucide-vue-next'
import { sumDays } from '@/utils/nutritionHelpers'
import { useDietStore } from '@/stores/dietStore'
import { chatAboutDish } from '@/services/dishChat'
import { localizedDish } from '@/utils/dishLocale'

const { t, locale } = useI18n()
const store = useDietStore()

const props = defineProps({
  week: { type: Object, default: null },
})

defineEmits(['generate'])

function printPlan() {
  window.print()
}

// Bulk ingredient swap
const swapInput = ref('')
const swapping = ref(false)
const swapMsg = ref('')

async function handleSwap() {
  const raw = swapInput.value.trim()
  if (!raw || swapping.value) return

  // Parse "patata → boniato" or "patata -> boniato" or "patata por boniato"
  const parts = raw.split(/\s*(?:→|->|por)\s*/i)
  if (parts.length !== 2 || !parts[0] || !parts[1]) return

  const from = parts[0].trim()
  const to = parts[1].trim()

  // Find all dishes containing the ingredient
  const week = props.week
  if (!week) return

  const targets = []
  for (const day of week.days) {
    for (const meal of day.meals) {
      for (const dish of meal.dishes) {
        const view = localizedDish(dish, locale.value)
        const hasIt = (view.ingredients || []).some((ing) =>
          ing.name.toLowerCase().includes(from.toLowerCase()),
        )
        if (hasIt) targets.push(dish)
      }
    }
  }

  if (targets.length === 0) {
    swapMsg.value = t('summary.swapNone')
    setTimeout(() => (swapMsg.value = ''), 3000)
    return
  }

  swapping.value = true
  swapMsg.value = ''
  let swapped = 0

  for (const dish of targets) {
    const result = await chatAboutDish({
      dish: localizedDish(dish, locale.value),
      profile: store.profile,
      history: [],
      message: `Replace all "${from}" with "${to}" in this dish. Recalculate macros accordingly. Keep everything else the same.`,
      language: locale.value,
    })

    if (result.success && result.updatedDish) {
      store.updateDishById(dish.id, result.updatedDish, locale.value)
      swapped++
    }
  }

  swapping.value = false
  swapInput.value = ''

  if (swapped > 0) {
    swapMsg.value = t('summary.swapDone', swapped, { count: swapped })
    store.rebuildShoppingList(store.currentWeekKey)
  }
  setTimeout(() => (swapMsg.value = ''), 4000)
}

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
    vegetables: Math.round((totals.value.vegetables || 0) / n),
  }
})

// Pull targets from the user's profile when present, otherwise use sensible defaults.
const targets = computed(() => ({
  protein: store.profile.proteinTarget || 150,
  carbs: store.profile.carbsTarget || 220,
  fat: store.profile.fatTarget || 70,
  vegetables: store.profile.vegetableTarget || 400,
}))

const macros = computed(() => [
  { key: 'protein', label: t('summary.protein'), value: dailyAvg.value.protein, target: targets.value.protein },
  { key: 'carbs', label: t('summary.carbs'), value: dailyAvg.value.carbs, target: targets.value.carbs },
  { key: 'fat', label: t('summary.fat'), value: dailyAvg.value.fat, target: targets.value.fat },
  { key: 'vegetables', label: t('summary.vegetables'), value: dailyAvg.value.vegetables, target: targets.value.vegetables },
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
    <div class="summary__swap">
      <div class="summary__swap-row">
        <ArrowRightLeft :size="12" />
        <input
          v-model="swapInput"
          class="app-input summary__swap-input"
          :placeholder="t('summary.swapPlaceholder')"
          :disabled="swapping"
          @keydown.enter.prevent="handleSwap"
        />
        <button
          type="button"
          class="app-btn app-btn--primary app-btn--sm"
          :disabled="swapping || !swapInput.trim()"
          @click="handleSwap"
        >
          {{ swapping ? t('summary.swapping') : t('summary.swapBtn') }}
        </button>
      </div>
      <p v-if="swapMsg" class="summary__swap-msg">{{ swapMsg }}</p>
    </div>

    <button type="button" class="app-btn app-btn--ghost summary__print" @click="printPlan">
      <Printer :size="14" />
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

.summary__swap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary__swap-row {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-faint);
}

.summary__swap-input {
  flex: 1;
  min-height: 34px;
  font-size: 12px;
  padding: 6px 8px;
}

.summary__swap-msg {
  font-size: 11px;
  font-weight: 500;
  color: var(--accent);
}

.summary__print {
  width: 100%;
  margin-top: -4px;
}

@media (max-width: 768px) {
  .summary {
    position: static;
  }
  .summary__kcal-value {
    font-size: 26px;
  }
}
</style>
