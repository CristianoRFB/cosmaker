# Ozzy Cosmaker — Vitrine e gestão conceitual

Prévia **não oficial**, produzida pela 77 sem vínculo contratual com o titular do Instagram `@ozzy_cosmaker`.

**Link principal:** https://77-ozzy-cosmaker-demo.on7.workers.dev/

## Rotas
- `/`: vitrine de categorias e apresentação visual conceitual.
- `/orcamento`: formulário que cria pedido **fictício** com código de acompanhamento.
- `/acompanhar`: consulta `OZ-DEMO` ou código criado na mesma origem/browser.
- `/atelier`: oficina DEMO pública que avança/reverte etapas do pedido fictício.
- `/gestao`: gestão DEMO pública para controlar categorias visíveis na vitrine.

## Arquitetura
- HTML/CSS/JS standalone: `demos/ozzy/index.html`, source of truth nesta branch.
- Worker Cloudflare isolado: `77-ozzy-cosmaker-demo`, subdomínio `on7.workers.dev`.
- Worker faz fetch de `raw.githubusercontent.com/CristianoRFB/cosmaker/demo/ozzy-cosmaker-forja-20261102/demos/ozzy/index.html` e serve as cinco rotas em um único HTML. Sujeito à disponibilidade da origem remota; cache curto. Alterações no HTML da branch não exigem novo deploy do Worker, mas podem demorar conforme cache.
- Sem backend, sem autenticação, sem tenants reais. `localStorage` guarda apenas dados inseridos nesta simulação no navegador atual, sem sincronização.
- Segurança do preview: sem segredos, sem formulário real, noindex, CSP restritiva para rede externa, frame bloqueado. Script e CSS inline por ser demo standalone.

## Apresentação recomendada (90s)
1. Abra a vitrine e mostre conceito visual e categorias.
2. Acesse orçamento, preencha **somente dados fictícios** e gere código.
3. Abra acompanhamento, observe a etapa inicial.
4. Acesse oficina, avance o pedido; volte ao acompanhamento no mesmo navegador.
5. Na gestão oculte uma categoria; volte à vitrine e confira.
6. Explique os próximos passos de uma versão real: permissões, portfólio autorizado, fluxo e custos acordados.

## Limitações
- Não representa a identidade oficial do Ozzy, catálogo comercial, disponibilidade, preço ou prazo.
- Fotos dos projetos reais não foram usadas; apenas ilustrações autorais.
- Painéis não têm proteção porque são exclusivamente demonstrações locais sem dados reais.
- Requer validação visual/interação em navegador real antes de apresentar como solução pronta; o teste automatizado de cliques não foi realizado.
- Worker depende de recurso raw GitHub da branch; não deve ser confundido com plataforma do cliente. Não fundir na `main` como tenant de produção.

## Integração futura no Cosmaker OS
Após aprovação do lead, adaptar a experiência ao resolver de tenant público por slug, intake backend, RBAC e fluxo de pedidos da base canônica, preservando isolamento, proveniência e privacidade.
