/* Plantão OSCE · runtime fora do Claude
 *
 * O jogo (PlantaoOSCE.html) foi escrito para rodar como artifact dentro do
 * Claude, que entrega três coisas pela função window.claude.use(nome):
 *   - "sample"    → a IA (examinador, paciente, tutor e correção)
 *   - "tts"       → a voz que lê as respostas
 *   - "dictation" → o microfone que transcreve a fala
 * Aberto pelo site, nada disso existe. Este arquivo cria um window.claude com
 * o mesmo formato, usando:
 *   - a API da Anthropic, com a chave da própria pessoa (guardada só neste
 *     navegador, em localStorage, e enviada apenas para api.anthropic.com);
 *   - a voz do navegador (speechSynthesis);
 *   - o reconhecimento de fala do navegador (SpeechRecognition).
 * Dentro do Claude este arquivo não faz nada: o runtime de lá tem prioridade.
 *
 * "db" e "user" ficam de fora de propósito: sem eles o jogo já guarda as
 * fichas e as notas no localStorage do navegador.
 */
(function () {
  'use strict';
  if (window.claude && typeof window.claude.use === 'function') return;

  /* ================= chave da API ================= */
  var KEY = 'osce.apikey';
  var memKey = '';
  function getKey() { try { return localStorage.getItem(KEY) || memKey; } catch (e) { return memKey; } }
  function setKey(v) {
    memKey = v || '';
    try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {}
    paintBar();
  }

  /* ================= IA: API da Anthropic ================= */
  /* O jogo pede três níveis ("quick", "default", "complex"); cada um vira um modelo. */
  var MODELS = { quick: 'claude-haiku-5-5', default: 'claude-sonnet-5-5', complex: 'claude-opus-5-5' };
  var EFFORT = { quick: 'low', default: 'low', complex: 'medium' };
  /* Nestes modelos a API oferece troca automática de modelo quando um filtro de
     segurança recusa a resposta; sem isso uma recusa encerraria a fala. */
  var HAS_FALLBACK = { 'claude-sonnet-5-5': true, 'claude-opus-5-5': true };
  var FALLBACK_BETA = 'server-side-fallback-2026-07-01';

  var sdkP = null;
  function loadSdk() {
    if (!sdkP) sdkP = import('./osce-sdk.mjs').then(function (m) { return m.default; });
    return sdkP.catch(function (e) { sdkP = null; throw e; });
  }

  function textOf(message) {
    return (message.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
  }

  async function streamOnce(client, params, useFallback, opts, live) {
    var req = { signal: opts.signal };
    var stream = useFallback
      ? client.beta.messages.stream(Object.assign({ betas: [FALLBACK_BETA], fallbacks: 'default' }, params), req)
      : client.messages.stream(params, req);
    stream.on('text', function (delta) {
      live.text += delta;
      if (opts.onText) { try { opts.onText({ text: live.text, delta: delta }); } catch (e) {} }
    });
    return stream.finalMessage();
  }

  async function ask(input, opts) {
    opts = opts || {};
    if (opts.signal && opts.signal.aborted) throw { code: 'cancelled', message: 'Cancelado.' };
    var key = getKey();
    if (!key) key = await askKey();
    if (!key) throw { code: 'no_key', message: 'Sem chave da API.' };

    var Anthropic;
    try { Anthropic = await loadSdk(); }
    catch (e) { throw { code: 'upstream_error', message: 'Não consegui carregar o cliente da API.' }; }

    var tier = MODELS[opts.modelTier] ? opts.modelTier : 'default';
    var model = MODELS[tier];
    var messages = typeof input === 'string'
      ? [{ role: 'user', content: input }]
      : input.map(function (m) { return { role: m.role, content: String(m.content) }; });
    var params = {
      model: model,
      max_tokens: 32000,
      /* a ficha vai inteira no começo de toda chamada: com cache, as falas seguintes pagam só o trecho novo */
      cache_control: { type: 'ephemeral' },
      output_config: { effort: EFFORT[tier] },
      messages: messages
    };
    var client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    var live = { text: '' };
    var message;
    try {
      try {
        message = await streamOnce(client, params, !!HAS_FALLBACK[model], opts, live);
      } catch (e) {
        /* se a conta não aceitar a troca automática de modelo, repete a chamada sem ela */
        if (HAS_FALLBACK[model] && e instanceof Anthropic.BadRequestError && !live.text) {
          message = await streamOnce(client, params, false, opts, live);
        } else throw e;
      }
    } catch (e) {
      if (e instanceof Anthropic.APIUserAbortError) throw { code: 'cancelled', message: 'Cancelado.', text: live.text };
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
        notice('A Anthropic não aceitou esta chave. Confira se ela está inteira e ativa.', 'Trocar chave', openKeyDialog);
        throw { code: 'bad_key', message: 'Chave recusada.' };
      }
      if (e instanceof Anthropic.RateLimitError) throw { code: 'rate_limited', message: 'Limite de uso.' };
      if (e instanceof Anthropic.ContentTooLargeError) throw { code: 'prompt_too_large', message: 'Conversa longa demais.' };
      if (e instanceof Anthropic.APIConnectionError) throw { code: 'network', message: 'Sem conexão com a API.' };
      if (e instanceof Anthropic.APIError) {
        /* crédito esgotado, conta sem acesso ao modelo e casos parecidos chegam aqui: mostra o que a API disse */
        notice('A API da Anthropic respondeu com erro' + (e.status ? ' ' + e.status : '') + ': ' + String(e.message || '').slice(0, 300), 'Ver chave', openKeyDialog);
        throw { code: 'upstream_error', message: String(e.message || '') };
      }
      throw { code: 'upstream_error', message: String((e && e.message) || e) };
    }

    if (message.stop_reason === 'refusal') throw { code: 'refused', message: 'A IA recusou este conteúdo.' };
    var text = textOf(message) || live.text;
    if (!text.trim()) throw { code: 'empty_completion', message: 'A IA não respondeu.' };
    if (text !== live.text && opts.onText) { try { opts.onText({ text: text, delta: '' }); } catch (e) {} }
    clearNotice();
    return { text: text, truncated: message.stop_reason === 'max_tokens' };
  }

  /* Tira o JSON de dentro da resposta, mesmo que venha cercado de ``` ou de uma frase. */
  function parseJson(text) {
    var t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(t); } catch (e) {}
    var a = t.search(/[{[]/);
    if (a >= 0) {
      var close = t.charAt(a) === '{' ? '}' : ']', b = t.lastIndexOf(close);
      if (b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
    }
    throw { code: 'invalid_json', message: 'A resposta não veio em JSON.' };
  }

  function sample(input, opts) { return ask(input, opts); }
  sample.json = function (input, opts) {
    var extra = '\n\nResponda somente com o JSON válido, sem texto antes ou depois e sem cercas de código.';
    var inp = typeof input === 'string'
      ? input + extra
      : input.map(function (m, i) { return i === input.length - 1 ? { role: m.role, content: String(m.content) + extra } : m; });
    return ask(inp, opts).then(function (r) { return parseJson(r.text); });
  };
  sample.limits = function () { return Promise.resolve({ images: false }); };

  /* ================= voz: speechSynthesis ================= */
  function makeTts() {
    var synth = window.speechSynthesis;
    if (!synth || !window.SpeechSynthesisUtterance) return null;

    /* O jogo conhece quatro vozes pelo nome que o Claude dá a elas. Aqui cada nome
       vira uma voz em português do aparelho; quando só existe uma, o tom separa as personagens. */
    var NAMES = ['buttery', 'airy', 'glassy', 'rounded'];
    /* ordem em que os nomes pegam as vozes do aparelho: paciente (buttery) e banca (glassy) primeiro, para soarem diferentes já com duas vozes */
    var ORDER = ['buttery', 'glassy', 'airy', 'rounded'];
    var PITCH_SAME = { buttery: 1, airy: 1.2, glassy: 0.85, rounded: 0.7 };
    var PITCH_OWN = { buttery: 1, airy: 1.05, glassy: 0.97, rounded: 0.9 };
    var list = [];
    function loadVoices() {
      var all = [];
      try { all = synth.getVoices() || []; } catch (e) {}
      var br = all.filter(function (v) { return /^pt[-_]br/i.test(v.lang); });
      var pt = all.filter(function (v) { return /^pt/i.test(v.lang) && !/^pt[-_]br/i.test(v.lang); });
      var score = function (v) { return (/natural|neural|premium|enhanced/i.test(v.name) ? 0 : 2) + (/google|microsoft|luciana|francisca/i.test(v.name) ? 0 : 1); };
      br.sort(function (a, b) { return score(a) - score(b); });
      list = br.length ? br : pt;
    }
    loadVoices();
    try { synth.addEventListener('voiceschanged', loadVoices); } catch (e) {}

    var rate = 1, queue = [], current = null, state = 'idle', idleT = null, watch = null;
    var onStateL = [], onLineL = [];
    function fire(l, ev) { l.forEach(function (fn) { try { fn(ev); } catch (e) {} }); }
    function setState(s, reason) {
      clearTimeout(idleT);
      if (s === state) return;
      state = s; fire(onStateL, { state: s, reason: reason });
    }
    function clamp(r) { r = parseFloat(r); if (!(r > 0)) r = 1; return Math.min(1.5, Math.max(0.7, r)); }

    /* O Chrome corta falas longas no meio: cada linha vai em pedaços de até ~220 caracteres. */
    function pieces(text) {
      var out = [], parts = String(text).replace(/\s+/g, ' ').trim().match(/[^.!?…;:]+[.!?…;:]*["”)]?\s*/g) || [];
      var buf = '';
      parts.forEach(function (p) {
        while (p.length > 220) { var cut = p.lastIndexOf(' ', 220); if (cut < 60) cut = 220; out.push((buf + p.slice(0, cut)).trim()); buf = ''; p = p.slice(cut); }
        if ((buf + p).length > 220) { if (buf.trim()) out.push(buf.trim()); buf = p; } else buf += p;
      });
      if (buf.trim()) out.push(buf.trim());
      return out;
    }

    function enqueue(input, opts) {
      opts = opts || {};
      var lines = typeof input === 'string' ? [{ text: input }] : (Array.isArray(input) ? input : []);
      var job = { left: 0, resolve: null, reject: null, done: false };
      var p = new Promise(function (res, rej) { job.resolve = res; job.reject = rej; });
      lines.forEach(function (ln, idx) {
        if (!ln || !ln.text) return;
        pieces(ln.text).forEach(function (chunk, ci) {
          queue.push({ job: job, text: chunk, first: ci === 0, line: idx, id: ln.id, voice: ln.voice || opts.voice || 'buttery', lang: ln.language || opts.language || 'pt-BR', rate: ln.rate || opts.rate });
          job.left++;
        });
      });
      if (!job.left) { job.done = true; job.resolve(); return p; }
      setState('speaking');
      pump();
      return p;
    }
    function finishItem(item) {
      clearTimeout(watch);
      if (current !== item) return;
      current = null;
      if (!item.job.done && --item.job.left <= 0) { item.job.done = true; item.job.resolve(); }
      if (queue.length) pump();
      else { clearTimeout(idleT); idleT = setTimeout(function () { if (!current && !queue.length) setState('idle', 'completed'); }, 160); }
    }
    function pump() {
      if (current || !queue.length) return;
      var item = queue.shift(); current = item;
      if (!list.length) loadVoices();
      var u = new SpeechSynthesisUtterance(item.text);
      var i = Math.max(0, ORDER.indexOf(item.voice)), n = list.length;
      var own = n > 0 && (i === 0 || i % n !== 0);
      if (n) u.voice = list[i % n];
      u.lang = (n && u.voice && u.voice.lang) || item.lang || 'pt-BR';
      u.pitch = (own ? PITCH_OWN : PITCH_SAME)[ORDER[i]] || 1;
      u.rate = clamp(item.rate || rate);
      u.onend = function () { finishItem(item); };
      u.onerror = function (ev) {
        var err = ev && ev.error;
        if (err === 'not-allowed') { failAll({ code: 'no_gesture', message: 'O navegador pede um toque antes de falar.' }, 'no_gesture'); return; }
        finishItem(item);
      };
      if (item.first) fire(onLineL, { line: item.line, id: item.id });
      try { synth.resume(); synth.speak(u); } catch (e) { finishItem(item); return; }
      /* às vezes o navegador não avisa que terminou: segue adiante sozinho */
      clearTimeout(watch);
      watch = setTimeout(function () { if (current === item) { try { synth.cancel(); } catch (e) {} finishItem(item); } }, 4000 + item.text.length * 130 / u.rate);
    }
    function failAll(err, reason) {
      var jobs = [];
      if (current && !current.job.done) jobs.push(current.job);
      queue.forEach(function (it) { if (!it.job.done && jobs.indexOf(it.job) < 0) jobs.push(it.job); });
      queue = []; current = null; clearTimeout(watch);
      try { synth.cancel(); } catch (e) {}
      jobs.forEach(function (j) { j.done = true; j.reject(err); });
      setState('idle', reason);
    }

    return {
      speak: function (input, opts) {
        if (current || queue.length) failAll({ code: 'replaced', message: 'Outra leitura começou.' }, 'replaced');
        return enqueue(input, opts);
      },
      add: function (input, opts) { return enqueue(input, opts); },
      stop: function () { failAll({ code: 'stopped', message: 'Leitura parada.' }, 'stopped'); return Promise.resolve(); },
      pause: function () { try { synth.pause(); } catch (e) {} if (state === 'speaking') setState('paused'); return Promise.resolve(); },
      resume: function () { try { synth.resume(); } catch (e) {} if (state === 'paused') setState('speaking'); return Promise.resolve(); },
      setRate: function (r) { rate = clamp(r); },
      voices: function () { return Promise.resolve(NAMES.slice()); },
      onState: function (fn) { onStateL.push(fn); },
      onLine: function (fn) { onLineL.push(fn); },
      onPosition: function () {}
    };
  }

  /* ================= microfone: SpeechRecognition ================= */
  function makeDictation() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    var MAX_MS = 10 * 60 * 1000;
    /* no Android o modo contínuo repete o que já foi dito: lá cada frase é uma escuta nova */
    var continuous = !/Android/i.test(navigator.userAgent);
    var rec = null, state = 'idle', denied = false, wantStop = false, startedAt = 0, lang = 'pt-BR', quick = 0;
    var onPartialL = [], onFinalL = [], onStateL = [], stopWaiters = [];
    function fire(l, ev) { l.forEach(function (fn) { try { fn(ev); } catch (e) {} }); }
    function setState(s, reason) { if (s === state) return; state = s; fire(onStateL, { state: s, reason: reason }); }
    function end(reason) {
      rec = null;
      fire(onPartialL, { text: '' });
      setState('idle', reason);
      var w = stopWaiters; stopWaiters = []; w.forEach(function (fn) { fn(); });
    }

    function open(resolve, reject) {
      var r, err = null, began = Date.now(), settled = !resolve;
      try { r = new SR(); } catch (e) { end('error'); if (reject) reject({ code: 'unavailable', message: 'Ditado indisponível.' }); return; }
      rec = r;
      r.lang = lang; r.continuous = continuous; r.interimResults = true; r.maxAlternatives = 1;
      r.onstart = function () { if (!settled) { settled = true; resolve(); } setState('listening'); };
      r.onresult = function (ev) {
        var interim = '', i, res, t;
        for (i = ev.resultIndex; i < ev.results.length; i++) {
          res = ev.results[i]; t = res[0] ? String(res[0].transcript || '') : '';
          if (res.isFinal) { if (t.trim()) fire(onFinalL, { text: ' ' + t.trim() }); }
          else interim += t;
        }
        fire(onPartialL, { text: interim.trim() });
      };
      r.onerror = function (ev) { err = ev && ev.error; };
      r.onend = function () {
        if (rec !== r) return;
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          denied = true; end('not_granted');
          if (!settled) { settled = true; reject({ code: 'not_granted', message: 'Microfone não liberado.' }); }
          return;
        }
        if (err === 'audio-capture' || err === 'language-not-supported') {
          end('error');
          if (!settled) { settled = true; reject({ code: 'unavailable', message: 'Microfone indisponível.' }); }
          return;
        }
        if (!settled) { settled = true; end('error'); reject({ code: 'upstream_error', message: 'O microfone não abriu.' }); return; }
        if (wantStop) { end('stopped'); return; }
        if (document.hidden) { end('hidden'); return; }
        if (err === 'network') { end('error'); return; }
        /* o navegador encerra a escuta sozinho depois de um silêncio: reabre sem a pessoa perceber */
        quick = Date.now() - began < 800 ? quick + 1 : 0;
        if (quick >= 3 || Date.now() - startedAt > MAX_MS) { end(quick >= 3 ? 'error' : 'time_limit'); return; }
        open(null, null);
      };
      try { r.start(); }
      catch (e) { end('error'); if (!settled) { settled = true; reject({ code: 'upstream_error', message: 'O microfone não abriu.' }); } }
    }

    return {
      start: function (opts) {
        if (denied) return Promise.reject({ code: 'not_granted', message: 'Microfone não liberado.' });
        if (state !== 'idle') return Promise.resolve();
        lang = (opts && opts.language) || 'pt-BR';
        wantStop = false; startedAt = Date.now(); quick = 0;
        setState('starting');
        return new Promise(function (resolve, reject) { open(resolve, reject); });
      },
      stop: function () {
        if (state === 'idle' || !rec) return Promise.resolve();
        wantStop = true;
        return new Promise(function (resolve) {
          var done = false, fin = function () { if (!done) { done = true; resolve(); } };
          stopWaiters.push(fin);
          try { rec.stop(); } catch (e) { end('stopped'); }
          setTimeout(function () { if (!done) { if (state !== 'idle') end('stopped'); fin(); } }, 2500);
        });
      },
      onPartial: function (fn) { onPartialL.push(fn); },
      onFinal: function (fn) { onFinalL.push(fn); },
      onState: function (fn) { onStateL.push(fn); }
    };
  }

  /* ================= window.claude ================= */
  var made = {};
  window.claude = {
    use: function (name) {
      if (!(name in made)) {
        var v = null;
        try {
          if (name === 'sample') v = sample;
          else if (name === 'tts') v = makeTts();
          else if (name === 'dictation') v = makeDictation();
        } catch (e) { v = null; }
        made[name] = v;
      }
      return Promise.resolve(made[name]);
    }
  };

  /* ================= interface: aviso e janela da chave ================= */
  function h(tag, attrs) {
    var n = document.createElement(tag), k, i, c;
    if (attrs) for (k in attrs) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'style') n.style.cssText = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) { c = arguments[i]; if (c != null && c !== false) n.append(c); }
    return n;
  }

  var bar = null, dlg = null, pending = null, lastDismiss = 0, note = null;

  function paintBar() {
    if (!bar) return;
    bar.replaceChildren();
    var msg = null, label = null, act = null;
    if (note) { msg = note.msg; label = note.label; act = note.act; }
    else if (!getKey()) { msg = 'A IA está desconectada. Fora do Claude, o jogo usa a sua chave da API da Anthropic.'; label = 'Conectar chave'; act = openKeyDialog; }
    bar.hidden = !msg;
    if (!msg) return;
    bar.append(h('span', { text: msg, style: 'flex:1;min-width:200px' }));
    if (label) bar.append(h('button', { class: 'btn', type: 'button', text: label, onclick: act }));
    if (note) bar.append(h('button', { class: 'linkbtn', type: 'button', text: 'Fechar', onclick: clearNotice }));
  }
  function notice(msg, label, act) { note = { msg: msg, label: label, act: act }; paintBar(); }
  function clearNotice() { if (note) { note = null; paintBar(); } }

  function buildDialog() {
    var input = h('input', { type: 'password', id: 'osce-key', placeholder: 'sk-ant-…', autocomplete: 'off', spellcheck: 'false', style: 'width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--paper)' });
    var err = h('div', { role: 'alert', style: 'color:var(--bad);font-size:13px;font-weight:600;min-height:18px' });
    var status = h('p', { class: 'note', style: 'margin:0' });
    var remove = h('button', { class: 'btn danger', type: 'button', text: 'Remover chave', onclick: function () { setKey(''); clearNotice(); dlg.close(''); } });
    var form = h('form', { novalidate: true },
      h('h2', { text: 'Conectar a IA' }),
      h('p', { style: 'margin:0', text: 'Aqui no site o jogo não tem a IA do Claude embutida. Para o examinador, o paciente e a correção responderem, cole uma chave da API da Anthropic.' }),
      h('p', { class: 'note', style: 'margin:0', text: 'A chave fica guardada só neste navegador e é enviada apenas para api.anthropic.com. O uso é cobrado na sua conta da API, que é separada da assinatura do Claude. Se preferir não usar chave, abra o jogo pelo Claude: lá a IA já vem incluída.' }),
      h('label', { for: 'osce-key', text: 'Chave da API' }),
      input, err, status,
      h('p', { class: 'note', style: 'margin:0' }, 'Ainda não tem? ', h('a', { href: 'https://platform.claude.com/settings/keys', target: '_blank', rel: 'noopener', text: 'Criar uma chave no Console da Anthropic' }), '.'),
      h('div', { class: 'dlg-actions' }, remove, h('span', { class: 'grow' }),
        h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: function () { dlg.close(''); } }),
        h('button', { class: 'btn primary', type: 'submit', text: 'Salvar' })));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v) { err.textContent = 'Cole a chave para salvar.'; return; }
      if (v.indexOf('sk-ant-') !== 0 || /\s/.test(v)) { err.textContent = 'Isso não parece uma chave da API da Anthropic. Ela começa com sk-ant- e não tem espaços.'; return; }
      setKey(v); clearNotice(); dlg.close(v);
    });
    dlg = h('dialog', { class: 'dlg', id: 'osce-dlg-key' }, form);
    dlg.addEventListener('close', function () {
      var v = dlg.returnValue || '';
      if (!v) lastDismiss = Date.now();
      var p = pending; pending = null;
      if (p) p(getKey());
    });
    dlg.osce = { input: input, err: err, status: status, remove: remove };
    document.body.append(dlg);
  }
  function openKeyDialog() {
    if (!dlg) buildDialog();
    if (dlg.open) return;
    var has = !!getKey(), o = dlg.osce;
    o.input.value = ''; o.err.textContent = '';
    o.status.textContent = has ? 'Já existe uma chave salva neste navegador (final …' + getKey().slice(-4) + '). Colar outra substitui a atual.' : '';
    o.remove.hidden = !has;
    dlg.returnValue = '';
    try { dlg.showModal(); } catch (e) { return; }
    o.input.focus();
  }
  /* Usada quando a IA é chamada sem chave: abre a janela e espera a pessoa decidir. */
  function askKey() {
    if (pending) return pending.promise;
    if (Date.now() - lastDismiss < 10000) return Promise.resolve('');
    var resolve, promise = new Promise(function (r) { resolve = r; });
    pending = function (v) { resolve(v); }; pending.promise = promise;
    openKeyDialog();
    if (!dlg || !dlg.open) { pending = null; return Promise.resolve(''); }
    return promise;
  }

  function mountUi() {
    var app = document.querySelector('.app'), top = document.querySelector('.top');
    if (!app) return;
    bar = h('div', { id: 'osce-bar', role: 'status', hidden: true, style: 'flex:none;display:flex;gap:8px 12px;align-items:center;flex-wrap:wrap;padding:10px 20px;background:var(--warn-bg);color:var(--warn);font-weight:600;font-size:14px;border-bottom:1px solid var(--line)' });
    if (top && top.parentNode === app) top.after(bar); else app.prepend(bar);
    var gear = document.getElementById('btn-settings');
    if (gear) {
      var b = h('button', { class: 'iconbtn', id: 'osce-btn-key', type: 'button', 'aria-label': 'Chave da IA', title: 'Chave da IA', onclick: openKeyDialog });
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/></svg>';
      gear.before(b);
    }
    paintBar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountUi); else mountUi();
})();
