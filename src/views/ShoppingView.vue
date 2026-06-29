<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ShoppingCart, ClipboardList, Snowflake } from 'lucide-vue-next'
import { useDietStore } from '@/stores/dietStore'
import { useWeekNavigation } from '@/composables/useWeekNavigation'
import { estimateWeeklyCost, preloadCatalog } from '@/utils/mercadonaPrices'
import WeekNavigator from '@/components/calendar/WeekNavigator.vue'

const { t, locale } = useI18n()
const store = useDietStore()
const { weekRange, init, goToPrevWeek, goToNextWeek, goToToday } = useWeekNavigation()

const catalogReady = ref(false)
onMounted(() => {
  init()
  preloadCatalog().then(() => { catalogReady.value = true })
})

const CATEGORY_ORDER = [
  'vegetables',
  'fruits',
  'protein',
  'dairy',
  'grains_and_pasta',
  'legumes',
  'nuts_and_seeds',
  'pantry',
  'herbs_and_spices',
  'oils_and_condiments',
  'frozen',
  'beverages',
  'bakery',
  'other',
]

// Persist checked items in the week's shoppingList so they survive refresh.
const hideChecked = ref(false)
const copyMsg = ref('')

const checkedSet = computed(() => new Set(week.value?.shoppingList?.checkedItems || []))

function toggle(key) {
  if (!week.value?.shoppingList) return
  const current = [...(week.value.shoppingList.checkedItems || [])]
  const idx = current.indexOf(key)
  if (idx === -1) current.push(key)
  else current.splice(idx, 1)
  week.value.shoppingList.checkedItems = current
}

const recalcMsg = ref('')

function recalcList() {
  store.rebuildShoppingList(store.currentWeekKey)
  recalcMsg.value = t('shopping.recalcDone')
  setTimeout(() => (recalcMsg.value = ''), 2000)
}

function copyAsText() {
  const lines = []
  for (const group of grouped.value) {
    lines.push(`\n${t(`shopping.categories.${group.key}`).toUpperCase()}`)
    for (const item of group.items) {
      const mark = checkedSet.value.has(item.name) ? '✓' : '○'
      lines.push(`  ${mark} ${item.name} — ${item.amount}`)
    }
  }
  navigator.clipboard.writeText(lines.join('\n').trim()).then(() => {
    copyMsg.value = t('shopping.copied')
    setTimeout(() => (copyMsg.value = ''), 2000)
  }).catch(() => {})
}

const week = computed(() => store.currentWeek)
const shoppingList = computed(() => week.value?.shoppingList || null)
const items = computed(() => shoppingList.value?.items || [])

const grouped = computed(() => {
  const map = new Map()
  for (const item of items.value) {
    const cat = CATEGORY_ORDER.includes(item.category) ? item.category : 'other'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat).push(item)
  }
  return CATEGORY_ORDER
    .filter((c) => map.has(c))
    .map((c) => ({ key: c, items: map.get(c) }))
})

const estimatedCost = computed(() => {
  if (items.value.length === 0) return null
  // Touch catalogReady so the cost recomputes once the catalog finishes loading.
  void catalogReady.value
  return estimateWeeklyCost(items.value)
})

// Fresh meat and fish that spoils within 1-2 days in the fridge.
// Excludes cured/processed meats (jamón, chorizo, bacon) and dairy.
const PERISHABLE_CATEGORIES = new Set()
const PERISHABLE_KEYWORDS = [
  // Aves frescas
  'pollo', 'pavo', 'pechuga', 'muslo', 'contramuslo', 'alitas',
  'chicken', 'turkey', 'breast', 'thigh',
  // Carne roja fresca
  'ternera', 'cerdo', 'cordero', 'lomo', 'solomillo', 'filete',
  'carne picada', 'carne molida', 'entrecot', 'chuleta',
  'beef', 'pork', 'lamb', 'steak', 'fillet', 'mince', 'ground',
  // Pescado y marisco fresco
  'salmón', 'salmon', 'atún', 'atun', 'merluza', 'bacalao fresco',
  'dorada', 'lubina', 'rape', 'trucha', 'lenguado', 'mero', 'rodaballo',
  'gambas', 'langostino', 'sepia', 'calamar', 'pulpo', 'sardina', 'anchoa',
  'mejillones', 'almejas', 'berberechos',
  'cod', 'tuna', 'trout', 'bass', 'hake', 'sole', 'bream',
  'shrimp', 'prawn', 'squid', 'octopus', 'mussel', 'clam',
]
const FREEZER_THRESHOLD_DAYS = 3

// Analyze which days each ingredient is first used
const freezerItems = computed(() => {
  if (!week.value || items.value.length === 0) return []

  // Build a map: ingredient name (lowercase) → earliest dayIndex it appears
  const firstUseDay = new Map()
  for (const day of week.value.days) {
    const dayIdx = week.value.days.indexOf(day)
    for (const meal of day.meals) {
      for (const dish of meal.dishes) {
        for (const ing of (dish.ingredients || [])) {
          if (!ing.name) continue
          const key = ing.name.toLowerCase().trim()
          if (!firstUseDay.has(key)) {
            firstUseDay.set(key, dayIdx)
          }
        }
      }
    }
  }

  // Find shopping list items that are perishable AND first used on day 3+
  const result = []
  for (const item of items.value) {
    const key = item.name.toLowerCase().trim()
    const firstDay = firstUseDay.get(key)
    if (firstDay === undefined || firstDay < FREEZER_THRESHOLD_DAYS) continue

    const isPerishableCat = PERISHABLE_CATEGORIES.has(item.category)
    const isPerishableKeyword = PERISHABLE_KEYWORDS.some((kw) => key.includes(kw))
    if (!isPerishableCat && !isPerishableKeyword) continue

    const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    result.push({
      ...item,
      firstDayIndex: firstDay,
      firstDayKey: WEEKDAY_KEYS[firstDay] || '',
    })
  }

  return result.sort((a, b) => a.firstDayIndex - b.firstDayIndex)
})

const generatedAtLabel = computed(() => {
  if (!shoppingList.value?.generatedAt) return ''
  const date = new Date(shoppingList.value.generatedAt)
  const fmt = new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
  return t('shopping.generatedAt', { when: fmt.format(date) })
})
</script>

<template>
  <div class="shopping">
    <header class="shopping__head">
      <div class="shopping__title-row">
        <div class="shopping__title-icon">
          <ShoppingCart :size="20" />
        </div>
        <div>
          <h1 class="shopping__title font-display">{{ t('shopping.title') }}</h1>
          <p class="shopping__sub">{{ t('shopping.subtitle') }}</p>
        </div>
      </div>
      <WeekNavigator
        :week-range="weekRange"
        @prev="goToPrevWeek"
        @next="goToNextWeek"
        @today="goToToday"
      />
    </header>

    <div v-if="items.length === 0" class="shopping__empty app-card">
      <ClipboardList :size="28" />
      <p>{{ t('shopping.empty') }}</p>
    </div>

    <div v-else class="shopping__toolbar">
      <div class="shopping__meta">
        <span>{{ t('shopping.itemsCount', items.length, { count: items.length }) }}</span>
        <span v-if="estimatedCost !== null" class="shopping__cost">~{{ estimatedCost.toFixed(2) }}€</span>
        <span v-if="generatedAtLabel">{{ generatedAtLabel }}</span>
      </div>
      <div class="shopping__actions">
        <button type="button" class="app-btn app-btn--ghost app-btn--sm" @click="recalcList">
          {{ recalcMsg || t('shopping.recalcList') }}
        </button>
        <button type="button" class="app-btn app-btn--ghost app-btn--sm" @click="hideChecked = !hideChecked">
          {{ hideChecked ? t('shopping.showAll') : t('shopping.hideChecked') }}
        </button>
        <button type="button" class="app-btn app-btn--secondary app-btn--sm" @click="copyAsText">
          {{ copyMsg || t('shopping.copyList') }}
        </button>
      </div>
    </div>

    <section v-for="group in grouped" :key="group.key" class="shopping__section app-card">
      <h2 class="shopping__section-title">{{ t(`shopping.categories.${group.key}`) }}</h2>
      <ul class="shopping__items">
        <li
          v-for="(item, i) in group.items"
          :key="`${group.key}-${i}-${item.name}`"
          v-show="!hideChecked || !checkedSet.has(item.name)"
          class="shopping-item"
          :class="{ 'is-checked': checkedSet.has(item.name) }"
          @click="toggle(item.name)"
        >
          <span class="shopping-item__checkbox">
            <span v-if="checkedSet.has(item.name)" class="shopping-item__tick">✓</span>
          </span>
          <span class="shopping-item__name">{{ item.name }}</span>
          <span v-if="item.amount" class="shopping-item__amount tabular">{{ item.amount }}</span>
        </li>
      </ul>
    </section>

    <!-- Freezer recommendations -->
    <section v-if="freezerItems.length > 0" class="shopping__section shopping__freezer app-card">
      <h2 class="shopping__section-title shopping__freezer-title">
        <Snowflake :size="14" /> {{ t('shopping.freezer.title') }}
      </h2>
      <p class="shopping__freezer-sub">{{ t('shopping.freezer.subtitle') }}</p>
      <ul class="shopping__items">
        <li
          v-for="(item, i) in freezerItems"
          :key="`freezer-${i}-${item.name}`"
          class="shopping-item shopping-item--freezer"
        >
          <Snowflake :size="14" class="shopping-item__frost" />
          <span class="shopping-item__name">{{ item.name }}</span>
          <span class="shopping-item__amount tabular">{{ item.amount }}</span>
          <span class="shopping-item__day">{{ t(`planner.weekday.${item.firstDayKey}`) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.shopping {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 880px;
  margin: 0 auto;
}

.shopping__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.shopping__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.shopping__title-icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background-color: var(--accent-tint);
  color: var(--accent);
}

.shopping__title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
}

.shopping__sub {
  font-size: 13px;
  color: var(--text-faint);
}

.shopping__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 24px;
  color: var(--text-faint);
  text-align: center;
}

.shopping__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.shopping__meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-faint);
}

.shopping__cost {
  font-weight: 700;
  color: var(--accent);
  font-size: 14px;
}

.shopping__actions {
  display: flex;
  gap: 8px;
}

.shopping__section {
  padding: 20px 24px;
}

.shopping__section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
  margin-bottom: 12px;
}

.shopping__items {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.shopping-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.shopping-item:last-child {
  border-bottom: none;
}

.shopping-item__checkbox {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--border-strong);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--accent-fg);
  font-size: 12px;
  font-weight: 700;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.shopping-item.is-checked .shopping-item__checkbox {
  background-color: var(--accent);
  border-color: var(--accent);
}

.shopping-item__name {
  flex: 1;
  font-size: 14px;
  color: var(--text);
  font-weight: 500;
}

.shopping-item__amount {
  font-size: 13px;
  color: var(--text-muted);
}

.shopping-item.is-checked .shopping-item__name,
.shopping-item.is-checked .shopping-item__amount {
  text-decoration: line-through;
  color: var(--text-faint);
}

.shopping__freezer {
  border-color: #a8d8ea;
  background: linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, #a8d8ea 8%, var(--surface)) 100%);
}

.shopping__freezer-title {
  color: #4a9ec5;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.shopping__freezer-sub {
  font-size: 12px;
  color: var(--text-faint);
  margin-bottom: 12px;
  line-height: 1.4;
}

.shopping-item--freezer {
  cursor: default;
}

.shopping-item__frost {
  color: #4a9ec5;
  flex-shrink: 0;
}

.shopping-item__day {
  font-size: 11px;
  font-weight: 700;
  color: #4a9ec5;
  background-color: color-mix(in srgb, #a8d8ea 20%, transparent);
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .shopping__head {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .shopping__section {
    padding: 16px;
  }
  .shopping__title {
    font-size: 22px;
  }
}
</style>
