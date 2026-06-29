import { createRouter, createWebHistory } from 'vue-router'
import PlannerView from '@/views/PlannerView.vue'

const routes = [
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
