import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getWeekKey, getWeekDates, getMonday, shiftWeek, formatWeekRange, parseWeekKey } from '@/utils/dateHelpers'
import { useDietStore } from '@/stores/dietStore'

export function useWeekNavigation() {
  const store = useDietStore()
  const { locale } = useI18n()
  // Start from whatever week the store already considers current. This way
  // navigating in Planner carries over when the user opens Generate, and
  // vice versa, since both views run setCurrentWeek as they navigate.
  const initialMonday = parseWeekKey(store.currentWeekKey) || getMonday(new Date())
  const referenceDate = ref(initialMonday)

  const weekDates = computed(() => getWeekDates(referenceDate.value))
  const weekKey = computed(() => getWeekKey(referenceDate.value))
  const weekRange = computed(() => formatWeekRange(weekDates.value, locale.value))

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
