<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MailWarning } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/authStore'

const { t } = useI18n()
const auth = useAuthStore()
const sending = ref(false)
const sentMsg = ref('')

async function resend() {
  if (sending.value) return
  sending.value = true
  sentMsg.value = ''
  await auth.resendVerification()
  sentMsg.value = t('auth.verify.resent')
  sending.value = false
}
</script>

<template>
  <div v-if="auth.needsVerification" class="verify-banner" role="status">
    <MailWarning :size="18" class="verify-banner__icon" />
    <span class="verify-banner__text">{{ t('auth.verify.banner') }}</span>
    <span v-if="sentMsg" class="verify-banner__sent">{{ sentMsg }}</span>
    <button class="verify-banner__btn" :disabled="sending" @click="resend">
      {{ t('auth.verify.resend') }}
    </button>
  </div>
</template>

<style scoped>
.verify-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  background-color: var(--danger-tint);
  color: var(--text);
  border-bottom: 1px solid var(--border);
  padding: 8px 24px;
  font-size: 14px;
}
.verify-banner__icon {
  color: var(--danger);
  flex-shrink: 0;
}
.verify-banner__text {
  flex: 1;
  min-width: 200px;
}
.verify-banner__sent {
  color: var(--text-muted);
  font-size: 13px;
}
.verify-banner__btn {
  border: 1px solid var(--border-strong);
  background-color: var(--surface);
  color: var(--text);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.verify-banner__btn:disabled {
  opacity: 0.6;
  cursor: default;
}
@media (max-width: 768px) {
  .verify-banner {
    padding: 8px 12px;
  }
}
</style>
