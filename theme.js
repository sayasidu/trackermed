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
  var RESET_EXTRA = ['planejamento.disponibilidade', 'historicoEstudos'];
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
    // Completa o que falta com um lançamento final que leva a POSIÇÃO até o
    // total (ate) — qtd registra só o trecho restante de fato.
    if (st.restante > 0) m.log.push({ data: tzTodayKey(), qtd: st.restante, ate: matNum(m.total), ts: Date.now() });
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
  //
  // Dois conceitos distintos, que só coincidem quando a leitura começa do
  // início do material:
  //   · lidas (Σ qtd das sessões) — esforço real: alimenta hoje, média/dia,
  //     ritmo e a velocidade (págs/h). Ler da pág. 34 à 40 conta 7.
  //   · posição alcançada (matPosAtual) — progresso acumulado: alimenta
  //     feito, pct e restante. Parou na pág. 40 de 240 → 40 · 17% · restam 200.
  function matStats(m) {
    var total = matNum(m.total);
    var log = Array.isArray(m.log) ? m.log : [];
    var lidas = 0, hoje = 0, first = null;
    var hojeKey = tzTodayKey();
    var hojeDate = tzToday();
    var diasSet = {};
    var recente = 0;
    var iniJanela = new Date(hojeDate.getTime() - 6 * MAT_DAY_MS);
    for (var i = 0; i < log.length; i++) {
      var e = log[i]; if (!e) continue;
      var q = matNum(e.qtd);
      lidas += q;
      if (e.data === hojeKey) hoje += q;
      diasSet[e.data] = (diasSet[e.data] || 0) + q;
      var d = matParseKey(e.data);
      if (d) {
        if (!first || d < first) first = d;
        if (d >= iniJanela && d <= hojeDate) recente += q;
      }
    }
    var pos = matPosAtual(m);
    var restante = Math.max(0, total - pos);
    var pct = total > 0 ? Math.min(100, Math.round((pos / total) * 100)) : 0;
    var diasComAvanco = Object.keys(diasSet).length;
    var mediaDia = diasComAvanco > 0 ? lidas / diasComAvanco : 0;
    // Ritmo por dia corrido na janela recente; fallback: média desde o início.
    var ritmo = 0;
    if (first) {
      var diasDesde = Math.max(1, matDiffDias(first, hojeDate) + 1);
      var janela = Math.min(7, diasDesde);
      ritmo = janela > 0 ? recente / janela : 0;
      if (ritmo <= 0) ritmo = lidas / diasDesde;
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
      total: total, feito: total > 0 ? Math.min(pos, total) : pos,
      lidas: lidas, feitoBruto: lidas,
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
  // Posição atual em unidades de posição (página/minuto/% em que o aluno
  // parou). Segue o log em ordem: lançamentos com `ate` fixam a posição
  // exata; os demais (avanços avulsos) somam a quantidade. É a base da regra
  // "avanço da sessão = posição informada − última posição registrada".
  function matPosAtual(m) {
    if (!m) return 0;
    var log = Array.isArray(m.log) ? m.log : [];
    var pos = 0;
    for (var i = 0; i < log.length; i++) {
      var e = log[i]; if (!e) continue;
      var ate = parseFloat(e.ate);
      pos = isFinite(ate) ? ate : pos + matNum(e.qtd);
    }
    var total = matNum(m.total);
    return total > 0 ? Math.min(pos, total) : pos;
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

  // ---- Atividades e etapas: tempo, situação, estimativa, correções ------
  // Uma ATIVIDADE é o que a aluna quer concluir (ler o cap. 12, assistir a
  // aula X). Cada ETAPA dela (leitura, resumo, questões, revisão…) é um
  // material comum — mesma unidade, total, log e estatísticas de sempre —
  // ligado ao grupo por `atividadeId`. Materiais antigos, sem o campo, são
  // atividades de uma etapa só (o próprio id vira o id da atividade), então
  // nada precisa migrar. O tempo REALIZADO vem das sessões (blocos do
  // planejamento com materialId); o RESERVADO, das sessões ainda pendentes;
  // a ESTIMATIVA restante respeita a definida à mão e, sem ela, deriva do
  // ritmo medido (ou, sem ritmo, da proporção tempo gasto × avanço).
  var MAT_ETAPAS = {
    leitura:    { label: 'Leitura',           icon: '📖', unidade: 'paginas',    tipo: 'livro'  },
    video:      { label: 'Videoaula / áudio', icon: '🎬', unidade: 'minutos',    tipo: 'video'  },
    resumo:     { label: 'Resumo',            icon: '📝', unidade: 'paginas',    tipo: 'resumo' },
    questoes:   { label: 'Questões',          icon: '✅', unidade: 'questoes',   tipo: 'outro'  },
    flashcards: { label: 'Flashcards',        icon: '🃏', unidade: 'itens',      tipo: 'outro'  },
    revisao:    { label: 'Revisão',           icon: '🔁', unidade: 'percentual', tipo: 'outro'  },
    outro:      { label: 'Outra etapa',       icon: '📌', unidade: 'itens',      tipo: 'outro'  }
  };
  var MAT_SITUACAO_LBL = { 'nao-iniciada': 'Não iniciada', 'em-andamento': 'Em andamento', 'concluida': 'Concluída' };
  // Unidades de POSIÇÃO: a aluna informa onde parou e só a diferença conta.
  var MAT_POS_UNIDS = { paginas: 1, minutos: 1, percentual: 1 };

  function matEtapaKey(m) {
    if (m && m.etapa && MAT_ETAPAS[m.etapa]) return m.etapa;
    var t = m && m.tipo;
    if (t === 'video' || t === 'gravacao' || t === 'audio') return 'video';
    if (t === 'resumo') return 'resumo';
    if (m && m.unidade === 'questoes') return 'questoes';
    return 'leitura';
  }
  function matEtapaLabel(m) { return (m && m.etapaNome) || MAT_ETAPAS[matEtapaKey(m)].label; }
  function matEtapaIcon(m) { return MAT_ETAPAS[matEtapaKey(m)].icon; }
  function matAtividadeId(m) { return m ? (m.atividadeId || m.id) : null; }
  function matNum0(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function matHHMMtoMin(t) {
    if (!t || typeof t !== 'string') return NaN;
    var p = t.split(':');
    var h = parseInt(p[0], 10), mi = parseInt(p[1], 10);
    return (isNaN(h) || isNaN(mi)) ? NaN : h * 60 + mi;
  }
  // Mesma regra de todas as páginas: minutos planejados = b.minutos ou fim−ini;
  // estudados = minutosFeitos (ou o planejado, se marcado feito sem registro).
  function matPlannedMin(b) {
    if (!b) return 0;
    if (matNum0(b.minutos) > 0) return Math.round(matNum0(b.minutos));
    var mi = matHHMMtoMin(b.ini), mf = matHHMMtoMin(b.fim);
    if (!isNaN(mi) && !isNaN(mf)) return Math.max(0, Math.round(mf - mi));
    return 0;
  }
  function matStudiedMin(b) {
    if (!b) return 0;
    if (b.minutosFeitos != null) return Math.max(0, Math.round(matNum0(b.minutosFeitos)));
    return b.feito ? matPlannedMin(b) : 0;
  }

  // Agrupa os materiais em atividades (cada uma com suas etapas, na ordem
  // de criação). opts.incluirConcluidas: também as 100% concluídas.
  function matAtividades(opts) {
    opts = opts || {};
    var grupos = {}, ordem = [];
    matLoad().forEach(function (m) {
      if (!m) return;
      var aid = matAtividadeId(m);
      if (!grupos[aid]) {
        grupos[aid] = { id: aid, nome: m.nome, tipo: m.tipo, discId: m.discId || null, discNome: m.discNome || '',
                        conteudoId: m.conteudoId || null, conteudoNome: m.conteudoNome || '', prazo: m.prazo || null,
                        criadoEm: m.criadoEm || '', etapas: [] };
        ordem.push(aid);
      }
      var g = grupos[aid];
      if (!g.prazo && m.prazo) g.prazo = m.prazo;
      g.etapas.push(m);
    });
    var out = ordem.map(function (aid) {
      var g = grupos[aid];
      g.etapas.sort(function (a, b) {
        return (matNum0(a.ordem) - matNum0(b.ordem))
          || String(a.criadoEm || '').localeCompare(String(b.criadoEm || ''))
          || String(a.id).localeCompare(String(b.id));
      });
      g.concluida = g.etapas.every(function (m) { return !!m.concluido; });
      return g;
    });
    if (!opts.incluirConcluidas) out = out.filter(function (g) { return !g.concluida; });
    return out;
  }
  function matEtapasDe(atividadeId) {
    return matLoad().filter(function (m) { return m && matAtividadeId(m) === atividadeId; });
  }
  // Nova etapa numa atividade existente: herda nome, disciplina e conteúdo da
  // etapa-base; só etapa, unidade, total e estimativa são próprios.
  function matNovaEtapa(atividadeId, campos) {
    var base = matEtapasDe(atividadeId)[0];
    if (!base) return null;
    campos = campos || {};
    var key = campos.etapa && MAT_ETAPAS[campos.etapa] ? campos.etapa : 'outro';
    var def = MAT_ETAPAS[key];
    var unidade = campos.unidade || def.unidade;
    var total = matNum0(campos.total);
    if (!(total > 0) && unidade === 'percentual') total = 100;
    var est = matNum0(campos.estimativaMin);
    var m = {
      id: matUid(), nome: base.nome, tipo: campos.tipo || def.tipo,
      etapa: key, etapaNome: String(campos.etapaNome || '').trim() || null,
      unidade: unidade, total: total,
      atividadeId: atividadeId,
      discId: base.discId || null, discNome: base.discNome || null,
      conteudoId: base.conteudoId || null, conteudoNome: base.conteudoNome || null,
      prazo: campos.prazo || null, criadoEm: tzTodayKey(),
      ordem: matEtapasDe(atividadeId).length,
      concluido: false, concluidoEm: null, log: [],
      estimativaMin: est > 0 ? est : null, estimativaBaseMin: est > 0 ? 0 : null
    };
    if (!base.atividadeId) { base.atividadeId = atividadeId; matUpsert(base); }
    matUpsert(m);
    return m;
  }
  function matRemoverAtividade(atividadeId) {
    matSave(matLoad().filter(function (m) { return !(m && matAtividadeId(m) === atividadeId); }));
  }

  // Tempo da etapa a partir das sessões (blocos com materialId) + lançamentos
  // do log com tempo medido que não pertencem a nenhuma dessas sessões
  // (avanços antigos, registrados por outro caminho) — sem contar duas vezes.
  // items: [{ b, wk, date }] (ver TrackerMedSessoes.collectAll) ou [bloco].
  function matTempo(m, items) {
    var linked = {}, realizado = 0, reservado = 0, proximas = [], sessoes = [];
    (items || []).forEach(function (it) {
      var b = it && it.b ? it.b : it;
      if (!b || !m || b.materialId !== m.id) return;
      var date = (it && it.date) || b.data || null;
      var pl = matPlannedMin(b), st = matStudiedMin(b);
      linked[b.id] = 1;
      realizado += st;
      sessoes.push({ b: b, wk: it && it.wk, date: date, planned: pl, studied: st, feito: !!b.feito });
      if (!b.feito) {
        var falta = Math.max(0, pl - st);
        reservado += falta;
        proximas.push({ b: b, wk: it && it.wk, date: date, faltaMin: falta, planned: pl, studied: st });
      }
    });
    (m && Array.isArray(m.log) ? m.log : []).forEach(function (e) {
      if (!e) return;
      var sm = matNum0(e.sessaoMin);
      if (sm > 0 && (!e.blocoId || !linked[e.blocoId])) realizado += sm;
    });
    var byDate = function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); };
    proximas.sort(byDate);
    sessoes.sort(function (a, b) { return byDate(b, a); });
    return { realizadoMin: Math.round(realizado), reservadoMin: Math.round(reservado), proximas: proximas, sessoes: sessoes, nSessoes: sessoes.length };
  }
  function matSituacao(m, tempo) {
    if (!m) return 'nao-iniciada';
    if (m.concluido) return 'concluida';
    if (matPosAtual(m) > 0 || (tempo && tempo.realizadoMin > 0) || (Array.isArray(m.log) && m.log.length > 0)) return 'em-andamento';
    return 'nao-iniciada';
  }
  // Estimativa de tempo restante. fonte: 'manual' (a da aluna, descontando o
  // que ela estudou depois de defini-la) · 'ritmo' (velocidade medida) ·
  // 'proporcao' (tempo gasto × avanço, provisória) · null (sem dados).
  function matEstimativa(m, tempo, allSamples) {
    var st = matStats(m);
    if (m.concluido) return { min: 0, fonte: 'concluida' };
    var realizado = tempo ? matNum0(tempo.realizadoMin) : 0;
    if (matNum0(m.estimativaMin) > 0) {
      var gasto = Math.max(0, realizado - matNum0(m.estimativaBaseMin));
      return { min: Math.max(0, Math.round(matNum0(m.estimativaMin) - gasto)), fonte: 'manual', definida: matNum0(m.estimativaMin) };
    }
    if (st.restante <= 0 && matNum(m.total) > 0) return { min: 0, fonte: 'ritmo' };
    var ri = ritMaterial(m, allSamples);
    if (ri && ri.vel && ri.restanteMin != null) return { min: Math.max(0, Math.round(ri.restanteMin)), fonte: 'ritmo', vel: ri.vel, provisoria: !!ri.vel.provisoria };
    var pos = matPosAtual(m);
    if (realizado > 0 && pos > 0 && st.restante > 0) return { min: Math.max(0, Math.round(realizado * st.restante / pos)), fonte: 'proporcao', provisoria: true };
    return { min: null, fonte: null };
  }
  function matSetEstimativa(id, min, realizadoAtualMin) {
    var m = matGet(id);
    if (!m) return null;
    var v = matNum0(min);
    if (v > 0) { m.estimativaMin = Math.round(v); m.estimativaBaseMin = Math.round(matNum0(realizadoAtualMin)); }
    else { m.estimativaMin = null; m.estimativaBaseMin = null; }
    matUpsert(m);
    return m;
  }

  // Correção de lançamentos do log (os totais são derivados, então corrigir
  // um registro recalcula tudo). Atingiu o total → conclui; caiu abaixo →
  // reabre (a conclusão manual grava um lançamento até o total, então ela
  // só é desfeita se a aluna mexer nesse lançamento).
  function matRecalcConclusao(m) {
    var st = matStats(m);
    if (matNum(m.total) > 0 && st.restante <= 0) { if (!m.concluido) { m.concluido = true; m.concluidoEm = tzTodayKey(); } }
    else if (m.concluido) { m.concluido = false; m.concluidoEm = null; }
  }
  function matLogFind(m, ts) {
    var log = Array.isArray(m.log) ? m.log : [];
    for (var i = 0; i < log.length; i++) { if (log[i] && String(log[i].ts) === String(ts)) return i; }
    return -1;
  }
  function matLogEditar(id, ts, patch) {
    var m = matGet(id);
    if (!m) return null;
    var i = matLogFind(m, ts);
    if (i < 0) return null;
    var e = Object.assign({}, m.log[i]);
    var ateAntes = e.ate != null ? matNum0(e.ate) : null;
    patch = patch || {};
    if (patch.data) e.data = patch.data;
    if (patch.ate != null) {
      var ate = matNum0(patch.ate);
      e.ate = ate;
      if (e.de != null) e.qtd = Math.max(0, ate - matNum0(e.de));
    }
    if (patch.qtd != null) e.qtd = Math.max(0, matNum0(patch.qtd));
    if (patch.sessaoMin !== undefined) { if (matNum0(patch.sessaoMin) > 0) e.sessaoMin = matNum0(patch.sessaoMin); else delete e.sessaoMin; }
    if (patch.blocoId !== undefined) { if (patch.blocoId) e.blocoId = patch.blocoId; else delete e.blocoId; }
    m.log[i] = e;
    if (ateAntes != null && e.ate != null && matNum0(e.ate) !== ateAntes) matLogReencadear(m, i + 1, ateAntes, matNum0(e.ate));
    matRecalcConclusao(m);
    matUpsert(m);
    return m;
  }
  function matLogRemover(id, ts) {
    var m = matGet(id);
    if (!m) return null;
    var i = matLogFind(m, ts);
    if (i >= 0) {
      var rem = m.log[i];
      // Posição em que o log ficava ANTES do lançamento removido.
      var pos = 0;
      for (var k = 0; k < i; k++) { var p = m.log[k]; if (!p) continue; var a = parseFloat(p.ate); pos = isFinite(a) ? a : pos + matNum(p.qtd); }
      m.log.splice(i, 1);
      if (rem && rem.ate != null) matLogReencadear(m, i, matNum0(rem.ate), pos);
      matRecalcConclusao(m);
      matUpsert(m);
    }
    return m;
  }
  // Lançamentos de posição são encadeados (o "de" de um é o "ate" do anterior).
  // Corrigir ou remover um deles re-encadeia os seguintes enquanto a corrente
  // continuar (de === ate anterior), pra que o avanço de cada sessão continue
  // sendo a diferença real — a posição alcançada (último "ate") não muda.
  function matLogReencadear(m, from, ateAntigo, ateNovo) {
    var prevOld = ateAntigo, prevNew = ateNovo;
    for (var j = from; j < m.log.length; j++) {
      var e = m.log[j];
      if (!e || e.ate == null || e.de == null || matNum0(e.de) !== prevOld) break;
      var novo = Object.assign({}, e, { de: prevNew, qtd: Math.max(0, matNum0(e.ate) - prevNew) });
      m.log[j] = novo;
      prevOld = matNum0(e.ate); prevNew = matNum0(e.ate);
    }
  }
  // Lançamentos ligados a uma sessão (bloco), em qualquer material.
  function matLogPorBloco(blocoId) {
    var out = [];
    if (!blocoId) return out;
    matLoad().forEach(function (m) {
      (m && Array.isArray(m.log) ? m.log : []).forEach(function (e) { if (e && e.blocoId === blocoId) out.push({ material: m, entry: e }); });
    });
    return out;
  }
  // Tira de todos os materiais os lançamentos de uma sessão (ao trocar a
  // atividade de um registro ou excluir a sessão).
  function matLogDesvincularBloco(blocoId) {
    var mudou = [];
    if (!blocoId) return mudou;
    matLoad().forEach(function (m) {
      if (!m || !Array.isArray(m.log)) return;
      var antes = m.log.length;
      m.log = m.log.filter(function (e) { return !(e && e.blocoId === blocoId); });
      if (m.log.length !== antes) { matRecalcConclusao(m); matUpsert(m); mudou.push(m.id); }
    });
    return mudou;
  }
  // Avanço a partir do valor digitado: unidades de posição (página, minuto, %)
  // → diferença pra última posição; demais (questões, capítulos, itens) →
  // quantidade. Devolve { qtd, de, ate } ou { erro: 'menor'|'maior' }.
  function matAvancoDePosicao(m, valor) {
    var v = matNum0(valor);
    if (!(v > 0)) return null;
    if (MAT_POS_UNIDS[m.unidade]) {
      var pos = matPosAtual(m);
      if (v <= pos) return { erro: 'menor', pos: pos };
      var total = matNum(m.total);
      if (total > 0 && v > total) return { erro: 'maior', total: total };
      return { qtd: v - pos, de: pos, ate: v };
    }
    return { qtd: v, de: null, ate: null };
  }
  function matPergunta(unidade) {
    return ({ paginas: 'Parou em que página?', minutos: 'Parou em que minuto?', percentual: 'Em que % está agora?',
              capitulos: 'Capítulos concluídos', aulas: 'Aulas concluídas', questoes: 'Questões feitas', itens: 'Itens concluídos' })[unidade] || 'Quanto avançou?';
  }

  // ---- Sessões de todos os planos -------------------------------------
  // Blocos de estudo/revisão do plano em foco (chaves vivas) e dos demais
  // (snapshots), cada um com a data real — base do tempo por atividade e das
  // visões de dia/semana. Só leitura.
  function sessBlocoDate(wk, b) {
    if (b && b.data) return b.data;
    if (!wk || !b || b.dia == null) return null;
    var p = wk.split('-').map(Number);
    if (!p[0]) return null;
    var off = b.dia === 0 ? 6 : b.dia - 1;
    return tzKeyOf(new Date(p[0], p[1] - 1, p[2] + off));
  }
  function sessCollectAll() {
    var planos = ctxPlanos(), foco = ctxFocusId(), store = ctxSnapStore();
    var out = [], seenFoco = false;
    var addPlan = function (plan, p, isFoco) {
      if (!plan || typeof plan !== 'object') return;
      for (var wk in plan) {
        (plan[wk] || []).forEach(function (b) {
          if (!b) return;
          out.push({ b: b, wk: wk, date: sessBlocoDate(wk, b), planoId: p ? p.id : null, planoNome: p ? p.nome : '', foco: isFoco });
        });
      }
    };
    planos.forEach(function (p) {
      if (!p || !p.id) return;
      var isFoco = p.id === foco;
      if (isFoco) seenFoco = true;
      addPlan(isFoco ? jparse(lsGet(LIVE_KEYS.plan), {}) : jparse((store[p.id] || {}).plan, {}), p, isFoco);
    });
    if (!seenFoco) addPlan(jparse(lsGet(LIVE_KEYS.plan), {}), null, true);
    return out;
  }
  window.TrackerMedSessoes = {
    collectAll: sessCollectAll,
    blocoDate: sessBlocoDate,
    plannedMin: matPlannedMin,
    studiedMin: matStudiedMin
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
    posAtual: matPosAtual,
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
    tipoLabel: matTipoLabel,
    // atividades e etapas
    ETAPAS: MAT_ETAPAS,
    SITUACAO_LBL: MAT_SITUACAO_LBL,
    POS_UNIDS: MAT_POS_UNIDS,
    etapaKey: matEtapaKey,
    etapaLabel: matEtapaLabel,
    etapaIcon: matEtapaIcon,
    atividadeId: matAtividadeId,
    atividades: matAtividades,
    etapasDe: matEtapasDe,
    novaEtapa: matNovaEtapa,
    removerAtividade: matRemoverAtividade,
    tempo: matTempo,
    situacao: matSituacao,
    estimativa: matEstimativa,
    setEstimativa: matSetEstimativa,
    logEditar: matLogEditar,
    logRemover: matLogRemover,
    logPorBloco: matLogPorBloco,
    logDesvincularBloco: matLogDesvincularBloco,
    avancoDePosicao: matAvancoDePosicao,
    pergunta: matPergunta,
    plannedMin: matPlannedMin,
    studiedMin: matStudiedMin
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

  // ---- Afazeres do dia (lista de tarefas) --------------------------------
  // Lista simples de tarefas por dia, separada das sessões de estudo: texto
  // livre, feita/não feita e data. Mora no Histórico (segue o dia selecionado)
  // e aparece também na tela inicial do app (sempre "hoje"). Chave
  // trackermed.* — entra na sincronização da nuvem, no backup e no "Recomeçar
  // do zero" sem configuração extra. Shape de uma tarefa:
  // { id:'t-…', data:'YYYY-MM-DD', texto, feito:false, criadoEm:ISO,
  //   feitoEm:ISO|null, ordem:n, movidaDe:'YYYY-MM-DD'? }
  var TAR_KEY = 'trackermed.tarefas.v1';
  var TAR_MAX = 200;
  function tarLoad() {
    var a = jparse(lsGet(TAR_KEY), []);
    return Array.isArray(a) ? a.filter(function (t) { return t && t.id && typeof t.texto === 'string' && t.data; }) : [];
  }
  function tarSave(arr) {
    lsSet(TAR_KEY, JSON.stringify(arr));
    try { window.dispatchEvent(new CustomEvent('tmtarefas')); } catch (e) {}
  }
  function tarUid() { return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  // Pendentes primeiro (na ordem em que foram criadas), concluídas por último
  // (na ordem em que foram concluídas) — o que falta fica sempre à vista.
  function tarOrdenar(list) {
    return list.slice().sort(function (a, b) {
      if (!!a.feito !== !!b.feito) return a.feito ? 1 : -1;
      if (a.feito) return String(a.feitoEm || '').localeCompare(String(b.feitoEm || ''));
      return ((a.ordem || 0) - (b.ordem || 0)) || String(a.criadoEm || '').localeCompare(String(b.criadoEm || ''));
    });
  }
  function tarDoDia(dataKey) { return tarOrdenar(tarLoad().filter(function (t) { return t.data === dataKey; })); }
  // Tarefas de dias ANTERIORES que ficaram sem concluir — pra trazer pra frente.
  function tarPendentesAntes(dataKey) {
    return tarLoad().filter(function (t) { return !t.feito && t.data < dataKey; })
      .sort(function (a, b) { return String(a.data).localeCompare(String(b.data)) || ((a.ordem || 0) - (b.ordem || 0)); });
  }
  function tarProxOrdem(arr, dataKey) {
    return arr.reduce(function (m, t) { return t.data === dataKey ? Math.max(m, t.ordem || 0) : m; }, 0) + 1;
  }
  function tarAdd(dataKey, texto) {
    texto = String(texto == null ? '' : texto).trim().slice(0, TAR_MAX);
    if (!texto || !dataKey) return null;
    var arr = tarLoad();
    var t = { id: tarUid(), data: dataKey, texto: texto, feito: false, criadoEm: new Date().toISOString(), feitoEm: null, ordem: tarProxOrdem(arr, dataKey) };
    arr.push(t);
    tarSave(arr);
    return t;
  }
  function tarPatch(id, fn) {
    var arr = tarLoad(), hit = null;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) { hit = fn(arr[i]) || arr[i]; arr[i] = hit; break; }
    }
    if (hit) tarSave(arr);
    return hit;
  }
  function tarToggle(id, feito) {
    return tarPatch(id, function (t) {
      var f = feito == null ? !t.feito : !!feito;
      t.feito = f; t.feitoEm = f ? new Date().toISOString() : null;
      return t;
    });
  }
  function tarEditar(id, texto) {
    texto = String(texto == null ? '' : texto).trim().slice(0, TAR_MAX);
    if (!texto) return null;
    return tarPatch(id, function (t) { t.texto = texto; return t; });
  }
  function tarRemover(id) {
    var arr = tarLoad();
    var novo = arr.filter(function (t) { return t.id !== id; });
    if (novo.length !== arr.length) tarSave(novo);
  }
  // Move tarefas pra outro dia (guarda de onde vieram). Usado pra trazer as
  // pendentes de ontem/anteontem pra hoje.
  function tarMoverPara(ids, dataKey) {
    if (!dataKey || !ids || !ids.length) return;
    var set = {}; ids.forEach(function (id) { set[id] = 1; });
    var arr = tarLoad(), ordem = tarProxOrdem(arr, dataKey) - 1, mudou = false;
    arr.forEach(function (t) {
      if (!set[t.id] || t.data === dataKey) return;
      t.movidaDe = t.movidaDe || t.data; t.data = dataKey; t.ordem = ++ordem; mudou = true;
    });
    if (mudou) tarSave(arr);
  }
  function tarLimparConcluidas(dataKey) {
    var arr = tarLoad();
    var novo = arr.filter(function (t) { return !(t.feito && t.data === dataKey); });
    if (novo.length !== arr.length) tarSave(novo);
  }
  function tarStats(dataKey) {
    var l = tarLoad().filter(function (t) { return t.data === dataKey; });
    var f = l.filter(function (t) { return t.feito; }).length;
    return { total: l.length, feitas: f, pendentes: l.length - f };
  }

  // ---- Widget: a lista pronta, pra qualquer página montar num <div> --------
  // TrackerMedTarefas.render(el, 'YYYY-MM-DD', { compact, placeholder, onChange })
  // desenha (ou redesenha) a lista dentro de `el`. Os eventos ficam no próprio
  // elemento, e o widget se redesenha sozinho depois de cada ação, quando outra
  // aba mexe na lista e quando a nuvem traz dados novos.
  var TAR_CSS = [
    '.tm-todo{font-family:inherit;color:var(--text,var(--ink))}',
    '.tm-todo-add{display:flex;gap:8px}',
    '.tm-todo-add input{flex:1;min-width:0;padding:11px 13px;border:1px solid var(--line,#EFDBDD);background:var(--paper,#FAF0EE);color:var(--text,var(--ink));font-family:inherit;font-size:14px;border-radius:9px;transition:border-color .2s,box-shadow .2s}',
    '.tm-todo-add input:focus{outline:none;border-color:var(--cobalt,#C2255C);box-shadow:var(--ring,0 0 0 3px rgba(194,37,92,.3))}',
    '.tm-todo-add button{flex:none;background-image:var(--grad-brand,var(--grad,none));background-color:var(--cobalt,#C2255C);color:#fff;border:none;border-radius:9px;padding:0 16px;min-height:42px;font-family:inherit;font-size:13px;font-weight:600;letter-spacing:.02em;cursor:pointer;box-shadow:var(--sh-glow,0 8px 26px rgba(194,37,92,.34));transition:transform .2s,box-shadow .2s;white-space:nowrap}',
    '.tm-todo-add button:hover{transform:translateY(-2px)}',
    '.tm-todo-prog{display:flex;align-items:center;gap:10px;margin:12px 0 8px;font-size:11.5px;color:var(--muted,#7E6577)}',
    '.tm-todo-prog .bar{flex:1;height:6px;background:rgba(43,15,38,.10);border-radius:999px;overflow:hidden}',
    '.tm-todo-prog .bar i{display:block;height:100%;background-image:var(--grad-brand,var(--grad,none));background-color:var(--cobalt,#C2255C);border-radius:999px;transition:width .35s}',
    '.tm-todo-prog.done .bar i{background-image:none;background-color:#43A047}',
    '.tm-todo-prog .lbl{white-space:nowrap;font-weight:600}',
    '.tm-todo-clear{background:transparent;border:none;color:var(--cobalt,#C2255C);font-family:inherit;font-size:11.5px;font-weight:600;cursor:pointer;padding:2px 4px}',
    '.tm-todo-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}',
    '.tm-todo-item{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--paper,#FAF0EE);border:1px solid var(--line,#EFDBDD);border-left:3px solid var(--cobalt,#C2255C);border-radius:0 8px 8px 0;transition:background-color .2s,opacity .2s}',
    '.tm-todo-item.done{opacity:.62;border-left-color:#43A047;background:#E8F5E9}',
    '.tm-todo-item.done .tm-todo-txt{text-decoration:line-through;color:var(--muted,#7E6577)}',
    '.tm-todo-item.late{border-left-color:var(--amber,#F4A72F);background:#FFF8E1}',
    '.tm-todo-check{position:relative;flex:none;width:22px;height:22px;cursor:pointer;margin:0}',
    '.tm-todo-check input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}',
    '.tm-todo-check span{position:absolute;inset:0;border:2px solid var(--cobalt,#C2255C);border-radius:7px;background:var(--card,#fff);transition:background-color .15s,border-color .15s}',
    '.tm-todo-check input:checked+span{background:#43A047;border-color:#43A047}',
    '.tm-todo-check input:checked+span::after{content:"";position:absolute;left:6px;top:2px;width:5px;height:10px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}',
    '.tm-todo-check input:focus-visible+span{box-shadow:var(--ring,0 0 0 3px rgba(194,37,92,.3))}',
    '.tm-todo-txt{flex:1;min-width:0;font-size:14px;font-weight:500;line-height:1.35;cursor:pointer;overflow-wrap:anywhere}',
    '.tm-todo-edit{flex:1;min-width:0;padding:6px 9px;border:1px solid var(--cobalt,#C2255C);border-radius:7px;background:var(--card,#fff);color:var(--text,var(--ink));font-family:inherit;font-size:14px}',
    '.tm-todo-edit:focus{outline:none;box-shadow:var(--ring,0 0 0 3px rgba(194,37,92,.3))}',
    '.tm-todo-dia{flex:none;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#8D5A00;background:rgba(244,167,47,.18);padding:3px 7px;border-radius:999px;white-space:nowrap}',
    '.tm-todo-acts{flex:none;display:flex;gap:2px}',
    '.tm-todo-acts button{background:transparent;border:none;color:#b5b5b5;font-size:13px;cursor:pointer;padding:6px;min-width:32px;min-height:32px;border-radius:7px;font-family:inherit;line-height:1}',
    '.tm-todo-acts button:hover{color:var(--cobalt,#C2255C);background:rgba(194,37,92,.08)}',
    '.tm-todo-acts button[data-act="remover"]:hover{color:var(--rose,#FF5B5B)}',
    '.tm-todo-acts button[data-act="trazer"]{color:var(--cobalt,#C2255C);font-weight:700;font-size:11.5px;white-space:nowrap}',
    '.tm-todo-empty{font-size:12.5px;color:var(--muted,#7E6577);padding:14px 4px 4px}',
    '.tm-todo-pend{margin-top:14px;padding-top:12px;border-top:1px dashed var(--line,#EFDBDD)}',
    '.tm-todo-pend-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;font-weight:600;color:#8D5A00;margin-bottom:8px}',
    '.tm-todo-pend-head button{background:transparent;border:1px solid var(--cobalt,#C2255C);color:var(--cobalt,#C2255C);border-radius:999px;padding:5px 11px;font-family:inherit;font-size:11.5px;font-weight:600;cursor:pointer}',
    '.tm-todo-pend-head button:hover{background:var(--cobalt,#C2255C);color:#fff}',
    '.tm-todo.compact .tm-todo-add input{padding:10px 12px;font-size:13.5px}',
    '.tm-todo.compact .tm-todo-add button{min-height:40px;padding:0 13px}',
    '.tm-todo.compact .tm-todo-txt{font-size:13.5px}',
    '[data-theme="dark"] .tm-todo-add input,[data-theme="dark"] .tm-todo-edit{background:var(--surface-soft,#2A1327);color:var(--text,#F6EDF1)}',
    '[data-theme="dark"] .tm-todo-item{background:var(--surface-soft,#2A1327)}',
    '[data-theme="dark"] .tm-todo-item.done{background:rgba(67,160,71,.16)}',
    '[data-theme="dark"] .tm-todo-item.late{background:rgba(244,167,47,.14)}',
    '[data-theme="dark"] .tm-todo-check span{background:var(--surface,#33182F)}',
    '[data-theme="dark"] .tm-todo-prog .bar{background:rgba(250,240,238,.14)}',
    '[data-theme="dark"] .tm-todo-dia,[data-theme="dark"] .tm-todo-pend-head{color:#F4C77A}',
    '@media (max-width:640px){.tm-todo-add button{padding:0 12px}.tm-todo-item{padding:8px 10px;gap:8px}.tm-todo-prog .lbl{white-space:normal}}'
  ].join('\n');
  function tarInjectCss() {
    if (document.getElementById('tm-todo-css')) return;
    var s = document.createElement('style');
    s.id = 'tm-todo-css';
    s.textContent = TAR_CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  // 'YYYY-MM-DD' → 'sáb 01/11'
  function tarFmtDia(key) {
    var p = String(key || '').split('-');
    if (p.length !== 3) return key || '';
    var d = new Date(+p[0], +p[1] - 1, +p[2], 12);
    try { return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(/\./g, ''); }
    catch (e) { return p[2] + '/' + p[1]; }
  }
  function tarItemHTML(t, pendente) {
    return '<li class="tm-todo-item' + (t.feito ? ' done' : '') + (pendente ? ' late' : '') + '" data-id="' + escTxt(t.id) + '">'
      + '<label class="tm-todo-check"><input type="checkbox" data-act="toggle"' + (t.feito ? ' checked' : '') + ' aria-label="' + (t.feito ? 'Desmarcar' : 'Concluir') + ': ' + escTxt(t.texto) + '"><span></span></label>'
      + '<span class="tm-todo-txt" data-act="toggle-txt" title="' + (t.feito ? 'Desmarcar' : 'Marcar como concluída') + '">' + escTxt(t.texto) + '</span>'
      + (pendente ? '<span class="tm-todo-dia" title="Ficou pendente nesse dia">' + escTxt(tarFmtDia(t.data)) + '</span>' : '')
      + '<span class="tm-todo-acts">'
      + (pendente ? '<button type="button" data-act="trazer" title="Trazer pra hoje">→ hoje</button>' : '')
      + '<button type="button" data-act="editar" title="Editar" aria-label="Editar tarefa">✎</button>'
      + '<button type="button" data-act="remover" title="Excluir" aria-label="Excluir tarefa">🗑</button>'
      + '</span></li>';
  }
  var tarMounted = [];
  function tarRender(el, dataKey, opts) {
    if (!el) return;
    if (opts) el._tmTodoOpts = opts; else opts = el._tmTodoOpts || {};
    tarInjectCss();
    dataKey = dataKey || el._tmTodoDia || tzTodayKey();
    el._tmTodoDia = dataKey;
    // Não atropela uma edição em andamento; o rascunho do campo "nova tarefa"
    // sobrevive ao redesenho (a página redesenha de tempos em tempos).
    var editando = el.querySelector('.tm-todo-edit');
    if (editando && document.activeElement === editando) return;
    var addOld = el.querySelector('.tm-todo-add input');
    var rascunho = addOld ? addOld.value : '';
    var tinhaFoco = !!(addOld && document.activeElement === addOld);
    var ehHoje = dataKey === tzTodayKey();
    var lista = tarDoDia(dataKey);
    var feitas = lista.filter(function (t) { return t.feito; }).length;
    var pend = ehHoje ? tarPendentesAntes(dataKey) : [];
    var pct = lista.length ? Math.round(feitas / lista.length * 100) : 0;
    var placeholder = opts.placeholder || (ehHoje ? 'Nova tarefa pra hoje — ex: ler cap. 12, fazer 30 questões…' : 'Nova tarefa pra ' + tarFmtDia(dataKey) + '…');
    var h = '<div class="tm-todo' + (opts.compact ? ' compact' : '') + '">';
    h += '<form class="tm-todo-add" autocomplete="off"><input type="text" maxlength="' + TAR_MAX + '" placeholder="' + escTxt(placeholder) + '" aria-label="Nova tarefa" enterkeyhint="done"><button type="submit">+ Adicionar</button></form>';
    if (lista.length) {
      h += '<div class="tm-todo-prog' + (pct === 100 ? ' done' : '') + '"><div class="bar"><i style="width:' + pct + '%"></i></div>'
        + '<span class="lbl">' + feitas + ' de ' + lista.length + ' ' + (lista.length === 1 ? 'concluída' : 'concluídas') + (pct === 100 ? ' · dia fechado ✓' : '') + '</span>'
        + (feitas ? '<button type="button" class="tm-todo-clear" data-act="limpar" title="Apaga as tarefas já concluídas deste dia">limpar concluídas</button>' : '')
        + '</div>';
      h += '<ul class="tm-todo-list">' + lista.map(function (t) { return tarItemHTML(t, false); }).join('') + '</ul>';
    } else {
      h += '<div class="tm-todo-empty">' + escTxt(opts.vazio || (ehHoje ? 'Nenhuma tarefa pra hoje ainda. Anota aí em cima o que precisa sair do papel.' : 'Nenhuma tarefa nesse dia.')) + '</div>';
    }
    if (pend.length) {
      h += '<div class="tm-todo-pend"><div class="tm-todo-pend-head"><span>' + pend.length + (pend.length === 1 ? ' tarefa de um dia anterior ficou pendente' : ' tarefas de dias anteriores ficaram pendentes') + '</span>'
        + '<button type="button" data-act="trazer-todas">trazer todas pra hoje</button></div>'
        + '<ul class="tm-todo-list">' + pend.map(function (t) { return tarItemHTML(t, true); }).join('') + '</ul></div>';
    }
    h += '</div>';
    el.innerHTML = h;
    var addNew = el.querySelector('.tm-todo-add input');
    if (addNew && rascunho) addNew.value = rascunho;
    if (addNew && tinhaFoco) { try { addNew.focus(); addNew.setSelectionRange(addNew.value.length, addNew.value.length); } catch (e) {} }
    if (!el._tmTodoBound) { el._tmTodoBound = true; tarMounted.push(el); tarBind(el); }
  }
  function tarRefresh(el) {
    tarRender(el, el._tmTodoDia, null);
    var cb = el._tmTodoOpts && el._tmTodoOpts.onChange;
    if (typeof cb === 'function') { try { cb(); } catch (e) {} }
  }
  function tarIdDe(node) {
    var li = node && node.closest ? node.closest('.tm-todo-item') : null;
    return li ? li.getAttribute('data-id') : null;
  }
  function tarComecarEdicao(el, li) {
    var id = li.getAttribute('data-id');
    var t = tarLoad().filter(function (x) { return x.id === id; })[0];
    var txt = li.querySelector('.tm-todo-txt');
    if (!t || !txt) return;
    var inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'tm-todo-edit'; inp.maxLength = TAR_MAX; inp.value = t.texto;
    inp.setAttribute('aria-label', 'Editar tarefa');
    var fechado = false;
    function salvar() {
      if (fechado) return; fechado = true;
      var v = inp.value.trim();
      if (v && v !== t.texto) tarEditar(id, v);
      inp.remove();
      tarRefresh(el);
    }
    function cancelar() { if (fechado) return; fechado = true; inp.remove(); tarRefresh(el); }
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); salvar(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
    });
    inp.addEventListener('blur', salvar);
    txt.replaceWith(inp);
    try { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) {}
  }
  function tarBind(el) {
    el.addEventListener('submit', function (e) {
      var form = e.target && e.target.closest ? e.target.closest('.tm-todo-add') : null;
      if (!form) return;
      e.preventDefault();
      var inp = form.querySelector('input');
      var v = inp ? inp.value.trim() : '';
      if (!v) { if (inp) inp.focus(); return; }
      tarAdd(el._tmTodoDia, v);
      if (inp) inp.value = '';
      tarRefresh(el);
      var again = el.querySelector('.tm-todo-add input');
      if (again) { try { again.focus(); } catch (e2) {} }
    });
    el.addEventListener('change', function (e) {
      var cb = e.target;
      if (!cb || cb.getAttribute('data-act') !== 'toggle') return;
      var id = tarIdDe(cb);
      if (!id) return;
      tarToggle(id, cb.checked);
      tarRefresh(el);
    });
    el.addEventListener('click', function (e) {
      var node = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!node || node.tagName === 'INPUT') return;
      var act = node.getAttribute('data-act');
      var li = node.closest('.tm-todo-item');
      var id = li ? li.getAttribute('data-id') : null;
      if (act === 'toggle-txt' && id) { tarToggle(id); tarRefresh(el); }
      else if (act === 'editar' && li) { e.preventDefault(); tarComecarEdicao(el, li); }
      else if (act === 'remover' && id) {
        var t = tarLoad().filter(function (x) { return x.id === id; })[0];
        if (!t) return;
        if (!t.feito && !confirm('Excluir a tarefa "' + t.texto + '"?')) return;
        tarRemover(id); tarRefresh(el);
      }
      else if (act === 'trazer' && id) { tarMoverPara([id], el._tmTodoDia); tarRefresh(el); }
      else if (act === 'trazer-todas') {
        tarMoverPara(tarPendentesAntes(el._tmTodoDia).map(function (t) { return t.id; }), el._tmTodoDia);
        tarRefresh(el);
      }
      else if (act === 'limpar') {
        var st = tarStats(el._tmTodoDia);
        if (!st.feitas) return;
        if (!confirm('Apagar ' + (st.feitas === 1 ? 'a tarefa concluída' : 'as ' + st.feitas + ' tarefas concluídas') + ' deste dia?')) return;
        tarLimparConcluidas(el._tmTodoDia); tarRefresh(el);
      }
    });
  }
  // Outra aba mexeu na lista, ou a nuvem trouxe dados novos: redesenha os
  // widgets que ainda estão na página.
  function tarRefreshMounted() {
    tarMounted = tarMounted.filter(function (el) { return el && document.contains(el); });
    tarMounted.forEach(function (el) { tarRender(el, el._tmTodoDia, null); });
  }
  window.addEventListener('storage', function (e) { if (e && e.key === TAR_KEY) tarRefreshMounted(); });
  window.addEventListener('tmsync', function (e) { if (e && e.detail && e.detail.applied) tarRefreshMounted(); });

  window.TrackerMedTarefas = {
    KEY: TAR_KEY,
    load: tarLoad,
    save: tarSave,
    doDia: tarDoDia,
    pendentesAntes: tarPendentesAntes,
    add: tarAdd,
    toggle: tarToggle,
    editar: tarEditar,
    remover: tarRemover,
    moverPara: tarMoverPara,
    limparConcluidas: tarLimparConcluidas,
    stats: tarStats,
    render: tarRender,
    fmtDia: tarFmtDia
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
