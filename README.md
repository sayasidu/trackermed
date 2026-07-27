# trackermed

Painel de estudo para medicina. Site estático — basta servir os arquivos (GitHub Pages).

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
arquivo (Exportar/Importar na mesma tela) continua como plano B.

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
