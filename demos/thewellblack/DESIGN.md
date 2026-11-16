# Design — Well (demonstração conceitual)

Data: 2026-11-02. **Lead não contratado**. Trabalho independente sem autorização de uso de marca/portfólio. O nome no cabeçalho da demo é identificado como conceito não oficial.

## Evidências e hipóteses

- Print do Instagram fornecido pelo usuário mostra `@thewellblack`, apresentação como cosplayer/propmaker e produção de adereços e impressão 3D. Não há prova de catálogo, preços, quantidade de pedidos, integrações, fotos autorizadas, prazos reais ou preferência de identidade.
- Print do link `https://linkr.bio/thewellblack/` exibe `NoSuchKey`; verificar novamente com o titular antes de sugerir migração do canal.
- Direção visual criativa proposta: **cinematográfica, artesanal, industrial**. Não afirma reproduzir a identidade oficial.

## UX / público

- Público final: conhece categorias, descreve ideia, recebe código **local e fictício**.
- Cliente: pode consultar `WB-DEMO` ou um pedido criado nesse navegador.
- Ateliê: quadro simples com status, avanço e reversão de etapa.
- Gestor: controla categorias ilustrativas visíveis na vitrine.
- Um único código HTML, com rotas distintas servidas pelo Worker Cloudflare isolado.

## Visual

- Paleta por papéis: canvas `#100f10`, surface `#1d1b1d`, ink `#f6eee8`, muted `#b8aaa7`, primary `#ec4b45`, accent `#e9d5be`, outline `#40383d`.
- Fontes: Arial/Helvetica (sistema) + Georgia para acento editorial. Sem download de fontes.
- Padrão editorial de alta legibilidade, cartões com hierarquia clara e ilustrações SVG originais estilizadas.
- Breakpoints: 920px e 620px; largura mínima de layout 320px; navegação mobile fixa com quatro vistas.
- Foco via `:focus-visible`, botões >= 40px, suporte a `prefers-reduced-motion`, states vazios e mensagens de feedback.
- Não usar imagens de Instagram, logotipos oficiais, personagens registrados, métricas ou preços inventados.

## Critérios / limitações

- Rota pública `/`, acompanhamento `/acompanhar`, operação `/atelier`, gestão `/gestao`.
- Dados fictícios salvos via `localStorage` do mesmo navegador/origem; não há backend, autenticação, comunicação real, pagamento, WhatsApp, e-mail ou persistência entre usuários.
- O acesso ao painel sem senha **é intencional apenas para a demonstração**; produção real exige auth, RBAC, isolamento por tenant, storage e auditoria.
- Não reutilizar interface estática diretamente como aplicação comercial.
- Migração futura para núcleo: brand/theme via tenant; catálogo via configuração de tenant; pedido com validação server-side; status via modelo de produção do Cosmaker OS; autorização de artes e conteúdos reais antes de publicar.
- Não usar informações digitadas em demo como lead/PII.
