<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { authApi } from '@/services/authApi'
import AuthCard from '@/components/auth/AuthCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const { t } = useI18n()
const route = useRoute()
const token = String(route.query.token || '')

const password = ref('')
const confirm = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)

async function onSubmit() {
  if (loading.value) return
  error.value = ''
  if (password.value.length < 8) {
    error.value = t('auth.reset.pwTooShort')
    return
  }
  if (password.value !== confirm.value) {
    error.value = t('auth.reset.mismatch')
    return
  }
  loading.value = true
  const { data } = await authApi.reset(token, password.value)
  loading.value = false
  if (data.success) {
    done.value = true
  } else {
    error.value = data.error || t('auth.reset.invalid')
  }
}
</script>

<template>
  <AuthCard :title="t('auth.reset.title')">
    <div v-if="done" class="auth-note auth-note--center">
      {{ t('auth.reset.done') }}
      <div class="auth-links"><RouterLink to="/login">{{ t('auth.reset.toLogin') }}</RouterLink></div>
    </div>
    <template v-else-if="!token">
      <p class="auth-error">{{ t('auth.reset.noToken') }}</p>
      <div class="auth-links"><RouterLink to="/forgot-password">{{ t('auth.reset.requestNew') }}</RouterLink></div>
    </template>
    <form v-else class="auth-form" @submit.prevent="onSubmit">
      <BaseInput v-model="password" type="password" :label="t('auth.reset.newPassword')" :placeholder="t('auth.register.pwHint')" />
      <BaseInput v-model="confirm" type="password" :label="t('auth.reset.confirm')" />
      <p v-if="error" class="auth-error">{{ error }}</p>
      <BaseButton type="submit" :disabled="loading" class="auth-submit">
        {{ loading ? t('auth.reset.submitting') : t('auth.reset.submit') }}
      </BaseButton>
    </form>
  </AuthCard>
</template>
