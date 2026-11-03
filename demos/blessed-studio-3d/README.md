# Blessed Studio 3D — Prévia conceitual não oficial

## Origem e escopo
Demonstração independente baseada em dois prints fornecidos em 02/11/2026. Nome **Blessed Studio 3D**, Instagram **@blessedstudio3d**, WhatsApp **+55 11 99127-1178**, segmento de impressão 3D e localização **São Paulo / SP** visíveis nas capturas.

Não há contrato, parceria, autorização de uso da marca nem preços confirmados. Ilustrações SVG criadas para esta demo representam categorias ilustrativas, não fotos oficiais. Os textos de produtos são conceituais.

## Experiências
- **Cliente**: página institucional, catálogo com filtros e busca, seletores de personalização, formulário validado e montagem de mensagem para WhatsApp (o visitante precisa clicar para enviar).
- **Gestão demo**: acesso por `?visao=gestao`, quadro de solicitações, avanço/recuo de etapas, inclusão de ficha fictícia, configuração de destaques, métricas derivadas do seed, restauração.
- **Dados**: seed 100% fictício e alterações em `localStorage` sob a chave `blessed-studio-3d-conceito-v1`. Alterações vistas no cliente e na gestão dentro do mesmo navegador, inclusive em outra aba. Não há sincronização remota.
- **Cuidado com pedidos reais**: o formulário NÃO cadastra ou envia nada para servidores. O envio pelo WhatsApp é iniciado explicitamente pelo visitante.
- **Acessibilidade**: navegação sem hover, teclas de foco, diálogo com fechamento por Escape e ciclo de tabulação, responsividade de 320 a 1440px e preferência por movimento reduzido.

## Execução
Abra `index.html` em um navegador. Não exige framework, instalação, backend ou API key.

## Limites antes de produção
Autorização da empresa e identidade visual, fotos com licença, catálogo/preço, financeiro, pedidos remotos, banco, autenticação, LGPD, política de frete e SLA devem ser discutidos e implementados separadamente. Não publicar admin real sem autenticação.

## Integração futura
A organização foi pensada em termos de produto, vitrine, formulário e etapas. Para absorção em multi-tenant, mover `products`, branding, WhatsApp e stages para configurações com `tenantId`, implementar autorização, storage persistente e servidor para regras críticas. Este protótipo não deve ser conectado diretamente à produção.
