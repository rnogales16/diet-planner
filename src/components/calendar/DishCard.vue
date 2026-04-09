<script setup>
import { computed } from 'vue'

const props = defineProps({
  dish: { type: Object, required: true },
  mealType: { type: String, default: '' },
})

defineEmits(['edit', 'delete', 'view'])

const accentMap = {
  breakfast:       'from-amber-400 to-orange-400',
  morning_snack:   'from-rose-400 to-pink-400',
  lunch:           'from-blue-400 to-cyan-400',
  afternoon_snack: 'from-violet-400 to-purple-400',
  dinner:          'from-indigo-400 to-blue-400',
}
const accent = computed(() => accentMap[props.mealType] || 'from-gray-400 to-gray-400')

const hasRecipe = computed(() =>
  (props.dish.ingredients?.length > 0) || (props.dish.instructions?.length > 0)
)
</script>

<template>
  <div
    class="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md dark:shadow-gray-900/30 transition-all duration-200 overflow-hidden cursor-pointer"
    @click="$emit('view', dish)"
  >
    <!-- Top accent bar -->
    <div class="h-0.5 bg-gradient-to-r" :class="accent" />

    <div class="px-3 py-2">
      <!-- Name + actions -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <p class="text-[12px] font-bold text-gray-800 dark:text-gray-100 truncate leading-snug">{{ dish.name || 'Untitled' }}</p>
          <svg
            v-if="hasRecipe"
            class="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            stroke-width="2"
            title="Has recipe"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <div class="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            class="p-1 text-gray-300 dark:text-gray-500 hover:text-emerald-500 dark:hover:text-emerald-400 rounded-md transition-colors cursor-pointer"
            title="Edit"
            @click.stop="$emit('edit', dish)"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
            </svg>
          </button>
          <button
            class="p-1 text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 rounded-md transition-colors cursor-pointer"
            title="Delete"
            @click.stop="$emit('delete', dish)"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Time + macros in a single clean row -->
      <div class="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
        <span class="font-medium">{{ dish.time }}</span>
        <span class="text-gray-200 dark:text-gray-600">|</span>
        <span class="font-semibold text-orange-500/80 dark:text-orange-400/80">{{ dish.calories }}</span>
        <span class="text-gray-200 dark:text-gray-600">&middot;</span>
        <span>P{{ dish.protein }}</span>
        <span class="text-gray-200 dark:text-gray-600">&middot;</span>
        <span>C{{ dish.carbs }}</span>
        <span class="text-gray-200 dark:text-gray-600">&middot;</span>
        <span>F{{ dish.fat }}</span>
      </div>
    </div>
  </div>
</template>
