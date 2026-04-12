<script setup>
import { watch, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  title: { type: String, default: '' },
  show: { type: Boolean, default: false },
  size: { type: String, default: 'md' }, // sm | md | lg
})

const emit = defineEmits(['close'])

function onBackdropClick(e) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}

// Scroll lock: prevents the background page from scrolling while the modal
// is open. On iOS this requires position:fixed on the body.
let savedScrollY = 0

function lockScroll() {
  savedScrollY = window.scrollY
  document.body.style.position = 'fixed'
  document.body.style.top = `-${savedScrollY}px`
  document.body.style.left = '0'
  document.body.style.right = '0'
  document.body.style.overflow = 'hidden'
}

function unlockScroll() {
  if (document.body.style.position !== 'fixed') return
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.left = ''
  document.body.style.right = ''
  document.body.style.overflow = ''
  window.scrollTo(0, savedScrollY)
}

watch(
  () => props.show,
  (open) => {
    if (open) lockScroll()
    else unlockScroll()
  },
)

// Safety net: if the component is destroyed (e.g. user navigated away
// with the browser back button) without show being set to false, make
// sure we release the scroll lock so the page doesn't get stuck.
onUnmounted(() => {
  unlockScroll()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="modal-backdrop"
        @click="onBackdropClick"
        @touchmove.self.prevent
      >
        <Transition name="modal-content" appear>
          <div class="modal-card" :class="`modal-card--${size}`">
            <header class="modal-head">
              <h2 class="modal-title font-display">{{ title }}</h2>
              <button class="modal-close" type="button" @click="$emit('close')">
                <X :size="16" />
              </button>
            </header>
            <div class="modal-body">
              <slot />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgb(0 0 0 / 0.45);
  backdrop-filter: blur(4px);
  padding: 16px;
  overscroll-behavior: contain;
}

.modal-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-card--lg {
  max-width: 720px;
}

.modal-card--sm {
  max-width: 360px;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.modal-close {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.modal-close:hover {
  background-color: var(--surface-2);
  color: var(--text);
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-content-enter-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.modal-content-leave-active {
  transition: transform 0.15s ease, opacity 0.1s ease;
}
.modal-content-enter-from {
  transform: translateY(20px);
  opacity: 0;
}
.modal-content-leave-to {
  transform: translateY(8px);
  opacity: 0;
}

@media (max-width: 768px) {
  .modal-backdrop {
    padding: 0;
    /* The card fills the backdrop; it manages its own height. */
    align-items: stretch;
    justify-content: stretch;
  }

  .modal-card {
    /* Fill the fixed-inset backdrop which is exactly the viewport. Using
       flex:1 instead of 100vh/100dvh because those units are broken on
       iOS Chrome and cause the header to get cut off. */
    flex: 1;
    max-width: 100%;
    max-height: none;
    border-radius: 0;
    border: none;
  }

  .modal-card--sm,
  .modal-card--lg {
    max-width: 100%;
  }

  .modal-head {
    padding: 14px 16px;
    gap: 12px;
  }

  .modal-title {
    font-size: 16px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .modal-body {
    padding: 16px;
    flex: 1;
    min-height: 0;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  }

  .modal-content-enter-from {
    transform: translateY(40px);
  }
  .modal-content-leave-to {
    transform: translateY(40px);
  }
}
</style>
