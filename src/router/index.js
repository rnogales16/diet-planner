import { createRouter, createWebHistory } from 'vue-router'
import PlannerView from '@/views/PlannerView.vue'
import { useAuthStore } from '@/stores/authStore'

const routes = [
  // Public auth screens (bare layout: no app chrome). Reachable without a session.
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { public: true, bare: true, title: { es: 'Iniciar sesión', en: 'Log in' } },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/auth/RegisterView.vue'),
    meta: { public: true, bare: true, title: { es: 'Crear cuenta', en: 'Sign up' } },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/auth/ForgotPasswordView.vue'),
    meta: { public: true, bare: true, title: { es: 'Recuperar contraseña', en: 'Reset password' } },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/auth/ResetPasswordView.vue'),
    meta: { public: true, bare: true, title: { es: 'Nueva contraseña', en: 'New password' } },
  },
  {
    path: '/',
    name: 'planner',
    component: PlannerView,
    meta: {
      title: { es: 'Planificador semanal', en: 'Weekly Planner' },
    },
  },
  {
    path: '/generate',
    name: 'generate',
    component: () => import('@/views/GenerateView.vue'),
    meta: {
      title: { es: 'Generar dieta con IA', en: 'AI Diet Generator' },
    },
  },
  {
    path: '/shopping',
    name: 'shopping',
    component: () => import('@/views/ShoppingView.vue'),
    meta: {
      title: { es: 'Lista de la compra', en: 'Shopping List' },
    },
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: () => import('@/views/FavoritesView.vue'),
    meta: {
      title: { es: 'Recetas favoritas', en: 'Favorite Recipes' },
    },
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/SearchView.vue'),
    meta: {
      title: { es: 'Buscar recetas', en: 'Search Recipes' },
    },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: {
      title: { es: 'Historial de dietas', en: 'Diet History' },
    },
  },
  {
    path: '/nutrition',
    name: 'nutrition',
    component: () => import('@/views/NutritionChatView.vue'),
    meta: {
      title: { es: 'Consulta nutricional', en: 'Nutrition Consultant' },
    },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: {
      title: { es: 'Ajustes', en: 'Settings' },
    },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// UX guard (not the security boundary — the backend still returns 401). Redirects
// anonymous users to /login and keeps authenticated users out of login/register.
// Auth state comes from the auth store, hydrated once at startup from /api/auth/me.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  // Wait for the initial /me to resolve before deciding — otherwise the very
  // first navigation runs while auth is still 'unknown' and wrongly redirects.
  await auth.ensureLoaded()
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  if (auth.isAuthenticated && (to.name === 'login' || to.name === 'register')) {
    return { path: '/' }
  }
  return true
})

router.afterEach((to) => {
  const lang = document.documentElement.getAttribute('lang') || 'en'
  const metaTitle = to.meta?.title
  if (metaTitle) {
    const pageTitle = metaTitle[lang] || metaTitle.en || ''
    document.title = pageTitle ? `${pageTitle} | Nutriplania` : 'Nutriplania'
  } else {
    document.title = 'Nutriplania'
  }
})

export default router
