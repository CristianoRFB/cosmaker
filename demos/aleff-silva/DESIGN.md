# DESIGN — Aleff Silva / Oficina de Ideias

Data: 2026-11-02. Status: proposta conceitual não oficial. Sem contratação, autorização de marca ou uso das imagens do perfil.

## Fontes e premissas

Print de Instagram @aleff_silva_cosmaker fornecido pelo usuário: profissional de cosmaker, especialista em armaduras e props em EVA, mais de dez anos no mercado, encomendas e mentorias. Não extrapolar para portfólio real, região, preço ou agendamento confirmado.

## Objetivo

Fluxo vitrine ilustrativa → pedido de teste → consulta com código → avanço de produção → ajustes de visibilidade no painel.

## Direção de arte

Industrial, artesanal e editorial. Fundo #11181a, aço #263032, cobre #e6aa76, pergaminho #f9f2e7, acento #edcfac. Fontes system-ui e Georgia local. Espaçamentos 8-64 px e cantos discretos. Ilustrações SVG originais abstratas, não imagens do Instagram ou produtos reais.

## Visões

Vitrine de 3 categorias conceituais; acompanhamento por código AS-DEMO; quadro de produção com estágios; gestão das categorias. Todas as mudanças são feitas só no navegador atual via localStorage.

## Limitações

Sem API, backend, autenticação, preço, pagamento, emissão de pedido verdadeiro ou sincronização entre dispositivos. Nenhum envio ao ateliê. Admin aberto apenas porque contém dados fictícios. Copiar para produção não é seguro.

## Readiness

GLOBAL: reutilizar os contratos de tenant e roles do Cosmaker OS. VERTICAL: mapa orçamentos→pedidos→etapas. LOCAL: catálogo e identidade validados por Aleff. A integração real requer autorização, hospedagem/conta, fotos, fluxos e política de privacidade.

## QA

Testar URL, formulário, código, status, visibilidade, reset, 320–1440px, teclado, reduced-motion, CSP e noindex. CI da branch é referencial; HTML independente requer validação adicional.