<script setup>
import { reactive, ref, toRaw } from 'vue'
import { Sun, Coffee, Utensils, Apple, Moon, Cpu, Download, Upload, Trash2, Check } from 'lucide-vue-next'
import { useDietStore } from '@/stores/dietStore'
import { getModel, setModel } from '@/services/openai'

const clone = (obj) => JSON.parse(JSON.stringify(obj))

const store = useDietStore()
const saved = ref(false)
const aiSaved = ref(false)

const aiModel = ref(getModel())

function saveAiConfig() {
  setModel(aiModel.value)
  aiSaved.value = true
  setTimeout(() => (aiSaved.value = false), 2000)
}

const form = reactive({
  mealTypes: clone(store.mealTypes),
})

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
      importMessage.value = 'Data imported successfully.'
      setTimeout(() => (importMessage.value = ''), 3000)
    } else {
      importError.value = result.error
    }
  } catch (err) {
    importError.value = `Could not read file: ${err.message}`
  } finally {
    event.target.value = ''
  }
}

function clearAllData() {
  if (!confirm('Clear all diet data? This cannot be undone.')) return
  localStorage.removeItem('diet')
  location.reload()
}
</script>

<template>
  <div class="settings">
    <header class="settings__head">
      <h1 class="settings__title font-display">Settings</h1>
      <p class="settings__sub">Customize your meal plan</p>
    </header>

    <!-- Meal types -->
    <section class="app-card settings__card">
      <header class="settings__card-head">
        <h2 class="settings__card-title font-display">Meal types</h2>
        <p class="settings__card-sub">Customize names and default times of each meal</p>
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
        <button type="button" class="app-btn app-btn--primary" @click="save">Save changes</button>
        <button type="button" class="app-btn app-btn--ghost" @click="reset">Reset</button>
        <Transition name="fade">
          <span v-if="saved" class="settings__saved">
            <Check :size="14" /> Saved
          </span>
        </Transition>
      </footer>
    </section>

    <!-- AI model -->
    <section class="app-card settings__card">
      <header class="settings__card-head">
        <h2 class="settings__card-title font-display">
          <Cpu :size="14" /> AI model
        </h2>
        <p class="settings__card-sub">Choose which model generates your meal plans</p>
      </header>
      <div class="settings__field">
        <select v-model="aiModel" class="app-input">
          <option value="llama-3.3-70b-versatile">Llama 3.3 70B (recommended)</option>
          <option value="llama-3.1-8b-instant">Llama 3.1 8B (fastest)</option>
        </select>
      </div>
      <footer class="settings__card-footer">
        <button type="button" class="app-btn app-btn--primary" @click="saveAiConfig">Save</button>
        <Transition name="fade">
          <span v-if="aiSaved" class="settings__saved">
            <Check :size="14" /> Saved
          </span>
        </Transition>
      </footer>
    </section>

    <!-- Data management -->
    <section class="app-card settings__card">
      <header class="settings__card-head">
        <h2 class="settings__card-title font-display">Data management</h2>
        <p class="settings__card-sub">All your data is stored locally in your browser</p>
      </header>
      <div class="data-row">
        <div class="data-row__copy">
          <p class="data-row__title">Export data</p>
          <p class="data-row__desc">Download all your meal plans as a JSON backup file</p>
        </div>
        <button type="button" class="app-btn app-btn--primary" @click="exportData">
          <Download :size="14" />
          Export
        </button>
      </div>
      <div class="data-row">
        <div class="data-row__copy">
          <p class="data-row__title">Import data</p>
          <p class="data-row__desc">Restore from a previously exported backup file</p>
        </div>
        <button type="button" class="app-btn app-btn--secondary" @click="triggerImport">
          <Upload :size="14" />
          Import
        </button>
        <input ref="importInput" type="file" accept="application/json,.json" class="hidden" @change="handleImportFile" />
      </div>

      <Transition name="fade">
        <p v-if="importMessage" class="settings__msg settings__msg--ok">{{ importMessage }}</p>
      </Transition>
      <Transition name="fade">
        <p v-if="importError" class="settings__msg settings__msg--err">{{ importError }}</p>
      </Transition>

      <div class="data-row data-row--danger">
        <div class="data-row__copy">
          <p class="data-row__title">Clear all data</p>
          <p class="data-row__desc">Permanently delete all meal plans and settings</p>
        </div>
        <button type="button" class="app-btn app-btn--danger" @click="clearAllData">
          <Trash2 :size="14" />
          Clear data
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
