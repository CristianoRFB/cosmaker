# DESIGN — Ateliê Monteiro (demonstração conceitual)
Data: 2026-11-06

## Origem e limites
- Evidência: captura enviada do Instagram @ateliemonteiro, com bio de arte em porcelana fria, Anápolis–GO, envios nacionais, peças personalizadas e pedidos no Direct.
- Pesquisa externa: outras marcas homônimas surgiram nos resultados; não foram atribuídas ao lead. Conta, preços, prazos e fluxo operacional não verificados de forma independente.
- Identidade visual oficial, logo e imagens das postagens NÃO utilizados. Toda arte da demo é SVG original criado no código e os produtos são fictícios.
- Marca editorial própria da demonstração: "Peças com história". Sem afiliação/contrato/endosso.

## Direção de arte
3 palavras: artesanal, delicado, confiável.
Público: colecionadores, fãs de cultura pop, compradores de presentes afetivos e organizador(a) do ateliê.
Proposta: de referências soltas no Direct para um caminho de inspiração, solicitação ilustrativa de orçamento e consulta simples do status.

## Tokens e componentes
- Canvas #f8f4eb, superfície #fdfbf6, texto #252a27, primária #315b49, acento #c46f51, divisas #dcded5.
- Tipografia: Fraunces (títulos expressivos, fallback Georgia) e DM Sans (leitura, fallback system-ui).
- Espaçamento 8/12/16/24/32/48/64, cantos 10–18 px e botões pílula para CTA.
- Grids desktop: hero 2 colunas, galeria 4, acompanhamento 2, gestão kanban 3. Mobile: hero empilhado, galeria 2, gestão 1.
- Tamanhos-alvo: 320, 360, 390, 430, 768, 1024, 1440. CSS responsivo implementado; **QA de screenshots interativos não totalmente executado**.
- Visões: / (cliente), /acompanhar (rastreio conceitual), /gestao (gestão conceitual).
- Motion: hover curto e redução de movimento respeitada por media query.
- Modal com labels, escape, foco inicial e campos validados. Resta testar manualmente o ciclo integral do foco.
- Sem logos oficiais ou fotografias sem licença. Desenhos vetoriais originais declarados como ilustrações, jamais exemplos reais de produção.

## Critérios de aceite
- [x] Worker publicado em rota independente com aviso de demo não oficial.
- [x] HTTP público acessível nos 3 caminhos e /health.
- [x] Navegação, filtros, formulário de pedido, mudança de etapa e rastreio implementados em JavaScript.
- [x] Nenhuma API de pedidos, pagamento, WhatsApp ou envio de dados a terceiros.
- [x] Estado local da demo isolado em localStorage/sessionStorage.
- [ ] Teste E2E real de interações e viewport em navegador: indisponível por saldo insuficiente no navegador automatizado e limite de Browser Rendering.
- [ ] Auditoria assistiva manual completa.
