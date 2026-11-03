# DESIGN — Sah Wayne · conceito independente
Data: 2026-11-03
Proveniência: screenshot do Instagram @sahwayne fornecido pelo usuário (perfil com cosplayer, cosmaker, embaixadora e agenda aberta). Resultado web externo: sem fontes verificáveis que acrescentassem dados; evitar atribuições não confirmadas.
Lead: cosmaker e criadora de conteúdo; visibilidade de 6.565 seguidores no screenshot (apenas observação do print, não métrica atual verificada).

## Premissas
CONFIRMADO NO PRINT: nome exibido Sah Wayne; cosplayer/cosmaker; embaixadora @tekbond_oficial e @tekbondgeek; chamada para encomendas e parcerias por direct; agenda marcada aberta no print.
HIPÓTESE: potencial de reunir vitrine, orçamento e conteúdo de parcerias em link único; negócio pode usar fluxo manual por DM; NÃO inferir que esteja sofrendo com atendimento.
DEMO_FICTÍCIO: personagens, peças ilustradas, nomes, propostas e contagens do painel; sem preço real, promessa de prazo ou case de sucesso.
PROIBIDO: fotos, logotipos, referências a campanhas oficiais e marcas de terceiros na demo.

## Objetivo
Mostrar uma jornada de orçamento que organiza referências; separar posicionamento de embaixadora e operação cosmaker; demonstrar o andamento do ateliê.

## Direção visual
3 atributos: editorial, artesanal, sofisticada.
Paleta: canvas #19151e; surface #28222e; ink #f5eee9; primary #e6c69c; accent #d2bdd9; muted #b9aebc; success #b5d5bf; error #f5beb7; border #514552.
Tipografia: Georgia serif para títulos + system-ui para interface, sem downloads de fontes.
Espaçamento: 4/8/12/16/24/32/48/64. Largura 1170px; mobile 320–430px, tablet 768px, desktop 1440px. CTA alvo 44px+.
Imagens: exclusivamente ilustrações originais vetoriais/CSS geradas para este conceito, não obras reais.
Animação: hover breve, respeita reduced-motion.

## Ambientes
Cliente (?view=cliente): portfólio conceitual, processo, orçamento e proposta de parceria. CTA: enviar simulação.
Operação (?view=operacao): projetos fictícios, progresso e alteração de etapa.
Gestão (?view=admin): orçamentos e parcerias fictícios, filtros, criação de projeto e agenda simulada.
Persistência: localStorage do navegador, não sincroniza dispositivos. Não possui backend, pagamento, autenticação real ou contato automático.
Acesso admin sem senha só porque esta é uma demo inteiramente fictícia, jamais ambiente de produção.

## Aceite
Não fingir participação real da Sah. Entradas escapadas na renderização, validação HTML, conteúdo inicial coerente, ações e confirmação em Português, navegação por query. Verificar responsividade e worker HTTP após publicação.
