const version = 'ritm-offline-v3';
const files = ['./', './index.html', './style.css?v=3', './system.css?v=3', './app.js?v=3', './training.js?v=3', './manifest.webmanifest', './icon-180.png?v=3', './icon-192.png?v=3', './icon-512.png?v=3'];
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(version);
  await cache.addAll(files);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('ritm-offline-') && name !== version) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  if (event.request.mode === 'navigate') {
    if (!['./', './index.html'].some(file => new URL(file, self.registration.scope).pathname === url.pathname)) return;
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
  } else {
    event.respondWith(caches.match(event.request).then(cached => cached ?? fetch(event.request)));
  }
});
