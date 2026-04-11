<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ShoppingCart, ClipboardList } from 'lucide-vue-next'
import { useDietStore } from '@/stores/dietStore'
import { useWeekNavigation } from '@/composables/useWeekNavigation'
import WeekNavigator from '@/components/calendar/WeekNavigator.vue'

const { t, locale } = useI18n()
const store = useDietStore()
const { weekRange, init, goToPrevWeek, goToNextWeek, goToToday } = useWeekNavigation()

onMounted(init)

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

// Checked state is local to the session — we don't persist it to D1.
const checked = ref(new Set())

function toggle(key) {
  const next = new Set(checked.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  checked.value = next
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

    <div v-else class="shopping__meta">
      <span>{{ t('shopping.itemsCount', items.length, { count: items.length }) }}</span>
      <span v-if="generatedAtLabel">{{ generatedAtLabel }}</span>
    </div>

    <section v-for="group in grouped" :key="group.key" class="shopping__section app-card">
      <h2 class="shopping__section-title">{{ t(`shopping.categories.${group.key}`) }}</h2>
      <ul class="shopping__items">
        <li
          v-for="(item, i) in group.items"
          :key="`${group.key}-${i}-${item.name}`"
          class="shopping-item"
          :class="{ 'is-checked': checked.has(`${group.key}-${i}-${item.name}`) }"
          @click="toggle(`${group.key}-${i}-${item.name}`)"
        >
          <span class="shopping-item__checkbox">
            <span v-if="checked.has(`${group.key}-${i}-${item.name}`)" class="shopping-item__tick">✓</span>
          </span>
          <span class="shopping-item__name">{{ item.name }}</span>
          <span v-if="item.amount" class="shopping-item__amount tabular">{{ item.amount }}</span>
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

.shopping__meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--text-faint);
  padding: 0 4px;
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
</style>
