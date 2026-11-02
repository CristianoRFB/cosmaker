# DESIGN — Cosmaker Satu (conceito não oficial)

Data: 2026-11-02. Proponente: 77 — SaaS Comercial.

## Evidências e limites
- CONFIRMADO NO PRINT disponibilizado: Instagram @cosmaker.satu, nome Satu, descrição Cosmaker / Propmaker / Cosplayer, orçamento por WhatsApp e publicações visuais sobre figurinos, props e armaduras.
- NÃO CONFIRMADO: lista real de serviços/preços, localização, prazos, processo de atendimento, direitos de marca/imagens, capacidade, contratos, existência de site próprio, permissões para apresentação pública da marca.
- A pesquisa pública por combinação do handle e nome não trouxe outra página verificável do mesmo negócio. Não são usadas fotos de Instagram nem trabalhos de terceiros.
- PROPOSTA: fluxo de briefing → solicitação de orçamento → fabricação → revisão e acompanhamento; este fluxo NÃO é alegado como vigente no ateliê.

## Objetivo e públicos
- Cliente: explorar a estética, selecionar tipo de trabalho, simular uma solicitação, consultar etapa pelo código.
- Produção: movimentar encomendas de teste entre quatro estágios.
- Gestão: acompanhar o volume derivado da lista demo e ativar/pausar categorias ilustrativas.
- Uma demonstração em três visões conectadas no mesmo navegador, sem autenticação real.

## Direção visual
Personalidade: artesanal, dramática, precisa.
Cores por função:
- Fundo escuro: #111015, superfícies #1d1922 / #29232e.
- Texto principal: #f8f2f0, secundário #b9aeba.
- Primária lilás: #bb82ff, contraste em controles com texto #21132f.
- Ouro acento: #e5bb79.
- Fundo claro: #f6f0eb, tinta #201b24.
Tipografia: serif do sistema (Georgia) para títulos editoriais; sans do sistema (Inter fallback) para UX. Sem download de fontes.
Grid: até 1200px, respiros 8/12/16/24/32/48/64/92px, cards em grid 1–3 colunas responsivas, botão de toque >= 38px (primários >= 48px).
Ilustrações: SVG original embutido no HTML; não reproduzem fotos reais ou personagens licenciados.

## Microinterações
1. Filtros de categorias com aria-pressed e feedback visual.
2. Quadro de produção com avanço reversível de etapa e consulta sincronizada ao mesmo objeto em memória.
3. Criar solicitação fictícia pelo modal com verificação nativa de campos; usar código para rastrear.
Motion até 180ms; respeitar prefers-reduced-motion.

## Estrutura
- A única fonte de verdade da sessão é um array de objetos JS, sem storage, fetch, analytics, backend ou envio de dados.
- Links públicos usam ?view=cliente|producao|gestao; os três modos compartilham o HTML e seu estado em memória.
- Código mantém nomenclatura genérica para peças e estágios; branding e fixtures estão isolados no arquivo demonstrativo. Integração canônica futura requer migrar componentes, modelos, controles de acesso e configurações tenant sem copiar lógica de produção.
- O site está em public/demos/satu/index.html, sem tocar rotas, Rules, tenants ou autenticação do Cosmaker OS.

## Lacunas para produção
- Aprovação do uso comercial do nome/arte real, briefing visual, fotografia autorizada.
- Validação de serviços/preços e política de orçamento/produção.
- Backend com autenticação e memberships tenant, arquivo de referência com política de privacidade e LGPD, comunicação real autorizada, persistência, testes de carga e segurança.
- Nenhum dado desta demonstração é tenant real.

## Aceite
Prova de disponibilidade em https://77-cosmaker-satu-conceito.on7.workers.dev/
Status: apresentável como conceito interativo, não homologado para produção.
Teste de cada fluxo em navegador real ainda deve ser realizado; não reivindicar E2E apenas pelo carregamento da página.
