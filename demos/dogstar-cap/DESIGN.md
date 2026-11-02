# DESIGN — Dogstar Cap (demonstração conceitual)
Data: 2026-11-02
Perfil observado no print: instagram.com/dogstar.cap; Santa Fé do Sul/SP; customização de bonés, Skins Épicas, Skins Lendárias, Monster Cap e Encomenda; WhatsApp pelo perfil (número não confirmado).

## Premissas e transparência
Confirmado no print: nome, bio "O Estilo que não late, Morde!", bonés customizados, categorias em destaques e associação a AnimesFest.
Inferido: encomendas por conversa e dificuldade potencial em organizar referências, orçamento e estágios.
Desconhecido: estoque real, preço vigente, modelos, formas de pagamento, capacidade, entrega, prazos, número do WhatsApp, autorização de marca/fotos.
Todas as imagens do HTML são SVGs geométricos originais, não fotos oficiais. Nunca insinuar parceria ou operação real.

## Direção visual
Personalidade: ousada, criativa, urbana. Apelo streetwear/pop-cultural, amarelo industrial inspirado em cor visível no avatar e preto grafite; coral e areia usados apenas na proposta, não identidade oficial.
Cores: ink #1e2225, black #111316, yellow #ffd347, paper #fffdf7, cream #f7f5ee, focus #1676d2.
Tipografia: system UI para corpo, Impact/Arial Black como display fallback, sem CDNs.
Estrutura: hero tipográfico + arte de boné original, coleções em cards, fluxo de três etapas, briefing em duas colunas, quadro de produção em colunas horizontais roláveis e gestão sem faturamento fictício.
Mobile-first: layout responsivo, scroll horizontal do quadro com colunas legíveis, navegação de três visões, CTA fixo na vitrine.
Motion: transições de 170ms em CTAs; respeitar reduced-motion.
Prioridade: ação principal "Quero personalizar". Campos de briefing sem dados pessoais, sem compra nem envio real.
Acessibilidade: lang pt-BR, headings, rótulos, foco visível, targets 44 px e estados de teclados.
## Estados / segurança
view=loja, view=atelier, view=gestao; tracking do último exemplo criado na mesma sessão/navegador.
Todos os dados são fictícios, guardados no localStorage do visitante (não há servidor, autenticação nem persistência compartilhada).
Nunca vender a aba de gestão como autenticação administrativa; é uma maquete interativa pública.
## Critérios
HTML standalone sem dependências, três visões navegáveis, registro de pedido DEMO local, movimentação de etapa local, reset; instrução de que não existe encomenda real; teste em 320/360/390/430/768/1024/1440 e teclado.
## Próximo passo após resposta comercial
Validar fluxo, autorização de marca, política de artes de terceiros, produtos e preços, integrar vertical de customização com isolamento tenant real e controle de acesso, ordem de produção e mídia autorizada.
