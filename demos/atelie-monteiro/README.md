# Demonstração conceitual — ateliê de porcelana fria

**Prospect:** @ateliemonteiro (baseado em screenshot público enviado em 2026-11-06, sem validação externa independente). **Tipo:** prospect, não cliente.

**Worker verificado:** https://77-atelie-monteiro-conceito.on7.workers.dev/

Rotas:
- Cliente / vitrine: `/`
- Acompanhamento fictício: `/acompanhar`
- Gestão fictícia: `/gestao`
- Health: `/health`

## O que foi construído
Site responsivo single-file `index.html`, com CSS e JS sem dependências de build e SVGs autorais. Possui: quatro inspirações ilustrativas, filtros, formulário ilustrativo de pedido e um mini-kanban de acompanhamento; as etapas mudam em armazenamento **local ao navegador**, não sincronizam entre usuários nem são transmitidas ao negócio.

## Segurança e proveniência
- Não há logo oficial, fotografia de rede social, preços ou pedidos reais.
- Sem contato automático, faturamento, integração de WhatsApp, upload, banco ou credenciais.
- Não envolve login de gestão de produção: é uma visão pública da **DEMO**, sem poderes reais.
- Toda a navegação contém a indicação "projeto conceitual não oficial".
- Nenhuma alteração na aplicação Next/Firebase do Cosmaker OS; arquivo isolado em demos/.
- Deploy por Cloudflare API em Worker independente `77-atelie-monteiro-conceito`, na conta previamente conectada, sem custom domain e sem adicionar serviço pago.

## Testes
- Worker criado e subdomínio de Workers habilitado; deployments automáticos em 100% reportados.
- URL pública consultada externamente em `/`, `/acompanhar`, `/gestao`, `/health`.
- Não houve testes E2E de interação confirmados: serviço TinyFish não tinha saldo; Browser Rendering respondeu 429 em nova captura. Testes de responsividade visuais não homologados.
- Para testar manualmente: `index.html` pode abrir no browser, mas a rota interna é definida por `location.pathname`; use a hospedagem para navegar entre as três visões.

## Próximo passo
Se prospect responder positivamente, validar porte do ateliê, materiais, prazos reais, canais, fluxo de orçamento e permissão de uso da marca. Só então integrar a aplicação multi-tenant e persistência autenticada em staging, com autorização e contratos adequados.

Consulte `DESIGN.md` para decisões de UX e limitações.
