<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Sparkles, AlertCircle, CalendarClock, RefreshCw, Plus } from 'lucide-vue-next'
import { translateDishes } from '@/services/translate'
import { SUPPORTED_LOCALES } from '@/i18n'
import { useDietStore } from '@/stores/dietStore'
import { useWeekNavigation } from '@/composables/useWeekNavigation'
import { useGeneration } from '@/composables/useGeneration'
import GenerateForm from '@/components/generate/GenerateForm.vue'
import GenerateLoading from '@/components/generate/GenerateLoading.vue'
import GeneratePlanPreview from '@/components/generate/GeneratePlanPreview.vue'
import WeekNavigator from '@/components/calendar/WeekNavigator.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

const { t } = useI18n()
const router = useRouter()
const store = useDietStore()
const { weekKey, weekRange, init, goToPrevWeek, goToNextWeek, goToToday } = useWeekNavigation()
const { phase, plan, error, start, cancel, clear, dismissError } = useGeneration()

init()

// The form phase is the default. The composable uses 'idle' for that.
const uiPhase = computed(() => {
  if (phase.value === 'idle') return 'form'
  return phase.value
})

async function handleGenerate(formData) {
  await start(formData, weekKey.value)
}

function handleCancel() {
  cancel()
}

const showApplyChoice = ref(false)

function handleApply() {
  if (!plan.value) return
  store.ensureWeek(weekKey.value, new Date())
  if (store.weekHasDishes(weekKey.value)) {
    showApplyChoice.value = true
    return
  }
  doApply('replace')
}

function doApply(mode) {
  showApplyChoice.value = false
  if (!plan.value) return
  store.applyGeneratedPlan(
    weekKey.value,
    plan.value.days,
    plan.value.shoppingList,
    mode,
  )
  void backfillOtherLanguages()
  clear()
  router.push('/')
}

async function backfillOtherLanguages() {
  const sourceLang = store.language || 'en'
  const others = SUPPORTED_LOCALES.filter((l) => l !== sourceLang)
  for (const target of others) {
    try {
      const dishes = store.collectDishesNeedingTranslation(target)
      if (dishes.length === 0) continue
      const result = await translateDishes(dishes, target)
      if (result.success) {
        store.applyDishTranslations(target, result.translations)
      }
    } catch {
      // Silent: best-effort.
    }
  }
}

function handleBack() {
  dismissError()
  clear()
}
</script>

<template>
  <div class="generate-view">
    <header class="generate-hero" v-if="uiPhase === 'form'">
      <div class="generate-hero__icon">
        <Sparkles :size="20" />
      </div>
      <h1 class="generate-hero__title font-display">{{ t('generate.heroTitle') }}</h1>
      <p class="generate-hero__sub">{{ t('generate.heroSub') }}</p>
    </header>

    <div v-if="uiPhase !== 'loading'" class="target-week">
      <span class="target-week__label">
        <CalendarClock :size="14" />
        {{ t('generate.targetWeek') }}
      </span>
      <WeekNavigator
        :week-range="weekRange"
        @prev="goToPrevWeek"
        @next="goToNextWeek"
        @today="goToToday"
      />
    </div>

    <div v-if="error && uiPhase !== 'preview'" class="generate-error">
      <AlertCircle :size="16" />
      <div>
        <p class="generate-error__title">{{ t('generate.errorTitle') }}</p>
        <p class="generate-error__msg">{{ error }}</p>
      </div>
    </div>

    <div v-if="uiPhase === 'form' || uiPhase === 'error'" class="generate-card app-card">
      <GenerateForm @generate="handleGenerate" />
    </div>

    <GenerateLoading v-else-if="uiPhase === 'loading'" @cancel="handleCancel" />

    <GeneratePlanPreview
      v-else-if="uiPhase === 'preview' && plan"
      :plan="plan"
      :week-range="weekRange"
      @apply="handleApply"
      @back="handleBack"
    />

    <BaseModal
      :show="showApplyChoice"
      size="sm"
      :title="t('generate.applyChoice.title')"
      @close="showApplyChoice = false"
    >
      <p class="apply-choice__body">{{ t('generate.applyChoice.body') }}</p>
      <div class="apply-choice__options">
        <button type="button" class="apply-choice__btn" @click="doApply('replace')">
          <RefreshCw :size="16" />
          <span class="apply-choice__label">
            <span class="apply-choice__title">{{ t('generate.applyChoice.replace') }}</span>
            <span class="apply-choice__hint">{{ t('generate.applyChoice.replaceHint') }}</span>
          </span>
        </button>
        <button type="button" class="apply-choice__btn" @click="doApply('append')">
          <Plus :size="16" />
          <span class="apply-choice__label">
            <span class="apply-choice__title">{{ t('generate.applyChoice.append') }}</span>
            <span class="apply-choice__hint">{{ t('generate.applyChoice.appendHint') }}</span>
          </span>
        </button>
      </div>
      <div class="apply-choice__cancel">
        <button type="button" class="app-btn app-btn--ghost" @click="showApplyChoice = false">{{ t('common.cancel') }}</button>
      </div>
    </BaseModal>
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

.target-week {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}

.target-week__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
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

.apply-choice__body {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 18px;
}

.apply-choice__options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.apply-choice__btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.apply-choice__btn:hover {
  border-color: var(--accent);
  background-color: var(--accent-tint);
  color: var(--accent);
}

[data-theme='dark'] .apply-choice__btn:hover {
  background-color: color-mix(in srgb, var(--accent) 14%, transparent);
}

.apply-choice__label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.apply-choice__title {
  font-size: 14px;
  font-weight: 600;
}

.apply-choice__hint {
  font-size: 12px;
  color: var(--text-faint);
}

.apply-choice__btn:hover .apply-choice__hint {
  color: inherit;
  opacity: 0.8;
}

.apply-choice__cancel {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
</style>
