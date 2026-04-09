<script setup>
defineProps({
  title: { type: String, default: '' },
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

function onBackdropClick(e) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
        @click="onBackdropClick"
      >
        <Transition name="modal-content" appear>
          <div class="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div class="relative px-6 py-5 border-b border-gray-100 dark:border-gray-700">
              <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-t-2xl" />
              <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ title }}</h2>
              <button
                class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                @click="$emit('close')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="p-6">
              <slot />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-content-enter-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.modal-content-leave-active {
  transition: transform 0.2s ease, opacity 0.15s ease;
}
.modal-content-enter-from {
  transform: translateY(30px);
  opacity: 0;
}
.modal-content-leave-to {
  transform: translateY(10px);
  opacity: 0;
}
</style>
