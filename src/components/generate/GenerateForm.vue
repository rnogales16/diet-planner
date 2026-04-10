<script setup>
import { reactive } from 'vue'
import { Sparkles } from 'lucide-vue-next'

const emit = defineEmits(['generate'])

const form = reactive({
  preferences: '',
  fridgeContents: '',
  favourites: '',
  restrictions: '',
  calorieTarget: null,
  proteinTarget: null,
  carbsTarget: null,
  fatTarget: null,
})

function submit() {
  emit('generate', { ...form })
}
</script>

<template>
  <form class="generate-form" @submit.prevent="submit">
    <section class="generate-form__section">
      <h2 class="generate-form__title font-display">Preferences</h2>
      <div class="generate-form__grid">
        <label class="field">
          <span class="field__label">Dietary preferences</span>
          <textarea v-model="form.preferences" class="app-input" rows="3" placeholder="vegetarian, mediterranean, low-carb..." />
        </label>
        <label class="field">
          <span class="field__label">What is in your fridge</span>
          <textarea v-model="form.fridgeContents" class="app-input" rows="3" placeholder="chicken breast, rice, broccoli, eggs..." />
        </label>
        <label class="field">
          <span class="field__label">Favourite foods</span>
          <textarea v-model="form.favourites" class="app-input" rows="3" placeholder="pasta, salmon, avocado..." />
        </label>
        <label class="field">
          <span class="field__label">Restrictions or allergies</span>
          <textarea v-model="form.restrictions" class="app-input" rows="3" placeholder="lactose intolerant, no nuts..." />
        </label>
      </div>
    </section>

    <div class="hairline" />

    <section class="generate-form__section">
      <h2 class="generate-form__title font-display">Daily nutrition targets</h2>
      <p class="generate-form__sub">Optional. Leave blank for a balanced default.</p>
      <div class="generate-form__targets">
        <label class="field">
          <span class="field__label">Calories</span>
          <span class="field__control">
            <input v-model.number="form.calorieTarget" type="number" min="0" placeholder="2000" class="app-input app-input--with-suffix" />
            <span class="field__suffix">kcal</span>
          </span>
        </label>
        <label class="field">
          <span class="field__label">Protein</span>
          <span class="field__control">
            <input v-model.number="form.proteinTarget" type="number" min="0" placeholder="150" class="app-input app-input--with-suffix" />
            <span class="field__suffix">g</span>
          </span>
        </label>
        <label class="field">
          <span class="field__label">Carbs</span>
          <span class="field__control">
            <input v-model.number="form.carbsTarget" type="number" min="0" placeholder="220" class="app-input app-input--with-suffix" />
            <span class="field__suffix">g</span>
          </span>
        </label>
        <label class="field">
          <span class="field__label">Fat</span>
          <span class="field__control">
            <input v-model.number="form.fatTarget" type="number" min="0" placeholder="70" class="app-input app-input--with-suffix" />
            <span class="field__suffix">g</span>
          </span>
        </label>
      </div>
    </section>

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
  gap: 24px;
}

.generate-form__section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.generate-form__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.005em;
}

.generate-form__sub {
  font-size: 12px;
  color: var(--text-faint);
  margin-top: -8px;
}

.generate-form__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.generate-form__targets {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.generate-form__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
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
  .generate-form__grid {
    grid-template-columns: 1fr;
  }
  .generate-form__targets {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
