import { ref, watchEffect } from 'vue'

const STORAGE_KEY = 'nutriplan_theme'
const isDark = ref(localStorage.getItem(STORAGE_KEY) !== 'light')

watchEffect(() => {
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
})

export function useTheme() {
  function toggle() {
    isDark.value = !isDark.value
  }
  return { isDark, toggle }
}
