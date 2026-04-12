// Basic service worker for offline shell caching.
// We cache the app shell (HTML, CSS, JS) so the app loads instantly on
// repeat visits. API calls still go to the network (meal plans, sync, etc).

const CACHE_NAME = 'diet-planner-v1'
const SHELL_ASSETS = ['/', '/index.html']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Never cache API calls, D1 sync, or auth flows
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/cdn-cgi/')) {
    return
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone))
        }
        return response
      }).catch(() => cached)
      return cached || fetched
    })
  )
})
