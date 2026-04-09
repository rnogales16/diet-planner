<script setup>
import { computed } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  dish: { type: Object, default: null },
})

defineEmits(['close', 'edit', 'delete'])

const hasRecipe = computed(() => {
  if (!props.dish) return false
  return (props.dish.ingredients?.length > 0) || (props.dish.instructions?.length > 0)
})

const totalTime = computed(() => {
  if (!props.dish) return 0
  return (props.dish.prepTime || 0) + (props.dish.cookTime || 0)
})
</script>

<template>
  <BaseModal :show="show" :title="dish?.name || 'Dish Details'" @close="$emit('close')">
    <div v-if="dish" class="space-y-4">
      <!-- Time & Macros summary -->
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold rounded-lg">{{ dish.time }}</span>
        <span class="px-2.5 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold rounded-lg">🔥 {{ dish.calories }} kcal</span>
        <span class="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold rounded-lg">P {{ dish.protein }}g</span>
        <span class="px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-semibold rounded-lg">C {{ dish.carbs }}g</span>
        <span class="px-2.5 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 font-semibold rounded-lg">F {{ dish.fat }}g</span>
      </div>

      <!-- Prep/Cook/Servings -->
      <div v-if="dish.prepTime || dish.cookTime || dish.servings > 1" class="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span v-if="dish.prepTime" class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
          Prep: {{ dish.prepTime }} min
        </span>
        <span v-if="dish.cookTime" class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          </svg>
          Cook: {{ dish.cookTime }} min
        </span>
        <span v-if="totalTime" class="font-semibold text-gray-700 dark:text-gray-300">Total: {{ totalTime }} min</span>
        <span v-if="dish.servings > 1" class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          {{ dish.servings }} servings
        </span>
      </div>

      <!-- Notes -->
      <div v-if="dish.notes" class="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3 italic">
        {{ dish.notes }}
      </div>

      <!-- Ingredients -->
      <div v-if="dish.ingredients?.length > 0">
        <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Ingredients</p>
        <ul class="space-y-1.5">
          <li v-for="(ing, i) in dish.ingredients" :key="i" class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" />
            <span class="font-medium">{{ ing.name }}</span>
            <span v-if="ing.amount" class="text-gray-400 dark:text-gray-500">{{ ing.amount }}</span>
          </li>
        </ul>
      </div>

      <!-- Instructions -->
      <div v-if="dish.instructions?.length > 0">
        <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Instructions</p>
        <ol class="space-y-2">
          <li v-for="(step, i) in dish.instructions" :key="i" class="flex gap-3 text-sm">
            <span class="w-6 h-6 flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full shrink-0 mt-0.5">{{ i + 1 }}</span>
            <span class="text-gray-700 dark:text-gray-300 leading-relaxed">{{ step }}</span>
          </li>
        </ol>
      </div>

      <!-- No recipe hint -->
      <div v-if="!hasRecipe && !dish.notes" class="text-center py-4">
        <p class="text-sm text-gray-400 dark:text-gray-500">No recipe details yet.</p>
        <p class="text-xs text-gray-300 dark:text-gray-600 mt-1">Click Edit to add ingredients and instructions.</p>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <BaseButton variant="danger" size="sm" @click="$emit('delete', dish)">Delete</BaseButton>
        <BaseButton size="sm" @click="$emit('edit', dish)">Edit</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
