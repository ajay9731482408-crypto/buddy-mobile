/* Offline support. Network first: when the phone is online it always gets the newest files, and it saves a copy.
   When it is offline it uses the saved copy. Cloud calls go to another address and are never cached.
   Bump V when the list of files changes, so old caches are removed. */
const V = 'buddy-mobile-v4';
const SHELL = ['./', './index.html', './logic.js', './plus.js', './cloud.js', './voice.js', './vfx.js', './icons.js', './app.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) caches.open(V).then((c) => c.put(e.request, r.clone()));
    return r;
  }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html'))));
});
