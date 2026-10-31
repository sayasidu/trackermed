# trackermed

Painel de estudo para medicina. Site estático — basta servir os arquivos (GitHub Pages).

## Identidade visual · tema Rosé

O site usa a paleta **Rosé**: ameixa profunda, creme rosado, rosa framboesa e
blush, com degradê-assinatura rosa→lilás e modo escuro em tons de ameixa. Os
nomes das variáveis CSS antigas (`--cobalt`, `--acid`, `--ink`, `--paper`)
foram mantidos por compatibilidade — só os valores mudaram (em `app.css` e no
`<style>` próprio de `index.html`).

Na **home** (`index.html`), logo abaixo dos três cartões de resumo, fica o
quadro **Provas no radar**: todas as provas cadastradas para o mês atual e o
próximo, em ordem cronológica, uma coluna por mês, com disciplina, nome da
prova, data (com dia da semana) e quantos dias faltam. Ele reúne as provas das
disciplinas de todos os planos (`trackermed.disciplinas.v1` e snapshots), a
data de prova dos planos de residência/ENAMED (`trackermed.planos.v1`) e a
prova avulsa do Dashboard (`trackermed.prova.v1`). A contagem se refaz sozinha
quando o dia vira, quando a aba volta ao primeiro plano, quando outra aba mexe
nos dados e quando a nuvem sincroniza.

Atalhos de personalização e manutenção:

- **Recomeçar do zero**: botão no pé da barra lateral de todas as páginas (e
  no rodapé da home), com confirmação dupla — apaga todos os dados E
  configurações (nome, tema, planos, leituras…). Com a conta conectada, a
  limpeza vale também pra nuvem. Também disponível em app → Conta.
- **Excluir leituras individualmente**: nas listas "Materiais em andamento"
  do Histórico e do Planejamento, o botão 🗑 remove só aquela leitura (as
  sessões já registradas no histórico ficam).
- **Sessão manual / reservar sessão**: além da sugestão automática, dá pra
  reservar à mão a matéria que vai estudar no dia, com horário de início,
  tempo planejado e, opcionalmente, a atividade/etapa — em **Planejamento**
  (botão "+ Sessão manual" ou clique num horário vazio da grade) e em
  **Histórico** ("+ Reservar sessão", com a opção "Salvar e iniciar" o
  cronômetro). O registro é o mesmo bloco de estudo dos gerados
  automaticamente, então aparece nas duas telas, no calendário geral e segue o
  fluxo normal de cronômetro, progresso e conclusão.

## Diário de estudo (Histórico) — planejar, registrar e acompanhar

O **Histórico** funciona como planejador + diário integrados. Tudo gira em
torno de três conceitos, guardados nas chaves que o site já usava:

- **Sessão** — um bloco em `trackermed.plan.v1` (o mesmo formato do
  Planejamento). Carrega o tempo *reservado* (`minutos`), o *realizado*
  (`minutosFeitos`), se foi *encerrada* (`feito`), a data real (`data`) e,
  opcionalmente, a atividade/etapa (`materialId`). É dela que Dashboard,
  Gráficos e app somam as horas.
- **Atividade** — o que a aluna quer concluir (ler o cap. 12, assistir a
  aula X). Cada **etapa** dela (leitura, resumo, questões, revisão,
  flashcards…) é um material em `trackermed.materiais.v1` ligado ao grupo por
  `atividadeId`, com unidade, total e log próprios — concluir a leitura não
  conclui o resumo. Materiais antigos são atividades de uma etapa só; nada
  precisa migrar.
- **Avanço** — lançamento no log da etapa (`{ data, qtd, de, ate, sessaoMin,
  blocoId }`). Páginas, minutos e % são *posição* ("parou na página 8" → o
  avanço é a diferença pra última posição); questões, capítulos e itens são
  quantidade.

O que o site calcula sozinho, por etapa: feito/restante/%, **tempo
realizado** (soma das sessões ligadas), **tempo reservado** (sessões ainda em
aberto), **estimativa restante** (a definida pela aluna vence, descontando o
que ela estudou depois; sem ela, o ritmo medido; sem ritmo, a proporção tempo
× avanço) e a **situação** (não iniciada / em andamento / concluída).
Corrigir ou excluir um registro recalcula tudo — e sessão reagendada nunca
conta duas vezes (o que foi feito fica no dia original, só o restante muda de
data).

Fluxo de uso, com o exemplo "ler o cap. 12 do Harrison (20 páginas)":

1. **+ Nova atividade** (ou "+ etapa" numa existente): matéria, nome, etapa
   *Leitura*, 20 páginas, prazo e estimativa opcionais.
2. **⏱ reservar** no cartão da etapa (ou "+ Reservar sessão" no dia): data,
   horário de início e tempo — vira um bloco pendente, visível na faixa da
   semana, na lista do dia e na grade do Planejamento.
3. **+ Registrar estudo** (ou "+ sessão" no cartão): matéria, data e tempo
   bastam. Em *Detalhes*, a etapa e "parou em que página?" (5), conteúdo,
   anotações, horário, tempo reservado, sessão encerrada ou não, mandar pras
   revisões. Serve pra registrar depois, em qualquer data, sem cronômetro.
   O cronômetro (▶) desemboca no mesmo modal, já preenchido.
4. O cartão mostra: 5 de 20 · restam 15 · 25% · realizado 2h00 · reservado
   1h30 (próx. dom 1/11) · faltam ~6h (pelo ritmo) · em andamento. Amanhã,
   "parou na 8" → 8 de 20 (40%).
5. Reorganizar: ✎ corrige qualquer sessão (tempo, data, etapa, quantidade),
   ⇄ reagenda o que ficou pra trás, ○ encerra, "registros" lista sessões e
   avanços da etapa com ✎/🗑, "✎ estimativa" define o tempo que ainda falta.

Outras chaves: `historicoEstudos` (feed das sessões e revisões) agora
sincroniza na nuvem, entra no backup e no "Recomeçar do zero".

## App no iPhone e iPad (PWA)

O site agora instala como app na tela inicial, com a tela `app.html` como início
(atalhos, resumo do dia, cronômetro e backup):

1. Abre o site no **Safari** do iPhone/iPad.
2. Toca em **Compartilhar → Adicionar à Tela de Início**.
3. O ícone do TrackerMed abre o app em tela cheia, funcionando offline.

## Sincronização na nuvem

Com uma conta (e-mail e senha), os dados sincronizam entre todos os aparelhos:
o login fica em **app → ↻ Conta e sincronização** (uma vez por aparelho; depois
todas as páginas do site sincronizam sozinhas em segundo plano). Conflitos são
resolvidos chave a chave — a alteração mais recente vence — e no primeiro login
de um aparelho que já tem dados o app pergunta qual lado vale. O backup por
arquivo (Exportar/Importar na mesma tela) continua como plano B. A mesma tela
tem a opção **Começar do zero**, que apaga todos os dados de estudo (com
confirmação dupla) — com a conta conectada, a limpeza vale também para a nuvem
e os outros aparelhos.

Backend: Firebase (projeto `trackermed-b335e`) — Authentication (e-mail/senha) +
Cloud Firestore, plano gratuito. As chaves em `sync.js` são públicas por design;
a segurança está nas regras do Firestore, que devem ser estas (console →
Firestore → Regras):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Ao publicar mudanças no site, subir a versão em `sw.js` (`VERSION`) para o cache
offline trocar.

## Proposta de design do app

A proposta que deu origem ao app é uma página interativa do próprio site:
[`TrackerMed App.dc.html`](https://cortexmd.com.br/TrackerMed%20App.dc.html) —
protótipo navegável do iPhone, layout do iPad e as decisões técnicas.
`support.js` e `ios-frame.jsx` são o runtime dela (gerados pelo Claude Design;
não editar à mão). Precisa de internet — o protótipo carrega React/Babel de CDN.
