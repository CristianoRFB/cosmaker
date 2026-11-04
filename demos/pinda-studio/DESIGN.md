# Pinda Studio — Prévia independente · 04/11/2026

## Evidência e justificativa
- Instagram @pinda.studio: 2026 fechado; orçamentos via direct; trajes emborrachados; entregas pelos Correios (print enviado).
- Site público https://www.pindastudio.com/ tem catálogo, página de projeto e formulário de medidas. Não substituir o site com landing redundante.
- Lacuna **não confirmada**: transparência de andamento para cliente, controle de etapas e priorização da pré-lista. Foco só na hipótese demonstrável.
- **Sem autorização de marca**: nenhuma logo/foto do perfil, nenhum personagem licenciado, nenhum produto real.

## Direção visual
Palavras: artesanal / editorial / precisa.
Paleta: paper #f5f1e9, surface #fffdf8, ink #202822, primary #244940, clay #b65c3b, sage #d9e5dc.
Fonte: Georgia (títulos) + fontes nativas do sistema (UI). Sem fontes externas.
Imagem: estudo SVG original de corte, feito em código. Não atribuído ao estúdio.
Componentes: navegação para três papéis, cartões de projetos, status, stepper, formulários com feedback, tabelas com overflow seguro.
Responsividade: 320–1440px por CSS grid/flex, breakpoint 700px/950px; acessibilidade básica (skip link, labels, focus, contraste, reduced motion).

## Produto demonstrado
- Cliente: apresentação, consulta a protocolos fictícios, jornada por etapas, formulário de interesse sem dados sensíveis.
- Oficina: fila de projetos e avançar/voltar etapas.
- Gestão: números do estado fictício, projetos, filtro via visão Oficina, lista local de interessados, conversão simulada e reset.
- Dados de exemplo compartilham estado entre as três visões do **mesmo navegador** por localStorage. Nenhum backend, autenticação, sincronismo entre usuários, recebimento de pedidos ou disparo de mensagens.
- URL conceitual identificada como não oficial em todas as visões.

## Para sair do protótipo
Integrar à vertical Cosmaker OS via tenant resolver real, regras de autenticação, autorização e isolamento; confirmação de dados, processo de agenda, consentimento, status reais e notificações. Nenhuma implantação ao estúdio foi feita.
