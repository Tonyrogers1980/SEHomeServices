const CACHE = 'clearround-v7';
const PRECACHE = ['/SEHomeServices/', '/SEHomeServices/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Always go network-first for HTML so app always updates.
  // cache:'no-store' is essential here — without it, fetch() still honours the
  // browser's ordinary HTTP cache (GitHub Pages sends ~10min max-age), so
  // "network-first" was silently serving a stale disk-cached response instead
  // of actually hitting the network. no-store forces a real round-trip every time.
  if (e.request.url.includes('index.html') || e.request.url.endsWith('/SEHomeServices/') || e.request.url.endsWith('/SEHomeServices')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Network-first for Supabase/n8n API calls — never cache
  if (e.request.url.includes('supabase.co') || e.request.url.includes('n8n.cloud')) {
    return;
  }
  // Cache-first for static assets (logo, manifest)
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

self.addEventListener('push', e => {
  let data = { title: 'ClearRound', body: '', url: '/SEHomeServices/' };
  try { data = { ...data, ...e.data.json() }; } catch (err) { /* fall back to defaults */ }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/SEHomeServices/logo.png',
      badge: '/SEHomeServices/logo.png',
      data: { url: data.url || '/SEHomeServices/' },
      tag: data.tag || undefined
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data && e.notification.data.url ? e.notification.data.url : '/SEHomeServices/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes('/SEHomeServices/') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

