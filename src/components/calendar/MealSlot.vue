<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import DishCard from './DishCard.vue'

const { t } = useI18n()

const props = defineProps({
  meal: { type: Object, required: true },
})

defineEmits(['addDish', 'editDish', 'deleteDish', 'viewDish'])

const hasDishes = computed(() => props.meal.dishes.length > 0)
</script>

<template>
  <div class="meal-slot">
    <div class="meal-slot__head">
      <span class="meal-slot__label">{{ meal.label }}</span>
      <span class="meal-slot__time tabular">{{ meal.defaultTime }}</span>
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
