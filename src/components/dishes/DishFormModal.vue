<script setup>
import { reactive, ref, watch } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  dish: { type: Object, default: null },
  mealLabel: { type: String, default: '' },
  isEditing: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'save'])

const activeTab = ref('details')

const form = reactive({
  name: '',
  time: '12:00',
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  notes: '',
  prepTime: 0,
  cookTime: 0,
  servings: 1,
  ingredients: [],
  instructions: [],
})

watch(
  () => props.show,
  (val) => {
    if (val && props.dish) {
      Object.assign(form, {
        name: props.dish.name || '',
        time: props.dish.time || '12:00',
        calories: props.dish.calories || 0,
        protein: props.dish.protein || 0,
        carbs: props.dish.carbs || 0,
        fat: props.dish.fat || 0,
        notes: props.dish.notes || '',
        prepTime: props.dish.prepTime || 0,
        cookTime: props.dish.cookTime || 0,
        servings: props.dish.servings || 1,
        ingredients: props.dish.ingredients ? props.dish.ingredients.map(i => ({ ...i })) : [],
        instructions: props.dish.instructions ? [...props.dish.instructions] : [],
      })
      activeTab.value = 'details'
    }
  },
)

function addIngredient() {
  form.ingredients.push({ name: '', amount: '' })
}

function removeIngredient(index) {
  form.ingredients.splice(index, 1)
}

function addInstruction() {
  form.instructions.push('')
}

function removeInstruction(index) {
  form.instructions.splice(index, 1)
}

function updateInstruction(index, value) {
  form.instructions[index] = value
}

function handleSave() {
  emit('save', {
    name: form.name,
    time: form.time,
    calories: form.calories,
    protein: form.protein,
    carbs: form.carbs,
    fat: form.fat,
    notes: form.notes,
    prepTime: form.prepTime,
    cookTime: form.cookTime,
    servings: form.servings,
    ingredients: form.ingredients.filter(i => i.name.trim()),
    instructions: form.instructions.filter(s => s.trim()),
  })
}
</script>

<template>
  <BaseModal :show="show" :title="isEditing ? 'Edit Dish' : `Add Dish`" @close="$emit('close')">
    <form class="space-y-4" @submit.prevent="handleSave">
      <!-- Meal label badge -->
      <div v-if="!isEditing" class="flex items-center gap-2 mb-1">
        <span class="text-xs font-semibold text-gray-400 dark:text-gray-500">Adding to</span>
        <span class="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full border border-emerald-200 dark:border-emerald-800">
          {{ mealLabel }}
        </span>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl">
        <button
          type="button"
          class="flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer"
          :class="activeTab === 'details' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
          @click="activeTab = 'details'"
        >
          Details
        </button>
        <button
          type="button"
          class="flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer"
          :class="activeTab === 'recipe' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
          @click="activeTab = 'recipe'"
        >
          Recipe
        </button>
      </div>

      <!-- Details Tab -->
      <div v-show="activeTab === 'details'" class="space-y-4">
        <BaseInput v-model="form.name" label="Dish Name" placeholder="e.g. Oatmeal with berries" />
        <BaseInput v-model="form.time" label="Time" type="time" />

        <!-- Macro inputs with colored labels -->
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Nutrition</p>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-orange-500 dark:text-orange-400 flex items-center gap-1">🔥 Calories</label>
              <input
                v-model.number="form.calories"
                type="number"
                class="w-full px-3.5 py-2.5 text-sm bg-orange-50/50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 dark:focus:border-orange-500 transition-all dark:text-gray-100"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-blue-500 dark:text-blue-400 flex items-center gap-1">💪 Protein (g)</label>
              <input
                v-model.number="form.protein"
                type="number"
                class="w-full px-3.5 py-2.5 text-sm bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 dark:focus:border-blue-500 transition-all dark:text-gray-100"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-amber-500 dark:text-amber-400 flex items-center gap-1">⚡ Carbs (g)</label>
              <input
                v-model.number="form.carbs"
                type="number"
                class="w-full px-3.5 py-2.5 text-sm bg-amber-50/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 dark:focus:border-amber-500 transition-all dark:text-gray-100"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1">🫒 Fat (g)</label>
              <input
                v-model.number="form.fat"
                type="number"
                class="w-full px-3.5 py-2.5 text-sm bg-rose-50/50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400/40 focus:border-rose-400 dark:focus:border-rose-500 transition-all dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</label>
          <textarea
            v-model="form.notes"
            rows="2"
            placeholder="Optional notes..."
            class="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-gray-700 resize-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500 dark:text-gray-100"
          />
        </div>
      </div>

      <!-- Recipe Tab -->
      <div v-show="activeTab === 'recipe'" class="space-y-4">
        <!-- Prep/Cook/Servings row -->
        <div class="grid grid-cols-3 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-gray-500 dark:text-gray-400">Prep (min)</label>
            <input
              v-model.number="form.prepTime"
              type="number"
              min="0"
              class="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:border-emerald-500 transition-all dark:text-gray-100"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-gray-500 dark:text-gray-400">Cook (min)</label>
            <input
              v-model.number="form.cookTime"
              type="number"
              min="0"
              class="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:border-emerald-500 transition-all dark:text-gray-100"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-gray-500 dark:text-gray-400">Servings</label>
            <input
              v-model.number="form.servings"
              type="number"
              min="1"
              class="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:border-emerald-500 transition-all dark:text-gray-100"
            />
          </div>
        </div>

        <!-- Ingredients -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ingredients</p>
            <button
              type="button"
              class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer"
              @click="addIngredient"
            >
              + Add
            </button>
          </div>
          <div class="space-y-2">
            <div v-for="(ing, i) in form.ingredients" :key="i" class="flex gap-2 items-center">
              <input
                v-model="ing.name"
                placeholder="Ingredient"
                class="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:border-emerald-500 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500 dark:text-gray-100"
              />
              <input
                v-model="ing.amount"
                placeholder="Amount"
                class="w-24 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:border-emerald-500 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500 dark:text-gray-100"
              />
              <button
                type="button"
                class="p-1.5 text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                @click="removeIngredient(i)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p v-if="form.ingredients.length === 0" class="text-xs text-gray-300 dark:text-gray-500 italic py-2 text-center">No ingredients added</p>
          </div>
        </div>

        <!-- Instructions -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Instructions</p>
            <button
              type="button"
              class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer"
              @click="addInstruction"
            >
              + Add Step
            </button>
          </div>
          <div class="space-y-2">
            <div v-for="(step, i) in form.instructions" :key="i" class="flex gap-2 items-start">
              <span class="mt-2.5 text-xs font-bold text-gray-400 dark:text-gray-500 w-5 text-right shrink-0">{{ i + 1 }}.</span>
              <textarea
                :value="step"
                placeholder="Describe this step..."
                rows="2"
                class="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:border-emerald-500 resize-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500 dark:text-gray-100"
                @input="updateInstruction(i, $event.target.value)"
              />
              <button
                type="button"
                class="mt-2 p-1.5 text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                @click="removeInstruction(i)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p v-if="form.instructions.length === 0" class="text-xs text-gray-300 dark:text-gray-500 italic py-2 text-center">No instructions added</p>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <BaseButton variant="secondary" type="button" @click="$emit('close')">Cancel</BaseButton>
        <BaseButton type="submit">{{ isEditing ? 'Save Changes' : 'Add Dish' }}</BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
