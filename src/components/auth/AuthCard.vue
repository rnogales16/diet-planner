<script setup>
import AppLogo from '@/components/layout/AppLogo.vue'
import { useI18n } from 'vue-i18n'

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
})
const { t } = useI18n()
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-brand">
        <AppLogo :size="34" />
        <span class="auth-brand__name font-display">{{ t('header.brand') }}</span>
      </div>
      <h1 v-if="title" class="auth-title">{{ title }}</h1>
      <p v-if="subtitle" class="auth-subtitle">{{ subtitle }}</p>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: var(--bg);
  color: var(--text);
}
.auth-card {
  width: 100%;
  max-width: 400px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 32px 28px;
}
.auth-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  margin-bottom: 20px;
}
.auth-brand__name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.015em;
}
.auth-title {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 4px;
}
.auth-subtitle {
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
  margin: 0 0 20px;
}
</style>
