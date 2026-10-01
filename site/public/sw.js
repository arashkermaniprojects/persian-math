// Kamangir service worker: no third-party requests exist, so only same-origin GETs are handled.
// - Pages: network first (fresh when online), cache fallback (works through shutdowns).
// - Everything else (hashed JS/CSS, fonts): cache first.
// - On request from a page, download every file of that page's locale (dist/precache.json),
//   so the whole academy works offline after one visit.
const PREFIX = 'kamangir-';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (e) => {
  if (e.data?.type === 'precache') e.waitUntil(precache(e.data.locale));
});

async function precache(locale) {
  const res = await fetch('/precache.json', { cache: 'no-store' });
  if (!res.ok) return;
  const manifest = await res.json();
  const name = PREFIX + manifest.version;
  const cache = await caches.open(name);
  const urls = [...manifest.shared, ...(manifest[locale] || [])];
  const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  // Small batches keep low-end phones and slow links responsive.
  const todo = urls.filter((u) => !have.has(u));
  for (let i = 0; i < todo.length; i += 6) await Promise.all(todo.slice(i, i + 6).map((u) => cache.add(u).catch(() => {})));
  // Drop caches from older builds once the new one is complete.
  for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== name) await caches.delete(k);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.keys().then((ks) => ks.find((k) => k.startsWith(PREFIX)) || PREFIX + 'runtime').then((k) => caches.open(k)).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(new URL('./', req.url).pathname)))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PREFIX + 'runtime').then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
