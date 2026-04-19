// Variation 3 — Magenta Cirúrgica
// Cream + hot magenta + ink. Brutalist asymmetric grid, oversized numbers, data-forward.

const V3 = {
  bg: '#F2EFE7',
  panel: '#FFFFFF',
  ink: '#121212',
  ink2: '#3A3A3A',
  line: '#121212',
  magenta: '#FF2E88',
  magentaSoft: '#FFD7E8',
  teal: '#00897B',
  yellow: '#FFD400',
  muted: '#7A7468',
};

const v3Disciplines = [
  { name: 'Emergências', pct: 91, hrs: 12.2, trend: [60, 68, 72, 78, 82, 88, 91] },
  { name: 'Morfofuncional', pct: 90, hrs: 10.4, trend: [70, 72, 74, 80, 85, 88, 90] },
  { name: 'Saúde Coletiva', pct: 82, hrs: 3.23, trend: [50, 55, 62, 68, 74, 78, 82] },
  { name: 'Hematológicas', pct: 81, hrs: 8.75, trend: [55, 62, 68, 72, 75, 79, 81] },
  { name: 'Farmacologia', pct: 69, hrs: 6.97, trend: [40, 48, 52, 58, 62, 66, 69] },
];

function V3Sidebar() {
  const items = ['Home', 'Planos', 'Disciplinas', 'Edital', 'Planejamento', 'Revisões', 'Histórico', 'Estatísticas', 'Simulados'];
  return (
    <div style={{
      width: 200, background: V3.panel, borderRight: `1.5px solid ${V3.line}`,
      padding: '22px 0', display: 'flex', flexDirection: 'column',
      fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
    }}>
      <div style={{ padding: '0 20px 26px', display: 'flex', alignItems: 'baseline', gap: 4, borderBottom: `1.5px solid ${V3.line}` }}>
        <div style={{ fontFamily: '"IBM Plex Serif", serif', fontSize: 22, fontWeight: 700, letterSpacing: -1, lineHeight: 1 }}>TrackerMed</div>
        <div style={{ width: 8, height: 8, background: V3.magenta, borderRadius: '50%', alignSelf: 'center' }} />
      </div>
      <div style={{ padding: '16px 20px 8px', fontSize: 10, letterSpacing: 2, color: V3.muted, fontWeight: 600, fontFamily: '"IBM Plex Mono", monospace' }}>NAV—</div>
      {items.map((name, i) => {
        const active = i === 0;
        return (
          <div key={name} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: active ? 700 : 400,
            color: V3.ink, cursor: 'pointer',
            background: active ? V3.magentaSoft : 'transparent',
            borderLeft: active ? `4px solid ${V3.magenta}` : '4px solid transparent',
            position: 'relative',
          }}>
            {name}
            {active && <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontFamily: '"IBM Plex Mono", monospace' }}>→</span>}
          </div>
        );
      })}
      <div style={{ flex: 1 }} />
      <div style={{ margin: '0 16px', background: V3.ink, color: V3.bg, padding: 14, position: 'relative' }}>
        <div style={{ position: 'absolute', top: -1, right: -1, width: 14, height: 14, background: V3.magenta }} />
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: V3.yellow, fontFamily: '"IBM Plex Mono", monospace', marginBottom: 4 }}>HOJE</div>
        <div style={{ fontSize: 12, lineHeight: 1.4 }}>3 sessões agendadas</div>
        <div style={{ fontSize: 12, lineHeight: 1.4, color: V3.magenta, fontWeight: 600 }}>próxima · 15:00</div>
      </div>
    </div>
  );
}

function V3Spark({ data, color = V3.magenta }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const w = 70, h = 22;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / range) * h} r={2.5} fill={color} />
    </svg>
  );
}

function V3Dashboard() {
  return (
    <div style={{
      display: 'flex', width: 1280, height: 820, background: V3.bg, color: V3.ink,
      fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
    }}>
      <V3Sidebar />
      <div style={{ flex: 1, padding: '22px 28px', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: V3.muted, fontFamily: '"IBM Plex Mono", monospace', fontWeight: 600 }}>19 · ABR · 2026  /  SEG</div>
            <div style={{ fontFamily: '"IBM Plex Serif", serif', fontSize: 42, fontWeight: 700, letterSpacing: -1.8, lineHeight: 1, marginTop: 4 }}>
              Oi, Júlia —<br />bora estudar?
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ border: `1.5px solid ${V3.line}`, background: V3.panel, padding: '8px 14px', fontSize: 13 }}>Módulo 2 ▾</div>
            <div style={{ background: V3.magenta, color: V3.panel, padding: '8px 16px', fontSize: 13, fontWeight: 700, border: `1.5px solid ${V3.line}` }}>+ ADICIONAR ESTUDO</div>
          </div>
        </div>

        {/* Asymmetric KPI grid — 3 cols 2 rows */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.9fr 0.9fr',
          gridTemplateRows: 'auto auto',
          gap: 0, border: `1.5px solid ${V3.line}`, background: V3.panel, marginBottom: 14,
        }}>
          {/* Big hero — tempo de estudo */}
          <div style={{
            gridRow: 'span 2', padding: '24px 28px', borderRight: `1.5px solid ${V3.line}`,
            background: V3.ink, color: V3.bg, position: 'relative',
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, fontFamily: '"IBM Plex Mono", monospace', color: V3.yellow }}>01 · TEMPO DE ESTUDO</div>
            <div style={{ fontFamily: '"IBM Plex Serif", serif', fontSize: 96, fontWeight: 700, letterSpacing: -4, lineHeight: 0.95, marginTop: 14 }}>
              40:45
            </div>
            <div style={{ fontSize: 12, color: V3.bg, opacity: 0.6, fontFamily: '"IBM Plex Mono", monospace', marginTop: 4 }}>h · m — abril</div>

            <div style={{ marginTop: 22, display: 'flex', gap: 14 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: V3.yellow, fontFamily: '"IBM Plex Mono", monospace' }}>META</div>
                <div style={{ fontFamily: '"IBM Plex Serif", serif', fontSize: 22, fontWeight: 600 }}>60h</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
              <div>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: V3.yellow, fontFamily: '"IBM Plex Mono", monospace' }}>PROGRESSO</div>
                <div style={{ fontFamily: '"IBM Plex Serif", serif', fontSize: 22, fontWeight: 600 }}>68%</div>
              </div>
            </div>

            <div style={{ marginTop: 18, height: 8, background: 'rgba(255,255,255,0.12)' }}>
              <div style={{ height: '100%', width: '68%', background: V3.magenta }} />
            </div>

            <div style={{ position: 'absolute', bottom: 20, right: 22, fontSize: 10, fontFamily: '"IBM Plex Mono", monospace', color: V3.bg, opacity: 0.4 }}>
              01/04
            </div>
          </div>

          {/* Desempenho */}
          <div style={{ padding: '20px 22px', borderRight: `1.5px solid ${V3.line}`, borderBottom: `1.5px solid ${V3.line}` }}>
            <div style={{ fontSize: 10, letterSpacing: 2, fontFamily: '"IBM Plex Mono", monospace', color: V3.muted }}>02 · DESEMPENHO</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
              <div style={{ fontFamily: '"IBM Plex Serif", serif', fontSize: 64, fontWeight: 700, letterSpacing: -3, lineHeight: 1, color: V3.teal }}>85</div>
              <div style={{ fontSize: 20, color: V3.muted }}>%</div>
            </div>
            <div style={{ fontSize: 11, color: V3.ink2, marginTop: 6, fontFamily: '"IBM Plex Mono", monospace' }}>
              <span style={{ color: V3.teal }}>128 ✓</span> · <span style={{ color: V3.magenta }}>14 ✕</span>
            </div>
          </div>

          {/* Edital */}
          <div style={{ padding: '20px 22px', borderBottom: `1.5px solid ${V3.line}` }}>
            <div style={{ fontSize: 10, letterSpacing: 2, fontFamily: '"IBM Plex Mono", monospace', color: V3.muted }}>03 · EDITAL</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
              <div style={{ fontFamily: '"IBM Plex Serif", serif', fontSize: 64, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>42</div>
              <div style={{ fontSize: 20, color: V3.muted }}>%</div>
            </div>
            <div style={{ fontSize: 11, color: V3.ink2, marginTop: 6, fontFamily: '"IBM Plex Mono", monospace' }}>
              54 / 128 tópicos
            </div>
          </div>

          {/* Streak */}
          <div style={{ padding: '20px 22px', borderRight: `1.5px solid ${V3.line}`, background: V3.magentaSoft }}>
            <div style={{ fontSize: 10, letterSpacing: 2, fontFamily: '"IBM Plex Mono", monospace', color: V3.ink2 }}>04 · CONSTÂNCIA</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
              <div style={{ fontFamily: '"IBM Plex Serif", serif', fontSize: 64, fontWeight: 700, letterSpacing: -3, lineHeight: 1, color: V3.magenta }}>2</div>
              <div style={{ fontSize: 14, color: V3.ink }}>dias</div>
            </div>
            <div style={{ fontSize: 11, color: V3.ink2, marginTop: 6, fontFamily: '"IBM Plex Mono", monospace' }}>
              recorde 7d
            </div>
          </div>

          {/* Prova countdown */}
          <div style={{ padding: '20px 22px', background: V3.yellow, position: 'relative' }}>
            <div style={{ fontSize: 10, letterSpacing: 2, fontFamily: '"IBM Plex Mono", monospace' }}>05 · PRÓXIMA PROVA</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
              <div style={{ fontFamily: '"IBM Plex Serif", serif', fontSize: 64, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>09</div>
              <div style={{ fontSize: 14 }}>dias</div>
            </div>
            <div style={{ fontSize: 11, marginTop: 6, fontWeight: 700 }}>Morfofuncional II · 28.abr</div>
          </div>
        </div>

        {/* Lower grid: disciplines + quote/actions stack */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
          {/* Disciplines w/ sparklines */}
          <div style={{ border: `1.5px solid ${V3.line}`, background: V3.panel }}>
            <div style={{ padding: '14px 20px', borderBottom: `1.5px solid ${V3.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 2, fontFamily: '"IBM Plex Mono", monospace', color: V3.muted }}>PAINEL</div>
                <div style={{ fontFamily: '"IBM Plex Serif", serif', fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>Disciplinas · abril</div>
              </div>
              <div style={{ fontSize: 11, color: V3.magenta, fontWeight: 700, fontFamily: '"IBM Plex Mono", monospace' }}>VER TUDO →</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 70px 90px 80px 60px', padding: '10px 20px', fontSize: 9, letterSpacing: 1.5, color: V3.muted, fontFamily: '"IBM Plex Mono", monospace', borderBottom: `1px solid ${V3.line}`, fontWeight: 600 }}>
              <div>DISCIPLINA</div><div>HORAS</div><div>TENDÊNCIA</div><div>ACURÁCIA</div><div style={{ textAlign: 'right' }}>%</div>
            </div>
            {v3Disciplines.map((d, i) => (
              <div key={d.name} style={{
                display: 'grid', gridTemplateColumns: '2fr 70px 90px 80px 60px', padding: '12px 20px',
                alignItems: 'center', fontSize: 13,
                borderBottom: i < v3Disciplines.length - 1 ? `1px dashed ${V3.muted}` : 'none',
              }}>
                <div style={{ fontWeight: 600 }}>{d.name}</div>
                <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }}>{d.hrs.toFixed(1)}h</div>
                <div><V3Spark data={d.trend} color={d.pct >= 85 ? V3.teal : V3.magenta} /></div>
                <div>
                  <div style={{ height: 6, background: V3.bg, width: '100%', position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${d.pct}%`, background: d.pct >= 85 ? V3.teal : V3.magenta }} />
                  </div>
                </div>
                <div style={{ fontFamily: '"IBM Plex Serif", serif', fontSize: 18, fontWeight: 700, textAlign: 'right' }}>{d.pct}</div>
              </div>
            ))}
          </div>

          {/* Right stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Quick actions */}
            <div style={{ border: `1.5px solid ${V3.line}`, background: V3.panel, padding: '16px 20px' }}>
              <div style={{ fontSize: 10, letterSpacing: 2, fontFamily: '"IBM Plex Mono", monospace', color: V3.muted, marginBottom: 12 }}>AÇÕES RÁPIDAS</div>
              <button style={{
                width: '100%', background: V3.ink, color: V3.yellow, border: `1.5px solid ${V3.line}`, padding: '14px 16px',
                fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, letterSpacing: 0.5,
              }}>
                <span>▶ INICIAR CRONÔMETRO</span>
                <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: V3.bg, opacity: 0.6 }}>⌘ + P</span>
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button style={{ background: V3.panel, border: `1.5px solid ${V3.line}`, padding: '10px 12px', fontSize: 12, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>+ Sessão</button>
                <button style={{ background: V3.magentaSoft, border: `1.5px solid ${V3.line}`, padding: '10px 12px', fontSize: 12, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>+ Revisão</button>
                <button style={{ background: V3.yellow, border: `1.5px solid ${V3.line}`, padding: '10px 12px', fontSize: 12, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>Simulado</button>
                <button style={{ background: V3.panel, border: `1.5px solid ${V3.line}`, padding: '10px 12px', fontSize: 12, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>Flashcards</button>
              </div>
            </div>

            {/* Streak bar strip */}
            <div style={{ border: `1.5px solid ${V3.line}`, background: V3.panel, padding: '14px 20px' }}>
              <div style={{ fontSize: 10, letterSpacing: 2, fontFamily: '"IBM Plex Mono", monospace', color: V3.muted, marginBottom: 8 }}>ÚLTIMOS 14 DIAS</div>
              <div style={{ display: 'flex', gap: 3, height: 32 }}>
                {Array.from({ length: 14 }, (_, i) => {
                  const miss = i === 3 || i === 9;
                  const today = i === 12;
                  return (
                    <div key={i} style={{
                      flex: 1,
                      background: miss ? V3.bg : today ? V3.yellow : V3.magenta,
                      border: `1.5px solid ${V3.line}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: miss ? V3.ink2 : V3.ink,
                      fontFamily: '"IBM Plex Mono", monospace',
                    }}>{miss ? '✕' : today ? '•' : '✓'}</div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.V3Dashboard = V3Dashboard;
