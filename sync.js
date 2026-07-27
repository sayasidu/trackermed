/* TrackerMed · sincronização na nuvem (Firebase Auth + Firestore)
 *
 * Carregado em TODAS as páginas (site e app). Depois que o aluno entra na conta
 * (o login fica na tela Conta do app — app.html#/sync), este script mantém as
 * chaves trackermed.* do localStorage espelhadas em
 * users/{uid}/kv/{chave} no Firestore, em cada aparelho logado.
 *
 * Como funciona:
 * - Intercepta localStorage.setItem/removeItem: qualquer gravação das páginas
 *   marca a chave como "suja" e agenda um envio (debounce). Nenhuma página
 *   precisou mudar por causa disso.
 * - Cada chave vira um documento {v, del, up}: valor bruto, tombstone de
 *   remoção e timestamp da última alteração. Conflito entre aparelhos é
 *   resolvido chave a chave: o timestamp maior vence (last-write-wins).
 * - Um listener em tempo real aplica no aparelho o que chegar mais novo da
 *   nuvem (evento 'tmsync' avisa a interface para re-renderizar).
 * - Primeiro login num aparelho com dados dos dois lados: o app pergunta se
 *   traz os da nuvem ou envia os do aparelho — nunca sobrescreve sem
 *   perguntar. (Nas páginas do site não há como perguntar; a sincronização só
 *   ativa depois dessa escolha, feita uma única vez no app.)
 * - Offline: o cache local do Firestore enfileira as gravações e envia quando
 *   a conexão voltar.
 *
 * As chaves do firebaseConfig são públicas por design — a segurança está nas
 * regras do Firestore (só o próprio usuário lê/escreve users/{uid}/**).
 */
(function () {
  'use strict';

  var FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDcYSwrdq2EM0sDj8yWuz4fVbMTR3RrcFE',
    authDomain: 'trackermed-b335e.firebaseapp.com',
    projectId: 'trackermed-b335e',
    storageBucket: 'trackermed-b335e.firebasestorage.app',
    messagingSenderId: '141430143681',
    appId: '1:141430143681:web:c8b7ee142d3cf60a72f240'
  };
  var SDK_BASE = 'https://www.gstatic.com/firebasejs/11.1.0/';
  var PUSH_DEBOUNCE_MS = 2500;

  var META_KEY = 'trackermed.sync.meta.v1';
  // Chaves que NÃO sincronizam: estado do cronômetro em andamento (é do
  // aparelho), tema (preferência do aparelho) e o próprio meta.
  var EXCLUDE = { 'trackermed.app.timer.v1': 1, 'trackermed.theme.v1': 1 };
  EXCLUDE[META_KEY] = 1;
  var EXTRA_KEYS = { 'planejamento.disponibilidade': 1 };

  function tracked(k) {
    return typeof k === 'string' && !EXCLUDE[k] &&
      (k.indexOf('trackermed.') === 0 || EXTRA_KEYS[k] === 1);
  }

  // Acesso "cru" ao storage, por baixo do patch (evita loop ao aplicar remoto).
  var _set = Storage.prototype.setItem;
  var _del = Storage.prototype.removeItem;
  function rawGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function rawSet(k, v) { try { _set.call(localStorage, k, v); } catch (e) {} }
  function rawDel(k) { try { _del.call(localStorage, k); } catch (e) {} }

  function loadMeta() {
    try { return JSON.parse(rawGet(META_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveMeta() { rawSet(META_KEY, JSON.stringify(meta)); }
  var meta = loadMeta();               // {uid, initialized, last, keys:{k:ts}, local:{k:ts}}
  if (!meta.keys) meta.keys = {};
  if (!meta.local) meta.local = {};

  var fb = null;                       // {auth, db, fns} depois do SDK carregar
  var user = null;
  var state = 'carregando';            // carregando|indisponivel|signedout|aguardando-escolha|sincronizando|ok|offline|erro
  var dirty = {};                      // chave -> ts (mudanças locais pendentes)
  var pushTimer = null;
  var applying = false;                // aplicando dados remotos (não marcar sujo)
  var chooser = null;                  // registrado pelo app: () => Promise<'nuvem'|'aparelho'>
  var unsubSnap = null;
  var started = false;

  function emit(extra) {
    var d = { state: state, email: user ? user.email : null, last: meta.last || null };
    if (extra) for (var k in extra) d[k] = extra[k];
    try { window.dispatchEvent(new CustomEvent('tmsync', { detail: d })); } catch (e) {}
  }
  function setState(s, extra) { state = s; emit(extra); }

  // ---- Rastreio de mudanças locais ----------------------------------------
  Storage.prototype.setItem = function (k, v) {
    _set.apply(this, arguments);
    if (this === window.localStorage && !applying && tracked(k)) note(k);
  };
  Storage.prototype.removeItem = function (k) {
    _del.apply(this, arguments);
    if (this === window.localStorage && !applying && tracked(k)) note(k);
  };
  window.addEventListener('storage', function (e) {
    if (e && e.key && tracked(e.key) && !applying) note(e.key);
  });

  function note(k) {
    var ts = Date.now();
    dirty[k] = ts;
    meta.local[k] = ts;
    saveMeta();
    schedulePush();
  }
  function schedulePush() {
    if (!user || !fb || !meta.initialized) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(pushDirty, PUSH_DEBOUNCE_MS);
  }

  // ---- Envio / aplicação --------------------------------------------------
  function docRefFor(k) { return fb.fns.doc(fb.db, 'users', user.uid, 'kv', k); }

  function pushKey(k, ts) {
    var v = rawGet(k);
    var data = { up: ts || meta.local[k] || Date.now() };
    if (v == null) { data.del = true; data.v = null; }
    else { data.del = false; data.v = v; }
    return fb.fns.setDoc(docRefFor(k), data).then(function () {
      meta.keys[k] = data.up;
      delete dirty[k];
      meta.last = Date.now();
      saveMeta();
    });
  }

  function pushDirty() {
    if (!user || !fb || !meta.initialized) return Promise.resolve();
    var keys = Object.keys(dirty);
    if (!keys.length) return Promise.resolve();
    setState('sincronizando');
    return Promise.all(keys.map(function (k) { return pushKey(k, dirty[k]); }))
      .then(function () { setState('ok'); })
      .catch(function (e) { console.warn('[tmsync] envio falhou', e); setState(navigator.onLine ? 'erro' : 'offline'); });
  }

  function applyRemote(k, data) {
    if (!tracked(k)) return false;
    var known = meta.keys[k] || 0;
    var localTs = meta.local[k] || 0;
    var up = data.up || 0;
    if (up <= known) return false;          // já temos essa versão
    if (localTs > up) {                     // local é mais novo: local vence, envia
      dirty[k] = localTs;
      schedulePush();
      return false;
    }
    applying = true;
    try {
      if (data.del) rawDel(k); else rawSet(k, data.v == null ? '' : data.v);
    } finally { applying = false; }
    meta.keys[k] = up;
    meta.local[k] = up;
    delete dirty[k];
    meta.last = Date.now();
    saveMeta();
    return true;
  }

  function listen() {
    if (unsubSnap) { unsubSnap(); unsubSnap = null; }
    var col = fb.fns.collection(fb.db, 'users', user.uid, 'kv');
    unsubSnap = fb.fns.onSnapshot(col, function (snap) {
      var applied = 0;
      snap.docChanges().forEach(function (ch) {
        if (ch.type === 'removed') return;
        if (ch.doc.metadata && ch.doc.metadata.hasPendingWrites) return; // eco local
        if (applyRemote(ch.doc.id, ch.doc.data())) applied++;
      });
      if (applied > 0) { setState('ok', { applied: applied }); }
    }, function (err) {
      console.warn('[tmsync] listener', err);
      setState(navigator.onLine ? 'erro' : 'offline');
    });
  }

  function localTrackedKeys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (tracked(k)) out.push(k);
      }
    } catch (e) {}
    return out;
  }

  function fetchCloud() {
    var col = fb.fns.collection(fb.db, 'users', user.uid, 'kv');
    return fb.fns.getDocs(col).then(function (snap) {
      var docs = {};
      snap.forEach(function (d) { docs[d.id] = d.data(); });
      return docs;
    });
  }

  // Sincronização completa: mescla nuvem × aparelho chave a chave (mais novo vence).
  function fullSync() {
    setState('sincronizando');
    return fetchCloud().then(function (cloud) {
      var ops = [];
      var seen = {};
      Object.keys(cloud).forEach(function (k) {
        seen[k] = 1;
        applyRemote(k, cloud[k]);
        var localTs = meta.local[k] || 0;
        if (localTs > (cloud[k].up || 0)) ops.push(pushKey(k, localTs));
      });
      localTrackedKeys().forEach(function (k) {
        if (!seen[k] && !(meta.keys[k] > 0)) ops.push(pushKey(k)); // só existe aqui: envia
        else if (!seen[k] && meta.keys[k] > 0) {
          // existia na nuvem e sumiu de lá — remoção remota já tratada por tombstone;
          // sem tombstone (doc apagado à mão), mantém o local e reenvia.
          ops.push(pushKey(k));
        }
      });
      return Promise.all(ops);
    }).then(function () {
      meta.last = Date.now();
      saveMeta();
      setState('ok');
    }).catch(function (e) {
      console.warn('[tmsync] fullSync', e);
      setState(navigator.onLine ? 'erro' : 'offline');
      throw e;
    });
  }

  // ---- Primeiro login neste aparelho --------------------------------------
  function firstSync() {
    setState('sincronizando');
    return fetchCloud().then(function (cloud) {
      var cloudKeys = Object.keys(cloud).filter(function (k) { return !cloud[k].del; });
      var localKeys = localTrackedKeys();

      function adoptCloud() {
        applying = true;
        try {
          localKeys.forEach(function (k) { if (!cloud[k]) rawDel(k); });
        } finally { applying = false; }
        meta.keys = {}; meta.local = {}; dirty = {};
        Object.keys(cloud).forEach(function (k) { applyRemote(k, cloud[k]); });
        return Promise.resolve();
      }
      function adoptDevice() {
        var now = Date.now();
        var ops = localKeys.map(function (k) { meta.local[k] = now; return pushKey(k, now); });
        cloudKeys.forEach(function (k) {
          if (localKeys.indexOf(k) === -1) ops.push(fb.fns.setDoc(docRefFor(k), { del: true, v: null, up: now }));
        });
        return Promise.all(ops);
      }
      function finish() {
        meta.uid = user.uid;
        meta.initialized = true;
        meta.last = Date.now();
        saveMeta();
        setState('ok', { applied: 1 });
        listen();
      }

      if (!cloudKeys.length) return adoptDevice().then(finish);   // nuvem vazia: sobe o aparelho
      if (!localKeys.length) return adoptCloud().then(finish);    // aparelho vazio: desce a nuvem
      if (!chooser) { setState('aguardando-escolha'); return null; } // site: espera o app decidir
      return chooser().then(function (escolha) {
        return (escolha === 'nuvem' ? adoptCloud() : adoptDevice()).then(finish);
      });
    }).catch(function (e) {
      console.warn('[tmsync] firstSync', e);
      setState(navigator.onLine ? 'erro' : 'offline');
    });
  }

  function onUser(u) {
    user = u;
    if (unsubSnap) { unsubSnap(); unsubSnap = null; }
    if (!u) { setState('signedout'); return; }
    if (meta.uid && meta.uid !== u.uid) {
      // Conta diferente da última usada neste aparelho: recomeça o pareamento.
      meta = { keys: {}, local: {} };
      saveMeta();
    }
    if (!meta.initialized || meta.uid !== u.uid) { firstSync(); return; }
    fullSync().then(listen).catch(function () { listen(); });
  }

  // ---- Carga do SDK -------------------------------------------------------
  function start() {
    if (started) return; started = true;
    Promise.all([
      import(SDK_BASE + 'firebase-app.js'),
      import(SDK_BASE + 'firebase-auth.js'),
      import(SDK_BASE + 'firebase-firestore.js')
    ]).then(function (mods) {
      var appM = mods[0], authM = mods[1], fsM = mods[2];
      var app = appM.initializeApp(FIREBASE_CONFIG);
      var db;
      try {
        db = fsM.initializeFirestore(app, {
          localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() })
        });
      } catch (e) { db = fsM.getFirestore(app); }
      fb = {
        auth: authM.getAuth(app),
        db: db,
        fns: {
          doc: fsM.doc, collection: fsM.collection, setDoc: fsM.setDoc,
          getDocs: fsM.getDocs, onSnapshot: fsM.onSnapshot
        },
        authFns: authM
      };
      authM.onAuthStateChanged(fb.auth, onUser);
    }).catch(function (e) {
      console.warn('[tmsync] SDK indisponível (offline?)', e);
      setState('indisponivel');
    });
  }

  window.addEventListener('online', function () { if (user && fb && meta.initialized) fullSync().catch(function () {}); });
  window.addEventListener('pagehide', function () { if (pushTimer) { clearTimeout(pushTimer); pushDirty(); } });

  var ERROS_PT = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/missing-password': 'Digita a senha.',
    'auth/weak-password': 'Senha fraca — usa pelo menos 6 caracteres.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Usa "Entrar".',
    'auth/user-not-found': 'Conta não encontrada. Confere o e-mail ou usa "Criar conta".',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas — espera um pouco e tenta de novo.',
    'auth/network-request-failed': 'Sem conexão. Tenta de novo quando a internet voltar.'
  };
  function ptError(e) {
    return (e && e.code && ERROS_PT[e.code]) || 'Não deu certo (' + ((e && e.code) || 'erro') + '). Tenta de novo.';
  }

  // ---- API pública (usada pelo app.html) ----------------------------------
  window.TrackerMedSync = {
    state: function () { return state; },
    user: function () { return user ? { email: user.email, uid: user.uid } : null; },
    last: function () { return meta.last || null; },
    registerChooser: function (fn) {
      chooser = fn;
      if (user && state === 'aguardando-escolha') firstSync();
    },
    login: function (email, senha) {
      if (!fb) return Promise.reject(new Error('Sincronização indisponível sem internet.'));
      return fb.authFns.signInWithEmailAndPassword(fb.auth, email, senha)
        .catch(function (e) { throw new Error(ptError(e)); });
    },
    signup: function (email, senha) {
      if (!fb) return Promise.reject(new Error('Sincronização indisponível sem internet.'));
      return fb.authFns.createUserWithEmailAndPassword(fb.auth, email, senha)
        .catch(function (e) { throw new Error(ptError(e)); });
    },
    logout: function () {
      if (!fb) return Promise.resolve();
      return fb.authFns.signOut(fb.auth);
    },
    syncNow: function () {
      if (!user || !fb) return Promise.resolve();
      if (!meta.initialized) return firstSync();
      return pushDirty().then(fullSync);
    }
  };

  start();
})();
