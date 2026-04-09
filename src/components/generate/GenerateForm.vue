<script setup>
import { reactive } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const emit = defineEmits(['generate'])

const form = reactive({
  preferences: '',
  fridgeContents: '',
  favourites: '',
  restrictions: '',
  calorieTarget: null,
  proteinTarget: null,
  carbsTarget: null,
  fatTarget: null,
})

function submit() {
  emit('generate', { ...form })
}
</script>

<template>
  <form @submit.prevent="submit" class="space-y-6">
    <!-- Preferences Section -->
    <section class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden">
      <div class="px-6 py-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
        <h2 class="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <span class="text-base">💬</span>
          Preferences
        </h2>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Tell the AI what you like and what you have available</p>
      </div>
      <div class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Dietary Preferences</label>
          <textarea
            v-model="form.preferences"
            rows="2"
            placeholder="e.g. Mediterranean diet, high protein, prefer whole foods..."
            class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all resize-none"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Fridge Contents</label>
          <textarea
            v-model="form.fridgeContents"
            rows="2"
            placeholder="e.g. chicken breast, rice, tomatoes, spinach, eggs, milk..."
            class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all resize-none"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Favourite Ingredients</label>
          <textarea
            v-model="form.favourites"
            rows="2"
            placeholder="e.g. avocado, salmon, sweet potato, Greek yogurt..."
            class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all resize-none"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Restrictions / Allergies</label>
          <textarea
            v-model="form.restrictions"
            rows="2"
            placeholder="e.g. no gluten, lactose intolerant, nut allergy..."
            class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all resize-none"
          />
        </div>
      </div>
    </section>

    <!-- Nutrition Targets Section -->
    <section class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden">
      <div class="px-6 py-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
        <h2 class="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <span class="text-base">🎯</span>
          Nutrition Targets
          <span class="text-xs font-normal text-gray-400 dark:text-gray-500">(optional)</span>
        </h2>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Set daily macro targets for the generated plan</p>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-orange-600 mb-1.5">Calories (kcal)</label>
            <input
              v-model.number="form.calorieTarget"
              type="number"
              min="0"
              placeholder="e.g. 2000"
              class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-blue-600 mb-1.5">Protein (g)</label>
            <input
              v-model.number="form.proteinTarget"
              type="number"
              min="0"
              placeholder="e.g. 150"
              class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-amber-600 mb-1.5">Carbs (g)</label>
            <input
              v-model.number="form.carbsTarget"
              type="number"
              min="0"
              placeholder="e.g. 250"
              class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-rose-600 mb-1.5">Fat (g)</label>
            <input
              v-model.number="form.fatTarget"
              type="number"
              min="0"
              placeholder="e.g. 65"
              class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 transition-all"
            />
          </div>
        </div>
      </div>
    </section>

    <BaseButton type="submit" class="w-full !py-3 !text-base">
      Generate Meal Plan
    </BaseButton>
  </form>
</template>
