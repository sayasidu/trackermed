// Variation 1 — Cobalto Elétrico
// Deep cobalt + acid yellow accent, editorial serif display + grotesque, ring KPIs

const V1 = {
  ink: '#0A1330',
  ink2: '#2A3356',
  paper: '#F4F1EA',
  card: '#FFFFFF',
  line: '#E4DFD2',
  line2: '#CFC8B5',
  cobalt: '#1E3AE8',
  cobaltDeep: '#0D1B8F',
  acid: '#E6FF3D',
  rose: '#FF5B5B',
  mint: '#1FC28A',
  muted: '#6B6A5F',
};

const v1Disciplines = [
  { name: 'Morfofuncional',      time: '10h22', right: 128, wrong: 14, rev: 62, pct: 90 },
  { name: 'Sínd. Hematológicas', time: '08h45', right: 94,  wrong: 22, rev: 48, pct: 81 },
  { name: 'Emergências',         time: '12h10', right: 176, wrong: 18, rev: 70, pct: 91 },
  { name: 'Farmacologia',        time: '06h58', right: 62,  wrong: 28, rev: 31, pct: 69 },
  { name: 'Saúde Coletiva',      time: '03h14', right: 40,  wrong: 9,  rev: 22, pct: 82 },
];

function V1Ring({ pct, size = 78, stroke = 10, color = V1.cobalt }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={V1.line} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${c * pct/100} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

function V1Sidebar() {
  const items = [
    ['Home', true], ['Planos', false], ['Disciplinas', false], ['Edital', false],
    ['Planejamento', false], ['Revisões', false], ['Histórico', false],
    ['Estatísticas', false], ['Simulados', false],
  ];
  return (
    <div style={{
      width: 232, background: V1.ink, color: '#E8E6DC', padding: '28px 18px',
      display: 'flex', flexDirection: 'column', gap: 2, height: '100%',
      fontFamily: '"Inter Tight", "Inter", sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 8px 32px' }}>
        <div style={{ fontFamily: '"Fraunces", serif', fontSize: 30, fontWeight: 600, letterSpacing: -1, color: V1.paper }}>
          Tracker<span style={{ color: V1.acid, fontStyle: 'italic' }}>Med</span>
        </div>
        <div style={{ width: 6, height: 6, background: V1.acid, borderRadius: '50%', alignSelf: 'center' }} />
      </div>
      {items.map(([name, active]) => (
        <div key={name} style={{
          padding: '11px 14px', borderRadius: 8, fontSize: 14, fontWeight: active ? 600 : 400,
          background: active ? V1.cobalt : 'transparent',
          color: active ? '#fff' : 'rgba(232,230,220,0.72)',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{name}</span>
          {active && <span style={{ color: V1.acid }}>●</span>}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{
        background: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, lineHeight: 1.5,
      }}>
        <div style={{ color: V1.acid, fontSize: 11, letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>FOCO HOJE</div>
        <div style={{ color: '#E8E6DC' }}>Revisar ECG + 40 questões de Emergências</div>
      </div>
    </div>
  );
}

function V1Kpi({ label, value, sub, color = V1.ink, accent }) {
  return (
    <div style={{
      flex: 1, background: V1.card, padding: '20px 22px', position: 'relative',
      border: `1px solid ${V1.line}`, minHeight: 132,
    }}>
      <div style={{ fontSize: 10, letterSpacing: 1.4, color: V1.muted, fontWeight: 600, marginBottom: 18 }}>
        {label}
      </div>
      <div style={{
        fontFamily: '"Fraunces", serif', fontSize: 44, fontWeight: 500,
        letterSpacing: -1.5, color, lineHeight: 1,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: V1.ink2, marginTop: 10 }}>{sub}</div>}
      {accent && (
        <div style={{ position: 'absolute', top: 0, right: 0, width: 12, height: 12, background: accent }} />
      )}
    </div>
  );
}

function V1Streak() {
  const days = Array.from({ length: 30 }, (_, i) => {
    if (i === 27) return 'today';
    if (i === 5 || i === 12) return 'miss';
    return 'ok';
  });
  return (
    <div style={{ background: V1.card, border: `1px solid ${V1.line}`, padding: '22px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 1.4, color: V1.muted, fontWeight: 600, marginBottom: 8 }}>
            CONSTÂNCIA NOS ESTUDOS
          </div>
          <div style={{ fontSize: 15, color: V1.ink, lineHeight: 1.4 }}>
            Você está há <b style={{ color: V1.cobalt }}>2 dias</b> sem falhar. Seu recorde é de <b style={{ background: V1.acid, padding: '0 4px' }}>7 dias</b> sem falhas.
          </div>
        </div>
        <div style={{ fontSize: 12, color: V1.muted, fontVariantNumeric: 'tabular-nums' }}>
          21/03 — 19/04
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {days.map((d, i) => (
          <div key={i} style={{
            flex: 1, height: 34,
            background: d === 'ok' ? V1.cobalt : d === 'miss' ? V1.rose : V1.acid,
            border: d === 'today' ? `2px solid ${V1.ink}` : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: d === 'miss' ? '#fff' : d === 'today' ? V1.ink : '#fff',
            fontSize: 11, fontWeight: 700, fontFamily: '"Fraunces", serif',
          }}>
            {d === 'ok' ? '✓' : d === 'miss' ? '✕' : '•'}
          </div>
        ))}
      </div>
    </div>
  );
}

function V1Disciplines() {
  return (
    <div style={{ background: V1.card, border: `1px solid ${V1.line}`, padding: '22px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: V1.muted, fontWeight: 600 }}>PAINEL · DISCIPLINAS</div>
        <div style={{ fontSize: 11, color: V1.cobalt, fontWeight: 600, cursor: 'pointer' }}>ver tudo →</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 60px 60px 60px 90px', fontSize: 10, letterSpacing: 1, color: V1.muted, fontWeight: 600, paddingBottom: 10, borderBottom: `1px solid ${V1.line}` }}>
        <div>DISCIPLINA</div><div>TEMPO</div><div>✓</div><div>✕</div><div>REV</div><div style={{ textAlign: 'right' }}>%</div>
      </div>
      {v1Disciplines.map((d, i) => (
        <div key={d.name} style={{
          display: 'grid', gridTemplateColumns: '2fr 80px 60px 60px 60px 90px',
          padding: '14px 0', borderBottom: i < v1Disciplines.length - 1 ? `1px solid ${V1.line}` : 'none',
          alignItems: 'center', fontSize: 13, fontFamily: '"Inter Tight", sans-serif',
        }}>
          <div style={{ color: V1.ink, fontWeight: 500 }}>{d.name}</div>
          <div style={{ color: V1.ink2, fontVariantNumeric: 'tabular-nums' }}>{d.time}</div>
          <div style={{ color: V1.mint, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{d.right}</div>
          <div style={{ color: V1.rose, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{d.wrong}</div>
          <div style={{ color: V1.ink2, fontVariantNumeric: 'tabular-nums' }}>{d.rev}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
            <div style={{ width: 60, height: 4, background: V1.line, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${d.pct}%`, background: V1.cobalt }} />
            </div>
            <span style={{ fontFamily: '"Fraunces", serif', fontSize: 14, color: V1.ink, fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'right' }}>{d.pct}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function V1Exam() {
  return (
    <div style={{
      background: V1.ink, color: V1.paper, padding: '24px 26px', position: 'relative', overflow: 'hidden',
      minHeight: 220, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: V1.acid, fontWeight: 600, marginBottom: 12 }}>
          PRÓXIMA PROVA
        </div>
        <div style={{ fontFamily: '"Fraunces", serif', fontSize: 22, fontWeight: 500, letterSpacing: -0.5, lineHeight: 1.15 }}>
          Morfofuncional II
        </div>
        <div style={{ fontSize: 12, color: 'rgba(244,241,234,0.6)', marginTop: 6 }}>
          ter. 28 de abril, 2026 · 08h00
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div style={{
          fontFamily: '"Fraunces", serif', fontStyle: 'italic', fontSize: 96, fontWeight: 400,
          color: V1.acid, lineHeight: 0.9, letterSpacing: -4,
        }}>9</div>
        <div style={{ fontSize: 11, color: 'rgba(244,241,234,0.7)', paddingBottom: 12, lineHeight: 1.3 }}>
          dias<br />para a<br />prova
        </div>
      </div>
      <div style={{ position: 'absolute', top: 18, right: 20, fontSize: 10, color: 'rgba(244,241,234,0.4)' }}>
        02 / 05
      </div>
    </div>
  );
}

function V1QuickActions() {
  return (
    <div style={{ background: V1.card, border: `1px solid ${V1.line}`, padding: '22px 24px' }}>
      <div style={{ fontSize: 10, letterSpacing: 1.4, color: V1.muted, fontWeight: 600, marginBottom: 16 }}>AÇÕES RÁPIDAS</div>
      <button style={{
        width: '100%', background: V1.cobalt, color: '#fff', border: 'none', padding: '16px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: '"Inter Tight", sans-serif', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8,
      }}>
        <span>Iniciar cronômetro</span>
        <span style={{ fontFamily: '"Fraunces", serif', fontSize: 22 }}>▸</span>
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button style={{
          background: V1.paper, color: V1.ink, border: `1px solid ${V1.line2}`, padding: '12px 14px',
          fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
        }}>+ Estudo</button>
        <button style={{
          background: V1.paper, color: V1.ink, border: `1px solid ${V1.line2}`, padding: '12px 14px',
          fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
        }}>+ Revisão</button>
        <button style={{
          background: V1.acid, color: V1.ink, border: `1px solid ${V1.ink}`, padding: '12px 14px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
        }}>Simulado</button>
        <button style={{
          background: V1.paper, color: V1.ink, border: `1px solid ${V1.line2}`, padding: '12px 14px',
          fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
        }}>Flashcards</button>
      </div>
    </div>
  );
}

function V1Dashboard() {
  return (
    <div style={{
      display: 'flex', width: 1280, height: 820, background: V1.paper,
      fontFamily: '"Inter Tight", "Inter", -apple-system, sans-serif', color: V1.ink,
    }}>
      <V1Sidebar />
      <div style={{ flex: 1, padding: '24px 32px', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1.4, color: V1.muted, fontWeight: 600 }}>BOM DIA, JÚLIA</div>
            <div style={{ fontFamily: '"Fraunces", serif', fontSize: 40, fontWeight: 500, letterSpacing: -1.5, lineHeight: 1 }}>
              Seu <i>progresso</i> hoje
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ background: V1.card, border: `1px solid ${V1.line}`, padding: '9px 14px', fontSize: 13 }}>
              Módulo 2 ▾
            </div>
            <div style={{ background: V1.ink, color: V1.acid, padding: '9px 18px', fontSize: 13, fontWeight: 600 }}>
              + Adicionar estudo
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: V1.cobalt, color: V1.paper,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13 }}>JM</div>
          </div>
        </div>

        {/* KPI row with rings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: V1.card, border: `1px solid ${V1.line}`, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 18 }}>
            <V1Ring pct={68} color={V1.cobalt} />
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1.4, color: V1.muted, fontWeight: 600, marginBottom: 6 }}>TEMPO DE ESTUDO</div>
              <div style={{ fontFamily: '"Fraunces", serif', fontSize: 32, letterSpacing: -1, lineHeight: 1 }}>40h<span style={{ fontSize: 20, color: V1.muted }}>45m</span></div>
              <div style={{ fontSize: 11, color: V1.ink2, marginTop: 6 }}>meta 60h / abril</div>
            </div>
          </div>
          <V1Kpi label="DESEMPENHO" value="85%" sub="128 acertos · 14 erros" color={V1.mint} accent={V1.mint} />
          <V1Kpi label="EDITAL" value="42%" sub="54 de 128 tópicos" color={V1.cobalt} accent={V1.cobalt} />
          <div style={{ background: V1.ink, color: V1.paper, padding: '20px 22px', position: 'relative', minHeight: 132 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.4, color: V1.acid, fontWeight: 600, marginBottom: 10 }}>PENSAMENTO</div>
            <div style={{ fontFamily: '"Fraunces", serif', fontStyle: 'italic', fontSize: 14, lineHeight: 1.4, color: V1.paper }}>
              “A vida não é medida pelo número de respirações que tomamos, mas pelos momentos que nos tiram o fôlego.”
            </div>
            <div style={{ fontSize: 10, color: 'rgba(244,241,234,0.5)', marginTop: 8 }}>— Maya Angelou</div>
          </div>
        </div>

        {/* Streak */}
        <div style={{ marginBottom: 16 }}>
          <V1Streak />
        </div>

        {/* Bottom row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 0.9fr', gap: 12 }}>
          <V1Disciplines />
          <V1Exam />
          <V1QuickActions />
        </div>
      </div>
    </div>
  );
}

window.V1Dashboard = V1Dashboard;
