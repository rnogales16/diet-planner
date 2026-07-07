// Shared logout behaviour. Used by the desktop header and the Settings account
// section so the logic (canLogout + logout + redirect) lives in one place.

import { useAuthStore } from '@/stores/authStore'

export function useLogout() {
  const auth = useAuthStore()
  async function doLogout() {
    await auth.logout()
    // Full navigation so all app state resets cleanly.
    window.location.assign('/login')
  }
  return { auth, doLogout }
}
