<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil, Trash2, Heart } from 'lucide-vue-next'
import { localizedDish } from '@/utils/dishLocale'
import { useDietStore } from '@/stores/dietStore'

const { t, locale } = useI18n()
const store = useDietStore()

const props = defineProps({
  dish: { type: Object, required: true },
})

defineEmits(['edit', 'delete', 'view'])

const view = computed(() => localizedDish(props.dish, locale.value))
const isFav = computed(() => store.isFavorite(props.dish.name))

function toggleFavorite(e) {
  e.stopPropagation()
  if (isFav.value) {
    const fav = store.favorites.find((f) => f.name === props.dish.name)
    if (fav) store.removeFavorite(fav.favId)
  } else {
    store.addFavorite(props.dish)
  }
}
</script>

<template>
  <article class="dish-card" @click="$emit('view', dish)">
    <header class="dish-card__head">
      <h4 class="dish-card__name font-display">{{ view.name || t('common.untitled') }}</h4>
      <div class="dish-card__actions">
        <button
          type="button"
          :title="isFav ? t('dishCard.unfavorite') : t('dishCard.favorite')"
          :class="{ 'is-fav': isFav }"
          @click="toggleFavorite"
        >
          <Heart :size="12" :fill="isFav ? 'currentColor' : 'none'" />
        </button>
        <button type="button" :title="t('dishCard.edit')" @click.stop="$emit('edit', dish)">
          <Pencil :size="12" />
        </button>
        <button type="button" :title="t('dishCard.delete')" class="danger" @click.stop="$emit('delete', dish)">
          <Trash2 :size="12" />
        </button>
      </div>
    </header>
    <div class="dish-card__meta">
      <span class="tabular">{{ dish.time }}</span>
      <span class="dot" aria-hidden="true">·</span>
      <span class="dish-card__kcal tabular">{{ dish.calories }} {{ t('common.kcal') }}</span>
      <template v-if="view.cookedWeight">
        <span class="dot" aria-hidden="true">·</span>
        <span class="tabular">{{ view.cookedWeight }}</span>
      </template>
    </div>
  </article>
</template>

<style scoped>
.dish-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  position: relative;
}

.dish-card:hover {
  border-color: var(--border-strong);
  background-color: var(--surface-2);
}

.dish-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
}

.dish-card__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.dish-card__actions {
  display: inline-flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}

.dish-card:hover .dish-card__actions {
  opacity: 1;
}

/* Touch devices have no hover — always show the actions */
@media (hover: none) {
  .dish-card__actions {
    opacity: 1;
  }
}

.dish-card__actions button {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-faint);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.dish-card__actions button:hover {
  background-color: var(--surface-2);
  color: var(--text);
}

.dish-card__actions button.danger:hover {
  color: var(--danger);
}

.dish-card__actions button.is-fav {
  color: #e74c3c;
}

.dish-card__meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 3px 6px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-faint);
  min-width: 0;
}

.dish-card__kcal {
  color: var(--accent);
  font-weight: 600;
}

.dot {
  color: var(--border-strong);
}
</style>
