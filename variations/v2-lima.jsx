// Variation 2 — Lima Ácida (dark mode)
// Charcoal + acid lime + coral. Heatmap data-viz, compact rails, techy/terminal feel.

const V2 = {
  bg: '#0E0F0C',
  panel: '#16180F',
  panel2: '#1D2015',
  line: '#2A2E1F',
  line2: '#3A3F2A',
  text: '#E9EADC',
  muted: '#7A7F65',
  lime: '#C9FF2E',
  limeDim: '#8FB520',
  coral: '#FF6B4A',
  rose: '#FF3860',
  cyan: '#5DE6C4',
  amber: '#FFB020',
};

const v2Disciplines = [
  { name: 'Morfofuncional',      time: '10h22', pct: 90, hrs: 10.4 },
  { name: 'Sínd. Hematológicas', time: '08h45', pct: 81, hrs: 8.75 },
  { name: 'Emergências',         time: '12h10', pct: 91, hrs: 12.2 },
  { name: 'Farmacologia',        time: '06h58', pct: 69, hrs: 6.97 },
  { name: 'Saúde Coletiva',      time: '03h14', pct: 82, hrs: 3.23 },
  { name: 'Clínica Médica',      time: '09h02', pct: 76, hrs: 9.03 },
];

function V2Sidebar() {
  const items = [
    ['01', 'Home', true], ['02', 'Planos', false], ['03', 'Disciplinas', false],
    ['04', 'Edital', false], ['05', 'Planejamento', false], ['06', 'Revisões', false],
    ['07', 'Histórico', false], ['08', 'Estatísticas', false], ['09', 'Simulados', false],
  ];
  return (
    <div style={{
      width: 210, background: V2.panel, color: V2.text, padding: '24px 14px',
      borderRight: `1px solid ${V2.line}`, display: 'flex', flexDirection: 'column',
      fontFamily: '"JetBrains Mono", "SF Mono", monospace',
    }}>
      <div style={{ padding: '4px 8px 28px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 26, height: 26, background: V2.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', color: V2.bg, fontWeight: 900, fontSize: 14 }}>M</div>
        <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>
          TrackerMed<span style={{ color: V2.lime }}>.</span>
        </div>
      </div>
      <div style={{ fontSize: 9, color: V2.muted, padding: '0 8px 8px', letterSpacing: 1 }}>/ NAV</div>
      {items.map(([num, name, active]) => (
        <div key={name} style={{
          padding: '9px 10px', fontSize: 12, display: 'flex', gap: 10, alignItems: 'center',
          background: active ? V2.lime : 'transparent',
          color: active ? V2.bg : V2.text, fontWeight: active ? 700 : 400,
          borderLeft: active ? 'none' : `2px solid transparent`, cursor: 'pointer',
        }}>
          <span style={{ color: active ? V2.bg : V2.muted, fontSize: 10 }}>{num}</span>
          <span style={{ fontFamily: active ? '"Space Grotesk", sans-serif' : 'inherit' }}>{name}</span>
          {active && <span style={{ marginLeft: 'auto' }}>▸</span>}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ borderTop: `1px dashed ${V2.line2}`, padding: '14px 8px 0', fontSize: 10, lineHeight: 1.6, color: V2.muted }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>sessão</span><span style={{ color: V2.lime }}>01:42:18</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>cpu</span><span>▇▇▇▅▃ 71%</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>build</span><span>v2.6.0</span></div>
      </div>
    </div>
  );
}

function V2Bar({ label, value, max, color = V2.lime }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
      <div style={{ width: 110, color: V2.text, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ flex: 1, height: 18, background: V2.panel2, border: `1px solid ${V2.line}`, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: color }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 6px', color: pct > 50 ? V2.bg : V2.text, fontWeight: 700, mixBlendMode: pct > 50 ? 'normal' : 'normal' }}>
          {value}h
        </div>
      </div>
      <div style={{ width: 36, color: V2.muted, textAlign: 'right' }}>{Math.round(pct)}%</div>
    </div>
  );
}

function V2Heatmap() {
  // 7 rows (weekdays) × 18 cols (weeks/sessions)
  const rng = (s) => { let x = s; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; };
  const r = rng(7);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(18, 1fr)', gap: 3 }}>
      {Array.from({ length: 7 * 18 }, (_, i) => {
        const v = r();
        const today = i === 7 * 18 - 5;
        const miss = v < 0.12;
        const intensity = Math.min(1, v * 1.4);
        const bg = miss ? V2.panel2 : `rgba(201, 255, 46, ${0.2 + intensity * 0.8})`;
        return (
          <div key={i} style={{
            aspectRatio: '1', background: bg,
            border: today ? `1px solid ${V2.coral}` : `1px solid ${V2.line}`,
          }} />
        );
      })}
    </div>
  );
}

function V2Dashboard() {
  return (
    <div style={{
      display: 'flex', width: 1280, height: 820, background: V2.bg, color: V2.text,
      fontFamily: '"Space Grotesk", -apple-system, sans-serif',
    }}>
      <V2Sidebar />
      <div style={{ flex: 1, padding: '22px 28px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: V2.muted, letterSpacing: 1.5 }}>
              / HOME / MÓDULO_02 / HOJE
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.8, marginTop: 4 }}>
              Painel de estudo <span style={{ color: V2.lime }}>—</span> segunda, 19/abr
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>
            <div style={{ color: V2.muted }}>● online</div>
            <div style={{ background: V2.panel, border: `1px solid ${V2.line2}`, padding: '6px 12px', color: V2.text }}>MÓDULO 02 ▾</div>
            <div style={{ background: V2.lime, color: V2.bg, padding: '6px 14px', fontWeight: 700, letterSpacing: 0.5 }}>+ ADICIONAR ESTUDO</div>
            <div style={{ width: 30, height: 30, background: V2.coral, color: V2.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>JM</div>
          </div>
        </div>

        {/* KPIs — huge single-row stats with sparkline */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: 'TEMPO DE ESTUDO', value: '40h45', sub: 'meta 60h · 68%', color: V2.lime, corner: '↗ +12%' },
            { label: 'DESEMPENHO', value: '85%', sub: '128 acertos / 14 erros', color: V2.cyan, corner: '↗ +3%' },
            { label: 'PROGRESSO EDITAL', value: '42%', sub: '54 de 128 tópicos', color: V2.amber, corner: '↗ +6%' },
            { label: 'SEQUÊNCIA', value: '2d', sub: 'recorde · 7 dias', color: V2.coral, corner: '— hoje' },
          ].map((k, i) => (
            <div key={i} style={{
              background: V2.panel, border: `1px solid ${V2.line}`, padding: '16px 18px',
              position: 'relative',
            }}>
              <div style={{ fontSize: 9, color: V2.muted, letterSpacing: 1.5, fontFamily: '"JetBrains Mono", monospace' }}>{k.label}</div>
              <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1.5, color: k.color, lineHeight: 1.1, marginTop: 8, fontFamily: '"Space Grotesk", sans-serif' }}>{k.value}</div>
              <div style={{ fontSize: 11, color: V2.muted, marginTop: 6, fontFamily: '"JetBrains Mono", monospace' }}>{k.sub}</div>
              <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 10, color: k.color, fontFamily: '"JetBrains Mono", monospace' }}>{k.corner}</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, width: '100%', background: V2.panel2 }}>
                <div style={{ height: '100%', width: `${50 + i * 10}%`, background: k.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Middle: heatmap + quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 10 }}>
          <div style={{ background: V2.panel, border: `1px solid ${V2.line}`, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 9, color: V2.muted, letterSpacing: 1.5, fontFamily: '"JetBrains Mono", monospace' }}>CONSTÂNCIA · ÚLTIMOS 18 × 7</div>
                <div style={{ fontSize: 15, marginTop: 4 }}>
                  <b style={{ color: V2.lime }}>2 dias</b> sem falhar · recorde <b style={{ color: V2.coral }}>7d</b>
                </div>
              </div>
              <div style={{ fontSize: 10, color: V2.muted, fontFamily: '"JetBrains Mono", monospace', display: 'flex', gap: 12 }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: V2.panel2, border: `1px solid ${V2.line}`, verticalAlign: 'middle', marginRight: 4 }} />miss</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: V2.limeDim, verticalAlign: 'middle', marginRight: 4 }} />low</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: V2.lime, verticalAlign: 'middle', marginRight: 4 }} />hi</span>
              </div>
            </div>
            <V2Heatmap />
          </div>
          <div style={{ background: V2.panel, border: `1px solid ${V2.line}`, padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 9, color: V2.muted, letterSpacing: 1.5, fontFamily: '"JetBrains Mono", monospace', marginBottom: 14 }}>AÇÕES RÁPIDAS · ⌘K</div>
            <button style={{
              background: V2.lime, color: V2.bg, border: 'none', padding: '18px 16px',
              fontFamily: '"Space Grotesk", sans-serif', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: -0.3, marginBottom: 10,
            }}>
              <span>▶ INICIAR CRONÔMETRO</span>
              <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>SPACE</span>
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                ['+ Sessão', 'N'], ['+ Revisão', 'R'], ['Simulado', 'S'], ['Flashcards', 'F'],
              ].map(([n, k]) => (
                <button key={n} style={{
                  background: V2.panel2, color: V2.text, border: `1px solid ${V2.line2}`, padding: '11px 12px',
                  fontFamily: '"Space Grotesk", sans-serif', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>{n}</span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', color: V2.muted, fontSize: 10 }}>{k}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom: disciplines bar-chart + exam + quote */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 10, flex: 1, minHeight: 0 }}>
          <div style={{ background: V2.panel, border: `1px solid ${V2.line}`, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: V2.muted, letterSpacing: 1.5, fontFamily: '"JetBrains Mono", monospace' }}>DISCIPLINAS · TEMPO / ACURÁCIA</div>
              <div style={{ fontSize: 10, color: V2.lime, fontFamily: '"JetBrains Mono", monospace' }}>SORT: tempo ↓</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {v2Disciplines.map(d => {
                const color = d.pct >= 85 ? V2.lime : d.pct >= 75 ? V2.cyan : d.pct >= 65 ? V2.amber : V2.coral;
                return <V2Bar key={d.name} label={d.name} value={d.hrs} max={13} color={color} />;
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: V2.lime, color: V2.bg, padding: '18px 20px', position: 'relative' }}>
              <div style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: 1.5, fontWeight: 700 }}>PRÓXIMA PROVA ·  T-MINUS</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 }}>
                <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -3, lineHeight: 1 }}>09</div>
                <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.4 }}>
                  DIAS<br />23h · 14m
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>MORFOFUNCIONAL II</div>
              <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', opacity: 0.7 }}>28.abr.2026 · 08:00</div>
            </div>
            <div style={{ background: V2.panel, border: `1px solid ${V2.line}`, padding: '14px 18px', flex: 1 }}>
              <div style={{ fontSize: 9, color: V2.muted, letterSpacing: 1.5, fontFamily: '"JetBrains Mono", monospace', marginBottom: 8 }}>LOG · HOJE</div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, lineHeight: 1.8, color: V2.text }}>
                <div><span style={{ color: V2.muted }}>14:22</span> <span style={{ color: V2.lime }}>+</span> Emergências · 40q (92%)</div>
                <div><span style={{ color: V2.muted }}>11:08</span> <span style={{ color: V2.lime }}>+</span> Morfofuncional · 01h14m</div>
                <div><span style={{ color: V2.muted }}>09:30</span> <span style={{ color: V2.amber }}>~</span> Revisão · Hemato</div>
                <div><span style={{ color: V2.muted }}>08:15</span> <span style={{ color: V2.lime }}>+</span> Flashcards · 48 cards</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.V2Dashboard = V2Dashboard;
