<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// OAuth is a browser redirect, not a fetch — navigate to the start endpoint.
function go() {
  window.location.href = '/api/auth/google/start'
}
</script>

<template>
  <button type="button" class="google-btn" @click="go">
    <svg class="google-btn__icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.92v2.34A9 9 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.92a9 9 0 0 0 0 8.12l3.06-2.34Z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .92 4.94l3.06 2.34C4.68 5.16 6.66 3.58 9 3.58Z"/>
    </svg>
    <span>{{ t('auth.google') }}</span>
  </button>
</template>

<style scoped>
.google-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background-color: var(--surface);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.google-btn:hover {
  background-color: var(--surface-2);
}

.google-btn__icon {
  flex-shrink: 0;
}
</style>
