# ACEITE — Dogstar Cap UI V2
Data 2026-11-02. Classificação: **APRESENTÁVEL COM LIMITAÇÕES EXPLÍCITAS**, apenas conceito independente.

## Evidências verificadas
- Base: CristianoRFB/cosmaker; branch demo/dogstar-cap-conceito; PR #1 draft, main preservada.
- 3 visões: vitrine/estúdio, fila de produção e gestor; sem checkout real.
- Publicação: Cloudflare Worker 77-dogstar-cap-conceito, subdomínio on7. Upload do redesign confirmado e rota /health respondeu OK em checagem externa anterior.
- JavaScript sintaticamente válido pelo new Function no V8.
- Verificação sintética de lógica do código V2: loja/atelier/gestao renderizam; escolha de estilo abre form; submit cria ficha local com acompanhamento; ação avança a etapa; toggle de catálogo persiste no localStorage.
- Valores de painel derivados da coleção local de pedidos fictícios, sem métricas financeiras inventadas.
- Sem segredos, CRM real, WhatsApp real, contas, banco ou pagamentos.

## Pendências e limites
- Captura automatizada da tela pelo Cloudflare Browser Rendering falhou por limite HTTP 429. Não foram capturados screenshots reais da V2.
- Revisão visual real multi viewport, teclado, touch, reduced-motion e contraste ainda necessária; não afirmar conformidade completa WCAG.
- Fontes carregadas por Google Fonts com fallback.
- Painel gestão sem autenticação por ser DEMO pública; não converter em admin real sem roles e backend.
- CI do SHA final deve ser inspecionado antes de qualquer merge. PR permanece draft.
- Produto e identidade ainda não homologados pela Dogstar; sem permissão para apresentar como parceria.


---

## Confirmação comercial direta recebida — 04/11/2026

**Fonte:** mensagens do responsável pela Dogstar e foto do esboço enviadas pelo usuário no chat. Diferente das sugestões de identidade anteriores, as informações abaixo foram explicitamente comunicadas pelo lead.

- Lema exato informado: **“Estilo que não late, Morde!”** (a demonstração preserva a vírgula e a exclamação).
- Cores adicionais solicitadas: **vinho, cinza escuro, verde escuro, ciano, laranja neon, caramelo, marrom, rosa, verde neon e areia**.
- Duas correções: **amarelo canário** (substitui amarelo anterior) e **vermelho vivo** (substitui vermelho anterior). Hexadecimais dos tons são **interpretações propostas**, porque o cliente só informou nomes, não códigos.
- **Monster Cap NÃO é uma linha de bonés.** É um brinde exclusivo concedido **apenas aos bonés autorais**. Acompanha cartão com desenho da versão monstro do boné, nome, vida, ataque, resistência e foto do modelo com nome próprio.
- Esboço de três linhas: Épica/vermelho, Lendária/roxo, Ultimate/rosa. Nomes oriundos do desenho; protótipos ainda ilustrativos.
- Fotos reais, nome e atributos de uma peça Monster Cap efetivamente produzida **não foram enviados**.

## Implementação V4 — refletindo esses dados

- H1 da vitrine atualizado para lema exato (aria-label). Amarelo canário em token principal.
- Studio passou a ter **15 opções**, sendo as 12 comunicadas (10 adicionais + amarelo canário + vermelho vivo) e 3 opções antigas mantidas. O nome selecionado atualiza com a prévia.
- Monster Cap deixou de ser interpretado como categoria: seções **Épica, Lendária, Ultimate**; Monster Cap é bloco editorial independente com cartão-demo de frente e verso.
- Frente do cartão: arte fictícia da versão monstro + nome + valores de exemplo **100/75/60 explicitamente fictícios**. Verso: área reservada para a foto real do modelo, **sem inventar foto nem atributos finais**. Botão vira o cartão.
- Produção permite marcar/desmarcar uma **ficha DEMO** como boné autoral. Gestão calcula a contagem de fichas marcadas; não implica que a encomenda original do cliente é elegível, pois a decisão final é da Dogstar.
- O identificador legado interno \`monster\` da categoria Ultimate foi corrigido para \`ultimate\`, com migração no carregamento de localStorage. O nome público de Monster Cap agora é reservado ao brinde.
- Todos os dados locais são fictícios. Sem upload, vendas, pedidos reais, preço, checkout, CRM, telefone do lead ou autenticação operacional.

## Revisão e pendências

- JS passou em sintaxe V8; smoke tests de DOM sintético para as três visões, cores, criação de ficha, flip, elegibilidade e migração.
- Worker Cloudflare atualizado em 04/11/2026, subdomínio ativo e 3 URLs respondendo via TinyFish fetch.
- **Falta QA visual em navegadores reais e nas larguras 320/360/390/430/768/1024/1440**; não afirmar ausência de overflow sem screenshots e auditoria de foco, zoom e contraste.
- Antes da entrega final: aprovar códigos hex e versão oficial dos cartões; obter imagens reais/autorização para uso; substituir localStorage por backend seguro e multi-tenant se contratado.


## Correção validada em navegador real — 04/11/2026

- Cloudflare Browser Rendering capturou a versão nova em viewport mobile **320 × 900** (mobile+touch).
- Auditoria sobre bounding boxes de títulos, categorias, Monster Cap e CTAs: largura do viewport 320px, documento 320px, **zero elementos avaliados para fora da tela**.
- Inicialmente o título Monster Cap e o botão do cartão ultrapassavam 320px; CSS foi corrigido e o mesmo teste foi reexecutado com resultado PASS.
- Auditoria visual em 360, 390, 430, 768, 1024 e 1440 px e contraste completo ainda pendentes.
- Os itens, pedidos e atributos demonstrativos não representam peças oficiais da Dogstar.


## Atualização: portfólio e Projeto 2 (05/11/2026)

Fonte: imagens e mensagens encaminhadas pelo responsável da Dogstar na conversa; a demo publica somente as três fotos/imagens do projeto, nunca prints de conversa ou números.

- **Hipnotizante**: fotos do boné e no modelo; boné preto, decoração em branco e espinhos. O responsável informou que foi **sorteado no anime.fest**. Exibido como trabalho de portfólio, **não estoque à venda**.
- **Projeto 2**: imagem de uma criatura preta com espinhos brancos, compartilhada como referência. O criador quer fazer bonecos dos monstros, cada um com lore/história. **Não é Monster Cap**. Sem inventar histórias, datas de lançamento, preço ou disponibilidade.
- **Briefing**: três sugestões clicáveis preenchendo textarea editável (texturas 3D, cores e referências autorais). Não há pedido real.
- **Fotos**: caminhos `demos/dogstar-cap/assets/hipnotizante-bone.jpg`, `hipnotizante-modelo.jpg`, `projeto2-criatura.jpg`, na branch isolada. Worker serve cópias via `/assets/<nome>` usando proxy allowlist de GitHub público. Nenhum print da conversa foi incluído.
- **QA**: testes sintáticos e DOM das três visões + galeria e exemplos passaram. Browser Rendering na viewport **390 × 844** confirmou todas as 4 imagens verificadas com largura natural >0 e `scrollWidth=390`.
- **Pendências**: validar outros viewports, autorização final para publicar imagem da pessoa/modelo e eventual marca de terceiro visível no boné, origem/direitos da referência 3D e conteúdo oficial da lore. O material foi compartilhado para demo, mas isso não prova liberação contratual para uso comercial permanente.
- **Estado**: demo não oficial, localStorage com pedidos sintéticos, sem pagamento/backend ou indicação de produto à venda.
