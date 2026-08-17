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
    box.style.cssText = 'margin-top:16px;padding:10px 11px;border:1px solid rgba(250,240,238,0.12);border-radius:4px;background:rgba(250,240,238,0.04);';
    var rows = ativos.map(function (p) {
      var isFoco = p.id === foco;
      var ci = chipInfo(p.tipo);
      var badge = isFoco
        ? '<span style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:' + ci.txt + '">● em edição</span>'
        : '<span style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:rgba(250,240,238,0.42)">clique pra editar</span>';
      return '<div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding:6px 8px;border-radius:3px;border:1px solid rgba(' + ci.base + ',' + (isFoco ? '0.5' : '0.2') + ');border-left:3px solid ' + ci.txt + ';background:rgba(' + ci.base + ',' + (isFoco ? '0.16' : '0.05') + ')">'
        + '<button type="button" onclick="TrackerMedContext.switchTo(\'' + p.id + '\')" title="Editar este plano nas abas" style="flex:1 1 auto;min-width:0;text-align:left;background:transparent;border:0;cursor:pointer;padding:0;font-family:inherit">'
        + badge
        + '<b style="display:block;font-family:\'Fraunces\',serif;font-size:13px;font-weight:600;margin-top:1px;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + tipoIcon(p.tipo) + ' ' + escTxt(p.nome) + '</b>'
        + '</button>'
        + '<button type="button" onclick="TrackerMedContext.deactivateReload(\'' + p.id + '\')" title="Desativar este plano" aria-label="Desativar" style="flex:0 0 auto;background:transparent;border:0;color:rgba(250,240,238,0.5);cursor:pointer;font-size:16px;line-height:1;padding:2px 4px">×</button>'
        + '</div>';
    }).join('');
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">'
      + '<span style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;color:rgba(250,240,238,0.55)">Planos ativos · ' + ativos.length + '/' + MAX_ATIVOS + '</span>'
      + '<a href="planos.html" title="Gerenciar planos" style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:rgba(250,240,238,0.5);text-decoration:none">gerenciar ›</a>'
      + '</div>' + rows;
    var foot = sidebar.querySelector('.sidebar-foot');
    if (foot) sidebar.insertBefore(box, foot);
    else sidebar.appendChild(box);
  }
  // ---- Recomeçar do zero: reset global de dados E configurações ---------
  // Apaga todas as chaves do TrackerMed deste aparelho — dados de estudo,
  // leituras, nome, tema e preferências — com confirmação dupla. As remoções
  // passam pelo localStorage normal de propósito: o sync.js registra
  // tombstones, então com a conta conectada a limpeza vale também pra nuvem
  // e pros outros aparelhos. O pareamento da conta (sync.meta) fica — é dele
  // que o sync precisa pra propagar a limpeza; sair da conta é outra ação.
  var RESET_KEEP = ['trackermed.sync.meta.v1'];
  var RESET_EXTRA = ['planejamento.disponibilidade'];
  function resetKeys() {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || RESET_KEEP.indexOf(k) !== -1) continue;
        if (k.indexOf('trackermed.') === 0 || RESET_EXTRA.indexOf(k) !== -1) keys.push(k);
      }
    } catch (e) {}
    return keys.sort();
  }
  function resetRun() {
    var chaves = resetKeys();
    if (!chaves.length) { alert('Não há nada para apagar — o TrackerMed já está zerado. 🌷'); return; }
    var S = window.TrackerMedSync;
    var conta = S && S.user ? S.user() : null;
    var alcance = conta
      ? 'Isso apaga os dados deste aparelho E da nuvem — os outros aparelhos da conta ' + conta.email + ' também ficam zerados.'
      : 'Isso apaga os dados deste aparelho.';
    if (!confirm('Recomeçar do zero?\n\n' + alcance + '\nTudo vai embora: planos, disciplinas, sessões, revisões, erros, simulados, leituras, nome e preferências (' + chaves.length + ' chaves).\n\nSe quiser guardar uma cópia, cancela e exporta um backup antes (app → Conta e sincronização).')) return;
    if (!confirm('Última confirmação: apagar TUDO e começar de novo?\n\nEssa ação não pode ser desfeita.')) return;
    chaves.forEach(function (k) { lsDel(k); });
    var fim = function () { alert('Prontinho — tudo limpo pra recomeçar. ✨'); try { location.reload(); } catch (e) {} };
    if (conta && S && S.syncNow) { S.syncNow().catch(function () {}).then(fim); } else { fim(); }
  }
  // Botão discreto no pé da sidebar de todas as páginas do painel.
  function renderResetButton() {
    var foot = document.querySelector('.sidebar-foot');
    if (!foot || foot.querySelector('.tm-reset-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tm-reset-btn';
    btn.textContent = '🗑 Recomeçar do zero';
    btn.title = 'Apaga todos os dados e configurações salvos pra começar de novo';
    btn.addEventListener('click', resetRun);
    foot.appendChild(btn);
  }
  window.TrackerMedReset = { run: resetRun, keys: resetKeys };

  function renderSidebarExtras() {
    renderContextIndicator();
    renderResetButton();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSidebarExtras);
  } else {
    renderSidebarExtras();
  }
  // Atualiza quando outra aba muda o contexto, ou quando a própria página pede.
  window.addEventListener('storage', function (e) {
    if (!e || !e.key || e.key === FOCO_KEY || e.key === PLANOS_KEY || e.key === ATIVOS_KEY) {
      renderContextIndicator();
    }
  });

  // ---- Fuso horário do app: America/Cuiaba (Mato Grosso, Brasil) --------
  // Todo o sistema de datas/horários calcula "hoje", "agora", dia da semana e
  // as chaves de semana neste fuso, independentemente do fuso configurado no
  // navegador/dispositivo, pra que o site sempre reconheça o dia e o horário
  // locais de Cuiabá. As funções abaixo devolvem uma Date "deslocada" cujos
  // CAMPOS LOCAIS (getFullYear, getMonth, getDate, getDay, getHours…) já
  // refletem o horário de parede em Cuiabá — use só pra ler campos e fazer
  // aritmética de calendário, nunca via toISOString()/UTC.
  var APP_TZ = 'America/Cuiaba';
  var _tzDTF = null;
  function tzFormatter() {
    if (_tzDTF !== null) return _tzDTF;
    try {
      _tzDTF = new Intl.DateTimeFormat('en-US', {
        timeZone: APP_TZ, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch (e) { _tzDTF = false; }
    return _tzDTF;
  }
  // Campos de data/hora em Cuiabá para um instante (default: agora).
  function tzParts(instant) {
    var d = instant || new Date();
    var dtf = tzFormatter();
    if (!dtf) { // ambiente sem Intl/tz — cai pro horário local do navegador
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
               hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() };
    }
    var o = {};
    dtf.formatToParts(d).forEach(function (p) { if (p.type !== 'literal') o[p.type] = p.value; });
    var hour = parseInt(o.hour, 10); if (hour === 24) hour = 0;
    return { year: +o.year, month: +o.month, day: +o.day,
             hour: hour, minute: +o.minute, second: +o.second };
  }
  function tzNow() {
    var p = tzParts(new Date());
    return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  function tzToday() {
    var p = tzParts(new Date());
    return new Date(p.year, p.month - 1, p.day);
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  // Chave YYYY-MM-DD a partir dos CAMPOS LOCAIS de uma Date (deslocada ou não).
  function tzKeyOf(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function tzTodayKey() { return tzKeyOf(tzNow()); }

  window.TrackerMedTime = {
    TZ: APP_TZ,
    now: tzNow,          // Date deslocada = horário de parede atual em Cuiabá
    today: tzToday,      // Date deslocada às 00:00 de hoje em Cuiabá
    todayKey: tzTodayKey,// 'YYYY-MM-DD' de hoje em Cuiabá
    keyOf: tzKeyOf,      // 'YYYY-MM-DD' pelos campos locais de uma Date
    parts: tzParts       // {year,month,day,hour,minute,second} em Cuiabá
  };

  // ---- Materiais de estudo: progresso gradual --------------------------
  // Materiais que não são concluídos numa sessão só (capítulo de livro,
  // artigo, videoaula, podcast…). Chave GLOBAL — não entra em LIVE_KEYS de
  // propósito: o progresso de leitura pertence ao aluno, não a um plano, e
  // assim ele não some ao trocar o plano em foco. Cada material guarda o
  // vínculo com a disciplina/conteúdo por id + nome desnormalizado.
  //
  // Shape de um material:
  // { id:'m-…', nome, tipo:'livro'|'artigo'|'resumo'|'video'|'audio'|'outro',
  //   unidade:'paginas'|'minutos'|'capitulos'|'aulas'|'percentual'|'questoes',
  //   total:221, discId, discNome, conteudoId, conteudoNome,
  //   prazo:'YYYY-MM-DD'|null, criadoEm:'YYYY-MM-DD',
  //   concluido:false, concluidoEm:null,
  //   log:[ { data:'YYYY-MM-DD', qtd:10, ts:1690000000000 } ] }
  var MAT_KEY = 'trackermed.materiais.v1';

  var MAT_TIPOS = {
    livro:    { label: 'Livro / capítulo',  icon: '📖' },
    artigo:   { label: 'Artigo científico', icon: '📄' },
    resumo:   { label: 'Resumo / apostila', icon: '📝' },
    video:    { label: 'Videoaula',         icon: '🎬' },
    gravacao: { label: 'Gravação de aula',  icon: '🎥' },
    audio:    { label: 'Podcast / áudio',   icon: '🎧' },
    outro:    { label: 'Outros materiais',  icon: '📚' }
  };
  var MAT_UNIDADES = {
    paginas:    { sing: 'página',  plural: 'páginas',  abbr: 'págs',    verbo: 'lidas' },
    minutos:    { sing: 'minuto',  plural: 'minutos',  abbr: 'min',     verbo: 'assistidos' },
    capitulos:  { sing: 'capítulo', plural: 'capítulos', abbr: 'caps',  verbo: 'concluídos' },
    aulas:      { sing: 'aula',    plural: 'aulas',    abbr: 'aulas',   verbo: 'concluídas' },
    questoes:   { sing: 'questão', plural: 'questões', abbr: 'questões', verbo: 'feitas' },
    itens:      { sing: 'item',    plural: 'itens',    abbr: 'itens',   verbo: 'concluídos' },
    percentual: { sing: '%',       plural: '%',        abbr: '%',       verbo: 'concluído' }
  };

  function matLoad() {
    var v = jparse(lsGet(MAT_KEY), []);
    return Array.isArray(v) ? v : [];
  }
  function matSave(list) { lsSet(MAT_KEY, JSON.stringify(list)); }
  function matUid() { return 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6); }
  function matGet(id) {
    var l = matLoad();
    for (var i = 0; i < l.length; i++) { if (l[i] && l[i].id === id) return l[i]; }
    return null;
  }
  function matUpsert(m) {
    var l = matLoad(), found = false;
    for (var i = 0; i < l.length; i++) { if (l[i] && l[i].id === m.id) { l[i] = m; found = true; break; } }
    if (!found) l.push(m);
    matSave(l);
    return m;
  }
  function matRemove(id) { matSave(matLoad().filter(function (m) { return m && m.id !== id; })); }

  function matNum(n) { var v = parseFloat(n); return isFinite(v) ? v : 0; }
  // Quantidade formatada: inteiro seco, fração com 1 casa (vírgula pt-BR).
  function matFmtQtd(n) {
    var v = Math.round(matNum(n) * 10) / 10;
    return (v % 1 === 0) ? String(v) : String(v).replace('.', ',');
  }
  function matUnidLabel(unidade, n) {
    var u = MAT_UNIDADES[unidade] || MAT_UNIDADES.paginas;
    if (unidade === 'percentual') return '%';
    return matNum(n) === 1 ? u.sing : u.plural;
  }
  // "10 páginas", "1h20" para minutos grandes, "18%"…
  function matFmtUnid(qtd, unidade) {
    var v = matNum(qtd);
    if (unidade === 'percentual') return matFmtQtd(v) + '%';
    if (unidade === 'minutos' && v >= 60) {
      var h = Math.floor(v / 60), m = Math.round(v % 60);
      return m > 0 ? (h + 'h' + (m < 10 ? '0' : '') + m) : (h + 'h');
    }
    return matFmtQtd(v) + ' ' + matUnidLabel(unidade, v);
  }
  // Forma curta pra pares "X de Y páginas": número seco, exceto minutos (10min/1h20) e %.
  function matFmtCurto(qtd, unidade) {
    if (unidade === 'minutos') return matFmtUnid(qtd, 'minutos');
    if (unidade === 'percentual') return matFmtQtd(qtd) + '%';
    return matFmtQtd(qtd);
  }
  function matTipoIcon(t) { return (MAT_TIPOS[t] || MAT_TIPOS.outro).icon; }
  function matTipoLabel(t) { return (MAT_TIPOS[t] || MAT_TIPOS.outro).label; }

  // Date 00:00 (campos locais Cuiabá) a partir de 'YYYY-MM-DD'.
  function matParseKey(k) {
    if (!k || typeof k !== 'string') return null;
    var p = k.split('-');
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? null : d;
  }
  var MAT_DAY_MS = 24 * 60 * 60 * 1000;
  function matDiffDias(a, b) { return Math.round((b - a) / MAT_DAY_MS); }

  // Registra um avanço (qtd > 0) na data dada (default: hoje em Cuiabá).
  // Soma ao progresso; marca concluído automaticamente ao atingir o total.
  // meta (opcional): campos extras gravados no lançamento — ex. { de, ate,
  // blocoId } pra amarrar o avanço à sessão de estudo que o originou.
  function matAddAvanco(id, qtd, dataKey, meta) {
    var m = matGet(id);
    var v = matNum(qtd);
    if (!m || v <= 0) return null;
    if (!Array.isArray(m.log)) m.log = [];
    var entry = { data: dataKey || tzTodayKey(), qtd: v, ts: Date.now() };
    if (meta && typeof meta === 'object') {
      for (var k in meta) { if (meta[k] != null && entry[k] === undefined) entry[k] = meta[k]; }
    }
    m.log.push(entry);
    var st = matStats(m);
    if (st.restante <= 0 && !m.concluido) {
      m.concluido = true;
      m.concluidoEm = tzTodayKey();
    }
    matUpsert(m);
    return m;
  }
  function matConcluir(id) {
    var m = matGet(id);
    if (!m) return null;
    var st = matStats(m);
    // Completa o que falta com um lançamento final, pra soma bater com o total.
    if (st.restante > 0) m.log.push({ data: tzTodayKey(), qtd: st.restante, ts: Date.now() });
    m.concluido = true;
    m.concluidoEm = tzTodayKey();
    matUpsert(m);
    return m;
  }
  function matReabrir(id) {
    var m = matGet(id);
    if (!m) return null;
    m.concluido = false;
    m.concluidoEm = null;
    matUpsert(m);
    return m;
  }

  // Estatísticas derivadas + estimativa DINÂMICA:
  // o ritmo usa a janela dos últimos 7 dias corridos (ou desde o 1º avanço,
  // se mais recente) — acelerou, a previsão cai; desacelerou, ela sobe.
  function matStats(m) {
    var total = matNum(m.total);
    var log = Array.isArray(m.log) ? m.log : [];
    var feito = 0, hoje = 0, first = null;
    var hojeKey = tzTodayKey();
    var hojeDate = tzToday();
    var diasSet = {};
    var recente = 0;
    var iniJanela = new Date(hojeDate.getTime() - 6 * MAT_DAY_MS);
    for (var i = 0; i < log.length; i++) {
      var e = log[i]; if (!e) continue;
      var q = matNum(e.qtd);
      feito += q;
      if (e.data === hojeKey) hoje += q;
      diasSet[e.data] = (diasSet[e.data] || 0) + q;
      var d = matParseKey(e.data);
      if (d) {
        if (!first || d < first) first = d;
        if (d >= iniJanela && d <= hojeDate) recente += q;
      }
    }
    var restante = Math.max(0, total - feito);
    var pct = total > 0 ? Math.min(100, Math.round((feito / total) * 100)) : 0;
    var diasComAvanco = Object.keys(diasSet).length;
    var mediaDia = diasComAvanco > 0 ? feito / diasComAvanco : 0;
    // Ritmo por dia corrido na janela recente; fallback: média desde o início.
    var ritmo = 0;
    if (first) {
      var diasDesde = Math.max(1, matDiffDias(first, hojeDate) + 1);
      var janela = Math.min(7, diasDesde);
      ritmo = janela > 0 ? recente / janela : 0;
      if (ritmo <= 0) ritmo = feito / diasDesde;
    }
    var estimativaDias = (!m.concluido && restante > 0 && ritmo > 0) ? Math.ceil(restante / ritmo) : null;
    var dataEstimada = null;
    if (estimativaDias != null) dataEstimada = tzKeyOf(new Date(hojeDate.getTime() + estimativaDias * MAT_DAY_MS));
    // Prazo definido pelo aluno → quanto estudar por dia pra cumprir.
    var diasAtePrazo = null, sugestaoDiaria = null, atrasado = false;
    var prazoD = matParseKey(m.prazo);
    if (prazoD && !m.concluido && restante > 0) {
      diasAtePrazo = matDiffDias(hojeDate, prazoD);
      if (diasAtePrazo < 0) { atrasado = true; }
      var diasUteis = Math.max(1, diasAtePrazo + 1); // inclui hoje
      sugestaoDiaria = restante / diasUteis;
    }
    return {
      total: total, feito: Math.min(feito, total), feitoBruto: feito,
      restante: restante, pct: pct, hoje: hoje,
      diasComAvanco: diasComAvanco, mediaDia: mediaDia, ritmo: ritmo,
      estimativaDias: estimativaDias, dataEstimada: dataEstimada,
      diasAtePrazo: diasAtePrazo, sugestaoDiaria: sugestaoDiaria, atrasado: atrasado
    };
  }

  // Mensagens dinâmicas prontas pra UI ("Mantendo esse ritmo…").
  function matMensagens(m) {
    var st = matStats(m);
    var msgs = [];
    var u = function (n) { return matFmtUnid(n, m.unidade); };
    if (m.concluido) { msgs.push('Material concluído. 🎉'); return msgs; }
    if (st.hoje > 0 && st.diasComAvanco > 1 && st.hoje > st.mediaDia) {
      msgs.push('Hoje você avançou acima da sua média (' + u(st.hoje) + ' vs ' + u(Math.round(st.mediaDia * 10) / 10) + '/dia). 💪');
    }
    if (st.estimativaDias != null) {
      msgs.push('Mantendo esse ritmo (' + u(Math.round(st.ritmo * 10) / 10) + '/dia), você concluirá em aproximadamente ' + st.estimativaDias + (st.estimativaDias === 1 ? ' dia.' : ' dias.'));
    } else if (st.restante > 0 && st.diasComAvanco === 0) {
      msgs.push('Registre seu primeiro avanço pra ver a previsão de conclusão.');
    }
    if (st.sugestaoDiaria != null) {
      if (st.atrasado) {
        msgs.push('O prazo (' + matFmtDataBR(m.prazo) + ') já passou — faltam ' + u(st.restante) + '.');
      } else {
        msgs.push('Para concluir até ' + matFmtDataBR(m.prazo) + ', estude cerca de ' + u(Math.ceil(st.sugestaoDiaria)) + ' por dia.');
      }
    }
    return msgs;
  }
  function matFmtDataBR(k) {
    var d = matParseKey(k);
    if (!d) return '';
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  // Consultas usadas pelas páginas.
  function matPorDisciplina(discId) {
    return matLoad().filter(function (m) { return m && m.discId === discId; });
  }
  function matEmAndamento(discId) {
    return matLoad().filter(function (m) {
      if (!m || m.concluido) return false;
      return discId == null || m.discId === discId;
    });
  }
  // Avanços de um dia ('YYYY-MM-DD') → [{material, qtd}] pro Histórico.
  function matAvancosDoDia(dataKey) {
    var out = [];
    matLoad().forEach(function (m) {
      if (!m || !Array.isArray(m.log)) return;
      var q = 0;
      m.log.forEach(function (e) { if (e && e.data === dataKey) q += matNum(e.qtd); });
      if (q > 0) out.push({ material: m, qtd: q });
    });
    return out;
  }

  // ---- Ritmo de estudo: velocidade real por recurso + projeções ---------
  // Usa os avanços registrados ao encerrar sessões (qtd + sessaoMin no log
  // dos materiais; fallback: recurso gravado no historicoEstudos) para
  // calcular a velocidade REAL do aluno por tipo de recurso — páginas/hora
  // de leitura, minutos de conteúdo consumidos por hora real de estudo (o
  // que embute velocidade de reprodução, pausas e retornos), itens/hora —
  // e projetar quanto tempo falta para concluir cada material.
  var RIT_CATS = {
    leitura:      { label: 'Leitura',      icon: '📖', tipos: ['livro','artigo','resumo'], unidade: 'paginas' },
    visualizacao: { label: 'Visualização', icon: '🎬', tipos: ['video','gravacao'],        unidade: 'minutos' },
    escuta:       { label: 'Escuta',       icon: '🎧', tipos: ['audio'],                   unidade: 'minutos' },
    outros:       { label: 'Outros',       icon: '📚', tipos: ['outro'],                   unidade: 'itens' }
  };
  function ritCatOf(tipo) {
    for (var k in RIT_CATS) { if (RIT_CATS[k].tipos.indexOf(tipo) >= 0) return k; }
    return 'outros';
  }
  // Amostras: cada sessão com avanço + tempo medidos → { data, ts, materialId,
  // tipo, unidade, qtd, min }. Fonte primária: log dos materiais (sessaoMin);
  // fallback: entradas do historicoEstudos com recurso + minutos (sessões
  // registradas antes do sessaoMin existir), deduplicadas por chave.
  function ritSamples() {
    var out = [], seen = {};
    matLoad().forEach(function (m) {
      if (!m || !Array.isArray(m.log)) return;
      m.log.forEach(function (e) {
        if (!e || !(matNum(e.qtd) > 0) || !(matNum(e.sessaoMin) > 0)) return;
        var s = { ts: e.ts || 0, data: e.data || '', materialId: m.id, tipo: m.tipo || 'outro',
                  unidade: m.unidade || 'paginas', qtd: matNum(e.qtd), min: matNum(e.sessaoMin) };
        out.push(s);
        seen[m.id + '|' + s.data + '|' + s.qtd] = true;
      });
    });
    var hist = jparse(lsGet('historicoEstudos'), []);
    if (Array.isArray(hist)) {
      var mats = {};
      matLoad().forEach(function (m) { if (m) mats[m.id] = m; });
      hist.forEach(function (r) {
        if (!r || !r.recurso || !(matNum(r.recurso.qtd) > 0) || !(matNum(r.minutos) > 0)) return;
        var dm = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.data || '');
        var dk = dm ? (dm[3] + '-' + dm[2] + '-' + dm[1]) : '';
        var key = (r.recurso.materialId || '') + '|' + dk + '|' + matNum(r.recurso.qtd);
        if (seen[key]) return;
        seen[key] = true;
        var m = mats[r.recurso.materialId];
        out.push({ ts: 0, data: dk, materialId: r.recurso.materialId || null,
                   tipo: (m && m.tipo) || r.recurso.tipo || 'outro',
                   unidade: (m && m.unidade) || r.recurso.unidade || 'paginas',
                   qtd: matNum(r.recurso.qtd), min: matNum(r.minutos) });
      });
    }
    out.sort(function (a, b) { return a.data === b.data ? (a.ts - b.ts) : (a.data < b.data ? -1 : 1); });
    return out;
  }
  function ritVelSimples(list) {
    var q = 0, mi = 0;
    list.forEach(function (s) { q += s.qtd; mi += s.min; });
    return mi > 0 ? q / mi * 60 : null;
  }
  // Velocidade média ponderada por recência (decaimento 0.8 por sessão — as
  // últimas sessões pesam mais, sem descartar o histórico). Uma sessão isolada
  // não vira verdade: com menos de 3 amostras a estimativa é `provisoria`.
  // Tendência: média simples das últimas ~3 sessões × das anteriores
  // (±8% = melhora/redução; no meio, estável).
  function ritVelocidade(samples) {
    var n = samples.length;
    if (!n) return null;
    var wq = 0, wm = 0, q = 0, mi = 0;
    for (var i = 0; i < n; i++) {
      var w = Math.pow(0.8, n - 1 - i);
      wq += samples[i].qtd * w;
      wm += samples[i].min * w;
      q += samples[i].qtd;
      mi += samples[i].min;
    }
    if (wm <= 0) return null;
    var porHora = wq / wm * 60;
    var trend = null;
    if (n >= 4) {
      var cut = Math.max(1, n - 3);
      var vr = ritVelSimples(samples.slice(cut));
      var va = ritVelSimples(samples.slice(0, cut));
      if (vr != null && va != null && va > 0) {
        var dp = Math.round((vr - va) / va * 100);
        trend = { pct: dp, dir: dp >= 8 ? 'melhora' : (dp <= -8 ? 'reducao' : 'estavel'), atual: vr, anterior: va };
      }
    }
    return { porHora: porHora, minPorUnidade: porHora > 0 ? 60 / porHora : null,
             n: n, provisoria: n < 3, trend: trend, totalQtd: q, totalMin: mi };
  }
  // Minutos dedicados por dia CORRIDO na janela recente (últimos 14 dias, ou
  // desde a 1ª sessão se mais curto) — base realista pra converter tempo
  // restante em dias de calendário.
  function ritMediaDiaria(samples) {
    if (!samples.length) return 0;
    var hoje = tzToday();
    var first = null;
    samples.forEach(function (s) { var d = matParseKey(s.data); if (d && (!first || d < first)) first = d; });
    var span = first ? Math.max(1, matDiffDias(first, hoje) + 1) : 1;
    var janela = Math.min(14, span);
    var ini = new Date(hoje.getTime() - (janela - 1) * MAT_DAY_MS);
    var min = 0;
    samples.forEach(function (s) {
      var d = matParseKey(s.data);
      if (d && d >= ini && d <= hoje) min += s.min;
    });
    return min / janela;
  }
  // Projeção completa de um material: velocidade (do próprio material ou, sem
  // amostras dele, da categoria), tempo restante, dias e data prevista.
  function ritMaterial(m, allSamples) {
    var st = matStats(m);
    var all = allSamples || ritSamples();
    var proprios = all.filter(function (s) { return s.materialId === m.id; });
    var vel = ritVelocidade(proprios);
    var fonte = vel ? 'material' : null;
    if (!vel) {
      var cat = ritCatOf(m.tipo);
      var daCat = all.filter(function (s) {
        return ritCatOf(s.tipo) === cat && s.unidade === m.unidade;
      });
      vel = ritVelocidade(daCat);
      if (vel) { fonte = 'categoria'; vel = Object.assign({}, vel, { provisoria: true }); }
    }
    var tempoInvestidoMin = 0;
    proprios.forEach(function (s) { tempoInvestidoMin += s.min; });
    var restanteMin = (vel && vel.porHora > 0 && st.restante > 0) ? st.restante / vel.porHora * 60 : null;
    var mediaDiaMin = ritMediaDiaria(proprios);
    var metaDiariaMin = matNum(m.metaDiariaMin) > 0 ? matNum(m.metaDiariaMin) : null;
    var baseDia = metaDiariaMin || mediaDiaMin;
    var dias = (restanteMin != null && baseDia > 0) ? Math.max(1, Math.ceil(restanteMin / baseDia)) : null;
    var dataPrevista = dias != null ? tzKeyOf(new Date(tzToday().getTime() + dias * MAT_DAY_MS)) : null;
    return { material: m, stats: st, samples: proprios, vel: vel, fonte: fonte,
             tempoInvestidoMin: tempoInvestidoMin, restanteMin: restanteMin,
             mediaDiaMin: mediaDiaMin, metaDiariaMin: metaDiariaMin,
             dias: dias, dataPrevista: dataPrevista };
  }
  // Médias agregadas por categoria de recurso (só amostras na unidade
  // canônica da categoria, pra não misturar páginas com minutos).
  function ritCategorias(allSamples) {
    var all = allSamples || ritSamples();
    var out = {};
    for (var k in RIT_CATS) {
      var c = RIT_CATS[k];
      var sc = all.filter(function (s) { return ritCatOf(s.tipo) === k && s.unidade === c.unidade; });
      var matIds = {};
      var totalMin = 0, totalQtd = 0;
      sc.forEach(function (s) { if (s.materialId) matIds[s.materialId] = 1; totalMin += s.min; totalQtd += s.qtd; });
      out[k] = { key: k, label: c.label, icon: c.icon, unidade: c.unidade,
                 vel: ritVelocidade(sc), nSessoes: sc.length,
                 nMateriais: Object.keys(matIds).length, totalMin: totalMin, totalQtd: totalQtd };
    }
    return out;
  }
  // Cenários "e se": dias pra concluir estudando X min/dia.
  function ritCenarios(restanteMin, minsPorDiaList) {
    return (minsPorDiaList || []).map(function (pd) {
      return { minDia: pd, dias: (restanteMin != null && pd > 0) ? Math.max(1, Math.ceil(restanteMin / pd)) : null };
    });
  }
  function ritSetMetaDiaria(id, minPorDia) {
    var m = matGet(id);
    if (!m) return null;
    var v = matNum(minPorDia);
    m.metaDiariaMin = v > 0 ? v : null;
    matUpsert(m);
    return m;
  }
  // "12,4 págs/h", "72 min/h", "3,5 itens/h"
  function ritFmtVel(porHora, unidade) {
    var v = Math.round(matNum(porHora) * 10) / 10;
    var num = (v % 1 === 0) ? String(v) : String(v).replace('.', ',');
    var ab = unidade === 'percentual' ? '%' : ((MAT_UNIDADES[unidade] || MAT_UNIDADES.paginas).abbr);
    return num + ' ' + ab + '/h';
  }

  window.TrackerMedRitmo = {
    CATS: RIT_CATS,
    catOf: ritCatOf,
    samples: ritSamples,
    velocidade: ritVelocidade,
    mediaDiaria: ritMediaDiaria,
    material: ritMaterial,
    categorias: ritCategorias,
    cenarios: ritCenarios,
    setMetaDiaria: ritSetMetaDiaria,
    fmtVel: ritFmtVel
  };

  window.TrackerMedMateriais = {
    KEY: MAT_KEY,
    TIPOS: MAT_TIPOS,
    UNIDADES: MAT_UNIDADES,
    load: matLoad,
    save: matSave,
    uid: matUid,
    get: matGet,
    upsert: matUpsert,
    remove: matRemove,
    addAvanco: matAddAvanco,
    concluir: matConcluir,
    reabrir: matReabrir,
    stats: matStats,
    mensagens: matMensagens,
    porDisciplina: matPorDisciplina,
    emAndamento: matEmAndamento,
    avancosDoDia: matAvancosDoDia,
    fmtQtd: matFmtQtd,
    fmtUnid: matFmtUnid,
    fmtCurto: matFmtCurto,
    fmtDataBR: matFmtDataBR,
    unidadeLabel: matUnidLabel,
    tipoIcon: matTipoIcon,
    tipoLabel: matTipoLabel
  };

  // ---- Conteúdos hierárquicos: Disciplina → Conteúdo/Área → Tópico ------
  // Motor compartilhado dos campos "Conteúdo (opcional)" nos modais de estudo
  // (historico.html e plannerstudy.html). As opções vêm do cadastro feito em
  // disciplinas.html (d.conteudos[].topicos[]): quando a disciplina tem
  // conteúdos cadastrados o aluno escolhe entre eles — o mesmo conteúdo nunca
  // é registrado com nomes diferentes; sem cadastro, ou em matéria avulsa, o
  // campo continua sendo texto livre.
  var HIER_OUTRO = '__outro__';
  function hierConteudosDe(discId) {
    if (!discId) return [];
    var list = jparse(lsGet(LIVE_KEYS.disciplinas), []);
    var d = null;
    for (var i = 0; i < list.length; i++) { if (list[i] && list[i].id === discId) { d = list[i]; break; } }
    return ((d && d.conteudos) || []).filter(function (c) { return c && c.id && c.nome; });
  }
  function hierRotulo(contNome, topNome) { return topNome ? contNome + ' — ' + topNome : (contNome || ''); }
  // Casa um texto livre antigo com o cadastro ("Cardiologia — SCA", "SCA"…),
  // pra registros anteriores à estrutura hierárquica pré-selecionarem certo.
  function hierAcharPorTexto(conteudos, texto) {
    function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
    var alvo = norm(texto);
    if (!alvo) return null;
    for (var i = 0; i < conteudos.length; i++) {
      var c = conteudos[i];
      var tops = c.topicos || [];
      for (var j = 0; j < tops.length; j++) {
        var t = tops[j];
        if (t && t.nome && (alvo === norm(hierRotulo(c.nome, t.nome)) || alvo === norm(t.nome))) {
          return { conteudoId: c.id, topicoId: t.id };
        }
      }
      if (alvo === norm(c.nome)) return { conteudoId: c.id, topicoId: null };
    }
    return null;
  }
  // Controlador de um par de selects dependentes + fallback de texto livre.
  // ids: { sel, topico, selWrap, livreWrap, livre, hint? } — ids de elementos.
  function hierCtrl(ids) {
    function el(k) { return ids[k] ? document.getElementById(ids[k]) : null; }
    function mostrar(elm, on) { if (elm) elm.style.display = on ? '' : 'none'; }
    var ctrl = { conteudos: [], soLivre: true };

    function topicosDe(cid) {
      for (var i = 0; i < ctrl.conteudos.length; i++) {
        if (ctrl.conteudos[i].id === cid) {
          return (ctrl.conteudos[i].topicos || []).filter(function (t) { return t && t.id && t.nome; });
        }
      }
      return [];
    }
    function renderTopicos(topicoId) {
      var top = el('topico');
      var cid = el('sel').value;
      if (!cid || cid === HIER_OUTRO) {
        top.innerHTML = '<option value="">' + (cid === HIER_OUTRO ? '—' : '— escolha o conteúdo —') + '</option>';
        top.disabled = true;
        return;
      }
      var tops = topicosDe(cid);
      if (!tops.length) {
        top.innerHTML = '<option value="">— sem tópicos cadastrados —</option>';
        top.disabled = true;
        return;
      }
      top.innerHTML = '<option value="">— nenhum —</option>' + tops.map(function (t) {
        return '<option value="' + escTxt(t.id) + '"' + (t.id === topicoId ? ' selected' : '') + '>' + escTxt(t.nome) + '</option>';
      }).join('');
      top.disabled = false;
    }

    // onchange do select de conteúdo: repovoa os tópicos daquele conteúdo e
    // alterna o texto livre (opção "Outro").
    ctrl.onConteudoChange = function () {
      var outro = el('sel').value === HIER_OUTRO;
      mostrar(el('livreWrap'), outro);
      mostrar(el('hint'), false);
      if (outro) { var lv = el('livre'); if (lv) lv.focus(); }
      renderTopicos(null);
    };

    // Monta os campos pra disciplina. pre = { conteudoId, topicoId, texto } —
    // valores já gravados no estudo aparecem pré-selecionados.
    ctrl.montar = function (discId, pre) {
      pre = pre || {};
      ctrl.conteudos = hierConteudosDe(discId);
      ctrl.soLivre = !ctrl.conteudos.length;
      el('livre').value = '';
      if (ctrl.soLivre) {
        mostrar(el('selWrap'), false);
        mostrar(el('livreWrap'), true);
        mostrar(el('hint'), !!discId); // disciplina sem cadastro: aponta pra disciplinas.html
        el('livre').value = pre.texto || '';
        return;
      }
      var conteudoId = pre.conteudoId || null, topicoId = pre.topicoId || null;
      var valido = false;
      for (var i = 0; i < ctrl.conteudos.length; i++) { if (ctrl.conteudos[i].id === conteudoId) { valido = true; break; } }
      if (!valido) { conteudoId = null; topicoId = null; }
      if (!conteudoId && pre.texto) {
        var m = hierAcharPorTexto(ctrl.conteudos, pre.texto);
        if (m) { conteudoId = m.conteudoId; topicoId = m.topicoId; }
      }
      var usarOutro = !conteudoId && !!String(pre.texto == null ? '' : pre.texto).trim();
      mostrar(el('selWrap'), true);
      mostrar(el('hint'), false);
      el('sel').innerHTML = '<option value="">— nenhum —</option>' + ctrl.conteudos.map(function (c) {
        return '<option value="' + escTxt(c.id) + '"' + (c.id === conteudoId ? ' selected' : '') + '>' + escTxt(c.nome) + '</option>';
      }).join('') + '<option value="' + HIER_OUTRO + '"' + (usarOutro ? ' selected' : '') + '>✎ Outro (texto livre)</option>';
      mostrar(el('livreWrap'), usarOutro);
      if (usarOutro) el('livre').value = pre.texto;
      renderTopicos(topicoId);
    };

    // Lê a escolha atual → { conteudoId, topicoId, conteudo (texto exibido) }.
    ctrl.ler = function () {
      if (ctrl.soLivre || el('sel').value === HIER_OUTRO) {
        return { conteudoId: null, topicoId: null, conteudo: (el('livre').value || '').trim() };
      }
      var cid = el('sel').value || null;
      var cont = null;
      for (var i = 0; i < ctrl.conteudos.length; i++) { if (ctrl.conteudos[i].id === cid) { cont = ctrl.conteudos[i]; break; } }
      if (!cont) return { conteudoId: null, topicoId: null, conteudo: '' };
      var top = el('topico');
      var t = null;
      if (!top.disabled && top.value) {
        var tops = topicosDe(cid);
        for (var j = 0; j < tops.length; j++) { if (tops[j].id === top.value) { t = tops[j]; break; } }
      }
      return { conteudoId: cont.id, topicoId: t ? t.id : null, conteudo: hierRotulo(cont.nome, t && t.nome) };
    };

    return ctrl;
  }

  window.TrackerMedConteudos = {
    OUTRO: HIER_OUTRO,
    daDisciplina: hierConteudosDe,
    rotulo: hierRotulo,
    acharPorTexto: hierAcharPorTexto,
    ctrl: hierCtrl
  };

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
