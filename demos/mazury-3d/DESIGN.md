# DESIGN — Mazury Impressão 3D (conceito não oficial)

## Evidência e premissas
- CONFIRMADO pelo screenshot enviado: Instagram `@mazuryimpressao3d`, nome Mazury Impressão 3D; bio divulga protótipos, peças técnicas e decorativas, localização abreviada como Niterói/RJ; imagens de miniaturas alienígenas, peça festiva, sapo decorativo e outros objetos.
- NÃO CONFIRMADO: site existente, preço, medidas, material, prazo de entrega, WhatsApp, capacidade produtiva, estoque, preços e uso de software.
- FICTÍCIO na demo: desenhos originais de peças, cartões, status, clientes e pedidos, qualquer jornada de orçamento e gestão.
- Nenhuma imagem nem logotipo do Instagram foi copiado para a demo; a marca textual é usada como proposta não oficial.

## Objetivo
Transformar curiosidade por peças 3D em solicitação de orçamento organizada, com acompanhamento simples e vitrine editável.

## Direção visual
- 3 palavras: **curiosa, artesanal, contemporânea**.
- Público: admiradores de miniaturas, pessoas procurando presentes e pequenos negócios que necessitam protótipos.
- Paleta: canvas `#f7f6f0`; ink `#1b211d`; surface `#fffefa`; accent `#cfff60`; accent quente `#ff9d72`; borda `#dedfd6`; texto secundário `#667064`.
- Tipo: Space Grotesk em títulos e DM Sans no conteúdo (fontes de licenças abertas distribuídas via Google Fonts), com fallback system-ui.
- Mobile-first 320–430px; cards em duas colunas; desktop três colunas; admin adaptativo.
- Interação crítica: cliente escolhe peça → informa preferência e nota fictícia → recebe código de demonstração → consulta estágio → equipe avança fluxo → gestão oculta/exibe item e impacta catálogo.
- Componentes: imagem vetorial original por categoria, filter chips, botões pill, formulários com labels, modal nativo, tags de status, painéis operacionais, mensagens de sucesso/erro.
- Motion: estados hover sutis; respeita `prefers-reduced-motion`.
- CTA: explorar coleção e simular orçamento (nenhum envio real).
- Anti-padrões evitados: métricas de vendas falsas, checkout fake, preços inventados, fotos de terceiros sem licença e senhas de demonstração.

## Visões e estados
1. `#cliente`: vitrine e orçamento, filtro, status com código.
2. `#operacao`: fila por etapa e mudança de status.
3. `#gestao`: gestão de visibilidade de produtos e pedidos.

O estado salva em `localStorage` do navegador. Não há backend, autenticação, comunicação ou persistência entre aparelhos.

## Aceite
- Fluxo central de demonstração navegável nos tamanhos 320, 360, 390, 430, 768, 1024, 1280/1440px.
- Sem overflow horizontal, botões com foco visível, formulários com rótulos e validação, texto em PT-BR.
- Prévia marcada como não oficial e sem disparos externos.
- Testes de execução em navegador e QA registrados antes da apresentação.