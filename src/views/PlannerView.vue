<script setup>
import { ref, onMounted } from 'vue'
import { useDietStore } from '@/stores/dietStore'
import { useWeekNavigation } from '@/composables/useWeekNavigation'
import { createEmptyDish } from '@/utils/defaults'
import WeekNavigator from '@/components/calendar/WeekNavigator.vue'
import WeeklyCalendar from '@/components/calendar/WeeklyCalendar.vue'
import WeeklySummary from '@/components/summary/WeeklySummary.vue'
import DishFormModal from '@/components/dishes/DishFormModal.vue'
import DishDetailModal from '@/components/dishes/DishDetailModal.vue'
import DeleteConfirmModal from '@/components/dishes/DeleteConfirmModal.vue'

const store = useDietStore()
const { weekKey, weekRange, init, goToPrevWeek, goToNextWeek, goToToday } = useWeekNavigation()

onMounted(init)

// Dish form modal state
const showDishForm = ref(false)
const isEditing = ref(false)
const currentDayIndex = ref(0)
const currentMealType = ref('')
const currentMealLabel = ref('')
const currentDish = ref(null)

// Dish detail modal state
const showDishDetail = ref(false)
const detailDish = ref(null)
const detailDayIndex = ref(0)
const detailMealType = ref('')

// Delete confirm modal state
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
</script>

<template>
  <div>
    <div class="mb-4">
      <WeekNavigator
        :weekRange="weekRange"
        @prev="goToPrevWeek"
        @next="goToNextWeek"
        @today="goToToday"
      />
    </div>

    <WeeklyCalendar
      v-if="store.currentWeek"
      :week="store.currentWeek"
      @addDish="handleAddDish"
      @editDish="handleEditDish"
      @deleteDish="handleDeleteDish"
      @viewDish="handleViewDish"
    />

    <WeeklySummary :week="store.currentWeek" />

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
