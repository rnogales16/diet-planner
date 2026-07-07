// Authentication state for the SPA. Hydrated once at startup from /api/auth/me,
// which works in both environments via the resolveUser shim: own session
// (via='session') in local, or Cloudflare Access (via='access') in production.
// The app is driven entirely by this — no "Access mode" flag.

import { defineStore } from 'pinia'
import { authApi } from '@/services/authApi'

// Deduped, cached initial /me load, shared by the router guard and bootstrap so
// routing waits for auth to resolve (the guard's first run would otherwise race
// ahead of it). Reset naturally on each full page load.
let loadPromise = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    status: 'unknown', // unknown | authenticated | anonymous
    user: null, // { id, email, via, emailVerified }
    via: null, // 'session' | 'access' | null
    emailVerified: false,
  }),
  getters: {
    isAuthenticated: (s) => s.status === 'authenticated',
    // Only own-session, unverified users need the verify prompt. Access users
    // are treated as verified; anonymous users see the login screen.
    needsVerification: (s) => s.status === 'authenticated' && s.via === 'session' && !s.emailVerified,
    // Logging out only makes sense for our own sessions; Access users are gated
    // at the edge and have no session of ours to end.
    canLogout: (s) => s.status === 'authenticated' && s.via === 'session',
  },
  actions: {
    setAnonymous() {
      this.status = 'anonymous'
      this.user = null
      this.via = null
      this.emailVerified = false
    },
    async fetchMe() {
      const { status, data } = await authApi.me()
      if (status === 200 && data.authenticated && data.user) {
        this.status = 'authenticated'
        this.user = data.user
        this.via = data.user.via || null
        this.emailVerified = !!data.user.emailVerified
      } else {
        this.setAnonymous()
      }
      return this.status
    },
    // Resolve auth exactly once per page load; concurrent callers share the fetch.
    ensureLoaded() {
      if (!loadPromise) loadPromise = this.fetchMe()
      return loadPromise
    },
    async login(email, password) {
      const { status, data } = await authApi.login(email, password)
      if (status === 200 && data.success) return { ok: true }
      // Faithful to the backend's generic message (no enumeration).
      return { ok: false, error: data.error || '' }
    },
    async register(email, password) {
      const { status, data } = await authApi.register(email, password)
      if (status === 200 && data.success) {
        // New account → backend returns a user + sets a session. Existing email →
        // generic message, no user (anti-enumeration). Do not distinguish to the
        // user beyond what the backend says.
        return { ok: true, loggedIn: !!data.user, message: data.message || '' }
      }
      return { ok: false, error: data.error || '' }
    },
    async logout() {
      try {
        await authApi.logout()
      } catch {
        /* ignore */
      }
      this.setAnonymous()
    },
    async resendVerification() {
      const { data } = await authApi.resend()
      return data.message || ''
    },
  },
})
