# Gojo Cosmaker — Brief, DESIGN e execução da demonstração

Atualização: 2026-11-02 • Lead prospectado, sem contato ou autorização comercial registrados • Vertical Cosmaker.

## Proveniência
- **Confirmado pelo print fornecido (captura do Instagram):** perfil `@gojo.cosmaker`, nome apresentado como Gojo Sensei, descrição "Cosplays sob medida", 315 publicações, 7.314 seguidores na captura, texto "Agenda aberta para Fevereiro" e "Frete grátis para região sul e sudeste", link na bio `linktr.ee/gojocosmaker`.
- **Confirmado apenas para a captura do usuário:** a tentativa de abrir link de bio mostrada em outro print retornou erro XML `NoSuchKey`. **Não é prova de indisponibilidade geral ou permanente**.
- **Sem verificação independente:** cidade, catálogo e preços reais, agenda atual, prazos, política de frete, telefone, imagens autorizadas, contrato, avaliações, meios de pagamento, operação interna.
- **Hipótese:** formulário guiado, acompanhamento de confecção e painel simplificado podem reduzir trocas repetitivas de mensagens e organizar pedidos.

## Proposta e jornada
1. **Cliente — ?view=cliente:** conhecer categorias ilustrativas, começar solicitação, preencher apelido e referências fictícias, gerar protocolo local e acompanhar etapas.
2. **Ateliê — ?view=atelier:** ver lista de solicitações fictícias, avançar/voltar etapas do pedido e refletir o andamento na vitrine local.
3. **Gestão — ?view=gestao:** alterar texto de destaque, aviso de agenda e descrição; ler distribuição dos pedidos fictícios e restaurar estado.
Dados pertencem ao **mesmo navegador**, armazenados em localStorage sob `77_gojo_concept_v1`, **sem backend, contas, autenticação, uploads, mensagens e cobranças**. É propositalmente público e sem senha apenas por não conter dados reais.

## Design Brief
- **Personalidade:** delicada, criativa, artesanal. Proposta visual *não oficial*, inspirada somente no contexto lilás do avatar fornecido, sem reproduzir marca/logotipo.
- **Público:** fãs de anime, cosplayers e compradores de peças customizadas; foco mobile e em poucas interações.
- **Tarefa principal:** construir solicitação demonstrativa e enxergar a evolução do projeto.
- **Paleta:** fundo #fbf8fc, superfície #fff, tinta #251b35, violeta #6543a2, realce #d48fb0, linha #e8dfea; headings serif, texto sem serifa. Letras com fallbacks locais caso a fonte web não carregue.
- **Grid:** largura máxima 1180px; 3 cartões desktop, 1 coluna mobile; breakpoints 900/700/370px; largura mínima 320px.
- **Fotografia e mídia:** ilustrações SVG próprias desenhadas no código; nenhuma imagem real de perfil, obra de terceiros ou produto não autorizado.
- **Feedback:** estado de item, linha do tempo, confirmação de envio demo e salvamento local, reset com confirmação, estados de hover/foco e redução de movimento.
- **Acessibilidade:** idioma pt-BR, labels, contraste, navegação por teclado, foco visível e áreas de toque; revisão automatizada no browser ainda pendente.

## Dados e limites
- Pedido `GOJO-2406` e demais exemplos são artificiais; não representam encomendas reais.
- Não inferir preço, disponibilidade ou frete atual da loja. Aviso de agenda usa texto neutro: "Agenda sob consulta".
- A demo não usa Firebase nem APIs existentes; evita escrever no tenant real.
- Organização de configurações permite substituir marca e conteúdo no futuro; a migração multi-tenant real exige autorização e revisão da vertical.
- Workers Cloudflare isolado: `77-gojo-cosmaker-conceito`; URL de apresentação `https://77-gojo-cosmaker-conceito.on7.workers.dev/`. **É cópia da página HTML da branch**, não deploy da main.
- Para rodar no produto Next, arquivo público em `public/demos/gojo/index.html`; preserva rotas atuais.

## Verificação e aceite
- [x] GitHub branch isolada criada na conta CristianoRFB.
- [x] Arquivo estático versionado no repo Cosmaker.
- [x] Cloudflare Worker isolado criado e subdomínio habilitado.
- [x] URLs com três query strings responderam à leitura HTTP do site público.
- [x] Javascript validado por parser JS em ambiente isolado.
- [x] Simulação em DOM substituto verificou render das três visões; avanço de etapa e edição da gestão refletem na vitrine local.
- [ ] Navegação visual mobile/desktop e testes completos de clique em browser: não executados por falta de acesso disponível ao navegador de QA (saldo do serviço de automação externo esgotado).
- [ ] Deploy na vertical canônica, login real, persistência de pedidos e automação de contato: fora do escopo de demo.

## Classificação para integração futura
| Elemento | Escopo | Estado |
|---|---|---|
| Identidade/cores/texto | LOCAL | protótipo configurável |
| Acompanhamento de etapas | VERTICAL | sandbox local, requer contrato do produto |
| Separação de tenant, autorização, dados | GLOBAL | dependerá de backend canônico |
| Orçamento com referência e envio | VERTICAL | fluxo visual; sem upload/submit real |
| Gestão anônima com dados fake | LOCAL DEMO | nunca reutilizar como autenticação real |

## Gate comercial
Pode ser mostrado como **prévia conceitual não oficial**, sem afirmar parceria, disponibilidade, pedidos reais ou funcionalidade em produção. Valor financeiro e escopo contratado dependem de diagnóstico com a loja.
