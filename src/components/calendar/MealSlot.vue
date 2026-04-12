<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, RefreshCw } from 'lucide-vue-next'
import DishCard from './DishCard.vue'
import { localizedMealLabel } from '@/utils/mealLocale'

const { t } = useI18n()

const props = defineProps({
  meal: { type: Object, required: true },
  regenerating: { type: Boolean, default: false },
})

defineEmits(['addDish', 'editDish', 'deleteDish', 'viewDish', 'regenerate'])

const hasDishes = computed(() => props.meal.dishes.length > 0)
const label = computed(() => localizedMealLabel(props.meal, t))
</script>

<template>
  <div class="meal-slot">
    <div class="meal-slot__head">
      <span class="meal-slot__label">{{ label }}</span>
      <div class="meal-slot__actions">
        <button
          v-if="hasDishes"
          type="button"
          class="meal-slot__regen"
          :disabled="regenerating"
          :title="t('mealSlot.regenerate')"
          @click="$emit('regenerate', meal.type)"
        >
          <RefreshCw :size="11" :class="{ 'spin': regenerating }" />
        </button>
        <span class="meal-slot__time tabular">{{ meal.defaultTime }}</span>
      </div>
    </div>

    <div v-if="hasDishes" class="meal-slot__dishes">
      <DishCard
        v-for="dish in meal.dishes"
        :key="dish.id"
        :dish="dish"
        @edit="$emit('editDish', { mealType: meal.type, dish: $event })"
        @delete="$emit('deleteDish', { mealType: meal.type, dish: $event })"
        @view="$emit('viewDish', { mealType: meal.type, dish: $event })"
      />
    </div>

    <button
      v-else
      type="button"
      class="meal-slot__add"
      @click="$emit('addDish', meal.type)"
    >
      <Plus :size="12" />
      <span>{{ t('mealSlot.addDish') }}</span>
    </button>
  </div>
</template>

<style scoped>
.meal-slot {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meal-slot__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 2px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

.meal-slot__actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.meal-slot__regen {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-faint);
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.meal-slot__regen:hover:not(:disabled) {
  color: var(--accent);
  background-color: var(--accent-tint);
}

.meal-slot__regen:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.meal-slot__label {
  font-weight: 700;
}

.meal-slot__dishes {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meal-slot__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: 1px dashed var(--border-strong);
  background-color: transparent;
  border-radius: var(--radius-sm);
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.meal-slot__add:hover {
  border-color: var(--accent);
  color: var(--accent);
  background-color: var(--accent-tint);
}
</style>
