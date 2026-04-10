<script setup>
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/useTheme'
import { Leaf, Flame, Moon } from 'lucide-vue-next'

const { t } = useI18n()
const { theme, setTheme } = useTheme()

const options = [
  { id: 'sage', icon: Leaf },
  { id: 'warm', icon: Flame },
  { id: 'dark', icon: Moon },
]
</script>

<template>
  <div class="theme-toggle" role="radiogroup" :aria-label="t('theme.label')">
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      role="radio"
      :aria-checked="theme === opt.id"
      :title="t(`theme.${opt.id}`)"
      class="theme-toggle__btn"
      :class="{ 'is-active': theme === opt.id }"
      @click="setTheme(opt.id)"
    >
      <component :is="opt.icon" :size="14" :stroke-width="2" />
    </button>
  </div>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
  gap: 2px;
}

.theme-toggle__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  color: var(--text-faint);
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.theme-toggle__btn:hover {
  color: var(--text-muted);
}

.theme-toggle__btn.is-active {
  background-color: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}
</style>
