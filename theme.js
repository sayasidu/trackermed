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

  // ---- Indicador global de plano em foco --------------------------------
  // Vários planos podem ficar ativos ao mesmo tempo. O plano "em foco" é o que
  // você edita nas abas Disciplinas, Planejamento e Revisões (usa as chaves
  // vivas). Já o Planejamento geral (calendário) e o Histórico reúnem TODOS os
  // planos, com filtro por plano. Este chip na barra lateral mostra qual plano
  // de foco (residência/ENAMED/objetivo) está em edição, pra não confundir com
  // o semestre. (Só aparece quando o foco é um desses planos.)
  function escTxt(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Apresentação por tipo de plano de foco no chip (ícone, rótulo e cores que
  // leem bem sobre a barra lateral escura).
  var FOCO_INFO = {
    residencia: { icon: '🏥', label: 'Residência em foco', base: '124,148,255', txt: '#93B4FF' },
    enamed:     { icon: '📋', label: 'ENAMED em foco',      base: '244,167,47',  txt: '#F7C77A' },
    objetivo:   { icon: '📌', label: 'Objetivo em foco',    base: '124,92,252',  txt: '#B9A9FF' }
  };
  function activeFoco() {
    var id = null, planos = [];
    try { id = localStorage.getItem('trackermed.semestreAtivo.v1'); } catch (e) {}
    if (!id) return null;
    try { planos = JSON.parse(localStorage.getItem('trackermed.planos.v1') || '[]'); } catch (e) {}
    var p = planos.find(function (x) { return x && x.id === id; });
    return (p && FOCO_INFO[p.tipo]) ? p : null;
  }
  function renderContextIndicator() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    var old = sidebar.querySelector('.ctx-indicator');
    if (old) old.remove();
    var p = activeFoco();
    if (!p) return;
    var info = FOCO_INFO[p.tipo];
    var a = document.createElement('a');
    a.href = 'planos.html';
    a.className = 'ctx-indicator';
    a.title = info.label + ' — você edita as disciplinas e o cronograma dele aqui. No Planejamento geral e no Histórico, todos os planos aparecem juntos (com filtro). Clique pra gerenciar em Planos.';
    a.style.cssText = 'display:block;margin-top:16px;padding:10px 12px;border:1px solid rgba(' + info.base + ',0.5);border-left:3px solid ' + info.txt + ';background:rgba(' + info.base + ',0.16);border-radius:2px;text-decoration:none;line-height:1.35;';
    a.innerHTML =
      '<span style="display:block;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;color:' + info.txt + '">' + info.icon + ' ' + escTxt(info.label) + '</span>' +
      '<b style="display:block;font-family:\'Fraunces\',serif;font-size:14px;font-weight:600;margin-top:3px;color:var(--paper)">' + escTxt(p.nome) + '</b>' +
      '<span style="display:block;font-size:10px;color:rgba(244,241,234,0.6);margin-top:2px">em edição · planejamento e histórico reúnem todos os planos</span>';
    var foot = sidebar.querySelector('.sidebar-foot');
    if (foot) sidebar.insertBefore(a, foot);
    else sidebar.appendChild(a);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderContextIndicator);
  } else {
    renderContextIndicator();
  }
  // Atualiza quando outra aba muda o contexto, ou quando a própria página pede.
  window.addEventListener('storage', function (e) {
    if (!e || !e.key || e.key === 'trackermed.semestreAtivo.v1' || e.key === 'trackermed.planos.v1') {
      renderContextIndicator();
    }
  });

  window.TrackerMedTheme = { toggle, apply, current };
  window.TrackerMedContext = { refresh: renderContextIndicator };
})();
