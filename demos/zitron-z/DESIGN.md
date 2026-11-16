# STUDIO Z — conceito independente @zitron_z

Data: 2026-11-03. Status: DEMO, não oficial. Nenhuma parceria ou direito de uso de fotos/logotipos foi presumido.

## Evidências e hipótese
Screenshot público fornecido: @zitron_z, descrição de cosplay, cosmaker e wigmaker, destaques TRABALHOS, VENDA e TUTORIAL. Não comprovado que recebe encomendas atualmente, nem cidade, preços, prazos ou contatos. Prioridade comercial: média-alta por atuação artística e presença de venda; proposta sujeita a validar interesse e operação.

## UX e direção
Visual editorial próprio; paleta carvão #101017, menta #b6f0dc e lavanda #ccb6ff. Ilustrações SVG originais e claramente fictícias, sem logo nem fotos da pessoa. Tipografia system UI + Georgia em itálico. CTA primário: experimentar orçamento, CTA secundário: portfólio ilustrativo.

## Três ambientes
- Vitrine (?view=cliente): apresentação, portfólio conceitual, categorias, briefing sem dados pessoais, acompanhamento por código.
- Produção (?view=producao): kanban de quatro etapas com avanço, reabertura e restauração de exemplos.
- Gestão (?view=admin): métricas derivadas das solicitações, lista, distribuição por etapa e exportação CSV.

## Dados e limitações
Todos os dados são fictícios, armazenados exclusivamente em localStorage por navegador, sem backend, autenticação, pagamentos, envio de mensagens, acesso externo ou persistência entre dispositivos. Código de acompanhamento não representa credencial segura. Visões internas são públicas porque simuladas. Antes de produção: autenticação e autorização tenant-aware, backend privado, uploads, consentimento, comunicação e políticas reais.

## Responsividade e acessibilidade
Design previsto para 320, 360, 390, 430, 768, 1024 e 1440px; labels, semântica, foco, touch targets, dialog e reduced motion. Validar em navegadores reais após publicar.

## Integração ao Cosmaker OS
Nenhuma alteração no core do app; protótipo isolado nesta branch. Converter dados de catálogo/branding para tenant config, quote e stage para backend/roles já existentes; implementar portal com autenticação/autorização antes de qualquer uso real. Link de preview separado por Worker.
