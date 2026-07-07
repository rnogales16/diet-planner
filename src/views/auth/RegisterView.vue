<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/authStore'
import AuthCard from '@/components/auth/AuthCard.vue'
import AuthGoogleButton from '@/components/auth/AuthGoogleButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const { t } = useI18n()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')
const notice = ref('')
const loading = ref(false)

async function onSubmit() {
  if (loading.value) return
  error.value = ''
  notice.value = ''
  if (password.value.length < 8) {
    error.value = t('auth.register.pwTooShort')
    return
  }
  loading.value = true
  const r = await auth.register(email.value.trim(), password.value)
  loading.value = false
  if (r.ok && r.loggedIn) {
    window.location.assign('/') // new account + session → into the app (verify banner shows)
  } else if (r.ok) {
    // Existing email → backend responds generically (anti-enumeration). Show its
    // message as-is; do NOT reveal whether the email is registered.
    notice.value = r.message || t('auth.register.generic')
  } else {
    error.value = r.error || t('auth.register.error')
  }
}
</script>

<template>
  <AuthCard :title="t('auth.register.title')">
    <form class="auth-form" @submit.prevent="onSubmit">
      <BaseInput v-model="email" type="email" :label="t('auth.email')" :placeholder="t('auth.emailPlaceholder')" />
      <BaseInput v-model="password" type="password" :label="t('auth.password')" :placeholder="t('auth.register.pwHint')" />
      <p v-if="error" class="auth-error">{{ error }}</p>
      <p v-if="notice" class="auth-note">{{ notice }}</p>
      <BaseButton type="submit" :disabled="loading" class="auth-submit">
        {{ loading ? t('auth.register.submitting') : t('auth.register.submit') }}
      </BaseButton>
    </form>
    <div class="auth-divider"><span>{{ t('auth.or') }}</span></div>
    <AuthGoogleButton />
    <div class="auth-links">
      <span>{{ t('auth.register.haveAccount') }} <RouterLink to="/login">{{ t('auth.register.login') }}</RouterLink></span>
    </div>
  </AuthCard>
</template>
