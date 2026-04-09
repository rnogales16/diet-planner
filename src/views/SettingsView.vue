<script setup>
import { reactive, ref, toRaw } from 'vue'
import { useDietStore } from '@/stores/dietStore'
import { getApiKey, setApiKey, getModel, setModel } from '@/services/openai'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

const clone = (obj) => JSON.parse(JSON.stringify(obj))

const store = useDietStore()
const saved = ref(false)

// AI config
const aiKey = ref(getApiKey())
const aiModel = ref(getModel())
const showKey = ref(false)
const aiSaved = ref(false)

function saveAiConfig() {
  setApiKey(aiKey.value)
  setModel(aiModel.value)
  aiSaved.value = true
  setTimeout(() => (aiSaved.value = false), 2000)
}

const form = reactive({
  mealTypes: clone(store.mealTypes),
})

const mealIcons = {
  breakfast: '🌅',
  morning_snack: '🍎',
  lunch: '🍽️',
  afternoon_snack: '🥤',
  dinner: '🌙',
}

function save() {
  store.updateMealTypes(clone(toRaw(form.mealTypes)))
  saved.value = true
  setTimeout(() => (saved.value = false), 2000)
}

function reset() {
  form.mealTypes = clone(store.mealTypes)
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="flex items-center gap-3 mb-8">
      <div class="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-sm shadow-emerald-500/25">
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <div>
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Settings</h1>
        <p class="text-sm text-gray-400 dark:text-gray-500">Customize your meal plan</p>
      </div>
    </div>

    <section class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden">
      <div class="px-6 py-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
        <h2 class="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <span class="text-base">🍴</span>
          Meal Types
        </h2>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Customize names and default times for each meal</p>
      </div>
      <div class="p-6 space-y-3">
        <div
          v-for="(meal, idx) in form.mealTypes"
          :key="meal.type"
          class="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700"
        >
          <span class="text-xl w-8 text-center shrink-0">{{ mealIcons[meal.type] || '🍴' }}</span>
          <div class="flex-1">
            <BaseInput v-model="form.mealTypes[idx].label" :label="idx === 0 ? 'Label' : ''" />
          </div>
          <div class="w-32">
            <BaseInput v-model="form.mealTypes[idx].defaultTime" :label="idx === 0 ? 'Default Time' : ''" type="time" />
          </div>
        </div>
      </div>
      <div class="px-6 py-4 bg-gray-50/50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <BaseButton @click="save">Save Changes</BaseButton>
        <BaseButton variant="secondary" @click="reset">Reset</BaseButton>
        <Transition name="fade">
          <span v-if="saved" class="text-sm font-medium text-emerald-600 flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Saved!
          </span>
        </Transition>
      </div>
    </section>

    <section class="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden">
      <div class="px-6 py-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
        <h2 class="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <span class="text-base">🤖</span>
          AI Configuration
        </h2>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Configure Groq for AI-powered meal plan generation (free)</p>
      </div>
      <div class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Groq API Key</label>
          <div class="relative">
            <input
              v-model="aiKey"
              :type="showKey ? 'text' : 'password'"
              placeholder="gsk_..."
              class="w-full px-3 py-2 pr-10 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all font-mono"
            />
            <button
              type="button"
              @click="showKey = !showKey"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg v-if="!showKey" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            </button>
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Your key is stored locally in your browser and never sent to our servers.</p>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Model</label>
          <select
            v-model="aiModel"
            class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          >
            <option value="llama-3.3-70b-versatile">Llama 3.3 70B (recommended)</option>
            <option value="llama-3.1-8b-instant">Llama 3.1 8B (fastest)</option>
          </select>
        </div>
      </div>
      <div class="px-6 py-4 bg-gray-50/50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <BaseButton @click="saveAiConfig">Save AI Settings</BaseButton>
        <Transition name="fade">
          <span v-if="aiSaved" class="text-sm font-medium text-emerald-600 flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Saved!
          </span>
        </Transition>
      </div>
    </section>

    <section class="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden">
      <div class="px-6 py-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
        <h2 class="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <span class="text-base">💾</span>
          Data Management
        </h2>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">All your data is stored locally in your browser</p>
      </div>
      <div class="p-6">
        <div class="flex items-center justify-between p-4 rounded-xl bg-red-50/50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
          <div>
            <p class="text-sm font-semibold text-gray-800 dark:text-gray-200">Clear All Data</p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Permanently delete all meal plans and settings</p>
          </div>
          <BaseButton
            variant="danger"
            size="sm"
            @click="() => { if (confirm('Clear all diet data? This cannot be undone.')) { localStorage.removeItem('diet'); location.reload(); } }"
          >
            Clear Data
          </BaseButton>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
