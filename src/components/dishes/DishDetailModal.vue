<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clock, Flame, Users, Pencil, Trash2 } from 'lucide-vue-next'
import BaseModal from '@/components/ui/BaseModal.vue'
import { localizedDish } from '@/utils/dishLocale'

const { t, locale } = useI18n()

const props = defineProps({
  show: { type: Boolean, default: false },
  dish: { type: Object, default: null },
})

defineEmits(['close', 'edit', 'delete'])

const view = computed(() => (props.dish ? localizedDish(props.dish, locale.value) : null))

const hasRecipe = computed(() => {
  if (!view.value) return false
  return (view.value.ingredients?.length > 0) || (view.value.instructions?.length > 0)
})

const totalTime = computed(() => {
  if (!view.value) return 0
  return (view.value.prepTime || 0) + (view.value.cookTime || 0)
})
</script>

<template>
  <BaseModal :show="show" size="lg" :title="view?.name || t('dishDetail.title')" @close="$emit('close')">
    <div v-if="view" class="detail">
      <div class="detail__pills">
        <span class="pill pill--accent tabular">
          <Flame :size="12" />
          {{ view.calories }} {{ t('common.kcal') }}
        </span>
        <span class="pill tabular">
          <Clock :size="12" />
          {{ view.time }}
        </span>
        <span v-if="totalTime" class="pill tabular">{{ totalTime }} {{ t('common.min') }}</span>
        <span v-if="view.servings > 1" class="pill tabular">
          <Users :size="12" />
          {{ view.servings }} {{ t('common.servings') }}
        </span>
      </div>

      <div class="detail__macros">
        <div class="macro"><span class="macro__label">{{ t('summary.protein') }}</span><span class="macro__value tabular">{{ view.protein }} {{ t('common.g') }}</span></div>
        <div class="macro"><span class="macro__label">{{ t('summary.carbs') }}</span><span class="macro__value tabular">{{ view.carbs }} {{ t('common.g') }}</span></div>
        <div class="macro"><span class="macro__label">{{ t('summary.fat') }}</span><span class="macro__value tabular">{{ view.fat }} {{ t('common.g') }}</span></div>
      </div>

      <p v-if="view.notes" class="detail__notes">{{ view.notes }}</p>

      <div v-if="view.ingredients?.length > 0" class="detail__section">
        <h3 class="detail__heading">{{ t('dishDetail.ingredients') }}</h3>
        <ul class="ingredients">
          <li v-for="(ing, i) in view.ingredients" :key="i">
            <span class="ingredients__bullet" />
            <span class="ingredients__name">{{ ing.name }}</span>
            <span v-if="ing.amount" class="ingredients__amount">{{ ing.amount }}</span>
          </li>
        </ul>
      </div>

      <div v-if="view.instructions?.length > 0" class="detail__section">
        <h3 class="detail__heading">{{ t('dishDetail.instructions') }}</h3>
        <ol class="instructions">
          <li v-for="(step, i) in view.instructions" :key="i">
            <span class="instructions__num tabular">{{ i + 1 }}</span>
            <span>{{ step }}</span>
          </li>
        </ol>
      </div>

      <p v-if="!hasRecipe && !view.notes" class="detail__empty">{{ t('dishDetail.noRecipe') }}</p>

      <footer class="detail__footer">
        <button type="button" class="app-btn app-btn--ghost" @click="$emit('delete', dish)">
          <Trash2 :size="14" /> {{ t('common.delete') }}
        </button>
        <button type="button" class="app-btn app-btn--primary" @click="$emit('edit', dish)">
          <Pencil :size="14" /> {{ t('common.edit') }}
        </button>
      </footer>
    </div>
  </BaseModal>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detail__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background-color: var(--surface-2);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.pill--accent {
  background-color: var(--accent-tint);
  color: var(--accent);
  border-color: transparent;
}

[data-theme='dark'] .pill--accent {
  background-color: color-mix(in srgb, var(--accent) 14%, transparent);
}

.detail__macros {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px;
  gap: 12px;
}

.macro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.macro__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-faint);
  font-weight: 600;
}

.macro__value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.detail__notes {
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
  background-color: var(--surface-2);
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--accent);
}

.detail__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail__heading {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  color: var(--text-faint);
}

.ingredients {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ingredients li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
  color: var(--text);
}

.ingredients__bullet {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background-color: var(--accent);
  flex-shrink: 0;
  align-self: center;
}

.ingredients__name {
  flex: 1;
  font-weight: 500;
}

.ingredients__amount {
  color: var(--text-faint);
  font-size: 12px;
}

.instructions {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.instructions li {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text);
  line-height: 1.55;
}

.instructions__num {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: var(--accent-tint);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

[data-theme='dark'] .instructions__num {
  background-color: color-mix(in srgb, var(--accent) 14%, transparent);
}

.detail__empty {
  text-align: center;
  font-size: 13px;
  color: var(--text-faint);
  padding: 16px;
}

.detail__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
</style>
