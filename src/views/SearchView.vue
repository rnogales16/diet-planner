<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { useDietStore } from '@/stores/dietStore'
import { localizedDish } from '@/utils/dishLocale'

const { t, locale } = useI18n()
const store = useDietStore()

const query = ref('')

const results = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (!q || q.length < 2) return []

  const out = []
  for (const [weekKey, week] of Object.entries(store.weeks)) {
    for (const day of week.days) {
      for (const meal of day.meals) {
        for (const dish of meal.dishes) {
          const view = localizedDish(dish, locale.value)
          const nameMatch = (view.name || '').toLowerCase().includes(q)
          const ingMatch = (view.ingredients || []).some((ing) =>
            (ing.name || '').toLowerCase().includes(q),
          )
          if (nameMatch || ingMatch) {
            out.push({
              weekKey,
              date: day.date,
              mealType: meal.type,
              dish: view,
              rawDish: dish,
            })
          }
        }
      }
    }
  }
  return out.slice(0, 50)
})
</script>

<template>
  <div class="search-view">
    <header class="search-view__head">
      <div class="search-view__icon">
        <Search :size="20" />
      </div>
      <div>
        <h1 class="search-view__title font-display">{{ t('search.title') }}</h1>
      </div>
    </header>

    <div class="search-view__bar">
      <Search :size="16" />
      <input
        v-model="query"
        class="app-input search-view__input"
        :placeholder="t('search.placeholder')"
        autofocus
      />
    </div>

    <p v-if="query.length >= 2 && results.length === 0" class="search-view__empty">
      {{ t('search.noResults') }}
    </p>

    <div v-if="results.length" class="search-view__results">
      <div v-for="(r, i) in results" :key="i" class="search-result app-card">
        <div class="search-result__head">
          <strong class="search-result__name">{{ r.dish.name }}</strong>
          <span class="search-result__meta tabular">{{ r.dish.calories }} {{ t('common.kcal') }}</span>
        </div>
        <div class="search-result__sub">
          <span>{{ r.weekKey }}</span>
          <span>·</span>
          <span>{{ r.date }}</span>
          <span>·</span>
          <span>{{ r.mealType }}</span>
        </div>
        <div v-if="r.dish.ingredients?.length" class="search-result__ings">
          {{ r.dish.ingredients.map((ig) => ig.name).join(', ') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 720px;
  margin: 0 auto;
}

.search-view__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-view__icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background-color: var(--accent-tint);
  color: var(--accent);
}

.search-view__title {
  font-size: 26px;
  font-weight: 700;
}

.search-view__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-faint);
}

.search-view__input {
  flex: 1;
}

.search-view__empty {
  text-align: center;
  color: var(--text-faint);
  padding: 40px;
}

.search-view__results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-result {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.search-result__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.search-result__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.search-result__meta {
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
}

.search-result__sub {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: var(--text-faint);
}

.search-result__ings {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
