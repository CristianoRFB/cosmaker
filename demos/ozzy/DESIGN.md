# DESIGN — Ozzy Cosmaker (conceitual, não oficial)

**Data:** 2026-11-02. **Premissas confirmadas:** perfil de Cosplayer/Propmaker/Cosmaker com trabalhos visuais de armaduras, figurino e personagens (print de Instagram). **Hipóteses:** serviço de orçamento, pedidos e acompanhamento.

## Design brief
- Personalidade proposta: **forjado, cinematográfico, artesanal**.
- Público: fãs de cosplay buscando conhecer o trabalho; possíveis solicitantes de peças **se** o ateliê aceitar encomendas; artista/operador para simulação de acompanhamento.
- Objetivo principal: percorrer a jornada *vitrine → pedido fictício → acompanhamento → oficina* em ~90 segundos.
- Direção: editorial de dark fantasy, metal escovado, dourado envelhecido e ritmo de espaços negativos. Uma identidade visual *sugerida*, não uma reprodução do Instagram.
- Tipografia: pilha de sistema Inter/Segoe UI/Arial para interfaces; Georgia como acento editorial. Sem download de fontes e sem fontes redistribuídas.
- Tokens: canvas `#101214`; surface `#191c1d`; surface2 `#202425`; ink `#f1ebe1`; muted `#9da5a4`; primary `#dcb879`; accent `#f0d9a8`; borda `#3a3e3f`; error `#f2a49c`, success `#97c8a4`.
- Grid: 1192px máximo desktop; 2 colunas hero, 3 cards, colapso para uma coluna abaixo de 760px; base mobile 320px/360–430px; espaços 8/12/16/24/32/64.
- Imagens: todas as ilustrações de peças são vetores originais da demonstração. Nenhuma foto, logotipo oficial, modelo 3D ou personagem foi copiado.
- Interações: cards com detalhes; formulário com validação; código local; linha do tempo; avançar/reverter etapa; busca na oficina; visibilidade de categorias na gestão; feedback em toast; restauração local.
- Acessibilidade: campos rotulados, regiões semânticas, estados de foco, `prefers-reduced-motion`, alvos de toque ~44px, fallback de tela vazia e aviso persistente de caráter fictício.

## Fluxos
1. Vitrine `/` → card informativo → `/orcamento` → gerar `OZ-XXXXXX` local → `/acompanhar?codigo=...`.
2. Oficina `/atelier` → localizar código → avançar/reverter etapa → `/acompanhar` refletir estado **no mesmo navegador**.
3. Gestão `/gestao` → ocultar/reexibir categoria → vitrine reflete mudança no mesmo navegador.

## Gestão de dados e responsabilidades
- Visões operação/gestão são **públicas apenas no modo demonstração**. Não são painéis de produção, não há autenticação, RBAC, backend, cobrança, WhatsApp, upload ou compartilhamento remoto.
- Dados de exemplo em `localStorage` no mesmo browser/origem. O visitante é avisado a não digitar dados pessoais.
- O código usa entrada escapada ao renderizar HTML e IDs gerados com `crypto.randomUUID()`.
- Antes de contratação: autorização de marca/portfólio, definição de serviços e prazos reais, auth + regras de tenant no Cosmaker OS, testes de segurança e aceite.

## Evidência e limites de QA
- Código e arquivo remoto verificados após o commit; script JS sintaticamente válido.
- Cloudflare confirmou upload do Worker e ativação do subdomínio. Leitura remota HTTP em 4 rotas retornou HTML correto (verificação com ferramenta de extração).
- **Pendente**: navegador real automatizado (a ferramenta de browser interativo exige saldo e não pôde executar cliques), QA visual mobile/desktop com captura e teste end-to-end de criação/mudança de etapas.
- Não tratar ausência desses testes como aprovação de produção.
