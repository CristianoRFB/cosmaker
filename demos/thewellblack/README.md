# Well — Vitrine + orçamento + oficina (DEMO)

**Estado:** Demonstração interativa conceitual; sem vínculo comercial confirmado, sem alterações na main/prod, sem envio real.

**Preview independente:** https://well-cosmaker-demo-77.on7.workers.dev/

## Visões

- Vitrine e pedido fictício: `/` (selecione categoria, acabamento, prazo ilustrativo, digite ideia sem dados pessoais e gere código)
- Cliente: `/acompanhar` (código `WB-DEMO` ou código criado no navegador)
- Ateliê: `/atelier` (avance/reverta etapas; teste também restauração)
- Gestão: `/gestao` (altere visibilidade das categorias, abra vitrine e confira)

A demo usa `localStorage`, sem API ou backend. Mudanças não são sincronizadas entre dispositivos e o cliente Well não é notificado.

## Deploy

- Worker Cloudflare isolado `well-cosmaker-demo-77` na conta de demonstração, domínio `on7.workers.dev`.
- Source of truth para HTML: `demos/thewellblack/index.html` nesta branch, servido integralmente por Worker sem dependências. Atualizações de HTML neste GitHub **não publicam automaticamente** — requer sincronização manual do Worker.
- Nunca converter automaticamente esta visualização em tenant de produção. As regras de segurança, os contratos comerciais e o núcleo multi-tenant do repositório devem ser validados antes disso.
- A página inclui `noindex`, isolamento de recursos via CSP e rótulos de demo.

## Proveniência

Fonte fornecida pelo usuário: prints do Instagram `@thewellblack` e falha do `linkr.bio/thewellblack/` em 2026-11-02. Serviços e ilustrações são **exemplos interpretativos**. Não foi confirmada autorização para usar imagens reais nem preços; nenhum foi utilizado.

## Roadmap se a Well aprovar

1. Entrevista curta e validação de portfólio/autorização de imagens.
2. Definir catálogo/serviços reais, medidas, orçamento e canal autorizado.
3. Integrar ao tenant canônico Cosmaker OS com auth, fluxos de pedido, storage e status reais, isolados.
4. Testes de produção e aceitação específica.
