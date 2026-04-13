<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDietStore } from '@/stores/dietStore'
import { localizedDish } from '@/utils/dishLocale'
import { localizedMealLabel } from '@/utils/mealLocale'
import { sumMeals } from '@/utils/nutritionHelpers'

const { t, locale } = useI18n()
const store = useDietStore()

const props = defineProps({
  week: { type: Object, default: null },
  weekRange: { type: String, default: '' },
})

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const enabledTypes = computed(() => {
  const set = new Set()
  for (const mt of store.mealTypes) {
    if (mt.enabled !== false) set.add(mt.type)
  }
  return set
})

function dayMeals(day) {
  return day.meals.filter((m) => enabledTypes.value.has(m.type) && m.dishes.length > 0)
}

function loc(dish) {
  return localizedDish(dish, locale.value)
}

function mealLabel(meal) {
  return localizedMealLabel(meal, t)
}

function dayTotals(day) {
  return sumMeals(day.meals.filter((m) => enabledTypes.value.has(m.type)))
}

const shoppingItems = computed(() => props.week?.shoppingList?.items || [])

const CATEGORY_ORDER = [
  'vegetables', 'fruits', 'protein', 'dairy', 'grains_and_pasta',
  'legumes', 'nuts_and_seeds', 'pantry', 'herbs_and_spices',
  'oils_and_condiments', 'frozen', 'beverages', 'bakery', 'other',
]

const shoppingGrouped = computed(() => {
  const map = new Map()
  for (const item of shoppingItems.value) {
    const cat = CATEGORY_ORDER.includes(item.category) ? item.category : 'other'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat).push(item)
  }
  return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ key: c, items: map.get(c) }))
})
</script>

<template>
  <div v-if="week" class="print-plan">
    <!-- PAGE 1: Mon–Thu (read left-to-right, top-to-bottom via grid) -->
    <div class="pp-page">
      <header class="pp-header">
        <h1>Diet Planner</h1>
        <p>{{ weekRange }}</p>
      </header>
      <div class="pp-days">
        <section v-for="idx in [0, 1, 2, 3]" :key="week.days[idx].date" class="pp-day">
          <h2 class="pp-day-title">
            {{ t(`planner.weekday.${WEEKDAY_KEYS[idx]}`) }}
            <span class="pp-day-date">{{ new Date(week.days[idx].date).getDate() }}</span>
            <span class="pp-day-totals">
              {{ dayTotals(week.days[idx]).calories }} kcal ·
              P{{ dayTotals(week.days[idx]).protein }} C{{ dayTotals(week.days[idx]).carbs }} F{{ dayTotals(week.days[idx]).fat }}
            </span>
          </h2>
          <div v-for="meal in dayMeals(week.days[idx])" :key="meal.type" class="pp-meal">
            <div v-for="dish in meal.dishes" :key="dish.id" class="pp-dish">
              <div class="pp-dish-head">
                <span class="pp-meal-label">{{ mealLabel(meal) }}</span>
                <strong class="pp-dish-name">{{ loc(dish).name }}</strong>
                <span class="pp-dish-macros">{{ dish.calories }} kcal · P{{ dish.protein }} C{{ dish.carbs }} F{{ dish.fat }}</span>
              </div>
              <div v-if="loc(dish).ingredients?.length" class="pp-ings">
                <span v-for="(ing, i) in loc(dish).ingredients" :key="i" class="pp-ing">{{ ing.name }} <em>{{ ing.amount }}</em><template v-if="i < loc(dish).ingredients.length - 1">, </template></span>
              </div>
              <ol v-if="loc(dish).instructions?.length" class="pp-steps">
                <li v-for="(step, i) in loc(dish).instructions" :key="i">{{ step }}</li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- PAGE 2: Fri–Sun -->
    <div class="pp-page">
      <header class="pp-header pp-header--cont">
        <p>{{ weekRange }} — {{ t('common.continued') || 'cont.' }}</p>
      </header>
      <div class="pp-days">
        <section v-for="idx in [4, 5, 6]" :key="week.days[idx].date" class="pp-day">
          <h2 class="pp-day-title">
            {{ t(`planner.weekday.${WEEKDAY_KEYS[idx]}`) }}
            <span class="pp-day-date">{{ new Date(week.days[idx].date).getDate() }}</span>
            <span class="pp-day-totals">
              {{ dayTotals(week.days[idx]).calories }} kcal ·
              P{{ dayTotals(week.days[idx]).protein }} C{{ dayTotals(week.days[idx]).carbs }} F{{ dayTotals(week.days[idx]).fat }}
            </span>
          </h2>
          <div v-for="meal in dayMeals(week.days[idx])" :key="meal.type" class="pp-meal">
            <div v-for="dish in meal.dishes" :key="dish.id" class="pp-dish">
              <div class="pp-dish-head">
                <span class="pp-meal-label">{{ mealLabel(meal) }}</span>
                <strong class="pp-dish-name">{{ loc(dish).name }}</strong>
                <span class="pp-dish-macros">{{ dish.calories }} kcal · P{{ dish.protein }} C{{ dish.carbs }} F{{ dish.fat }}</span>
              </div>
              <div v-if="loc(dish).ingredients?.length" class="pp-ings">
                <span v-for="(ing, i) in loc(dish).ingredients" :key="i" class="pp-ing">{{ ing.name }} <em>{{ ing.amount }}</em><template v-if="i < loc(dish).ingredients.length - 1">, </template></span>
              </div>
              <ol v-if="loc(dish).instructions?.length" class="pp-steps">
                <li v-for="(step, i) in loc(dish).instructions" :key="i">{{ step }}</li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- PAGE 3: Shopping list -->
    <div v-if="shoppingGrouped.length" class="pp-page">
      <section class="pp-shopping">
        <h2 class="pp-shopping-title">{{ t('shopping.title') }} — {{ weekRange }}</h2>
        <div class="pp-shop-grid">
          <div v-for="group in shoppingGrouped" :key="group.key" class="pp-shop-group">
            <h3 class="pp-shop-cat">{{ t(`shopping.categories.${group.key}`) }}</h3>
            <div class="pp-shop-items">
              <div v-for="(item, i) in group.items" :key="i" class="pp-shop-item">
                ☐ {{ item.name }} <em>{{ item.amount }}</em>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Only visible when printing */
.print-plan {
  display: none;
}

@media print {
  .print-plan {
    display: block;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 9pt;
    color: #111;
    line-height: 1.4;
  }

  .pp-header {
    text-align: center;
    margin-bottom: 6pt;
    padding-bottom: 4pt;
    border-bottom: 1.5pt solid #7c9885;
  }

  .pp-header h1 {
    font-size: 11pt;
    font-weight: 700;
    margin: 0;
    color: #7c9885;
  }

  .pp-header p {
    font-size: 8pt;
    color: #666;
    margin: 1pt 0 0;
  }

  .pp-page {
    page-break-after: always;
  }

  .pp-page:last-child {
    page-break-after: auto;
  }

  /* Grid reads left-to-right: Mon Tue on the first row, Wed Thu on
     the second. NOT top-to-bottom like CSS columns would do. */
  .pp-days {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6pt 12pt;
  }

  .pp-day {
    margin-bottom: 0;
    break-inside: avoid;
  }

  .pp-day-title {
    font-size: 8pt;
    font-weight: 700;
    background: #f3f4f6;
    padding: 2pt 4pt;
    margin: 0 0 2pt;
    border-left: 2pt solid #7c9885;
    display: flex;
    align-items: baseline;
    gap: 4pt;
  }

  .pp-day-date {
    font-size: 9pt;
  }

  .pp-day-totals {
    margin-left: auto;
    font-size: 6.5pt;
    font-weight: 400;
    color: #666;
  }

  .pp-meal {
    margin-bottom: 1pt;
  }

  .pp-dish {
    padding: 1pt 0 1pt 6pt;
    border-bottom: 0.5pt solid #eee;
  }

  .pp-dish:last-child {
    border-bottom: none;
  }

  .pp-dish-head {
    display: flex;
    align-items: baseline;
    gap: 4pt;
    flex-wrap: wrap;
  }

  .pp-meal-label {
    font-size: 6pt;
    text-transform: uppercase;
    letter-spacing: 0.4pt;
    color: #999;
    min-width: 40pt;
  }

  .pp-dish-name {
    font-size: 7.5pt;
    font-weight: 600;
    flex: 1;
  }

  .pp-dish-macros {
    font-size: 6pt;
    color: #888;
    white-space: nowrap;
  }

  .pp-ings {
    font-size: 6.5pt;
    color: #444;
    margin: 1pt 0;
    padding-left: 40pt;
    line-height: 1.3;
  }

  .pp-ing em {
    color: #888;
    font-style: normal;
  }

  .pp-steps {
    font-size: 6.5pt;
    color: #333;
    margin: 1pt 0 0;
    padding-left: 50pt;
    line-height: 1.3;
  }

  .pp-steps li {
    margin-bottom: 0;
  }

  .pp-header--cont {
    border-bottom-width: 1pt;
    margin-bottom: 4pt;
  }

  .pp-header--cont h1 {
    display: none;
  }

  .pp-shopping {
    margin-top: 0;
  }

  .pp-shop-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4pt 14pt;
  }

  .pp-shopping-title {
    font-size: 9pt;
    font-weight: 700;
    color: #7c9885;
    border-bottom: 1pt solid #7c9885;
    padding-bottom: 2pt;
    margin: 0 0 4pt;
  }

  .pp-shop-group {
    margin-bottom: 3pt;
  }

  .pp-shop-cat {
    font-size: 6.5pt;
    text-transform: uppercase;
    letter-spacing: 0.4pt;
    color: #7c9885;
    font-weight: 700;
    margin: 0 0 1pt;
  }

  .pp-shop-items {
    font-size: 7pt;
    color: #333;
    line-height: 1.5;
  }

  .pp-shop-item {
    display: block;
  }

  .pp-shop-item em {
    color: #888;
    font-style: normal;
  }
}
</style>
