/* TrackerMed · registro do service worker (carregado em todas as páginas). */
(function () {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {
      /* sem SW (ex.: file://) o site segue funcionando normalmente */
    });
  });
})();
