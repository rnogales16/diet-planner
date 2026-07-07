<script setup>
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLogo from './AppLogo.vue'
import ThemeToggle from './ThemeToggle.vue'
import SyncIndicator from './SyncIndicator.vue'
import LanguageToggle from './LanguageToggle.vue'
import { useLanguage } from '@/composables/useLanguage'
import { useLogout } from '@/composables/useLogout'

useLanguage() // bootstrap locale <-> store sync
const { t } = useI18n()
const { auth, doLogout } = useLogout()
const menuOpen = ref(false)
const initial = computed(() => (auth.user?.email || 'U').charAt(0).toUpperCase())

function logout() {
  menuOpen.value = false
  doLogout()
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <RouterLink to="/" class="brand" :aria-label="t('header.brand') + ' — ' + t('header.planner')">
        <AppLogo :size="26" />
        <span class="brand__name font-display">{{ t('header.brand') }}</span>
      </RouterLink>

      <nav class="app-nav" :aria-label="t('header.planner')">
        <RouterLink to="/" class="app-nav__link" active-class="is-active" exact-active-class="is-active">{{ t('header.planner') }}</RouterLink>
        <RouterLink to="/generate" class="app-nav__link" active-class="is-active">{{ t('header.generate') }}</RouterLink>
        <RouterLink to="/shopping" class="app-nav__link" active-class="is-active">{{ t('header.shopping') }}</RouterLink>
        <RouterLink to="/favorites" class="app-nav__link" active-class="is-active">{{ t('header.favorites') }}</RouterLink>
        <RouterLink to="/nutrition" class="app-nav__link" active-class="is-active">{{ t('header.nutrition') }}</RouterLink>
        <RouterLink to="/settings" class="app-nav__link" active-class="is-active">{{ t('header.settings') }}</RouterLink>
      </nav>

      <div class="app-header__right">
        <SyncIndicator />
        <LanguageToggle />
        <ThemeToggle />
        <div class="account">
          <button class="avatar" type="button" :aria-label="t('auth.account')" @click="menuOpen = !menuOpen">{{ initial }}</button>
          <div v-if="menuOpen" class="account-menu">
            <div class="account-menu__email">{{ auth.user?.email }}</div>
            <button v-if="auth.canLogout" type="button" class="account-menu__logout" @click="logout">{{ t('auth.logout') }}</button>
            <div v-else class="account-menu__note">{{ t('auth.accessManaged') }}</div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background-color: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 30;
  backdrop-filter: saturate(140%) blur(8px);
}

.app-header__inner {
  max-width: 1920px;
  margin: 0 auto;
  padding: 0 24px;
  height: 60px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
  justify-self: start;
}

.brand__name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.015em;
}

.app-nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
}

.app-nav__link {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 999px;
  color: var(--text-muted);
  text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.app-nav__link:hover {
  color: var(--text);
}

.app-nav__link.is-active {
  background-color: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.app-header__right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  justify-self: end;
}

.account {
  position: relative;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background-color: var(--accent-tint);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid var(--border);
  cursor: pointer;
}

.account-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  padding: 10px;
  min-width: 200px;
  z-index: 40;
}

.account-menu__email {
  font-size: 13px;
  color: var(--text-muted);
  padding: 4px 6px 8px;
  border-bottom: 1px solid var(--border);
  word-break: break-all;
}

.account-menu__logout {
  width: 100%;
  text-align: left;
  margin-top: 6px;
  padding: 8px 6px;
  border: none;
  background: none;
  color: var(--danger);
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.account-menu__logout:hover {
  background-color: var(--danger-tint);
}

.account-menu__note {
  font-size: 12px;
  color: var(--text-faint);
  padding: 8px 6px 4px;
}

@media (max-width: 768px) {
  .app-header__inner {
    grid-template-columns: 1fr auto;
    height: 52px;
    padding: 0 12px;
    gap: 8px;
  }
  /* Navigation moves to the MobileNav bottom bar */
  .app-nav {
    display: none;
  }
  .avatar {
    display: none;
  }
  .brand__name {
    font-size: 15px;
  }
}
</style>
