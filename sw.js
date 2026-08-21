/* Service Worker — Painel de Suporte (PWA)
   Estratégia:
   - Navegação: network-first (sempre busca versão nova; fallback para cache offline)
   - Estáticos (mesmo domínio + CDNs): stale-while-revalidate
   - /api/* e métodos não-GET: sempre pela rede (nunca cacheia)
*/
const CACHE = 'painel-suporte-v42';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/styles.css',
  '/static/desafio-diario.css?v=42',
  '/static/home.css',
  '/static/css/tokens.css',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Só lida com GET
  if (req.method !== 'GET') return;

  // API sempre pela rede
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Navegação: network-first
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Demais GET (estáticos, CDNs): stale-while-revalidate
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
