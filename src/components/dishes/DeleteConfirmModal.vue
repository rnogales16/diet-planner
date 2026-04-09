<script setup>
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

defineProps({
  show: { type: Boolean, default: false },
  dishName: { type: String, default: '' },
})

defineEmits(['close', 'confirm'])
</script>

<template>
  <BaseModal :show="show" title="Delete Dish" @close="$emit('close')">
    <div class="text-center py-2">
      <div class="w-14 h-14 mx-auto mb-4 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
        <svg class="w-7 h-7 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </div>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Are you sure you want to delete</p>
      <p class="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">{{ dishName || 'this dish' }}?</p>
      <p class="text-xs text-gray-400 dark:text-gray-500 mb-6">This action cannot be undone.</p>
    </div>
    <div class="flex gap-2">
      <BaseButton variant="secondary" class="flex-1" @click="$emit('close')">Cancel</BaseButton>
      <BaseButton variant="danger" class="flex-1" @click="$emit('confirm')">Delete</BaseButton>
    </div>
  </BaseModal>
</template>
