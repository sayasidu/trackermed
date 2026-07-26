# trackermed

Painel de estudo para medicina. Site estático — basta servir os arquivos (GitHub Pages).

## App no iPhone e iPad (PWA)

O site agora instala como app na tela inicial, com a tela `app.html` como início
(atalhos, resumo do dia, cronômetro e backup):

1. Abre o site no **Safari** do iPhone/iPad.
2. Toca em **Compartilhar → Adicionar à Tela de Início**.
3. O ícone do TrackerMed abre o app em tela cheia, funcionando offline.

Os dados continuam no `localStorage` do aparelho. Para levar pra outro aparelho:
**app → ↻ Conta e sincronização → Exportar backup**, e **Importar** no destino.

Ao publicar mudanças no site, subir a versão em `sw.js` (`VERSION`) para o cache
offline trocar.
