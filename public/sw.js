// Service worker for PWA support.
//
// IMPORTANT: navigation requests (HTML pages) always go to the network
// so Cloudflare Access can intercept and enforce authentication. Only
// static assets (JS, CSS, images, fonts) are cached for offline speed.

const CACHE_NAME = 'diet-planner-v2'

self.addEventListener('install', () => {
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

  // Never cache API calls, auth flows, or Access endpoints
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/cdn-cgi/')) {
    return
  }

  // Navigation requests (HTML pages) MUST go to network so Access can
  // enforce login. If the network fails, fall back to cache.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Static assets (JS, CSS, images): cache-first for speed
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached
      return fetch(e.request).then((response) => {
        if (response.ok && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone))
        }
        return response
      })
    })
  )
})
