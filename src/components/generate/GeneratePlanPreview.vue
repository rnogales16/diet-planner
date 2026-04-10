<script setup>
import { computed } from 'vue'
import { ChevronLeft, Check } from 'lucide-vue-next'
import { sumDays } from '@/utils/nutritionHelpers'
import PreviewDayCard from './PreviewDayCard.vue'

const props = defineProps({
  plan: { type: Object, required: true },
  weekRange: { type: String, required: true },
})

const emit = defineEmits(['apply', 'back'])

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const daysForSum = computed(() =>
  props.plan.days.map((d) => ({
    meals: d.meals.map((m) => ({ dishes: [m.dish] })),
  }))
)

const weekTotals = computed(() => sumDays(daysForSum.value))
const dailyAvg = computed(() => ({
  calories: Math.round(weekTotals.value.calories / 7),
  protein: Math.round(weekTotals.value.protein / 7),
  carbs: Math.round(weekTotals.value.carbs / 7),
  fat: Math.round(weekTotals.value.fat / 7),
}))
</script>

<template>
  <div class="preview">
    <header class="preview__head">
      <div>
        <h2 class="preview__title font-display">Your generated week</h2>
        <p class="preview__sub">{{ weekRange }} &middot; 35 dishes</p>
      </div>
      <div class="preview__stats">
        <div class="stat">
          <span class="stat__label">avg/day</span>
          <span class="stat__value tabular">{{ dailyAvg.calories }} kcal</span>
        </div>
        <div class="stat">
          <span class="stat__label">P</span>
          <span class="stat__value tabular">{{ dailyAvg.protein }}g</span>
        </div>
        <div class="stat">
          <span class="stat__label">C</span>
          <span class="stat__value tabular">{{ dailyAvg.carbs }}g</span>
        </div>
        <div class="stat">
          <span class="stat__label">F</span>
          <span class="stat__value tabular">{{ dailyAvg.fat }}g</span>
        </div>
      </div>
    </header>

    <div class="preview__grid">
      <PreviewDayCard
        v-for="day in plan.days"
        :key="day.dayIndex"
        :day="day"
        :day-name="DAY_NAMES[day.dayIndex]"
      />
    </div>

    <footer class="preview__footer">
      <button type="button" class="app-btn app-btn--secondary" @click="emit('back')">
        <ChevronLeft :size="14" />
        Back to form
      </button>
      <button type="button" class="app-btn app-btn--primary app-btn--lg" @click="emit('apply')">
        <Check :size="14" />
        Apply to this week
      </button>
    </footer>

    <p class="preview__note">Applying replaces all existing dishes for this week.</p>
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.preview__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.preview__title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.preview__sub {
  font-size: 12px;
  color: var(--text-faint);
  margin-top: 2px;
}

.preview__stats {
  display: inline-flex;
  gap: 16px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.stat__label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

.stat__value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.preview__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.preview__footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.preview__note {
  text-align: center;
  font-size: 11px;
  color: var(--text-faint);
}

@media (min-width: 1024px) {
  .preview__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
