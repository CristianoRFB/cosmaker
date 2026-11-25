# Ateliê Nui — demo conceitual não oficial

2026-11-25. Local/vertical Cosmaker OS: fluxo artesanal de encomendas; demo independente, sem integração com a aplicação e sem dados reais. Base main preservada.

## Brief e design
Agenda fechada por padrão; fluxo de acompanhamento por código sintético NUI-101, gestão de etapas e capacidade, abertura somente na simulação. Alternativas: vitrine editorial, catálogo denso, dashboard prioritário; escolhida vitrine editorial artesanal lilás/marfim, com gestão separada. Ilustrações SVG originais conceituais (não fotos da artista); não copiar marca nem imagens de terceiros sem autorização. Fonte de trabalhos reais: perfil público indicado na vitrine. Carrd não pôde ser consultado. Preços da artista e datas futuras não confirmados.

## Evidências
- Worker isolado `77-lena-nui-plush-demo`, sem bindings, sem alteração de produção. Deploy 05845543fe2445b0880ac001c66cfe8f, código 7738c4fc6ca082cea275e3fd6c34ea5181c1af5c.
- https://77-lena-nui-plush-demo.on7.workers.dev/cliente /gestao /proposta: extração HTTP retornou título e navegação nas três rotas antes e após o segundo deploy. Extração não comprovou conteúdo JS renderizado.
- Rodada 1: JS compilado e 9 verificações em DOM simulado: agenda fechada, código válido e inválido, persistência local, abertura, limite, interesse refletido, etapa refletida, proposta. PASS. Não é E2E de browser.
- Rodada 2: correção de agenda lotada e etapa concluída, clone compatível; sintaxe JS PASS, upload e smoke HTTP PASS. Regressão funcional do patch e revisão visual desktop/mobile NOT_RUN. CI NOT_RUN.
- Sem banco, login, pagamentos, notificações, PII ou novos orçamentos reais. Persistência localStorage por navegador. Noindex; não é controle de acesso, não contém dados privados. Não há sincronização entre dispositivos.
- Aceite: APRESENTÁVEL COM LIMITAÇÕES EXPLÍCITAS após conferência manual visual. Próximo gate: testar navegação real em Android/desktop e obter autorização/licença para fotos; nenhuma mensagem enviada.
- Rollback: reimplantar SHA ae716c12465182c849a8b3b3bf3d8eb68efd3c7a ou desabilitar somente o subdomínio do Worker demo; não tocar produção.
