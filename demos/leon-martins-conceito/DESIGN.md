# DESIGN — Estúdio de Figurinos (conceito para @leonmarttins)
Data: 03/11/2026 · Status: demonstração não oficial, prospect (não cliente)

## Evidência e hipótese
- Perfil fornecido pelo usuário: Leon Martins, estilista, cosmaker, cosplayer, link Twitch e e-mail público; aproximadamente 17 mil seguidores na captura.
- Fonte pública independente: atuação como cosmaker e jurado de cosplay (BeCo'splay) e entrevistas históricas sobre encomendas e produção de figurinos. Fontes: https://becosplay.com.br/equipe-e-jurados e https://mercadocosplay.wixsite.com/website.
- Nenhuma confirmação de que o ateliê utilize planilha, software específico, orçamento manual, aceite digital ou solução de acompanhamento. A demo apresenta oportunidade possível, não problema afirmado.
- Estratégia comercial: PROSPECTAR com abordagem suave; profissional consolidado e reconhecido, portanto benefício operacional supera promessa genérica de “ter um site”.

## Arte e interação
- Personalidade: editorial, artesanal, sofisticada; posicionamento moda/figurino, não loja de fantasia.
- Marca: **nenhuma logo de terceiro, nenhuma foto copiada**, tipografia genérica “Figurino Sob Medida”. Linguagem de conceito independente.
- Paleta: papel #f7f3eb, tinta #17191b, superfície #fffdf9, terracota #bc6b43, vinho #793d45, feedback #366c5d.
- Tipografia: Georgia e Arial/Inter fallback; sem carregamento remoto de fontes.
- Grid: 1240px, duas colunas na hero e formulários; colunas flexíveis para mobile, quadro horizontal compacto de produção.
- Ilustração: SVG vetorial original embutido; não copia fotos do perfil.
- Comportamento: 5 vistas selecionáveis por URL, foco visível, área mínima confortável dos botões, labels, feedback, estados vazios, prefers-reduced-motion.
- Jornada principal: Vitrine → Solicitação de exemplo → Código de acompanhamento → Produção atualiza status → Acompanhamento reflete no mesmo browser.
- Secundárias: painel de gestão edita visibilidade de categorias e reinicia fixtures.

## Escopo e segurança
- Vistas: ?view=cliente, ?view=orcamento, ?view=acompanhamento, ?view=producao, ?view=gestao.
- Worker entrega HTML/CSS/JS autocontido, sem backend, sem login real, sem contato externo, sem pagamento.
- Fixtures e alterações no localStorage do navegador, isoladas por origem. **Não há sincronização entre dispositivos, cloud DB, notificações nem permissões reais.**
- Aviso de DEMO, não oficial, dados fictícios e hipótese em toda a experiência; não há autorização de marca ou de fotografias.
- Código preservado fora do app Next.js em `demos/leon-martins-conceito/`, para não interferir na base canônica.
- Para produto: absorver fluxos na vertical multi-tenant existente com Auth/Firestore Rules, roles, uploads autorizados e assinatura de propostas.

## Aceite parcial
- Cloudflare Worker carregado, deploy automático e habilitação workers.dev confirmados por API; teste HTTP de /health e da página efetuado por ferramenta externa.
- UI e formulários revisados em código, mas E2E visual/Playwright com clique em mobile/desktop não executado. Apresentável **com limitação explícita**; testar em dispositivos reais antes de enviar a prospect.
