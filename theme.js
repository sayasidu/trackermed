(function () {
  const KEY = 'trackermed.theme.v1';
  const root = document.documentElement;

  function getStored() {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }
  function store(v) {
    try { localStorage.setItem(KEY, v); } catch {}
  }
  function systemPref() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function apply(theme) {
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      const ico = btn.querySelector('.ico');
      const lbl = btn.querySelector('.lbl');
      if (ico) ico.textContent = theme === 'dark' ? '☀' : '☾';
      if (lbl) lbl.textContent = theme === 'dark' ? 'Claro' : 'Escuro';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro');
    });
  }
  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    store(next);
    apply(next);
  }

  // Apply on load
  const initial = getStored() || systemPref();
  apply(initial);

  // Wire up toggles after DOM ready
  function wire() {
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      if (btn.dataset.themeWired) return;
      btn.dataset.themeWired = '1';
      btn.addEventListener('click', toggle);
    });
    apply(current());
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  // React to system theme changes when user hasn't picked
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => { if (!getStored()) apply(systemPref()); };
    if (mq.addEventListener) mq.addEventListener('change', listener);
    else if (mq.addListener) mq.addListener(listener);
  }

  // ---- Motor de contexto: planos ativos + plano em foco -----------------
  // Até 3 planos podem ficar ATIVOS ao mesmo tempo. O plano "em foco" é aquele
  // cujos dados estão nas chaves vivas — é ele que as abas Disciplinas,
  // Planejamento e Revisões mostram/editam. Os outros planos ativos ficam
  // guardados em snapshots (trackermed.semestres.v1) e continuam aparecendo no
  // Planejamento geral e no Histórico (que reúnem TODOS os planos, com filtro).
  // Ativar um plano NÃO substitui os já ativos — ele é apenas somado ao conjunto
  // (respeitando o limite de 3). Este chip na barra lateral lista os planos
  // ativos, deixa trocar qual está em edição e desativar cada um.
  var PLANOS_KEY = 'trackermed.planos.v1';
  var FOCO_KEY   = 'trackermed.semestreAtivo.v1';  // id do plano em foco (chaves vivas)
  var ATIVOS_KEY = 'trackermed.planosAtivos.v1';   // conjunto (até 3) de ids ativos
  var SNAP_KEY   = 'trackermed.semestres.v1';      // snapshots dos planos fora de foco
  var MAX_ATIVOS = 3;
  // Espelho de LIVE_KEYS em planos.html — manter em sincronia.
  var LIVE_KEYS = {
    disciplinas: 'trackermed.disciplinas.v1',
    plan:        'trackermed.plan.v1',
    periodo:     'trackermed.planner.periodo.v1',
    rotina:      'trackermed.planner.rotina.v1',
    disp:        'planejamento.disponibilidade',
    excluidas:   'trackermed.planner.excluidas.v1',
    plannerHist: 'trackermed.planner.historico.v1',
    pend:        'trackermed.planner.pendDispensados.v1'
  };

  function escTxt(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function jparse(s, f) { try { var v = JSON.parse(s); return v == null ? f : v; } catch (e) { return f; } }

  function ctxPlanos() { return jparse(lsGet(PLANOS_KEY), []); }
  function ctxFocusId() { return lsGet(FOCO_KEY) || null; }
  function setFocusPtr(id) { if (id) lsSet(FOCO_KEY, id); else lsDel(FOCO_KEY); }
  function ctxSnapStore() { return jparse(lsGet(SNAP_KEY), {}); }
  function ctxSnapSave(o) { lsSet(SNAP_KEY, JSON.stringify(o)); }
  function ctxSnapshotLive() {
    var s = {};
    for (var k in LIVE_KEYS) { var v = lsGet(LIVE_KEYS[k]); if (v != null) s[k] = v; }
    return s;
  }
  function ctxRestoreLive(snap) {
    for (var k in LIVE_KEYS) {
      var key = LIVE_KEYS[k];
      if (snap && snap[k] != null) lsSet(key, snap[k]); else lsDel(key);
    }
  }
  // Snapshot de um plano: chaves vivas se for o foco, senão o snapshot arquivado.
  function ctxSnapshotOf(id) { return id === ctxFocusId() ? ctxSnapshotLive() : (ctxSnapStore()[id] || null); }

  // Ids ativos: lê planosAtivos.v1; se ausente, deriva do foco. Sempre inclui o
  // foco. Descarta ids que não existem mais. Limita a MAX_ATIVOS.
  function ctxActiveIds() {
    var planos = ctxPlanos(), valid = {};
    for (var i = 0; i < planos.length; i++) { if (planos[i] && planos[i].id) valid[planos[i].id] = 1; }
    var arr = jparse(lsGet(ATIVOS_KEY), null);
    if (!Array.isArray(arr)) { var f0 = ctxFocusId(); arr = f0 ? [f0] : []; }
    var f = ctxFocusId();
    if (f && valid[f] && arr.indexOf(f) === -1) arr.unshift(f);
    var seen = {}, out = [];
    for (var j = 0; j < arr.length; j++) { var id = arr[j]; if (valid[id] && !seen[id]) { seen[id] = 1; out.push(id); } }
    return out.length > MAX_ATIVOS ? out.slice(0, MAX_ATIVOS) : out;
  }
  function ctxSetActiveIds(arr) { lsSet(ATIVOS_KEY, JSON.stringify(arr.slice(0, MAX_ATIVOS))); }
  function ctxActivePlanos() {
    var byId = {}, planos = ctxPlanos();
    for (var i = 0; i < planos.length; i++) { if (planos[i] && planos[i].id) byId[planos[i].id] = planos[i]; }
    return ctxActiveIds().map(function (id) { return byId[id]; }).filter(Boolean);
  }
  function ctxIsActive(id) { return ctxActiveIds().indexOf(id) !== -1; }

  // Troca o plano em foco: arquiva as chaves vivas do atual e restaura o alvo.
  function ctxSetFocus(id) {
    var cur = ctxFocusId();
    if (cur === id) { renderContextIndicator(); return; }
    var store = ctxSnapStore();
    if (cur) store[cur] = ctxSnapshotLive();
    if (id) { ctxRestoreLive(store[id] || null); if (store[id]) delete store[id]; }
    else ctxRestoreLive(null);
    ctxSnapSave(store);
    setFocusPtr(id);
    // Reabre um semestre fechado ao colocá-lo em foco.
    if (id) {
      var planos = ctxPlanos(), mud = false;
      for (var i = 0; i < planos.length; i++) {
        if (planos[i] && planos[i].id === id && planos[i].status === 'fechado') {
          planos[i] = Object.assign({}, planos[i], { status: 'aberto' });
          delete planos[i].fechadoEm;
          mud = true;
        }
      }
      if (mud) lsSet(PLANOS_KEY, JSON.stringify(planos));
    }
    renderContextIndicator();
  }

  // Ativa um plano: soma ao conjunto (sem substituir os já ativos) e passa o
  // foco pra ele. Retorna {ok:false, reason:'limit'} se já houver MAX_ATIVOS.
  function ctxActivate(id) {
    var ids = ctxActiveIds();
    if (ids.indexOf(id) !== -1) { ctxSetFocus(id); return { ok: true, already: true }; }
    if (ids.length >= MAX_ATIVOS) return { ok: false, reason: 'limit', max: MAX_ATIVOS };
    ids.push(id);
    ctxSetActiveIds(ids);
    ctxSetFocus(id);
    return { ok: true };
  }
  // Desativa um plano: tira do conjunto. Se era o foco, passa o foco pra outro
  // ativo (ou nenhum), arquivando os dados. Não apaga nada — o snapshot fica.
  function ctxDeactivate(id) {
    var ids = ctxActiveIds().filter(function (x) { return x !== id; });
    ctxSetActiveIds(ids);
    if (ctxFocusId() === id) ctxSetFocus(ids[0] || null);
    else renderContextIndicator();
  }
  // Versões que recarregam a página, pra chip/switcher aplicarem a troca em
  // qualquer aba (as abas de edição releem as chaves vivas ao recarregar).
  function ctxSwitchTo(id) { ctxSetFocus(id); try { location.reload(); } catch (e) { renderContextIndicator(); } }
  function ctxDeactivateReload(id) { ctxDeactivate(id); try { location.reload(); } catch (e) { renderContextIndicator(); } }

  // Apresentação por tipo de plano.
  var TIPO_ICON = { semestre: '🎓', residencia: '🏥', enamed: '📋', objetivo: '📌' };
  var CHIP_INFO = {
    semestre:   { txt: '#5FE3B0', base: '31,194,138' },
    residencia: { txt: '#93B4FF', base: '124,148,255' },
    enamed:     { txt: '#F7C77A', base: '244,167,47' },
    objetivo:   { txt: '#B9A9FF', base: '124,92,252' }
  };
  function tipoIcon(t) { return TIPO_ICON[t] || '📘'; }
  function chipInfo(t) { return CHIP_INFO[t] || { txt: '#B9A9FF', base: '124,92,252' }; }

  // HTML reutilizável de "filtro/troca por plano" para as abas de edição
  // (Disciplinas, Planejamento, Revisões). Lista os planos ativos; o em foco
  // fica destacado. Clicar num plano ativo passa a mostrá-lo/editá-lo.
  function ctxSwitcherHTML(label) {
    label = label || 'Plano';
    var ativos = ctxActivePlanos();
    if (!ativos.length) {
      return '<div class="tm-switcher tm-none" style="background:var(--paper);border:1px solid var(--line);border-left:3px solid var(--amber);border-radius:0 8px 8px 0;padding:11px 15px;font-size:13px;color:var(--ink2)">Nenhum plano ativo — <a href="planos.html" style="color:var(--cobalt);font-weight:600;text-decoration:none">ative um plano em Planos</a> pra montar e ver o conteúdo dele aqui. Você pode manter até ' + MAX_ATIVOS + ' planos ativos ao mesmo tempo.</div>';
    }
    var foco = ctxFocusId();
    var chips = ativos.map(function (p) {
      var isFoco = p.id === foco;
      var ci = chipInfo(p.tipo);
      var bg = isFoco ? 'rgba(' + ci.base + ',0.16)' : 'transparent';
      var bd = isFoco ? ci.txt : 'var(--line)';
      var fg = isFoco ? 'var(--ink)' : 'var(--ink2)';
      var title = isFoco ? 'Plano em edição agora' : ('Mostrar/editar “' + escTxt(p.nome) + '” nesta aba');
      return '<button type="button" onclick="TrackerMedContext.switchTo(\'' + p.id + '\')" title="' + title + '" style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border:1px solid ' + bd + ';border-left:3px solid ' + ci.txt + ';background:' + bg + ';color:' + fg + ';border-radius:999px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">' + tipoIcon(p.tipo) + ' ' + escTxt(p.nome) + (isFoco ? ' <span style="opacity:.85">●</span>' : '') + '</button>';
    }).join('');
    return '<div class="tm-switcher" style="background:var(--paper);border:1px solid var(--line);border-left:3px solid var(--cobalt);border-radius:0 8px 8px 0;padding:10px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      + '<span style="font-size:13px;font-weight:600;color:var(--ink2)">' + escTxt(label) + ':</span>'
      + chips
      + (ativos.length > 1 ? '<span style="font-size:11px;color:var(--muted)">· clique pra trocar o plano em edição</span>' : '')
      + '<a href="planos.html" style="margin-left:auto;font-size:12px;color:var(--cobalt);font-weight:600;text-decoration:none">gerenciar ›</a>'
      + '</div>';
  }

  // Chip na barra lateral: lista todos os planos ativos, destaca o em foco,
  // deixa trocar o foco (clicar no nome) e desativar (×).
  function renderContextIndicator() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    var old = sidebar.querySelector('.ctx-indicator');
    if (old) old.remove();
    var ativos = ctxActivePlanos();
    if (!ativos.length) return;
    var foco = ctxFocusId();
    var box = document.createElement('div');
    box.className = 'ctx-indicator';
    box.style.cssText = 'margin-top:16px;padding:10px 11px;border:1px solid rgba(244,241,234,0.12);border-radius:4px;background:rgba(244,241,234,0.04);';
    var rows = ativos.map(function (p) {
      var isFoco = p.id === foco;
      var ci = chipInfo(p.tipo);
      var badge = isFoco
        ? '<span style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:' + ci.txt + '">● em edição</span>'
        : '<span style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:rgba(244,241,234,0.42)">clique pra editar</span>';
      return '<div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding:6px 8px;border-radius:3px;border:1px solid rgba(' + ci.base + ',' + (isFoco ? '0.5' : '0.2') + ');border-left:3px solid ' + ci.txt + ';background:rgba(' + ci.base + ',' + (isFoco ? '0.16' : '0.05') + ')">'
        + '<button type="button" onclick="TrackerMedContext.switchTo(\'' + p.id + '\')" title="Editar este plano nas abas" style="flex:1 1 auto;min-width:0;text-align:left;background:transparent;border:0;cursor:pointer;padding:0;font-family:inherit">'
        + badge
        + '<b style="display:block;font-family:\'Fraunces\',serif;font-size:13px;font-weight:600;margin-top:1px;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + tipoIcon(p.tipo) + ' ' + escTxt(p.nome) + '</b>'
        + '</button>'
        + '<button type="button" onclick="TrackerMedContext.deactivateReload(\'' + p.id + '\')" title="Desativar este plano" aria-label="Desativar" style="flex:0 0 auto;background:transparent;border:0;color:rgba(244,241,234,0.5);cursor:pointer;font-size:16px;line-height:1;padding:2px 4px">×</button>'
        + '</div>';
    }).join('');
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">'
      + '<span style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;color:rgba(244,241,234,0.55)">Planos ativos · ' + ativos.length + '/' + MAX_ATIVOS + '</span>'
      + '<a href="planos.html" title="Gerenciar planos" style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:rgba(244,241,234,0.5);text-decoration:none">gerenciar ›</a>'
      + '</div>' + rows;
    var foot = sidebar.querySelector('.sidebar-foot');
    if (foot) sidebar.insertBefore(box, foot);
    else sidebar.appendChild(box);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderContextIndicator);
  } else {
    renderContextIndicator();
  }
  // Atualiza quando outra aba muda o contexto, ou quando a própria página pede.
  window.addEventListener('storage', function (e) {
    if (!e || !e.key || e.key === FOCO_KEY || e.key === PLANOS_KEY || e.key === ATIVOS_KEY) {
      renderContextIndicator();
    }
  });

  window.TrackerMedTheme = { toggle, apply, current };
  window.TrackerMedContext = {
    MAX: MAX_ATIVOS,
    planos: ctxPlanos,
    focusId: ctxFocusId,
    activeIds: ctxActiveIds,
    activePlanos: ctxActivePlanos,
    isActive: ctxIsActive,
    activate: ctxActivate,
    deactivate: ctxDeactivate,
    setFocus: ctxSetFocus,
    switchTo: ctxSwitchTo,
    deactivateReload: ctxDeactivateReload,
    snapshotOf: ctxSnapshotOf,
    switcherHTML: ctxSwitcherHTML,
    tipoIcon: tipoIcon,
    refresh: renderContextIndicator
  };
})();
