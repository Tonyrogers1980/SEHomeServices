const CACHE = 'clearround-v9';
const PRECACHE = ['/SEHomeServices/', '/SEHomeServices/index.html', '/SEHomeServices/badge.png', '/SEHomeServices/icon-192.png'];

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
  let data = { title: 'ClearRound', body: '', url: '/SEHomeServices/', kind: '' };
  try { data = { ...data, ...e.data.json() }; } catch (err) { /* fall back to defaults */ }

  // Per-type presentation. `kind` is sent by the poller (escalation | new_lead | stale_response).
  const KINDS = {
    escalation:     { prefix: '🔴', vibrate: [200, 100, 200, 100, 200], requireInteraction: true },
    new_lead:       { prefix: '🟡', vibrate: [200, 100, 200] },
    stale_response: { prefix: '⏰', vibrate: [300, 150, 300] }
  };
  const style = KINDS[data.kind] || { prefix: '', vibrate: [200, 100, 200] };
  const title = style.prefix ? style.prefix + ' ' + data.title : data.title;

  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body,
      icon: '/SEHomeServices/icon-192.png',
      badge: '/SEHomeServices/badge.png',
      vibrate: style.vibrate,
      timestamp: Date.now(),
      requireInteraction: !!style.requireInteraction,
      // Group by conversation so repeat alerts replace rather than stack up.
      tag: data.tag || data.conversation_id || undefined,
      renotify: true,
      data: { url: data.url || '/SEHomeServices/', kind: data.kind || '' },
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
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

