<script setup>
import { Loader2 } from 'lucide-vue-next'

defineEmits(['cancel'])
</script>

<template>
  <div class="loading">
    <div class="loading__spinner">
      <Loader2 :size="32" class="spin" />
    </div>
    <p class="loading__title font-display">Cooking up your week</p>
    <p class="loading__sub">This usually takes 15 to 30 seconds</p>
    <button type="button" class="app-btn app-btn--ghost" @click="$emit('cancel')">Cancel</button>
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 80px 24px;
  text-align: center;
}

.loading__spinner {
  color: var(--accent);
  margin-bottom: 8px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.loading__sub {
  font-size: 13px;
  color: var(--text-faint);
  margin-bottom: 8px;
}
</style>
