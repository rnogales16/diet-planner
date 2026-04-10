<script setup>
import { reactive, ref, toRaw, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sun, Coffee, Utensils, Apple, Moon, User, Download, Upload, Trash2, Check, Languages } from 'lucide-vue-next'
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
  store.updateProfile(clone(toRaw(profile)))
  profileSaved.value = true
  setTimeout(() => (profileSaved.value = false), 2000)
}

const GOAL_VALUES = ['', 'lose_weight', 'gain_muscle', 'maintain', 'health']
const STYLE_VALUES = ['', 'omnivore', 'vegetarian', 'vegan', 'pescatarian', 'mediterranean', 'keto', 'paleo', 'other']

const goalOptions = computed(() =>
  GOAL_VALUES.map((v) => ({ value: v, label: t(`settings.profile.goalOptions.${v || 'none'}`) }))
)
const styleOptions = computed(() =>
  STYLE_VALUES.map((v) => ({ value: v, label: t(`settings.profile.styleOptions.${v || 'none'}`) }))
)

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

      <div class="profile-grid">
        <label class="field">
          <span class="field__label">{{ t('settings.profile.goal') }}</span>
          <select v-model="profile.goal" class="app-input">
            <option v-for="o in goalOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field__label">{{ t('settings.profile.dietaryStyle') }}</span>
          <select v-model="profile.dietaryStyle" class="app-input">
            <option v-for="o in styleOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
      </div>

      <label class="field">
        <span class="field__label">{{ t('settings.profile.allergies') }}</span>
        <input v-model="profile.allergies" class="app-input" :placeholder="t('settings.profile.allergiesPlaceholder')" />
      </label>
      <label class="field">
        <span class="field__label">{{ t('settings.profile.restrictions') }}</span>
        <input v-model="profile.restrictions" class="app-input" :placeholder="t('settings.profile.restrictionsPlaceholder')" />
      </label>
      <label class="field">
        <span class="field__label">{{ t('settings.profile.favourites') }}</span>
        <input v-model="profile.favourites" class="app-input" :placeholder="t('settings.profile.favouritesPlaceholder')" />
      </label>
      <label class="field">
        <span class="field__label">{{ t('settings.profile.cuisines') }}</span>
        <input v-model="profile.cuisines" class="app-input" :placeholder="t('settings.profile.cuisinesPlaceholder')" />
      </label>

      <div class="profile-grid profile-grid--4">
        <label class="field">
          <span class="field__label">{{ t('settings.profile.calories') }}</span>
          <span class="field__control">
            <input v-model.number="profile.calorieTarget" type="number" min="0" placeholder="2000" class="app-input app-input--with-suffix" />
            <span class="field__suffix">{{ t('common.kcal') }}</span>
          </span>
        </label>
        <label class="field">
          <span class="field__label">{{ t('settings.profile.protein') }}</span>
          <span class="field__control">
            <input v-model.number="profile.proteinTarget" type="number" min="0" placeholder="150" class="app-input app-input--with-suffix" />
            <span class="field__suffix">{{ t('common.g') }}</span>
          </span>
        </label>
        <label class="field">
          <span class="field__label">{{ t('settings.profile.carbs') }}</span>
          <span class="field__control">
            <input v-model.number="profile.carbsTarget" type="number" min="0" placeholder="220" class="app-input app-input--with-suffix" />
            <span class="field__suffix">{{ t('common.g') }}</span>
          </span>
        </label>
        <label class="field">
          <span class="field__label">{{ t('settings.profile.fat') }}</span>
          <span class="field__control">
            <input v-model.number="profile.fatTarget" type="number" min="0" placeholder="70" class="app-input app-input--with-suffix" />
            <span class="field__suffix">{{ t('common.g') }}</span>
          </span>
        </label>
      </div>

      <div class="profile-grid">
        <label class="field">
          <span class="field__label">{{ t('settings.profile.cookingFor') }}</span>
          <span class="field__control">
            <input v-model.number="profile.servings" type="number" min="1" class="app-input app-input--with-suffix" />
            <span class="field__suffix">{{ t('common.people') }}</span>
          </span>
        </label>
        <label class="field">
          <span class="field__label">{{ t('settings.profile.maxTime') }}</span>
          <span class="field__control">
            <input v-model.number="profile.maxCookTime" type="number" min="0" :placeholder="t('settings.profile.anyTime')" class="app-input app-input--with-suffix" />
            <span class="field__suffix">{{ t('common.min') }}</span>
          </span>
        </label>
      </div>

      <label class="field">
        <span class="field__label">{{ t('settings.profile.notes') }}</span>
        <textarea v-model="profile.notes" class="app-input" rows="2" :placeholder="t('settings.profile.notesPlaceholder')" />
      </label>

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
        <div v-for="(meal, idx) in form.mealTypes" :key="meal.type" class="meal-row">
          <span class="meal-row__icon">
            <component :is="mealIcons[meal.type] || Utensils" :size="14" />
          </span>
          <input v-model="form.mealTypes[idx].label" class="app-input meal-row__label" />
          <input v-model="form.mealTypes[idx].defaultTime" type="time" class="app-input meal-row__time" />
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
  grid-template-columns: 32px 1fr 110px;
  gap: 12px;
  align-items: center;
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

@media (max-width: 640px) {
  .profile-grid,
  .profile-grid--4 {
    grid-template-columns: 1fr 1fr;
  }
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
