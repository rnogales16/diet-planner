<script setup>
import { reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sparkles, User, Settings as SettingsIcon } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import { useDietStore } from '@/stores/dietStore'

const { t } = useI18n()
const emit = defineEmits(['generate'])
const store = useDietStore()

const form = reactive({
  fridgeContents: '',
  weeklyExtras: '',
})

function submit() {
  emit('generate', { ...form })
}

const profile = computed(() => store.profile)

const profileChips = computed(() => {
  const chips = []
  const p = profile.value
  if (Array.isArray(p.goals)) {
    for (const g of p.goals) chips.push(t(`settings.profile.goalOptions.${g}`))
  }
  if (p.dietaryStyle) chips.push(t(`settings.profile.styleOptions.${p.dietaryStyle}`))
  if (p.calorieTarget) chips.push(`${p.calorieTarget} ${t('common.kcal')}`)
  if (p.proteinTarget) chips.push(`${p.proteinTarget}${t('common.g')} ${t('summary.protein').toLowerCase()}`)
  if (p.servings && p.servings > 1) chips.push(`${p.servings} ${t('common.servings')}`)
  if (p.maxCookTime) chips.push(`≤${p.maxCookTime} ${t('common.min')}`)
  if (p.allergies) chips.push(p.allergies.split(',').slice(0, 2).join(', ').trim())
  return chips
})

const profileEmpty = computed(() => {
  const p = profile.value
  const hasFavs = Array.isArray(p.favourites) ? p.favourites.length > 0 : !!p.favourites
  return profileChips.value.length === 0 && !p.allergies && !hasFavs && !p.notes
})
</script>

<template>
  <form class="generate-form" @submit.prevent="submit">
    <!-- Profile banner -->
    <div v-if="!profileEmpty" class="profile-banner">
      <div class="profile-banner__icon">
        <User :size="14" />
      </div>
      <div class="profile-banner__body">
        <p class="profile-banner__title">{{ t('generate.form.usingProfile') }}</p>
        <div class="profile-banner__chips">
          <span v-for="chip in profileChips" :key="chip" class="profile-banner__chip">{{ chip }}</span>
        </div>
      </div>
      <RouterLink to="/settings" class="profile-banner__edit" :title="t('generate.form.editProfile')">
        <SettingsIcon :size="14" />
      </RouterLink>
    </div>

    <div v-else class="profile-banner profile-banner--empty">
      <div class="profile-banner__icon">
        <User :size="14" />
      </div>
      <div class="profile-banner__body">
        <p class="profile-banner__title">{{ t('generate.form.noProfile') }}</p>
        <i18n-t keypath="generate.form.noProfileSub" tag="p" class="profile-banner__sub">
          <template #link>
            <RouterLink to="/settings" class="profile-banner__link">{{ t('generate.form.fillProfile') }}</RouterLink>
          </template>
        </i18n-t>
      </div>
    </div>

    <label class="field">
      <span class="field__label">{{ t('generate.form.fridgeLabel') }}</span>
      <textarea
        v-model="form.fridgeContents"
        class="app-input"
        rows="3"
        :placeholder="t('generate.form.fridgePlaceholder')"
      />
      <span class="field__hint">{{ t('generate.form.fridgeHint') }}</span>
    </label>

    <label class="field">
      <span class="field__label">{{ t('generate.form.extrasLabel') }}</span>
      <textarea
        v-model="form.weeklyExtras"
        class="app-input"
        rows="2"
        :placeholder="t('generate.form.extrasPlaceholder')"
      />
      <span class="field__hint">{{ t('generate.form.extrasHint') }}</span>
    </label>

    <footer class="generate-form__footer">
      <button type="submit" class="app-btn app-btn--primary app-btn--lg">
        <Sparkles :size="14" />
        {{ t('generate.form.submit') }}
      </button>
    </footer>
  </form>
</template>

<style scoped>
.generate-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.profile-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background-color: var(--accent-tint);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: var(--radius-sm);
}

[data-theme='dark'] .profile-banner {
  background-color: color-mix(in srgb, var(--accent) 12%, transparent);
}

.profile-banner--empty {
  background-color: var(--surface-2);
  border-color: var(--border);
}

.profile-banner__icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: var(--surface);
  color: var(--accent);
  flex-shrink: 0;
  border: 1px solid var(--border);
}

.profile-banner--empty .profile-banner__icon {
  color: var(--text-faint);
}

.profile-banner__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.profile-banner__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.profile-banner__sub {
  font-size: 12px;
  color: var(--text-muted);
}

.profile-banner__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.profile-banner__chip {
  padding: 2px 8px;
  border-radius: 999px;
  background-color: var(--surface);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--border);
}

.profile-banner__link {
  color: var(--accent);
  text-decoration: underline;
  font-weight: 600;
}

.profile-banner__edit {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--text-muted);
  background-color: var(--surface);
  border: 1px solid var(--border);
  flex-shrink: 0;
  text-decoration: none;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.profile-banner__edit:hover {
  color: var(--accent);
  border-color: var(--accent);
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

.field__hint {
  font-size: 11px;
  color: var(--text-faint);
}

.generate-form__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
</style>
