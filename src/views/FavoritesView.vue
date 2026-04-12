<script setup>
import { useI18n } from 'vue-i18n'
import { Heart, Trash2 } from 'lucide-vue-next'
import { useDietStore } from '@/stores/dietStore'
import { localizedDish } from '@/utils/dishLocale'

const { t, locale } = useI18n()
const store = useDietStore()

function localize(dish) {
  return localizedDish(dish, locale.value)
}

function remove(favId) {
  store.removeFavorite(favId)
}
</script>

<template>
  <div class="favs">
    <header class="favs__head">
      <div class="favs__icon">
        <Heart :size="20" />
      </div>
      <div>
        <h1 class="favs__title font-display">{{ t('favorites.title') }}</h1>
        <p class="favs__sub">{{ t('favorites.subtitle') }}</p>
      </div>
    </header>

    <div v-if="store.favorites.length === 0" class="favs__empty app-card">
      <Heart :size="28" />
      <p>{{ t('favorites.empty') }}</p>
    </div>

    <div v-else class="favs__grid">
      <div v-for="fav in store.favorites" :key="fav.favId" class="fav-card app-card">
        <div class="fav-card__head">
          <h3 class="fav-card__name font-display">{{ localize(fav).name }}</h3>
          <button type="button" class="fav-card__remove" :title="t('favorites.remove')" @click="remove(fav.favId)">
            <Trash2 :size="14" />
          </button>
        </div>
        <div class="fav-card__macros tabular">
          <span>{{ fav.calories }} {{ t('common.kcal') }}</span>
          <span>P{{ fav.protein }}</span>
          <span>C{{ fav.carbs }}</span>
          <span>F{{ fav.fat }}</span>
        </div>
        <p v-if="localize(fav).ingredients?.length" class="fav-card__ings">
          {{ localize(fav).ingredients.map((i) => i.name).join(', ') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.favs {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 880px;
  margin: 0 auto;
}

.favs__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.favs__icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background-color: var(--accent-tint);
  color: var(--accent);
}

.favs__title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.favs__sub {
  font-size: 13px;
  color: var(--text-faint);
}

.favs__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 24px;
  color: var(--text-faint);
  text-align: center;
}

.favs__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.fav-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fav-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.fav-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.fav-card__remove {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-faint);
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
}

.fav-card__remove:hover {
  color: var(--danger);
  background-color: var(--danger-tint);
}

.fav-card__macros {
  display: flex;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

.fav-card__macros span:first-child {
  color: var(--accent);
}

.fav-card__ings {
  font-size: 12px;
  color: var(--text-faint);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
