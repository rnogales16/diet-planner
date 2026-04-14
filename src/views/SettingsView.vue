<script setup>
import { reactive, ref, toRaw, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sun, Coffee, Utensils, Apple, Moon, User, Download, Upload, Trash2, Check, Languages, X, Plus } from 'lucide-vue-next'
import { useDietStore } from '@/stores/dietStore'
import { translateDishes } from '@/services/translate'
import { localizedMealLabel } from '@/utils/mealLocale'

const { t, locale } = useI18n()

const clone = (obj) => JSON.parse(JSON.stringify(obj))

const store = useDietStore()
const saved = ref(false)
const profileSaved = ref(false)

// Diet profile (synced to D1 via the store)
const profile = reactive(clone(store.profile))

// If the store gets re-hydrated after a server fetch, refresh the local copy.
watch(
  () => store.profile,
  (next) => {
    Object.assign(profile, clone(next))
  },
  { deep: true },
)

function saveProfile() {
  const data = clone(toRaw(profile))
  // Auto-compute servings from the number of people
  data.servings = 1 + (Array.isArray(data.people) ? data.people.filter((p) => p.name || p.calorieTarget).length : 0)
  store.updateProfile(data)
  profileSaved.value = true
  setTimeout(() => (profileSaved.value = false), 2000)
}

const newDislike = ref('')
const dislikedIngredients = computed(() => store.profile.dislikedIngredients || [])

function addDislike() {
  const value = newDislike.value.trim()
  if (!value) return
  store.addDislikedIngredient(value)
  newDislike.value = ''
}

function removeDislike(name) {
  store.removeDislikedIngredient(name)
}

const GOAL_VALUES = ['lose_weight', 'gain_muscle', 'maintain', 'health']
const STYLE_VALUES = ['', 'omnivore', 'vegetarian', 'vegan', 'pescatarian', 'mediterranean', 'keto', 'paleo', 'other']

const goalOptions = computed(() =>
  GOAL_VALUES.map((v) => ({ value: v, label: t(`settings.profile.goalOptions.${v}`) }))
)
const styleOptions = computed(() =>
  STYLE_VALUES.map((v) => ({ value: v, label: t(`settings.profile.styleOptions.${v || 'none'}`) }))
)

function isGoalActive(value) {
  return Array.isArray(profile.goals) && profile.goals.includes(value)
}

function toggleGoal(value) {
  const current = Array.isArray(profile.goals) ? [...profile.goals] : []
  const idx = current.indexOf(value)
  if (idx === -1) current.push(value)
  else current.splice(idx, 1)
  profile.goals = current
}

// Map the stored meal types to their localized label whenever the user
// has not customized them. This way the editor reflects the current
// language; if the user types something else it becomes their override.
function localizeMealTypes(types) {
  return clone(types).map((mt) => ({
    ...mt,
    label: localizedMealLabel(mt, t),
  }))
}

const form = reactive({
  mealTypes: localizeMealTypes(store.mealTypes),
})

watch(
  () => [store.mealTypes, locale.value],
  () => {
    form.mealTypes = localizeMealTypes(store.mealTypes)
  },
  { deep: true },
)

const mealIcons = {
  breakfast: Sun,
  morning_snack: Coffee,
  lunch: Utensils,
  afternoon_snack: Apple,
  dinner: Moon,
}

function save() {
  store.updateMealTypes(clone(toRaw(form.mealTypes)))
  saved.value = true
  setTimeout(() => (saved.value = false), 2000)
}

function reset() {
  form.mealTypes = clone(store.mealTypes)
}

const importInput = ref(null)
const importMessage = ref('')
const importError = ref('')

function exportData() {
  const data = store.exportData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `diet-planner-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function triggerImport() {
  importMessage.value = ''
  importError.value = ''
  importInput.value?.click()
}

async function handleImportFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const payload = JSON.parse(text)
    const result = store.importData(payload)
    if (result.success) {
      importMessage.value = t('settings.data.importedOk')
      setTimeout(() => (importMessage.value = ''), 3000)
    } else {
      importError.value = result.error
    }
  } catch (err) {
    importError.value = t('settings.data.importError', { error: err.message })
  } finally {
    event.target.value = ''
  }
}

function addPerson() {
  if (!Array.isArray(profile.people)) profile.people = []
  // Default: eats all currently enabled meals
  const allEnabled = store.mealTypes.filter((mt) => mt.enabled !== false).map((mt) => mt.type)
  profile.people.push({ name: '', calorieTarget: null, proteinTarget: null, carbsTarget: null, fatTarget: null, vegetableTarget: null, enabledMeals: [...allEnabled] })
}

function togglePersonMeal(personIdx, mealType) {
  const person = profile.people[personIdx]
  if (!person) return
  if (!Array.isArray(person.enabledMeals)) {
    person.enabledMeals = store.mealTypes.filter((mt) => mt.enabled !== false).map((mt) => mt.type)
  }
  const idx = person.enabledMeals.indexOf(mealType)
  if (idx === -1) person.enabledMeals.push(mealType)
  else person.enabledMeals.splice(idx, 1)
}

function removePerson(idx) {
  profile.people.splice(idx, 1)
}

function clearAllData() {
  if (!confirm(t('settings.data.clearConfirm'))) return
  localStorage.removeItem('diet')
  location.reload()
}

const translateBusy = ref(false)
const translateMessage = ref('')
const translateError = ref('')

const currentLanguageLabel = computed(() => t(`language.${locale.value}`))

async function handleTranslateAll() {
  translateMessage.value = ''
  translateError.value = ''
  const target = locale.value
  const dishes = store.collectDishesNeedingTranslation(target)

  if (dishes.length === 0) {
    translateMessage.value = t('settings.data.translateNothing', { lang: currentLanguageLabel.value })
    setTimeout(() => (translateMessage.value = ''), 4000)
    return
  }

  translateBusy.value = true
  try {
    const result = await translateDishes(dishes, target)
    if (!result.success) {
      translateError.value = t('settings.data.translateError', { error: result.error })
      return
    }
    store.applyDishTranslations(target, result.translations)
    translateMessage.value = t('settings.data.translateOk', result.translations.length, { count: result.translations.length })
    setTimeout(() => (translateMessage.value = ''), 4000)
  } catch (err) {
    translateError.value = t('settings.data.translateError', { error: err.message })
  } finally {
    translateBusy.value = false
  }
}
</script>

<template>
  <div class="settings">
    <header class="settings__head">
      <h1 class="settings__title font-display">{{ t('settings.title') }}</h1>
      <p class="settings__sub">{{ t('settings.subtitle') }}</p>
    </header>

    <!-- Diet profile -->
    <section class="app-card settings__card">
      <header class="settings__card-head">
        <h2 class="settings__card-title font-display">
          <User :size="14" /> {{ t('settings.profile.title') }}
        </h2>
        <p class="settings__card-sub">{{ t('settings.profile.subtitle') }}</p>
      </header>

      <div class="field">
        <span class="field__label">{{ t('settings.profile.goals') }}</span>
        <div class="chip-group">
          <button
            v-for="o in goalOptions"
            :key="o.value"
            type="button"
            class="chip-toggle"
            :class="{ 'is-active': isGoalActive(o.value) }"
            @click="toggleGoal(o.value)"
          >
            <Check v-if="isGoalActive(o.value)" :size="12" />
            {{ o.label }}
          </button>
        </div>
        <span class="field__hint">{{ t('settings.profile.goalsHint') }}</span>
      </div>

      <label class="field">
        <span class="field__label">{{ t('settings.profile.dietaryStyle') }}</span>
        <select v-model="profile.dietaryStyle" class="app-input">
          <option v-for="o in styleOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>

      <label class="field">
        <span class="field__label">{{ t('settings.profile.allergiesAndIntolerances') }}</span>
        <input v-model="profile.allergiesAndIntolerances" class="app-input" :placeholder="t('settings.profile.allergiesAndIntolerancesPlaceholder')" />
      </label>
      <label class="field">
        <span class="field__label">{{ t('settings.profile.favourites') }}</span>
        <input v-model="profile.favourites" class="app-input" :placeholder="t('settings.profile.favouritesPlaceholder')" />
      </label>
      <label class="field">
        <span class="field__label">{{ t('settings.profile.cuisines') }}</span>
        <input v-model="profile.cuisines" class="app-input" :placeholder="t('settings.profile.cuisinesPlaceholder')" />
      </label>

      <!-- People eating from this plan -->
      <div class="people-section">
        <div class="people-section__head">
          <span class="field__label">{{ t('settings.profile.cookingFor') }}</span>
          <button type="button" class="app-btn app-btn--ghost app-btn--sm" @click="addPerson">
            <Plus :size="12" /> {{ t('settings.profile.addPerson') }}
          </button>
        </div>

        <!-- Primary user (you) -->
        <div class="person-card">
          <span class="person-card__name">{{ t('settings.profile.you') }}</span>
          <div class="person-card__macros">
            <label class="field"><span class="field__label">{{ t('settings.profile.calories') }}</span><input v-model.number="profile.calorieTarget" type="number" min="0" class="app-input" /></label>
            <label class="field"><span class="field__label">{{ t('settings.profile.protein') }}</span><input v-model.number="profile.proteinTarget" type="number" min="0" class="app-input" /></label>
            <label class="field"><span class="field__label">{{ t('settings.profile.carbs') }}</span><input v-model.number="profile.carbsTarget" type="number" min="0" class="app-input" /></label>
            <label class="field"><span class="field__label">{{ t('settings.profile.fat') }}</span><input v-model.number="profile.fatTarget" type="number" min="0" class="app-input" /></label>
            <label class="field"><span class="field__label">{{ t('settings.profile.vegetables') }}</span><input v-model.number="profile.vegetableTarget" type="number" min="0" class="app-input" /></label>
          </div>
        </div>

        <!-- Additional people -->
        <div v-for="(person, idx) in profile.people" :key="idx" class="person-card">
          <div class="person-card__head">
            <input v-model="profile.people[idx].name" class="app-input person-card__name-input" :placeholder="t('settings.profile.personNamePlaceholder')" />
            <button type="button" class="app-btn app-btn--ghost app-btn--sm" @click="removePerson(idx)">
              <X :size="12" /> {{ t('settings.profile.removePerson') }}
            </button>
          </div>
          <div class="person-card__macros">
            <label class="field"><span class="field__label">{{ t('settings.profile.calories') }}</span><input v-model.number="profile.people[idx].calorieTarget" type="number" min="0" class="app-input" /></label>
            <label class="field"><span class="field__label">{{ t('settings.profile.protein') }}</span><input v-model.number="profile.people[idx].proteinTarget" type="number" min="0" class="app-input" /></label>
            <label class="field"><span class="field__label">{{ t('settings.profile.carbs') }}</span><input v-model.number="profile.people[idx].carbsTarget" type="number" min="0" class="app-input" /></label>
            <label class="field"><span class="field__label">{{ t('settings.profile.fat') }}</span><input v-model.number="profile.people[idx].fatTarget" type="number" min="0" class="app-input" /></label>
            <label class="field"><span class="field__label">{{ t('settings.profile.vegetables') }}</span><input v-model.number="profile.people[idx].vegetableTarget" type="number" min="0" class="app-input" /></label>
          </div>
          <div class="person-card__meals">
            <span class="person-card__meals-label">{{ t('settings.profile.personMeals') }}</span>
            <div class="person-card__meal-chips">
              <button
                v-for="mt in store.mealTypes.filter((m) => m.enabled !== false)"
                :key="mt.type"
                type="button"
                class="person-meal-chip"
                :class="{ 'is-active': (person.enabledMeals || []).includes(mt.type) }"
                @click="togglePersonMeal(idx, mt.type)"
              >
                {{ localizedMealLabel(mt, t) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <label class="field">
        <span class="field__label">{{ t('settings.profile.maxTime') }}</span>
        <span class="field__control">
          <input v-model.number="profile.maxCookTime" type="number" min="0" :placeholder="t('settings.profile.anyTime')" class="app-input app-input--with-suffix" />
          <span class="field__suffix">{{ t('common.min') }}</span>
        </span>
      </label>

      <label class="field">
        <span class="field__label">{{ t('settings.profile.notes') }}</span>
        <textarea v-model="profile.notes" class="app-input" rows="2" :placeholder="t('settings.profile.notesPlaceholder')" />
      </label>

      <div class="dislike-block">
        <div class="dislike-block__head">
          <p class="dislike-block__title">{{ t('settings.profile.dislikedTitle') }}</p>
          <p class="dislike-block__sub">{{ t('settings.profile.dislikedSub') }}</p>
        </div>

        <div v-if="dislikedIngredients.length" class="dislike-chips">
          <span v-for="ing in dislikedIngredients" :key="ing" class="dislike-chip">
            {{ ing }}
            <button type="button" class="dislike-chip__remove" :title="t('settings.profile.dislikedRemove')" @click="removeDislike(ing)">
              <X :size="11" />
            </button>
          </span>
        </div>
        <p v-else class="dislike-empty">{{ t('settings.profile.dislikedEmpty') }}</p>

        <input
          v-model="newDislike"
          class="app-input"
          :placeholder="t('settings.profile.dislikedAddPlaceholder')"
          @keydown.enter.prevent="addDislike"
        />
      </div>

      <footer class="settings__card-footer">
        <button type="button" class="app-btn app-btn--primary" @click="saveProfile">{{ t('settings.profile.saveProfile') }}</button>
        <Transition name="fade">
          <span v-if="profileSaved" class="settings__saved">
            <Check :size="14" /> {{ t('common.saved') }}
          </span>
        </Transition>
      </footer>
    </section>

    <!-- Meal types -->
    <section class="app-card settings__card">
      <header class="settings__card-head">
        <h2 class="settings__card-title font-display">{{ t('settings.mealTypes.title') }}</h2>
        <p class="settings__card-sub">{{ t('settings.mealTypes.subtitle') }}</p>
      </header>
      <div class="settings__rows">
        <div
          v-for="(meal, idx) in form.mealTypes"
          :key="meal.type"
          class="meal-row"
          :class="{ 'is-disabled': !form.mealTypes[idx].enabled }"
        >
          <span class="meal-row__icon">
            <component :is="mealIcons[meal.type] || Utensils" :size="14" />
          </span>
          <input v-model="form.mealTypes[idx].label" class="app-input meal-row__label" :disabled="!form.mealTypes[idx].enabled" />
          <input v-model="form.mealTypes[idx].defaultTime" type="time" class="app-input meal-row__time" :disabled="!form.mealTypes[idx].enabled" />
          <label class="switch">
            <input type="checkbox" v-model="form.mealTypes[idx].enabled" />
            <span class="switch__track" />
          </label>
        </div>
      </div>
      <footer class="settings__card-footer">
        <button type="button" class="app-btn app-btn--primary" @click="save">{{ t('common.saveChanges') }}</button>
        <button type="button" class="app-btn app-btn--ghost" @click="reset">{{ t('common.reset') }}</button>
        <Transition name="fade">
          <span v-if="saved" class="settings__saved">
            <Check :size="14" /> {{ t('common.saved') }}
          </span>
        </Transition>
      </footer>
    </section>

    <!-- Data management -->
    <section class="app-card settings__card">
      <header class="settings__card-head">
        <h2 class="settings__card-title font-display">{{ t('settings.data.title') }}</h2>
        <p class="settings__card-sub">{{ t('settings.data.subtitle') }}</p>
      </header>
      <div class="data-row">
        <div class="data-row__copy">
          <p class="data-row__title">{{ t('settings.data.export') }}</p>
          <p class="data-row__desc">{{ t('settings.data.exportDesc') }}</p>
        </div>
        <button type="button" class="app-btn app-btn--primary" @click="exportData">
          <Download :size="14" />
          {{ t('settings.data.exportBtn') }}
        </button>
      </div>
      <div class="data-row">
        <div class="data-row__copy">
          <p class="data-row__title">{{ t('settings.data.import') }}</p>
          <p class="data-row__desc">{{ t('settings.data.importDesc') }}</p>
        </div>
        <button type="button" class="app-btn app-btn--secondary" @click="triggerImport">
          <Upload :size="14" />
          {{ t('settings.data.importBtn') }}
        </button>
        <input ref="importInput" type="file" accept="application/json,.json" class="hidden" @change="handleImportFile" />
      </div>

      <Transition name="fade">
        <p v-if="importMessage" class="settings__msg settings__msg--ok">{{ importMessage }}</p>
      </Transition>
      <Transition name="fade">
        <p v-if="importError" class="settings__msg settings__msg--err">{{ importError }}</p>
      </Transition>

      <div class="data-row">
        <div class="data-row__copy">
          <p class="data-row__title">{{ t('settings.data.translate') }}</p>
          <p class="data-row__desc">{{ t('settings.data.translateDesc', { lang: currentLanguageLabel }) }}</p>
        </div>
        <button type="button" class="app-btn app-btn--secondary" :disabled="translateBusy" @click="handleTranslateAll">
          <Languages :size="14" />
          {{ translateBusy ? t('settings.data.translateBusy') : t('settings.data.translateBtn') }}
        </button>
      </div>

      <Transition name="fade">
        <p v-if="translateMessage" class="settings__msg settings__msg--ok">{{ translateMessage }}</p>
      </Transition>
      <Transition name="fade">
        <p v-if="translateError" class="settings__msg settings__msg--err">{{ translateError }}</p>
      </Transition>

      <div class="data-row data-row--danger">
        <div class="data-row__copy">
          <p class="data-row__title">{{ t('settings.data.clear') }}</p>
          <p class="data-row__desc">{{ t('settings.data.clearDesc') }}</p>
        </div>
        <button type="button" class="app-btn app-btn--danger" @click="clearAllData">
          <Trash2 :size="14" />
          {{ t('settings.data.clearBtn') }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings__head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings__title {
  font-size: 32px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}

.settings__sub {
  font-size: 14px;
  color: var(--text-muted);
}

.settings__card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.settings__card-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings__card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.005em;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.settings__card-sub {
  font-size: 13px;
  color: var(--text-faint);
}

.settings__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meal-row {
  display: grid;
  grid-template-columns: 32px 1fr 110px 34px;
  gap: 12px;
  align-items: center;
}

.meal-row.is-disabled .meal-row__icon,
.meal-row.is-disabled .app-input {
  opacity: 0.4;
}

.switch {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 20px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch__track {
  position: absolute;
  inset: 0;
  background-color: var(--border-strong);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.switch__track::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  top: 2px;
  background-color: var(--surface);
  border-radius: 999px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.15);
  transition: transform 0.2s ease;
}

.switch input:checked + .switch__track {
  background-color: var(--accent);
}

.switch input:checked + .switch__track::before {
  transform: translateX(14px);
}

@media (max-width: 768px) {
  .settings__title {
    font-size: 24px;
  }
  .settings__card {
    padding: 16px;
  }
  .meal-row {
    grid-template-columns: 28px 1fr 90px 34px;
    gap: 8px;
  }
  .profile-grid--5 {
    grid-template-columns: 1fr 1fr;
  }
  .chip-group {
    gap: 5px;
  }
  .chip-toggle {
    font-size: 12px;
    padding: 6px 10px;
  }
  .data-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
}

.profile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.profile-grid--4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.profile-grid--5 {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 900px) {
  .profile-grid--5 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .profile-grid,
  .profile-grid--4,
  .profile-grid--5 {
    grid-template-columns: 1fr 1fr;
  }
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.chip-toggle:hover {
  color: var(--text);
  border-color: var(--border-strong);
}

.chip-toggle.is-active {
  background-color: var(--accent-tint);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

[data-theme='dark'] .chip-toggle.is-active {
  background-color: color-mix(in srgb, var(--accent) 15%, transparent);
}

.field__hint {
  font-size: 11px;
  color: var(--text-faint);
  margin-top: 4px;
}

.people-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.people-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.person-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.person-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.person-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.person-card__name-input {
  flex: 1;
  max-width: 200px;
  min-height: 32px;
  font-size: 13px;
  font-weight: 600;
}

.person-card__macros {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.person-card__macros .app-input {
  min-height: 32px;
  font-size: 12px;
  padding: 4px 6px;
  text-align: center;
}

@media (max-width: 640px) {
  .person-card__macros {
    grid-template-columns: repeat(3, 1fr);
  }
}

.person-card__meals {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.person-card__meals-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-faint);
}

.person-card__meal-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.person-meal-chip {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 999px;
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--text-faint);
  cursor: pointer;
  transition: all 0.15s ease;
}

.person-meal-chip:hover {
  border-color: var(--border-strong);
  color: var(--text-muted);
}

.person-meal-chip.is-active {
  background-color: var(--accent-tint);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.dislike-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.dislike-block__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.dislike-block__sub {
  font-size: 12px;
  color: var(--text-faint);
  margin-top: 2px;
}

.dislike-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dislike-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 4px 10px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 12px;
  color: var(--text);
}

.dislike-chip__remove {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.dislike-chip__remove:hover {
  background-color: var(--danger-tint);
  color: var(--danger);
}

.dislike-empty {
  font-size: 12px;
  color: var(--text-faint);
  font-style: italic;
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

.meal-row__icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: var(--accent-tint);
  color: var(--accent);
  border-radius: 999px;
}

.settings__field {
  display: flex;
  flex-direction: column;
}

.settings__card-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 4px;
}

.settings__saved {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}

.data-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  background-color: var(--surface-2);
  border-radius: var(--radius-sm);
}

.data-row__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.data-row__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.data-row__desc {
  font-size: 12px;
  color: var(--text-faint);
}

.data-row--danger {
  background-color: var(--danger-tint);
}

.data-row--danger .data-row__title {
  color: var(--danger);
}

.settings__msg {
  font-size: 12px;
  font-weight: 500;
}
.settings__msg--ok {
  color: var(--accent);
}
.settings__msg--err {
  color: var(--danger);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.hidden {
  display: none;
}
</style>
