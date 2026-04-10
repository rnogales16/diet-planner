<script setup>
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const { t } = useI18n()

defineProps({
  weekRange: { type: String, required: true },
})

defineEmits(['prev', 'next', 'today'])
</script>

<template>
  <div class="week-nav">
    <button class="week-nav__chev" type="button" @click="$emit('prev')" :aria-label="t('weekNav.prev')">
      <ChevronLeft :size="16" />
    </button>
    <div class="week-nav__label font-display tabular">{{ weekRange }}</div>
    <button class="week-nav__chev" type="button" @click="$emit('next')" :aria-label="t('weekNav.next')">
      <ChevronRight :size="16" />
    </button>
    <button class="week-nav__today" type="button" @click="$emit('today')">{{ t('weekNav.today') }}</button>
  </div>
</template>

<style scoped>
.week-nav {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  box-shadow: var(--shadow-sm);
}

.week-nav__chev {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.week-nav__chev:hover {
  background-color: var(--surface-2);
  color: var(--text);
}

.week-nav__label {
  min-width: 200px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.week-nav__today {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.week-nav__today:hover {
  background-color: var(--accent-tint);
  color: var(--accent);
  border-color: var(--accent);
}
</style>
