# Demonstração — Bel Creator Hub

**Lead:** @bel.cosplay · Cosplayer/Cosmaker/Criadora de conteúdo · **Status:** prospect, sem contrato.

**Objetivo:** mostrar uma proposta que complementa a página de links existente com **portfólio, fluxo de parcerias e gestão de solicitações**.

## Links
- Vitrine: https://77-bel-cosplay-creator-hub-demo.on7.workers.dev/?view=publico
- Propostas (simulação): https://77-bel-cosplay-creator-hub-demo.on7.workers.dev/?view=parcerias
- Gestão (simulação): https://77-bel-cosplay-creator-hub-demo.on7.workers.dev/?view=gestao

## Teste manual
1. Entre em Parcerias e crie uma proposta com nomes fictícios e pelo menos 15 caracteres na descrição.
2. Abra Gestão no mesmo navegador e confirme nova proposta, filtro e alteração de status.
3. Em Gestão, oculte "Tutoriais & conteúdo"; abra a vitrine e confirme a alteração; reative depois.
4. Teste recarga (localStorage do navegador), navegação pelo teclado, versão móvel e restaurar dados.

## Limites
**Não oficial.** Não utilizar logotipo, fotos de cosplay, endereço pessoal, contas de clientes ou credenciais. Pedidos são **simulados**, sem backend: status persiste apenas neste navegador; sem envio real de solicitação para a criadora. Dados e categorias são fictícios e não representam oferta/condições comerciais reais. Métricas da conta não foram incluídas.

## Deploy
Código de referência: `index.html`. Worker `77-bel-cosplay-creator-hub-demo` foi publicado como script autossuficiente com HTML incorporado; futuras alterações no arquivo requerem nova publicação do Worker. A pasta não faz parte do roteamento de produção do Cosmaker OS.

## Validação 03/11/2026
- JavaScript inline: sintaxe válida em compilação isolada.
- Cloudflare: Worker enviado, subdomínio habilitado.
- HTTP externo: as três URLs responderam com título/meta e navegação (checagem via TinyFish).
- **Não foi feita** automação E2E interativa ou auditoria real de viewport em navegador; requisição HTTP não prova execução do JS.
