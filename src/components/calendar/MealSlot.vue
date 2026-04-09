<script setup>
import { computed } from 'vue'
import DishCard from './DishCard.vue'

const props = defineProps({
  meal: { type: Object, required: true },
})

defineEmits(['addDish', 'editDish', 'deleteDish', 'viewDish'])

const mealConfig = {
  breakfast:       { icon: '🌅', bg: 'bg-amber-50/60 dark:bg-amber-900/20',   hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',   accent: 'border-amber-200/60 dark:border-amber-800/60' },
  morning_snack:   { icon: '🍎', bg: 'bg-rose-50/60 dark:bg-rose-900/20',     hoverBg: 'hover:bg-rose-50 dark:hover:bg-rose-900/20',     accent: 'border-rose-200/60 dark:border-rose-800/60' },
  lunch:           { icon: '🍽️', bg: 'bg-blue-50/60 dark:bg-blue-900/20',     hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',     accent: 'border-blue-200/60 dark:border-blue-800/60' },
  afternoon_snack: { icon: '🥤', bg: 'bg-violet-50/60 dark:bg-violet-900/20', hoverBg: 'hover:bg-violet-50 dark:hover:bg-violet-900/20', accent: 'border-purple-200/60 dark:border-purple-800/60' },
  dinner:          { icon: '🌙', bg: 'bg-indigo-50/60 dark:bg-indigo-900/20', hoverBg: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20', accent: 'border-indigo-200/60 dark:border-indigo-800/60' },
}

const config = computed(() => mealConfig[props.meal.type] || { icon: '🍴', bg: 'bg-gray-50/60 dark:bg-gray-700/50', hoverBg: 'hover:bg-gray-50 dark:hover:bg-gray-700', accent: 'border-gray-200/60 dark:border-gray-700/60' })
const hasDishes = computed(() => props.meal.dishes.length > 0)
</script>

<template>
  <div
    class="group rounded-xl transition-colors duration-200"
    :class="hasDishes ? [config.bg, 'p-2'] : ['p-1.5', config.hoverBg]"
  >
    <!-- Header row: always visible -->
    <div class="flex items-center justify-between" :class="hasDishes ? 'mb-1.5' : ''">
      <button
        class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 cursor-pointer transition-colors group-hover:text-gray-500 dark:group-hover:text-gray-400"
        @click="$emit('addDish', meal.type)"
      >
        <span class="text-xs leading-none">{{ config.icon }}</span>
        {{ meal.label }}
      </button>
      <button
        class="w-5 h-5 flex items-center justify-center rounded-full text-gray-300 dark:text-gray-500 opacity-0 group-hover:opacity-100 hover:!text-emerald-600 dark:hover:!text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all cursor-pointer"
        title="Add dish"
        @click="$emit('addDish', meal.type)"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Dishes -->
    <div v-if="hasDishes" class="space-y-1.5">
      <DishCard
        v-for="dish in meal.dishes"
        :key="dish.id"
        :dish="dish"
        :mealType="meal.type"
        @edit="$emit('editDish', { mealType: meal.type, dish: $event })"
        @delete="$emit('deleteDish', { mealType: meal.type, dish: $event })"
        @view="$emit('viewDish', { mealType: meal.type, dish: $event })"
      />
    </div>
  </div>
</template>
