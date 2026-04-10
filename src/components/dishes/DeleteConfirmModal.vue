<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '@/components/ui/BaseModal.vue'

const { t } = useI18n()

const props = defineProps({
  show: { type: Boolean, default: false },
  dishName: { type: String, default: '' },
})

defineEmits(['close', 'confirm'])

const displayName = computed(() => props.dishName || t('deleteDialog.thisDish'))
</script>

<template>
  <BaseModal :show="show" size="sm" :title="t('deleteDialog.title')" @close="$emit('close')">
    <i18n-t keypath="deleteDialog.body" tag="p" class="confirm-text">
      <template #name><strong>{{ displayName }}</strong></template>
    </i18n-t>
    <div class="confirm-actions">
      <button type="button" class="app-btn app-btn--secondary" @click="$emit('close')">{{ t('common.cancel') }}</button>
      <button type="button" class="app-btn app-btn--danger" @click="$emit('confirm')">{{ t('common.delete') }}</button>
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
