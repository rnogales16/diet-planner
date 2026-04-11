<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Loader2, Sparkles, AlertCircle, X } from 'lucide-vue-next'
import { useGeneration } from '@/composables/useGeneration'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { phase, error, dismissError, cancel } = useGeneration()

// Hide the banner while the user is already on /generate — the page shows
// the same state inline.
const visible = computed(() => {
  if (route.path === '/generate') return false
  return phase.value === 'loading' || phase.value === 'preview' || phase.value === 'error'
})

function go() {
  router.push('/generate')
}

function close() {
  if (phase.value === 'error') dismissError()
  else if (phase.value === 'loading') cancel()
  // preview: clicking X just hides the banner for now — state stays alive
}
</script>

<template>
  <Transition name="slide">
    <div v-if="visible" class="gen-banner" :class="`gen-banner--${phase}`" @click="go">
      <div class="gen-banner__icon">
        <Loader2 v-if="phase === 'loading'" :size="18" class="spin" />
        <Sparkles v-else-if="phase === 'preview'" :size="18" />
        <AlertCircle v-else :size="18" />
      </div>
      <div class="gen-banner__body">
        <p class="gen-banner__title">
          <template v-if="phase === 'loading'">{{ t('generation.bannerLoading') }}</template>
          <template v-else-if="phase === 'preview'">{{ t('generation.bannerReady') }}</template>
          <template v-else>{{ t('generation.bannerError') }}</template>
        </p>
        <p class="gen-banner__sub">
          <template v-if="phase === 'loading'">{{ t('generation.bannerLoadingSub') }}</template>
          <template v-else-if="phase === 'preview'">{{ t('generation.bannerReadySub') }}</template>
          <template v-else>{{ error }}</template>
        </p>
      </div>
      <button
        v-if="phase !== 'preview'"
        type="button"
        class="gen-banner__close"
        :title="phase === 'loading' ? t('common.cancel') : t('common.cancel')"
        @click.stop="close"
      >
        <X :size="14" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.gen-banner {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  min-width: 260px;
  max-width: 360px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.gen-banner:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
}

.gen-banner__icon {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: var(--surface-2);
  color: var(--text-muted);
  flex-shrink: 0;
}

.gen-banner--loading .gen-banner__icon {
  color: var(--accent);
}

.gen-banner--preview {
  border-color: var(--accent);
}

.gen-banner--preview .gen-banner__icon {
  background-color: var(--accent-tint);
  color: var(--accent);
}

[data-theme='dark'] .gen-banner--preview .gen-banner__icon {
  background-color: color-mix(in srgb, var(--accent) 16%, transparent);
}

.gen-banner--error {
  border-color: color-mix(in srgb, var(--danger) 40%, transparent);
}

.gen-banner--error .gen-banner__icon {
  background-color: var(--danger-tint);
  color: var(--danger);
}

.gen-banner__body {
  flex: 1;
  min-width: 0;
}

.gen-banner__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.gen-banner__sub {
  font-size: 12px;
  color: var(--text-faint);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gen-banner__close {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 999px;
  color: var(--text-faint);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.gen-banner__close:hover {
  background-color: var(--surface-2);
  color: var(--text);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateY(20px);
  opacity: 0;
}

@media (max-width: 640px) {
  .gen-banner {
    left: 16px;
    right: 16px;
    bottom: 16px;
    min-width: 0;
    max-width: none;
  }
}
</style>
