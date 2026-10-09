const CACHE_NAME = 'comm-cache-v1';
// Local shell — install fails if these can't be cached (the app can't run without them).
const CORE_ASSETS = ['./', './index.html', './data.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];
// CDN — cached opportunistically; one flaky CDN must never block install.
const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js',
  'https://cdn.jsdelivr.net/npm/@azure/msal-browser@3.18.0/lib/msal-browser.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(CORE_ASSETS.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => (r && r.ok) ? cache.put(u, r) : null)))
        .then(() => Promise.all(CDN_ASSETS.map(u => cache.add(u).catch(() => console.warn('SW cdn skip', u)))))
    )
    // No skipWaiting(): the page shows an Update banner so a reload never interrupts data entry.
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isShell(req) {
  if (req.mode === 'navigate') return true;
  const u = new URL(req.url);
  return u.origin === self.location.origin && (u.pathname.endsWith('/') || u.pathname.endsWith('index.html') || u.pathname.endsWith('data.js'));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (/graph\.microsoft\.com|login\.microsoftonline\.com|login\.live\.com/.test(u.hostname)) return;

  // Network-first for the shell (index.html + data.js) so the newest build loads when online.
  if (isShell(req)) {
    event.respondWith(
      fetch(new Request(req.url, { cache: 'no-store', credentials: 'same-origin' })).then(res => {
        if (res && res.status === 200) { const c = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, c)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(c => c || caches.match('./index.html')))
    );
    return;
  }
  // Cache-first for everything else.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.status === 200 && (u.origin === self.location.origin || res.type === 'cors')) {
        const c = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, c));
      }
      return res;
    }))
  );
});
