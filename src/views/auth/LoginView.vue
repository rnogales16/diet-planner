<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/authStore'
import AuthCard from '@/components/auth/AuthCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const { t } = useI18n()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  if (loading.value) return
  error.value = ''
  loading.value = true
  const r = await auth.login(email.value.trim(), password.value)
  loading.value = false
  if (r.ok) {
    // Full navigation so the app bootstraps (loads the diet store) as authenticated.
    window.location.assign('/')
  } else {
    // Faithful to the backend's generic message (no enumeration).
    error.value = r.error || t('auth.login.error')
  }
}
</script>

<template>
  <AuthCard :title="t('auth.login.title')">
    <form class="auth-form" @submit.prevent="onSubmit">
      <BaseInput v-model="email" type="email" :label="t('auth.email')" :placeholder="t('auth.emailPlaceholder')" />
      <BaseInput v-model="password" type="password" :label="t('auth.password')" />
      <p v-if="error" class="auth-error">{{ error }}</p>
      <BaseButton type="submit" :disabled="loading" class="auth-submit">
        {{ loading ? t('auth.login.submitting') : t('auth.login.submit') }}
      </BaseButton>
    </form>
    <div class="auth-links">
      <RouterLink to="/forgot-password">{{ t('auth.login.forgot') }}</RouterLink>
      <span>{{ t('auth.login.noAccount') }} <RouterLink to="/register">{{ t('auth.login.register') }}</RouterLink></span>
    </div>
  </AuthCard>
</template>
