<script setup>
import BaseModal from '@/components/ui/BaseModal.vue'

defineProps({
  show: { type: Boolean, default: false },
  dishName: { type: String, default: '' },
})

defineEmits(['close', 'confirm'])
</script>

<template>
  <BaseModal :show="show" size="sm" title="Delete dish" @close="$emit('close')">
    <p class="confirm-text">
      Delete <strong>{{ dishName || 'this dish' }}</strong>? This cannot be undone.
    </p>
    <div class="confirm-actions">
      <button type="button" class="app-btn app-btn--secondary" @click="$emit('close')">Cancel</button>
      <button type="button" class="app-btn app-btn--danger" @click="$emit('confirm')">Delete</button>
    </div>
  </BaseModal>
</template>

<style scoped>
.confirm-text {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 20px;
  line-height: 1.5;
}

.confirm-text strong {
  color: var(--text);
  font-weight: 600;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
