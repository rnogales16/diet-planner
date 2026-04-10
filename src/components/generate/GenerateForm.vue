<script setup>
import { reactive, computed } from 'vue'
import { Sparkles, User, Settings as SettingsIcon } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import { useDietStore } from '@/stores/dietStore'

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

const goalLabels = {
  lose_weight: 'Lose weight',
  gain_muscle: 'Gain muscle',
  maintain: 'Maintain',
  health: 'General health',
}

const styleLabels = {
  omnivore: 'Omnivore',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
  mediterranean: 'Mediterranean',
  keto: 'Keto',
  paleo: 'Paleo',
  other: 'Other',
}

const profileChips = computed(() => {
  const chips = []
  const p = profile.value
  if (p.goal) chips.push(goalLabels[p.goal] || p.goal)
  if (p.dietaryStyle) chips.push(styleLabels[p.dietaryStyle] || p.dietaryStyle)
  if (p.calorieTarget) chips.push(`${p.calorieTarget} kcal/day`)
  if (p.proteinTarget) chips.push(`${p.proteinTarget}g protein`)
  if (p.servings && p.servings > 1) chips.push(`${p.servings} servings`)
  if (p.maxCookTime) chips.push(`≤${p.maxCookTime} min/meal`)
  if (p.allergies) chips.push(`no ${p.allergies.split(',').slice(0, 2).join(', ').trim()}`)
  return chips
})

const profileEmpty = computed(() => profileChips.value.length === 0 && !profile.value.allergies && !profile.value.favourites && !profile.value.notes)
</script>

<template>
  <form class="generate-form" @submit.prevent="submit">
    <!-- Profile banner -->
    <div v-if="!profileEmpty" class="profile-banner">
      <div class="profile-banner__icon">
        <User :size="14" />
      </div>
      <div class="profile-banner__body">
        <p class="profile-banner__title">Using your diet profile</p>
        <div class="profile-banner__chips">
          <span v-for="chip in profileChips" :key="chip" class="profile-banner__chip">{{ chip }}</span>
        </div>
      </div>
      <RouterLink to="/settings" class="profile-banner__edit" title="Edit profile in Settings">
        <SettingsIcon :size="14" />
      </RouterLink>
    </div>

    <div v-else class="profile-banner profile-banner--empty">
      <div class="profile-banner__icon">
        <User :size="14" />
      </div>
      <div class="profile-banner__body">
        <p class="profile-banner__title">No diet profile yet</p>
        <p class="profile-banner__sub">
          Tip: <RouterLink to="/settings" class="profile-banner__link">fill in your diet profile</RouterLink> once and the AI will use it for every plan from now on.
        </p>
      </div>
    </div>

    <label class="field">
      <span class="field__label">What is in your fridge this week</span>
      <textarea
        v-model="form.fridgeContents"
        class="app-input"
        rows="3"
        placeholder="chicken breast, broccoli, eggs, brown rice, greek yogurt..."
      />
      <span class="field__hint">Optional. Helps the AI build a plan around what you already have.</span>
    </label>

    <label class="field">
      <span class="field__label">Anything specific for this week</span>
      <textarea
        v-model="form.weeklyExtras"
        class="app-input"
        rows="2"
        placeholder="having dinner out on Friday, want to try Thai food, low budget..."
      />
      <span class="field__hint">Optional. Anything that only applies to this particular week.</span>
    </label>

    <footer class="generate-form__footer">
      <button type="submit" class="app-btn app-btn--primary app-btn--lg">
        <Sparkles :size="14" />
        Generate plan
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
