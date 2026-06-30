<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sparkles, Printer, ArrowRightLeft, Share2, Link } from 'lucide-vue-next'
import { sumDays } from '@/utils/nutritionHelpers'
import { useDietStore } from '@/stores/dietStore'
import { chatAboutDish } from '@/services/dishChat'
import { localizedDish } from '@/utils/dishLocale'
import { localizedMealLabel } from '@/utils/mealLocale'

const { t, locale } = useI18n()
const store = useDietStore()

const props = defineProps({
  week: { type: Object, default: null },
})

defineEmits(['generate'])

function printPlan() {
  window.print()
}

// Share week
const shareMsg = ref('')
const shareLoading = ref(false)

async function shareWeek() {
  if (!props.week || shareLoading.value) return
  shareLoading.value = true
  shareMsg.value = ''
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week: props.week, weekRange: '' }),
      credentials: 'include',
    })
    const data = await res.json()
    if (data.success && data.id) {
      const link = `${location.origin}/shared/${data.id}`
      await navigator.clipboard.writeText(link)
      shareMsg.value = t('summary.shareCopied')
    }
  } catch { /* silent */ }
  shareLoading.value = false
  setTimeout(() => (shareMsg.value = ''), 3000)
}

// Batch cooking
const batchTips = ref([])
const batchLoading = ref(false)

async function loadBatchTips() {
  if (!props.week) return
  batchLoading.value = true
  batchTips.value = []

  const dishes = []
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  for (let i = 0; i < props.week.days.length; i++) {
    for (const meal of props.week.days[i].meals) {
      for (const dish of meal.dishes) {
        const view = localizedDish(dish, locale.value)
        dishes.push({ day: dayNames[i], name: view.name, ingredients: view.ingredients })
      }
    }
  }

  try {
    const res = await fetch('/api/batch-cooking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dishes, language: store.language || 'en' }),
      credentials: 'include',
    })
    const data = await res.json()
    if (data.success) batchTips.value = data.suggestions || []
  } catch { /* silent */ }
  batchLoading.value = false
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
    <button type="button" class="app-btn app-btn--ghost summary__batch-btn" :disabled="batchLoading" @click="loadBatchTips">
      {{ batchLoading ? t('summary.batchLoading') : t('summary.batchCooking') }}
    </button>

    <div v-if="batchTips.length" class="summary__batch-tips">
      <div v-for="(tip, i) in batchTips" :key="i" class="batch-tip">
        <strong class="batch-tip__ing">{{ tip.ingredient }}</strong>
        <p class="batch-tip__text">{{ tip.suggestion }}</p>
      </div>
    </div>

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

    <div class="summary__bottom-btns">
      <button type="button" class="app-btn app-btn--ghost" @click="shareWeek" :disabled="shareLoading">
        <Share2 :size="14" />
        {{ shareMsg || t('summary.shareWeek') }}
      </button>
      <button type="button" class="app-btn app-btn--ghost" @click="printPlan">
        <Printer :size="14" />
      </button>
    </div>
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

.summary__batch-btn {
  width: 100%;
}

.summary__batch-tips {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.batch-tip {
  padding: 8px 10px;
  background-color: var(--surface-2);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--accent);
}

.batch-tip__ing {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}

.batch-tip__text {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
  line-height: 1.4;
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

.summary__bottom-btns {
  display: flex;
  gap: 6px;
}

.summary__bottom-btns .app-btn {
  flex: 1;
}

.summary__bottom-btns .app-btn:last-child {
  flex: 0;
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
