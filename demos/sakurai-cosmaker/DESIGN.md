# DESIGN — Sakurai Cosmaker · demonstração não oficial

## Contexto e premissas
- Fonte direta: print do Instagram @sakurai_cosmaker enviado pelo usuário (02/11/2026).
- Perfil de artista/cosplayer e cosmaker. Bio informa **agenda fechada** e Linktree/contato.
- Sem autorização de uso de fotos, logomarca, identidade visual ou trabalhos da artista. Portanto: marca textual conceitual e ilustrações SVG originais de personagens fictícios, **não apresentadas como trabalhos reais**.
- A demonstração não tem relação comercial formal com o perfil citado, não coleta encomendas reais e não conecta a dados do Cosmaker OS.

## Objetivo e públicos
Mostrar em 90 segundos como um portfólio profissional pode coexistir com um acompanhamento de produção e uma bancada administrativa operacional.
- Visitante: descobrir a estética da vitrine, consultar os canais oficiais e compreender que agenda está fechada.
- Cliente fictício: consultar código `DEMO-042`, visualizar estado, etapas, recado.
- Gestor fictício: escolher projeto, atualizar etapa e recado, conferir reflexo na vista de cliente (mesmo navegador), criar exemplo e restaurar dados.

## Direção de arte
Três palavras: **editorial, artesanal, expressiva**.
- Fundo `#f7f1e9`, superfície `#fffaf3`, texto `#251d26` e escuro `#201922`.
- Ação primária `#b94661`, acento dourado `#b98d5d`, border `#d9d0cb`, confirmação `#226f58`.
- Títulos: Playfair Display (Google Fonts, fallback Georgia). UI: DM Sans (Google Fonts, fallback system-ui).
- Espaçamento modular 4/8/12/16/24/32/48/64px. Layout desktop max 1180px, mobile 360–430 prioritário.
- Raio baixo de 4px e contraste com imagens editorial-poster; evitar interfaces genéricas.

## Fluxos testáveis
1. Público `/index.html`: filtrar cartelas, abrir detalhe modal acessível, navegar para acompanhamento; nenhum envio real.
2. Cliente `/acompanhamento.html`: pesquisar `DEMO-042` ou clicar código de exemplo → acompanhar cinco etapas, nota demonstrativa e progresso; código inválido dá feedback.
3. Ateliê `/atelie.html`: selecionar projeto do quadro → alterar status e recado → salvar → visitar cliente com mesmo código e observar mudança. Criar novo exemplo e restaurar ao seed com confirmação.

## Estados, responsividade e acessibilidade
- Menu móvel com aria-expanded, filtros com aria-pressed, landmarks, skip link, diálogos nativos com Esc, labels explícitos, focus-visible, progresso com role=progressbar.
- Alto contraste em textos e botões; touch targets >= 42–50px; tabela substituída por kanban de rolagem horizontal no mobile.
- Erros de código e estados vazios; gravação local com fallback quando armazenamento indisponível; reduced-motion.
- Imagens SVG inteiramente vetoriais e próprias. Texto alternativo disponível. Nenhuma imagem de Instagram replicada.

## Natureza técnica / riscos
- **Demo interativa local**: persistência via localStorage no mesmo navegador, sem contas, autenticação, dados reais, banco remoto, WebSockets, preço, WhatsApp automático ou entrega física.
- Sem garantia de sincronização entre dispositivos; mudança reflete entre vistas no mesmo navegador, inclusive abas distintas via storage event.
- Painel aberto sem senha é apenas um protótipo isolado sem backend. Nunca reutilizar em produção sem autenticação e autorização.
- Linktree e Instagram são links externos oficiais mostrados no print, mas conteúdo destes destinos não está sob controle da demonstração.

## Integração futura ao Cosmaker OS
Isolar tenant demo real no núcleo canônico Next.js/Firebase, usando contratos existentes de quote/order/status com `atelierId` validado do lado servidor; mover dados fictícios para fixtures de staging, aplicar roles, rules, storage privados e resolver de slug. A demo separada **não se anuncia como integração**.
