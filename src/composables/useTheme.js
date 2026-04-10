import { ref, watchEffect } from 'vue'

const STORAGE_KEY = 'nutriplan_theme'
const THEMES = ['sage', 'warm', 'dark']

function readInitial() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (THEMES.includes(stored)) return stored
  return 'sage'
}

const theme = ref(readInitial())

watchEffect(() => {
  document.documentElement.dataset.theme = theme.value
  localStorage.setItem(STORAGE_KEY, theme.value)
})

export function useTheme() {
  function setTheme(next) {
    if (THEMES.includes(next)) theme.value = next
  }
  function cycle() {
    const i = THEMES.indexOf(theme.value)
    theme.value = THEMES[(i + 1) % THEMES.length]
  }
  return { theme, setTheme, cycle, themes: THEMES }
}
