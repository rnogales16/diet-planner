<script setup>
import { reactive, ref, watch } from 'vue'
import { X, Plus } from 'lucide-vue-next'
import BaseModal from '@/components/ui/BaseModal.vue'

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
        ingredients: props.dish.ingredients ? props.dish.ingredients.map((i) => ({ ...i })) : [],
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
    name: form.name.trim(),
    time: form.time,
    calories: Math.max(0, Number(form.calories) || 0),
    protein: Math.max(0, Number(form.protein) || 0),
    carbs: Math.max(0, Number(form.carbs) || 0),
    fat: Math.max(0, Number(form.fat) || 0),
    notes: form.notes,
    prepTime: Math.max(0, Number(form.prepTime) || 0),
    cookTime: Math.max(0, Number(form.cookTime) || 0),
    servings: Math.max(1, Number(form.servings) || 1),
    ingredients: form.ingredients.filter((i) => i.name.trim()),
    instructions: form.instructions.filter((s) => s.trim()),
  })
}
</script>

<template>
  <BaseModal :show="show" size="lg" :title="isEditing ? 'Edit dish' : 'Add dish'" @close="$emit('close')">
    <form class="dish-form" @submit.prevent="handleSave">
      <div v-if="!isEditing && mealLabel" class="dish-form__hint">
        Adding to <span class="app-pill">{{ mealLabel }}</span>
      </div>

      <div class="tabs">
        <button type="button" :class="['tabs__btn', { 'is-active': activeTab === 'details' }]" @click="activeTab = 'details'">Details</button>
        <button type="button" :class="['tabs__btn', { 'is-active': activeTab === 'recipe' }]" @click="activeTab = 'recipe'">Recipe</button>
      </div>

      <div v-show="activeTab === 'details'" class="dish-form__section">
        <label class="field">
          <span class="field__label">Dish name</span>
          <input v-model="form.name" required class="app-input" placeholder="e.g. Oatmeal with berries" />
        </label>

        <div class="dish-form__grid-2">
          <label class="field">
            <span class="field__label">Time</span>
            <input v-model="form.time" type="time" class="app-input" />
          </label>
          <label class="field">
            <span class="field__label">Servings</span>
            <input v-model.number="form.servings" type="number" min="1" class="app-input" />
          </label>
        </div>

        <div class="dish-form__macros">
          <span class="dish-form__macros-label">Nutrition</span>
          <div class="dish-form__grid-4">
            <label class="field">
              <span class="field__label">Calories</span>
              <span class="field__control">
                <input v-model.number="form.calories" type="number" min="0" class="app-input app-input--with-suffix" />
                <span class="field__suffix">kcal</span>
              </span>
            </label>
            <label class="field">
              <span class="field__label">Protein</span>
              <span class="field__control">
                <input v-model.number="form.protein" type="number" min="0" class="app-input app-input--with-suffix" />
                <span class="field__suffix">g</span>
              </span>
            </label>
            <label class="field">
              <span class="field__label">Carbs</span>
              <span class="field__control">
                <input v-model.number="form.carbs" type="number" min="0" class="app-input app-input--with-suffix" />
                <span class="field__suffix">g</span>
              </span>
            </label>
            <label class="field">
              <span class="field__label">Fat</span>
              <span class="field__control">
                <input v-model.number="form.fat" type="number" min="0" class="app-input app-input--with-suffix" />
                <span class="field__suffix">g</span>
              </span>
            </label>
          </div>
        </div>

        <label class="field">
          <span class="field__label">Notes</span>
          <textarea v-model="form.notes" rows="2" class="app-input" placeholder="Optional notes..." />
        </label>
      </div>

      <div v-show="activeTab === 'recipe'" class="dish-form__section">
        <div class="dish-form__grid-3">
          <label class="field">
            <span class="field__label">Prep time</span>
            <span class="field__control">
              <input v-model.number="form.prepTime" type="number" min="0" class="app-input app-input--with-suffix" />
              <span class="field__suffix">min</span>
            </span>
          </label>
          <label class="field">
            <span class="field__label">Cook time</span>
            <span class="field__control">
              <input v-model.number="form.cookTime" type="number" min="0" class="app-input app-input--with-suffix" />
              <span class="field__suffix">min</span>
            </span>
          </label>
          <label class="field">
            <span class="field__label">Servings</span>
            <input v-model.number="form.servings" type="number" min="1" class="app-input" />
          </label>
        </div>

        <div class="dish-form__list">
          <div class="dish-form__list-head">
            <span class="dish-form__list-title">Ingredients</span>
            <button type="button" class="app-btn app-btn--ghost app-btn--sm" @click="addIngredient">
              <Plus :size="12" /> Add
            </button>
          </div>
          <div v-for="(ing, i) in form.ingredients" :key="i" class="dish-form__row">
            <input v-model="ing.name" placeholder="Ingredient" class="app-input" />
            <input v-model="ing.amount" placeholder="Amount" class="app-input dish-form__row-amount" />
            <button type="button" class="dish-form__remove" @click="removeIngredient(i)">
              <X :size="14" />
            </button>
          </div>
          <p v-if="form.ingredients.length === 0" class="dish-form__empty">No ingredients yet</p>
        </div>

        <div class="dish-form__list">
          <div class="dish-form__list-head">
            <span class="dish-form__list-title">Instructions</span>
            <button type="button" class="app-btn app-btn--ghost app-btn--sm" @click="addInstruction">
              <Plus :size="12" /> Add step
            </button>
          </div>
          <div v-for="(step, i) in form.instructions" :key="i" class="dish-form__row dish-form__row--step">
            <span class="dish-form__step-num tabular">{{ i + 1 }}</span>
            <textarea
              :value="step"
              rows="2"
              placeholder="Describe this step..."
              class="app-input"
              @input="updateInstruction(i, $event.target.value)"
            />
            <button type="button" class="dish-form__remove" @click="removeInstruction(i)">
              <X :size="14" />
            </button>
          </div>
          <p v-if="form.instructions.length === 0" class="dish-form__empty">No steps yet</p>
        </div>
      </div>

      <footer class="dish-form__footer">
        <button type="button" class="app-btn app-btn--ghost" @click="$emit('close')">Cancel</button>
        <button type="submit" class="app-btn app-btn--primary">{{ isEditing ? 'Save changes' : 'Add dish' }}</button>
      </footer>
    </form>
  </BaseModal>
</template>

<style scoped>
.dish-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.dish-form__hint {
  font-size: 12px;
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 8px;
}

.tabs {
  display: inline-flex;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
  gap: 2px;
  align-self: flex-start;
}

.tabs__btn {
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.tabs__btn.is-active {
  background-color: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.dish-form__section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dish-form__grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.dish-form__grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.dish-form__grid-4 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.dish-form__macros {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background-color: var(--surface-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.dish-form__macros-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  color: var(--text-faint);
}

.dish-form__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dish-form__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dish-form__list-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  color: var(--text-faint);
}

.dish-form__row {
  display: grid;
  grid-template-columns: 1fr 110px auto;
  gap: 8px;
  align-items: start;
}

.dish-form__row--step {
  grid-template-columns: 24px 1fr auto;
}

.dish-form__row-amount {
  text-align: right;
}

.dish-form__step-num {
  width: 24px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-faint);
}

.dish-form__remove {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background-color: var(--surface);
  border-radius: var(--radius-sm);
  color: var(--text-faint);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.dish-form__remove:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.dish-form__empty {
  font-size: 12px;
  color: var(--text-faint);
  font-style: italic;
  text-align: center;
  padding: 8px 0;
}

.dish-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.field__control {
  position: relative;
  display: block;
}

.field__suffix {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--text-faint);
  pointer-events: none;
}

@media (max-width: 640px) {
  .dish-form__grid-3,
  .dish-form__grid-4 {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
