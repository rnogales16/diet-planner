<script setup>
import { ref, computed } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useDietStore } from '@/stores/dietStore'
import { useWeekNavigation } from '@/composables/useWeekNavigation'
import { getApiKey, generateMealPlan } from '@/services/openai'
import GenerateForm from '@/components/generate/GenerateForm.vue'
import GenerateLoading from '@/components/generate/GenerateLoading.vue'
import GeneratePlanPreview from '@/components/generate/GeneratePlanPreview.vue'

const router = useRouter()
const store = useDietStore()
const { weekKey, weekRange, init } = useWeekNavigation()

init()

const phase = ref('form') // 'form' | 'loading' | 'preview'
const error = ref('')
const generatedPlan = ref(null)

// Re-check on every render so it updates after the user saves a key in Settings
const hasApiKey = computed(() => !!getApiKey())

let abortController = null

async function handleGenerate(formData) {
  error.value = ''
  phase.value = 'loading'
  abortController = new AbortController()

  const result = await generateMealPlan(formData, abortController.signal)

  if (result.success) {
    generatedPlan.value = result.data
    phase.value = 'preview'
  } else {
    error.value = result.error
    phase.value = 'form'
  }
}

function handleCancel() {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  phase.value = 'form'
}

function handleApply() {
  if (!generatedPlan.value) return
  store.ensureWeek(weekKey.value, new Date())
  store.applyGeneratedPlan(weekKey.value, generatedPlan.value.days)
  router.push('/')
}

function handleBack() {
  error.value = ''
  phase.value = 'form'
}
</script>

<template>
  <div class="max-w-6xl">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-8">
      <div class="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-sm shadow-violet-500/25">
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div>
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">AI Meal Plan Generator</h1>
        <p class="text-sm text-gray-400 dark:text-gray-500">Describe your preferences and get a full 7-day plan</p>
      </div>
    </div>

    <!-- No API key warning -->
    <div
      v-if="!hasApiKey && !error"
      class="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3"
    >
      <svg class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <div>
        <p class="text-sm font-semibold text-amber-800 dark:text-amber-200">No API key configured</p>
        <p class="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
          Add your Groq API key in
          <RouterLink to="/settings" class="underline font-semibold hover:text-amber-800 dark:hover:text-amber-200">Settings</RouterLink>
          to use the AI generator.
        </p>
      </div>
    </div>

    <!-- Error banner -->
    <div
      v-if="error"
      class="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3"
    >
      <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <p class="text-sm font-semibold text-red-800 dark:text-red-200">Generation failed</p>
        <p class="text-xs text-red-600 dark:text-red-400 mt-0.5">{{ error }}</p>
      </div>
    </div>

    <!-- Phase: Form -->
    <div v-if="phase === 'form'" class="max-w-2xl">
      <GenerateForm @generate="handleGenerate" />
    </div>

    <!-- Phase: Loading -->
    <GenerateLoading v-else-if="phase === 'loading'" @cancel="handleCancel" />

    <!-- Phase: Preview -->
    <GeneratePlanPreview
      v-else-if="phase === 'preview' && generatedPlan"
      :plan="generatedPlan"
      :week-range="weekRange"
      @apply="handleApply"
      @back="handleBack"
    />
  </div>
</template>
