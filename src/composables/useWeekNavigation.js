import { ref, computed } from 'vue'
import { getWeekKey, getWeekDates, getMonday, shiftWeek, formatWeekRange } from '@/utils/dateHelpers'
import { useDietStore } from '@/stores/dietStore'

export function useWeekNavigation() {
  const store = useDietStore()
  const referenceDate = ref(getMonday(new Date()))

  const weekDates = computed(() => getWeekDates(referenceDate.value))
  const weekKey = computed(() => getWeekKey(referenceDate.value))
  const weekRange = computed(() => formatWeekRange(weekDates.value))

  function init() {
    store.setCurrentWeek(weekKey.value, referenceDate.value)
  }

  function goToPrevWeek() {
    referenceDate.value = shiftWeek(referenceDate.value, -1)
    store.setCurrentWeek(weekKey.value, referenceDate.value)
  }

  function goToNextWeek() {
    referenceDate.value = shiftWeek(referenceDate.value, 1)
    store.setCurrentWeek(weekKey.value, referenceDate.value)
  }

  function goToToday() {
    referenceDate.value = getMonday(new Date())
    store.setCurrentWeek(weekKey.value, referenceDate.value)
  }

  return {
    referenceDate,
    weekDates,
    weekKey,
    weekRange,
    init,
    goToPrevWeek,
    goToNextWeek,
    goToToday,
  }
}
