<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDietStore } from '@/stores/dietStore'
import { useWeekNavigation } from '@/composables/useWeekNavigation'
import { createEmptyDish, generateId } from '@/utils/defaults'
import { regenerateSingleMeal } from '@/services/regenerateMeal'
import WeekNavigator from '@/components/calendar/WeekNavigator.vue'
import WeeklyCalendar from '@/components/calendar/WeeklyCalendar.vue'
import WeeklySummary from '@/components/summary/WeeklySummary.vue'
import DishFormModal from '@/components/dishes/DishFormModal.vue'
import DishDetailModal from '@/components/dishes/DishDetailModal.vue'
import DeleteConfirmModal from '@/components/dishes/DeleteConfirmModal.vue'

const router = useRouter()
const store = useDietStore()
const { weekKey, weekRange, init, goToPrevWeek, goToNextWeek, goToToday } = useWeekNavigation()

onMounted(init)

const showDishForm = ref(false)
const isEditing = ref(false)
const currentDayIndex = ref(0)
const currentMealType = ref('')
const currentMealLabel = ref('')
const currentDish = ref(null)

const showDishDetail = ref(false)
const detailDish = ref(null)
const detailDayIndex = ref(0)
const detailMealType = ref('')

const showDeleteConfirm = ref(false)
const deleteDayIndex = ref(0)
const deleteMealType = ref('')
const deleteDish = ref(null)

function handleAddDish({ dayIndex, mealType }) {
  const week = store.currentWeek
  if (!week) return
  const day = week.days[dayIndex]
  const meal = day.meals.find((m) => m.type === mealType)
  currentDayIndex.value = dayIndex
  currentMealType.value = mealType
  currentMealLabel.value = meal?.label || mealType
  currentDish.value = createEmptyDish(mealType)
  isEditing.value = false
  showDishForm.value = true
}

function handleEditDish({ dayIndex, mealType, dish }) {
  currentDayIndex.value = dayIndex
  currentMealType.value = mealType
  const week = store.currentWeek
  const meal = week?.days[dayIndex]?.meals.find((m) => m.type === mealType)
  currentMealLabel.value = meal?.label || mealType
  currentDish.value = { ...dish }
  isEditing.value = true
  showDishForm.value = true
}

function handleViewDish({ dayIndex, mealType, dish }) {
  detailDayIndex.value = dayIndex
  detailMealType.value = mealType
  detailDish.value = { ...dish }
  showDishDetail.value = true
}

function handleDetailEdit(dish) {
  showDishDetail.value = false
  handleEditDish({
    dayIndex: detailDayIndex.value,
    mealType: detailMealType.value,
    dish,
  })
}

function handleDetailDelete(dish) {
  showDishDetail.value = false
  handleDeleteDish({
    dayIndex: detailDayIndex.value,
    mealType: detailMealType.value,
    dish,
  })
}

function handleSaveDish(formData) {
  if (isEditing.value) {
    store.updateDish(weekKey.value, currentDayIndex.value, currentMealType.value, currentDish.value.id, formData)
  } else {
    store.addDish(weekKey.value, currentDayIndex.value, currentMealType.value, {
      ...currentDish.value,
      ...formData,
    })
  }
  showDishForm.value = false
}

function handleDeleteDish({ dayIndex, mealType, dish }) {
  deleteDayIndex.value = dayIndex
  deleteMealType.value = mealType
  deleteDish.value = dish
  showDeleteConfirm.value = true
}

function confirmDelete() {
  store.deleteDish(weekKey.value, deleteDayIndex.value, deleteMealType.value, deleteDish.value.id)
  showDeleteConfirm.value = false
}

function goToGenerate() {
  router.push('/generate')
}

// Regenerate a single meal slot via AI
const regenDay = ref(-1)
const regenMeal = ref('')

async function handleRegenerateMeal({ dayIndex, mealType }) {
  regenDay.value = dayIndex
  regenMeal.value = mealType

  const result = await regenerateSingleMeal({
    mealType,
    dayIndex,
    weekKey: weekKey.value,
  })

  regenDay.value = -1
  regenMeal.value = ''

  if (result.success && result.dish) {
    store.addDish(weekKey.value, dayIndex, mealType, {
      ...result.dish,
      id: generateId(),
    })
    // In replace-style: remove existing dishes for this meal first, keep only the new one
    const week = store.weeks[weekKey.value]
    if (week) {
      const day = week.days[dayIndex]
      const meal = day?.meals.find((m) => m.type === mealType)
      if (meal && meal.dishes.length > 1) {
        // Keep only the last one (the one we just added)
        meal.dishes = [meal.dishes[meal.dishes.length - 1]]
      }
    }
  }
}
</script>

<template>
  <div class="planner">
    <div class="planner__top">
      <WeekNavigator
        :weekRange="weekRange"
        @prev="goToPrevWeek"
        @next="goToNextWeek"
        @today="goToToday"
      />
    </div>

    <div class="planner__layout">
      <WeeklyCalendar
        v-if="store.currentWeek"
        class="planner__calendar"
        :week="store.currentWeek"
        :regeneratingDay="regenDay"
        :regeneratingMeal="regenMeal"
        @addDish="handleAddDish"
        @editDish="handleEditDish"
        @deleteDish="handleDeleteDish"
        @viewDish="handleViewDish"
        @regenerateMeal="handleRegenerateMeal"
      />

      <WeeklySummary :week="store.currentWeek" @generate="goToGenerate" />
    </div>

    <DishFormModal
      :show="showDishForm"
      :dish="currentDish"
      :mealLabel="currentMealLabel"
      :isEditing="isEditing"
      @close="showDishForm = false"
      @save="handleSaveDish"
    />

    <DishDetailModal
      :show="showDishDetail"
      :dish="detailDish"
      @close="showDishDetail = false"
      @edit="handleDetailEdit"
      @delete="handleDetailDelete"
    />

    <DeleteConfirmModal
      :show="showDeleteConfirm"
      :dishName="deleteDish?.name"
      @close="showDeleteConfirm = false"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.planner {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.planner__top {
  display: flex;
  justify-content: center;
}

.planner__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 24px;
  align-items: start;
}

.planner__calendar {
  min-width: 0;
}

@media (max-width: 1100px) {
  .planner__layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .planner {
    gap: 16px;
  }
  .planner__layout {
    gap: 16px;
  }
}
</style>
