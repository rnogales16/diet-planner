<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cloud, CloudOff, Loader2, Check } from 'lucide-vue-next'
import { syncStatus, syncError } from '@/services/sync'

const { t } = useI18n()

const display = computed(() => {
  switch (syncStatus.value) {
    case 'loading':
      return { icon: Loader2, label: t('sync.loading'), kind: 'busy' }
    case 'saving':
      return { icon: Loader2, label: t('sync.saving'), kind: 'busy' }
    case 'saved':
      return { icon: Check, label: t('sync.saved'), kind: 'ok' }
    case 'error':
      return { icon: CloudOff, label: syncError.value || t('sync.error'), kind: 'error' }
    default:
      return { icon: Cloud, label: t('sync.synced'), kind: 'idle' }
  }
})
</script>

<template>
  <span class="sync" :class="`sync--${display.kind}`" :title="display.label">
    <component :is="display.icon" :size="13" :class="{ spin: display.kind === 'busy' }" />
    <span class="sync__label">{{ display.label }}</span>
  </span>
</template>

<style scoped>
.sync {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-faint);
  white-space: nowrap;
}

.sync--ok {
  color: var(--accent);
}

.sync--busy {
  color: var(--text-muted);
}

.sync--error {
  color: var(--danger);
  background-color: var(--danger-tint);
  border-color: color-mix(in srgb, var(--danger) 30%, transparent);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .sync__label {
    display: none;
  }
  .sync {
    padding: 4px 6px;
  }
}
</style>
