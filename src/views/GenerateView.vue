<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Sparkles, AlertCircle } from 'lucide-vue-next'
import { useDietStore } from '@/stores/dietStore'
import { useWeekNavigation } from '@/composables/useWeekNavigation'
import { generateMealPlan } from '@/services/openai'
import GenerateForm from '@/components/generate/GenerateForm.vue'
import GenerateLoading from '@/components/generate/GenerateLoading.vue'
import GeneratePlanPreview from '@/components/generate/GeneratePlanPreview.vue'

const router = useRouter()
const store = useDietStore()
const { weekKey, weekRange, init } = useWeekNavigation()

init()

const phase = ref('form') // form | loading | preview
const error = ref('')
const generatedPlan = ref(null)

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
  <div class="generate-view">
    <header class="generate-hero" v-if="phase === 'form'">
      <div class="generate-hero__icon">
        <Sparkles :size="20" />
      </div>
      <h1 class="generate-hero__title font-display">Plan your week with AI</h1>
      <p class="generate-hero__sub">
        Tell us what you eat and we will generate a balanced 7-day meal plan in seconds.
      </p>
    </header>

    <div v-if="error" class="generate-error">
      <AlertCircle :size="16" />
      <div>
        <p class="generate-error__title">Generation failed</p>
        <p class="generate-error__msg">{{ error }}</p>
      </div>
    </div>

    <div v-if="phase === 'form'" class="generate-card app-card">
      <GenerateForm @generate="handleGenerate" />
    </div>

    <GenerateLoading v-else-if="phase === 'loading'" @cancel="handleCancel" />

    <GeneratePlanPreview
      v-else-if="phase === 'preview' && generatedPlan"
      :plan="generatedPlan"
      :week-range="weekRange"
      @apply="handleApply"
      @back="handleBack"
    />
  </div>
</template>

<style scoped>
.generate-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 880px;
  margin: 0 auto;
}

.generate-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 16px 0 8px;
}

.generate-hero__icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background-color: var(--accent-tint);
  color: var(--accent);
}

.generate-hero__title {
  font-size: 32px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}

.generate-hero__sub {
  font-size: 14px;
  color: var(--text-muted);
  max-width: 480px;
}

.generate-card {
  padding: 28px 32px;
}

.generate-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  background-color: var(--danger-tint);
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
  border-radius: var(--radius-sm);
  color: var(--danger);
}

.generate-error__title {
  font-size: 13px;
  font-weight: 600;
}

.generate-error__msg {
  font-size: 12px;
  margin-top: 2px;
  opacity: 0.85;
}

@media (max-width: 720px) {
  .generate-card {
    padding: 20px;
  }
  .generate-hero__title {
    font-size: 26px;
  }
}
</style>
