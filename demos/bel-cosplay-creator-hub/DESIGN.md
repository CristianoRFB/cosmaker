# DESIGN — Bel / Creator Hub (demonstração não oficial)

## Evidência e premissas (03/11/2026)
- Print fornecido: @bel.cosplay, Roberta Páscoa; artista que se apresenta como cosmaker, apresentadora, jurada, streamer; destaques vendas, parcerias, dicas e cosplays. O print não prova preços, disponibilidade de encomendas nem serviços atuais.
- Pesquisa pública: https://linktr.ee/belcosplay já centraliza loja de adesivos, lives, tutoriais, links de produtos e outros canais. Esta demonstração **não** substitui esses canais.
- Projeto de pré-venda não oficial, sem autorização de marca, imagens, logos, assinatura ou métricas.
- Hipótese comercial: portfólio editorial e canal estruturado para propostas de marcas/eventos, com painel simples de qualificação. É um complemento ao Linktree, não um ecommerce.

## Objetivo / tarefa principal
Um parceiro visualiza possibilidades de colaboração, preenche um **formulário fictício** em até 90 segundos, e vê o registro na gestão da demonstração.

## Três ambientes
1. Público: `?view=publico` — portfólio visual, áreas criativas, CTA para parcerias.
2. Marcas e eventos: `?view=parcerias` — captura demonstrativa (sem envio) de organização, contato fictício, formato e briefing.
3. Gestão: `?view=gestao` — inbox demonstrativa com filtro, pesquisa, status Novo / Em conversa / Concluído, e controle de destaque das categorias da vitrine.

## Direção de arte
Personalidade: expressiva, editorial, confiante. Sem copiar identidade ou logotipo oficial.
Paleta: fundo #15131b, superfícies #24212b, ink #f9f4ee, pink #ff78aa, acid #e2fb89, muted #bab1bc. Aplicar contraste e foco visível.
Tipografia: Segoe UI / fontes de sistema, Georgia para acento; sem fontes externas.
Grid: 1180px central, mobile 320–430px, quebras 480/780/1050. Espaçamento 8/12/16/24/32/48/64.
Mídia: formas CSS, SVGs originais simples criados para a demo; sem imagens da artista, personagens licenciados ou logos.
Interações: navegação por links diretos, preenchimento validado, feedback de sucesso, pesquisa, filtro e mudanças de status, visibilidade de destaques. `prefers-reduced-motion` suportado.

## Escopo técnico e limites
- `DEMO_INTERATIVA_PERSISTIDA_LOCAL`: dados fictícios persistidos no `localStorage` do navegador, **sem backend ou sincronização entre dispositivos**.
- A gestão é pública e não requer senha **porque não contém dados de produção**.
- Links externos, envio de mensagens, agenda, checkout, autenticação, métricas oficiais e integrações **não implementados**.
- Worker público estático autossuficiente: `77-bel-cosplay-creator-hub-demo.on7.workers.dev`.
- Código da demo isolado do app Cosmaker OS multi-tenant.

## Critérios de aceite
Links para 3 ambientes, formulários com validação, atualizar status, alternar destaques, foco visível, viewport adaptativo, sem coleta real de informações e aviso não oficial visível.
