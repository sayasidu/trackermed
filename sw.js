/* TrackerMed · service worker
 * Deixa o site funcionar offline (premissa do app): as páginas são pré-cacheadas
 * na instalação; navegação tenta a rede primeiro (pra pegar atualização) e cai
 * pro cache sem conexão; fontes do Google ficam em cache de runtime após o
 * primeiro uso. Ao publicar mudanças, subir a versão abaixo troca o cache.
 */
const VERSION = 'trackermed-v3';
const CORE = [
  './',
  'index.html',
  'app.html',
  'dashboard.html',
  'plannerstudy.html',
  'disciplinas.html',
  'revisoes.html',
  'historico.html',
  'graficos.html',
  'planos.html',
  'simulados.html',
  'cortex-simulados.html',
  'app.css',
  'theme.js',
  'pwa.js',
  'sync.js',
  'favicon.png',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fontes do Google e o SDK do Firebase (www.gstatic.com/firebasejs) entram em
// cache na primeira visita online — assim o app instalado abre offline inteiro.
const isCachedCdn = url =>
  url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' ||
  (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // CDNs fixos (fontes, SDK): cache-first; guarda na primeira visita online.
  if (isCachedCdn(url)) {
    e.respondWith(
      caches.open(VERSION).then(c =>
        c.match(req).then(hit =>
          hit || fetch(req).then(res => { c.put(req, res.clone()); return res; })
        )
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegação: rede primeiro (atualizações), cache como fallback offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(hit => hit || caches.match('app.html'))
        )
    );
    return;
  }

  // Demais assets do site: cache-first com atualização em segundo plano.
  e.respondWith(
    caches.open(VERSION).then(c =>
      c.match(req).then(hit => {
        const refetch = fetch(req)
          .then(res => { c.put(req, res.clone()); return res; })
          .catch(() => hit);
        return hit || refetch;
      })
    )
  );
});
