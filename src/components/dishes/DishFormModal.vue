<script setup>
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Plus } from 'lucide-vue-next'
import BaseModal from '@/components/ui/BaseModal.vue'
import { localizedDish } from '@/utils/dishLocale'

const { t, locale } = useI18n()

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
  vegetables: 0,
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
      // Edit the dish in the language the user is currently looking at,
      // not necessarily the original. The save handler will route the
      // change to the right slot.
      const view = localizedDish(props.dish, locale.value)
      Object.assign(form, {
        name: view.name || '',
        time: view.time || '12:00',
        calories: view.calories || 0,
        protein: view.protein || 0,
        carbs: view.carbs || 0,
        fat: view.fat || 0,
        vegetables: view.vegetables || 0,
        notes: view.notes || '',
        prepTime: view.prepTime || 0,
        cookTime: view.cookTime || 0,
        servings: view.servings || 1,
        ingredients: view.ingredients ? view.ingredients.map((i) => ({ ...i })) : [],
        instructions: view.instructions ? [...view.instructions] : [],
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
  const cleanedIngredients = form.ingredients.filter((i) => i.name.trim())
  const cleanedInstructions = form.instructions.filter((s) => s.trim())
  const numericFields = {
    time: form.time,
    calories: Math.max(0, Number(form.calories) || 0),
    protein: Math.max(0, Number(form.protein) || 0),
    carbs: Math.max(0, Number(form.carbs) || 0),
    fat: Math.max(0, Number(form.fat) || 0),
    vegetables: Math.max(0, Number(form.vegetables) || 0),
    prepTime: Math.max(0, Number(form.prepTime) || 0),
    cookTime: Math.max(0, Number(form.cookTime) || 0),
    servings: Math.max(1, Number(form.servings) || 1),
  }
  const textFields = {
    name: form.name.trim(),
    notes: form.notes,
    ingredients: cleanedIngredients,
    instructions: cleanedInstructions,
  }

  // For brand new dishes (or originals being edited in their own language)
  // we save the text fields directly on the dish. Otherwise we slot the text
  // into translations[locale] and leave the original alone.
  const dish = props.dish || {}
  const originalLang = dish.originalLang || (props.isEditing ? 'en' : locale.value)
  const editingOriginal = !props.isEditing || originalLang === locale.value

  if (editingOriginal) {
    emit('save', {
      ...numericFields,
      ...textFields,
      originalLang,
    })
  } else {
    const existingTranslations = dish.translations || {}
    emit('save', {
      ...numericFields,
      originalLang,
      translations: {
        ...existingTranslations,
        [locale.value]: textFields,
      },
    })
  }
}
</script>

<template>
  <BaseModal :show="show" size="lg" :title="isEditing ? t('dishForm.editTitle') : t('dishForm.addTitle')" @close="$emit('close')">
    <form class="dish-form" @submit.prevent="handleSave">
      <div v-if="!isEditing && mealLabel" class="dish-form__hint">
        {{ t('dishForm.addingTo') }} <span class="app-pill">{{ mealLabel }}</span>
      </div>

      <div class="tabs">
        <button type="button" :class="['tabs__btn', { 'is-active': activeTab === 'details' }]" @click="activeTab = 'details'">{{ t('dishForm.tabDetails') }}</button>
        <button type="button" :class="['tabs__btn', { 'is-active': activeTab === 'recipe' }]" @click="activeTab = 'recipe'">{{ t('dishForm.tabRecipe') }}</button>
      </div>

      <div v-show="activeTab === 'details'" class="dish-form__section">
        <label class="field">
          <span class="field__label">{{ t('dishForm.name') }}</span>
          <input v-model="form.name" required class="app-input" :placeholder="t('dishForm.namePlaceholder')" />
        </label>

        <div class="dish-form__grid-2">
          <label class="field">
            <span class="field__label">{{ t('dishForm.time') }}</span>
            <input v-model="form.time" type="time" class="app-input" />
          </label>
          <label class="field">
            <span class="field__label">{{ t('common.servings') }}</span>
            <input v-model.number="form.servings" type="number" min="1" class="app-input" />
          </label>
        </div>

        <div class="dish-form__macros">
          <span class="dish-form__macros-label">{{ t('dishForm.nutrition') }}</span>
          <div class="dish-form__grid-5">
            <label class="field">
              <span class="field__label">{{ t('settings.profile.calories') }}</span>
              <span class="field__control">
                <input v-model.number="form.calories" type="number" min="0" class="app-input app-input--with-suffix" />
                <span class="field__suffix">{{ t('common.kcal') }}</span>
              </span>
            </label>
            <label class="field">
              <span class="field__label">{{ t('settings.profile.protein') }}</span>
              <span class="field__control">
                <input v-model.number="form.protein" type="number" min="0" class="app-input app-input--with-suffix" />
                <span class="field__suffix">{{ t('common.g') }}</span>
              </span>
            </label>
            <label class="field">
              <span class="field__label">{{ t('settings.profile.carbs') }}</span>
              <span class="field__control">
                <input v-model.number="form.carbs" type="number" min="0" class="app-input app-input--with-suffix" />
                <span class="field__suffix">{{ t('common.g') }}</span>
              </span>
            </label>
            <label class="field">
              <span class="field__label">{{ t('settings.profile.fat') }}</span>
              <span class="field__control">
                <input v-model.number="form.fat" type="number" min="0" class="app-input app-input--with-suffix" />
                <span class="field__suffix">{{ t('common.g') }}</span>
              </span>
            </label>
            <label class="field">
              <span class="field__label">{{ t('settings.profile.vegetables') }}</span>
              <span class="field__control">
                <input v-model.number="form.vegetables" type="number" min="0" class="app-input app-input--with-suffix" />
                <span class="field__suffix">{{ t('common.g') }}</span>
              </span>
            </label>
          </div>
        </div>

        <label class="field">
          <span class="field__label">{{ t('dishForm.notes') }}</span>
          <textarea v-model="form.notes" rows="2" class="app-input" :placeholder="t('dishForm.notesPlaceholder')" />
        </label>
      </div>

      <div v-show="activeTab === 'recipe'" class="dish-form__section">
        <div class="dish-form__grid-3">
          <label class="field">
            <span class="field__label">{{ t('dishForm.prep') }}</span>
            <span class="field__control">
              <input v-model.number="form.prepTime" type="number" min="0" class="app-input app-input--with-suffix" />
              <span class="field__suffix">{{ t('common.min') }}</span>
            </span>
          </label>
          <label class="field">
            <span class="field__label">{{ t('dishForm.cook') }}</span>
            <span class="field__control">
              <input v-model.number="form.cookTime" type="number" min="0" class="app-input app-input--with-suffix" />
              <span class="field__suffix">{{ t('common.min') }}</span>
            </span>
          </label>
          <label class="field">
            <span class="field__label">{{ t('common.servings') }}</span>
            <input v-model.number="form.servings" type="number" min="1" class="app-input" />
          </label>
        </div>

        <div class="dish-form__list">
          <div class="dish-form__list-head">
            <span class="dish-form__list-title">{{ t('dishForm.ingredients') }}</span>
            <button type="button" class="app-btn app-btn--ghost app-btn--sm" @click="addIngredient">
              <Plus :size="12" /> {{ t('dishForm.addIngredient') }}
            </button>
          </div>
          <div v-for="(ing, i) in form.ingredients" :key="i" class="dish-form__row">
            <input v-model="ing.name" :placeholder="t('dishForm.ingredientName')" class="app-input" />
            <input v-model="ing.amount" :placeholder="t('dishForm.ingredientAmount')" class="app-input dish-form__row-amount" />
            <button type="button" class="dish-form__remove" @click="removeIngredient(i)">
              <X :size="14" />
            </button>
          </div>
          <p v-if="form.ingredients.length === 0" class="dish-form__empty">{{ t('dishForm.noIngredients') }}</p>
        </div>

        <div class="dish-form__list">
          <div class="dish-form__list-head">
            <span class="dish-form__list-title">{{ t('dishForm.instructions') }}</span>
            <button type="button" class="app-btn app-btn--ghost app-btn--sm" @click="addInstruction">
              <Plus :size="12" /> {{ t('dishForm.addStep') }}
            </button>
          </div>
          <div v-for="(step, i) in form.instructions" :key="i" class="dish-form__row dish-form__row--step">
            <span class="dish-form__step-num tabular">{{ i + 1 }}</span>
            <textarea
              :value="step"
              rows="2"
              :placeholder="t('dishForm.stepPlaceholder')"
              class="app-input"
              @input="updateInstruction(i, $event.target.value)"
            />
            <button type="button" class="dish-form__remove" @click="removeInstruction(i)">
              <X :size="14" />
            </button>
          </div>
          <p v-if="form.instructions.length === 0" class="dish-form__empty">{{ t('dishForm.noSteps') }}</p>
        </div>
      </div>

      <footer class="dish-form__footer">
        <button type="button" class="app-btn app-btn--ghost" @click="$emit('close')">{{ t('common.cancel') }}</button>
        <button type="submit" class="app-btn app-btn--primary">{{ isEditing ? t('dishForm.submitEdit') : t('dishForm.submitNew') }}</button>
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

.dish-form__grid-5 {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
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

@media (max-width: 720px) {
  .dish-form__grid-5 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .dish-form__grid-3,
  .dish-form__grid-4,
  .dish-form__grid-5 {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
