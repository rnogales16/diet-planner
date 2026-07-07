<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { authApi } from '@/services/authApi'
import AuthCard from '@/components/auth/AuthCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const { t } = useI18n()
const email = ref('')
const loading = ref(false)
const sent = ref(false)

async function onSubmit() {
  if (loading.value) return
  loading.value = true
  // Response is always generic; the front never reveals whether the email exists.
  await authApi.forgot(email.value.trim())
  loading.value = false
  sent.value = true
}
</script>

<template>
  <AuthCard :title="t('auth.forgot.title')" :subtitle="t('auth.forgot.desc')">
    <div v-if="sent" class="auth-note auth-note--center">{{ t('auth.forgot.sent') }}</div>
    <form v-else class="auth-form" @submit.prevent="onSubmit">
      <BaseInput v-model="email" type="email" :label="t('auth.email')" :placeholder="t('auth.emailPlaceholder')" />
      <BaseButton type="submit" :disabled="loading" class="auth-submit">
        {{ loading ? t('auth.forgot.submitting') : t('auth.forgot.submit') }}
      </BaseButton>
    </form>
    <div class="auth-links">
      <RouterLink to="/login">{{ t('auth.forgot.backToLogin') }}</RouterLink>
    </div>
  </AuthCard>
</template>
