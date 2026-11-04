# DEMO — @anlloucosplay (04/11/2026)

## Estado e proveniência

- **Lead, não cliente.** Prévia conceitual independente, sem autorização de marca, sem fotos/identidade oficial.
- Print do Instagram enviado pelo usuário: @anlloucosplay, cosmaker no Brasil, 10,6 mil seguidores e **agenda de 2026 fechada**.
- Catálogo público verificado: https://cults3d.com/en/users/Anlloucosplay/3d-models (33 designs à data da consulta).
- Comentário público de março/2026 sobre encomendas 3D simples e atendimento pelo Instagram: https://cults3d.com/en/users/Anlloucosplay/comments.
- **Hipótese a validar:** organização de portfólio, coleta de briefing e acompanhamento de encomendas podem economizar idas e voltas no Direct. Não se afirma que a artista tenha esse problema ou aceite novos pedidos.

## Direção visual (DESIGN.md consolidado)

- **Personalidade:** artesanal, editorial, fantástica.
- **Pessoa atendida:** fã de cosplay que deseja entender especialidades e acompanhar um projeto; artista que gerencia produção individual.
- **Objetivo:** permitir uma simulação de briefing em até 90s e ver a solicitação entrar na operação.
- **Arte:** originais SVG abstratos de armadura, adereço, lâmina cenográfica e ornamento; **não usar marcas, imagens nem logotipos de terceiros**.
- **Paleta:** canvas #f7f5ef, ink #12201d, dark #142a25, CTA #d5e9ab, accent #377567, muted #69736f.
- **Tipografia:** Manrope + DM Sans, fallback system-ui; editorial amplo, títulos compactos e descrições pequenas porém legíveis.
- **Grid:** largura máx. 1180px; hero 2 colunas desktop, 1 mobile; cards 4/2 colunas; painel 2/1; breakpoints 1000px e 700px.
- **Interações:** 3 abas por ?view=cliente|producao|admin, modal de briefing, fila de pedidos demonstrativos com status, indicadores derivados, chave de agenda e visibilidade de categorias.
- **Estados:** vazio, filtros, sucesso, campos obrigatórios, agenda fechada, alteração de status, restauração.
- **Acessibilidade:** foco visível, ARIA nas abas/estados, landmarks, labels, prefers-reduced-motion, teclado para campos e ações.
- **Separação:** todos os dados são fictícios; localStorage no dispositivo; login, envio de orçamento, pagamentos, banco e comunicação real **não existem**.

## Deploy

- Worker: `77-anlloucosmaker-conceito`.
- Publicado com conexão Cloudflare autorizada, sem gravar em dados do SaaS.
- **Cliente:** https://77-anlloucosmaker-conceito.on7.workers.dev/?view=cliente
- **Produção:** https://77-anlloucosmaker-conceito.on7.workers.dev/?view=producao
- **Gestão (simulação):** https://77-anlloucosmaker-conceito.on7.workers.dev/?view=admin
- Origem: `demos/anlloucosplay/worker.js` nesta branch. Não substitui nenhum arquivo do Cosmaker OS canônico.

## Verificação / aceite

- Cloudflare confirmou deploy em 04/11/2026, 100% do tráfego da versão ativa, e URL workers.dev habilitada.
- Acesso HTTP/HTML às rotas cliente/admin confirmado por navegador/extrator externo, conteúdo em PT-BR e links reais para Instagram/Cults3D corretos.
- Parse do Worker e do script embutido: OK.
- **Não executado:** E2E de cliques em browser real e auditoria visual de viewports; portanto **APRESENTÁVEL COM LIMITAÇÕES EXPLÍCITAS**, não software homologado.
- Segurança: nenhuma credencial, cobrança ou mensagem disparada; admin é apenas interface de simulação local.
- Para produção: integrar Cosmaker OS com tenants/RBAC, backend de intake, validação de agenda, consentimento e canal de comunicação sob aprovação da artista.
