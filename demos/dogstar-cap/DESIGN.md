# DOGSTAR.CAP — DIREÇÃO DE ARTE V2
Data: 2026-11-02 | status: demonstração conceitual não oficial.

## Pesquisa e proveniência
Fonte principal: print do Instagram @dogstar.cap fornecido pelo usuário, com avatar amarelo/preto, lema "O Estilo que não late, Morde!", categorias Skins Épicas, Skins Lendárias, Monster Cap e destaque Encomenda.
A paleta, os modelos e a solução de gestão são **propostas**, não identidade ou sistemas oficiais. Sem vínculo ou autorização do estabelecimento. Sem fotos extraídas do Instagram.

## Alterações V1 → V2
V1: hero com desenho genérico, três cards repetidos, painel de métricas e kanban com visual de template.
V2: sistema editorial de streetwear com hero manifesto assimétrico, tipografia condensada grande, produto ilustrado em destaque com costuras/patch originais, seriais e grid 1+2 irregular. Sem cards do mesmo tamanho ou raio padrão. Estúdio de customização com estilos/cor/briefing, operação com filas legíveis, gestão com contagens apenas de exemplos locais e controles com efeito no cliente.

## Personalidade e trabalho do usuário
Três atributos: **expressivo, artesanal, urbano**.
Público: fãs de cultura pop e customização de bonés.
Objetivo principal: criar um briefing ilustrativo em menos de 90 segundos.
Cliente: vitrine e estúdio sem login. Operação: avançar etapa com ação por cartão. Gestor: compreender fila e controlar o que aparece na demo.

## Design system
| Papel | Cor |
|---|---|
| Canvas | #eae9e1 |
| Paper | #f6f5ef |
| Ink | #171815 |
| Deep | #141513 |
| Primary | #fbd332 |
| Editorial accent | #d84732 |
| Muted | #54574f |
| Hairline | #c8c7be |

Fontes: Barlow Condensed display 900, DM Sans regular 400/700/800 por Google Fonts, fallback Arial Narrow/Impact e system-ui. Raios ~2px, bordas finas, sombras curtas e duras; evitar "SaaS genérico". Escala base 4/8/12/16/24/32/48/64px. Grid max-width 1320px, hero de duas colunas em desktop e uma no mobile, card "feature" + dois "support" e thumb de toque >=44px.

## Microinterações / estados
- CTA primário: abrir o estúdio; troca de inspiração, com estado pressed e prévia sincronizada; troca de cor no SVG; preencher briefing opcional e gerar ficha DEMO.
- Kanban operacional avança estágio de uma ficha local. Gestão alterna catálogo/customização/rastreamento em estado local.
- Hover de 160ms, foco visível, preferência reduced-motion desativa animações.
- Sem botão fictício de checkout, pagamento, WhatsApp, foto de produto ou preço inventado.
- Mobile 320/360/390/430; tablet 768; desktop 1024/1440.

## Referências reais estudadas
- New Era by You — https://www.clevermethod.com/work/new-era-by-you/ (personalização visual em mobile/desktop).
- Pukka Hat Customizer — https://www.pukkainc.com/hatcustomizer/ (controle direto sobre objeto e prévia).
- SIDEWALK streetwear — https://www.behance.net/gallery/224896495/SIDEWALK-Website-Design-Brand-assets (tipografia e composição editorial).
- Ink — https://www.ink.app.br/ (mostrar percurso e benefício, não slogans vagos).
Referências de método, nunca autorização para copiar conteúdo.

## Limites de demo e white-label
Arte SVG original e pedidos seed fictícios. Nenhum backend, pagamentos, contas reais, integração com Dogstar ou envio de dados. Alterações em localStorage do navegador atual. Painel de gestão é **simulação pública**, nunca admin com autenticação de verdade.
Codificado em demos/dogstar-cap/index.html isolado na branch demo/dogstar-cap-conceito. Deploy separado no Cloudflare Worker 77-dogstar-cap-conceito, subdomínio on7.
Antes de produto: validar preços, fotos e autorização; integrar vertical custom-made multi-tenant com autenticação, regras, armazenamento e testes A×B.

## Testes pendentes
Screenshot real nos viewports indicados, revisão de contraste AA para texto miúdo, checagem de overflow/teclado/touch, e CI para o SHA final. Browser Rendering Cloudflare falhou com HTTP 429 e não deve ser reportado como captura aprovada.

## Adaptação a esboço fornecido — 04/11/2026

A foto de um desenho manual, fornecida na conversa, detalha três propostas de skins para bonés com lema "Estilo não late. Morde":

- **Épica** — vermelho, bordas diagonais e emblema triangular;
- **Lendária** — roxo, losangos encadeados e emblema em forma de diamante;
- **Ultimate** — rosa, manchas orgânicas e pequeno emblema.

A demo V3 converteu essa composição em ilustrações SVG vetoriais e ornamentos originais. Não foram usadas fotos oficiais do cliente nem a imagem bruta no repositório. A categoria de exibição "Monster Cap" passou a "Ultimate" como **proposta derivada do esboço**, pendente da confirmação do catálogo definitivo. Internamente o id legacy `monster` foi preservado para não descartar pedidos fictícios persistidos em localStorage; deve ser migrado com cuidado se o produto real for implementado.

### Testes da V3
- Três ilustrações de fundo distintas renderizadas na vitrine (mock DOM).
- Produção e gestão mantidas.
- Briefing Ultimate selecionável e pedido fictício gravado no navegador.
- JavaScript validado sintaticamente no runtime V8.
- Deploy Cloudflare Worker confirmado; **ainda sem screenshot e revisão visual real multi-viewport**.

A existência do esboço não implica autorização para vender produtos, usar preços reais, anunciar parceria ou substituir a aprovação da Dogstar.


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


## Atualização: portfólio e Projeto 2 (05/11/2026)

Fonte: imagens e mensagens encaminhadas pelo responsável da Dogstar na conversa; a demo publica somente as três fotos/imagens do projeto, nunca prints de conversa ou números.

- **Hipnotizante**: fotos do boné e no modelo; boné preto, decoração em branco e espinhos. O responsável informou que foi **sorteado no anime.fest**. Exibido como trabalho de portfólio, **não estoque à venda**.
- **Projeto 2**: imagem de uma criatura preta com espinhos brancos, compartilhada como referência. O criador quer fazer bonecos dos monstros, cada um com lore/história. **Não é Monster Cap**. Sem inventar histórias, datas de lançamento, preço ou disponibilidade.
- **Briefing**: três sugestões clicáveis preenchendo textarea editável (texturas 3D, cores e referências autorais). Não há pedido real.
- **Fotos**: caminhos `demos/dogstar-cap/assets/hipnotizante-bone.jpg`, `hipnotizante-modelo.jpg`, `projeto2-criatura.jpg`, na branch isolada. Worker serve cópias via `/assets/<nome>` usando proxy allowlist de GitHub público. Nenhum print da conversa foi incluído.
- **QA**: testes sintáticos e DOM das três visões + galeria e exemplos passaram. Browser Rendering na viewport **390 × 844** confirmou todas as 4 imagens verificadas com largura natural >0 e `scrollWidth=390`.
- **Pendências**: validar outros viewports, autorização final para publicar imagem da pessoa/modelo e eventual marca de terceiro visível no boné, origem/direitos da referência 3D e conteúdo oficial da lore. O material foi compartilhado para demo, mas isso não prova liberação contratual para uso comercial permanente.
- **Estado**: demo não oficial, localStorage com pedidos sintéticos, sem pagamento/backend ou indicação de produto à venda.


## Horoz — novo personagem enviado em 05/11/2026

**Fonte:** screenshot de WhatsApp e foto do esboço entregues pelo usuário neste chat. A foto da conversa contém informações pessoais e **não** foi publicada. Somente a imagem original do desenho foi acrescentada a \`assets/horoz-concept-art.jpg\`.

Informações efetivamente fornecidas pelo cliente:
- Nome do personagem: **Horoz**
- Classe: **Guardião**
- Vida: **7/13**
- Ataque: **6/13**
- Resistência: **6/13**
- A anotação visível no topo do esboço diz **“Hipnotizante — Monstro Corrompido”**.
- O desenho retrata uma criatura preta com chifres, espinhos e uma boca com dentes.
- **Lore não enviada**: não atribuir biografia, habilidades, poderes, lançamento, preço ou disponibilidade.

**Interpretação de escopo:** o cliente compartilhou o personagem na sequência da discussão do Projeto 2 (futuros bonecos dos monstros). Como **não confirmou que Horoz já seja um cartão do brinde Monster Cap**, o personagem e seus atributos foram colocados na seção **Projeto 2**, preservando separação explícita entre as iniciativas. Confirmar posteriormente se há vínculo entre ambas.

**UI realizada:**
- Novo perfil de personagem: nome, classe, atributos com escalas de 13 e explicação textual.
- Galeria alternável entre a referência visual anterior e o desenho original do Horoz; o desenho inicia selecionado.
- Alto contraste dos dados, medidores com valores acessíveis via \`role=meter\`, botões acessíveis com \`aria-pressed\`.
- Código isolado na branch \`demo/dogstar-cap-conceito\`, não na \`main\`.
- Worker expõe exclusivamente as 4 imagens aprovadas da demo via allowlist em \`/assets/\`.
- O desenho aparece como **estudo original**, não como figura comercializável nem arte final digitalizada.

**QA:** JavaScript sintaticamente válido, 9 smoke tests DOM passaram (3 visões, personagem/atributos, brinde separado, controles de imagem). Cloudflare Browser Rendering validou largura de **390 px**, \`scrollWidth=390\`, imagem \`horoz-concept-art.jpg\` carregada em resolução 1536×1536, atributos corretos e nenhum overflow nos elementos inspecionados. Tentativa adicional em 320 px bloqueada temporariamente por HTTP 429; demais breakpoints não revalidados nesta iteração.


## Curadoria de cinco obras e cinco personagens — 05/11/2026
**Fonte:** fotos originais, desenhos e prints de WhatsApp encaminhados pelo usuário, com mensagens do criador. Os prints e telefone NÃO são publicados.

O responsável informou que quer **apenas esses cinco exemplos na demonstração**, diferenciando a raridade por ❤️ Épica, 💜 Lendária e 💗 Ultimate. Não pediu ativação de tenant real.

| Boné (exemplo de portfólio) | Desenho / personagem | Classe | Vida | Ataque | Resistência | Reação observada nas mensagens |
| --- | --- | --- | --- | --- | --- | --- |
| Hipnotizante | Horoz | Guardião | 7/13 | 6/13 | 6/13 | ❤️ |
| Rosário d’Ouro | Acoril | Curadora | 6/13 | 7/13 | 9/13 | 💜 |
| Persistência | Ynatir | Tanque | 7/13 | 3/13 | 10/13 | ❤️ |
| Maldito Verme | Avral | Tanque | 7/13 | 3/13 | 6/13 | 💜 |
| Dino Punk | Ivsoy | DPS | 11/13 | 11/13 | 1/13 | ❤️ |

As reações foram usadas como **classificação demonstrativa preliminar**; nenhuma das cinco artes apresenta ❤️/💜/💗 inequívoco para Ultimate nas capturas disponíveis. O filtro 💗 Ultimate oferece mensagem de estado vazio em vez de inventar um exemplo dessa categoria. O criador deverá revisar/confirmar a atribuição por peça.

O Hipnotizante foi **sorteado no anime.fest**, logo não está indicado como produto disponível. Nenhum dos demais recebe preço, estoque, disponibilidade ou prazo inventados. O portfólio mostra fotografias originais e fotos com modelos, enquanto o **Projeto 2** mostra os cinco desenhos autorais e atributos comunicados pelo criador. As histórias/lore ainda estão pendentes e não foram fabricadas na demo. **Monster Cap** permanece seção separada do brinde de bonés autorais, sem confundir com Projeto 2.

### Trabalho entregue
- 11 novas imagens JPEG no diretório \`assets/\`, somando-se às 4 existentes. Proibido publicar as capturas de conversa, o número de telefone ou outros dados privados.
- Galeria editorial de 5 bonés, filtros por raridade, seleção de peça, miniaturas quando houver fotos alternativas e CTA para briefing original com referência preenchida.
- Seção de 5 personagens com desenho original e as escalas de atributos /13.
- Hero atualizado para usar foto real do Rosário d’Ouro em vez de boné fictício.
- Mesmo \`Worker\` independente de demonstração, com proxy **allowlist** restrito às 15 imagens. Sem modificação da \`main\`, conta real, banco de dados, cobrança ou submissão efetiva de encomendas.

### Testes / aceite técnico
- JavaScript V8: sintaxe PASS.
- 11 testes de lógica em DOM simulado: três visões; cinco bonés; cinco personagens; atributos; corações; imagens; seleção de boné/personagem; filtro 💜; estado vazio 💗; CTA inspirado para briefing — PASS.
- Browser Rendering Cloudflare real: \`320 px\` -> \`scrollWidth=320\` e 0 elementos avaliados com overflow; \`390 px\` -> \`scrollWidth=390\`, 5 cards, 5 personagens, fotos e desenhos carregados com largura natural >0; \`1440 px\` -> \`scrollWidth=1440\`, 0 elementos avaliados com overflow.
- Ainda faltam QA multi-viewport 360/430/768/1024, revisão visual manual completa, acessibilidade com teclado e aprovação do cliente das classificações de raridade.
- Fotos fornecidas pelo cliente para demonstração, mas liberação contratual para produção e autorização de imagem de todos os modelos ou marcas de terceiros **não verificadas**. Solicitar antes de converter em site real.
- Estado final: **APRESENTÁVEL COM LIMITAÇÕES EXPLÍCITAS**. PR draft, não mesclar em main até aceite.


## Vista traseira — feedback direto em 05/11/2026

Cliente pediu: “Nessa parte da personalização, tem como colocar a opção ‘parte de traz do boné’?”

Implementação no Studio:
- Controle interativo Frente / Parte de trás com estados de seleção aria-pressed, foco visível e alvos mínimos de 48px.
- SVG vetorial original da parte traseira com painéis, costuras, recorte e regulagem; a mesma cor escolhida atualiza ambas as vistas. É referência visual, NÃO renderização de artes ou molde de fabricação real.
- Campo opcional "Parte de trás do boné" (até 160 caracteres) para anotar personalização traseira. O formulário DEMO persiste em localStorage como backNote; aparece na confirmação e na produção fictícia. Pedidos antigos sem esse campo continuam compatíveis.
- Preview mantém título de categoria; texto explica frente/trás sem falsas promessas de fidelidade.
- Código em branch demo/dogstar-cap-conceito, PR rascunho, Worker público atualizado. Main sem alterações.

Testes: 8/8 smoke tests V8/DOM passaram (3 visões, alternância de lado, troca de cor com verso selecionado, retorno à frente, armazenamento e exibição na produção).
Cloudflare Browser Rendering: 320, 390 e 1440 px: scrollWidth igual à largura do viewport; vista traseira correta; campo presente; nenhum overflow nos elementos inspecionados. 360/430/768/1024 px, navegação por teclado e aprovação visual do cliente ainda pendentes.


## Correção de preservação de estado do editor — 05/11/2026

Problema reportado pelo usuário: “quando cê altera algo, a parte de trás volta pra parte da frente, entre outros”.

**Causas verificadas no código**: os eventos de seleção de cor e o `change` do menu de categoria invocavam diretamente a renderização frontal de `cap(...)`, ignorando `previewSide`. A ação “Personalizar” também forçava `previewSide='front'` ao reabrir.

**Correções aplicadas**:
- Os três caminhos (troca de cor, alteração de categoria por `select` e por botão) passam pelo método único `refreshCapPreview()`, mantendo o lado selecionado.
- Reabrir a personalização não força a vista frontal. O `editorDraft` fica salvo apenas no `localStorage` do navegador, com categoria, cor, lado, descrição principal e traseira (comprimentos limitados). Entrada de texto não causa rerender. Se reabrir ou recarregar no mesmo navegador, os valores retornam. O texto não é enviado à Dogstar.
- `use-idea` e `cap-inspire` agora preservam o rascunho; no fluxo de inspiração, a categoria segue a raridade da peça selecionada em vez de forçar Épica.
- Ao alterar categoria via menu, os botões correspondentes recebem `aria-pressed` sincronizado.
- O botão de reset também limpa o estado do rascunho de forma coerente. Dados anteriores sem `draft` continuam compatíveis.

**Evidências**: 11/11 testes em DOM simulado para controle do lado, mudança de cor, ambos os controles de categoria, permanência do texto, reabertura, atualização da página, sugestões e migração de dados antigos. Mais 5 verificações do fluxo de inspiração por raridade. Browser Rendering real em largura **390px**: todos os estados (“traseira”, cor, select, botão e reabertura) permaneceram na traseira; textos voltaram corretamente; `scrollWidth=390`, sem erro. Cloudflare Browser Rendering retornou HTTP 429 nas tentativas adicionais de 320px e 1440px nesta rodada (limitação do serviço), então esses dois tamanhos NÃO foram revalidados neste ajuste.

**Deploy**: Cloudflare Worker `77-dogstar-cap-conceito` atualizado, GitHub branch `demo/dogstar-cap-conceito`; `main` preservada, PR draft. Sem backend, pagamentos ou pedidos reais.


## Correção de regressão no personalizador — 05/11/2026

**Relato recebido:** “quando cê altera algo, a parte de trás volta pra parte da frente, entre outros”.

### Resultado
- A versão analisada já preservava o lado no estado do editor e em localStorage. Uma reprodução inicial real na demo (390 px) passou em **23 interações consecutivas**: verso selecionado, as 15 cores, as 3 categorias, select, texto e reabrir a ficha.
- Mesmo sem reproduzir o erro no código atual, reforçamos a persistência: a função de salvar rascunho lê diretamente os campos da interface, quando presentes, para capturar alterações vindas de autofill/alterações sem evento input. Também escuta change em campos de texto, guarda explicitamente side=front/back e reflete esse estado no atributo data-side da prévia. A escolha visual recebe destaque quando o verso está ativo.
- A demo foi republicada no Worker com **Cache-Control: no-store** para impedir que usuários recebam uma versão HTML antiga durante os ajustes.
- Não foi alterado o backend do Cosmaker, a autenticação, preços ou tenant; estes recursos continuam simulados.

### Testes
- Teste V8/DOM do novo código: 11/11 verificações aprovadas, incluindo 3 telas, frente/trás, troca de cor e categoria, entrada textual, preenchimento por change sem input, fechamento/reabertura, recarga (nova instância com o mesmo localStorage) e ausência de regressão das visões gestão/produção.
- Browser Rendering anterior do Worker: **390 px**, 23 interações com a vista traseira preservada.
- Browser Rendering da **nova publicação**: **320 px**, 22 verificações com o verso preservado, campo de traseira retido, data.draft íntegro e document.scrollWidth=320.
- Tentativa adicional em 390 px na publicação mais recente: indisponível por **HTTP 429** do serviço de navegador, então este breakpoint não foi confirmado outra vez após a atualização final.
- 1440 px: testado anteriormente para a prévia de trás, mas não nesta última publicação. Revisão completa 360/430/768/1024 e teste assistido no aparelho do cliente permanecem pendentes.

### Observações de uso
- A vista traseira é **um SVG ilustrativo** com regulagem e painéis, não um modelo 3D ou arte gerada automaticamente. O texto da customização da parte traseira é salvo como backNote na simulação, sem envio para a Dogstar.
- Para validar no mesmo endereço, basta abrir a demo; a versão HTTP HTML passou a ser entregue com política sem cache.


## Correção de layout da seção Próxima skin? — 05/11/2026

**Bug observado em screenshot:** Lendária comprimida visualmente contra a ilustração e CTA de Ultimate cortado na base. Navegador em 1440px revelou cards com altura fixa de 260px, porém conteúdos de 285px e 305px. A máscara de overflow escondia parte dos elementos.

**Correção direcionada ao seletor #colecoes:**
- Grid desktop com duas linhas de altura mínima fluida de 330px, sem corte por causa de conteúdo maior.
- Tipografia proporcional para os dois cards menores, largura segura de título, texto e CTA (44px de alvo de toque).
- Ilustração SVG contida na sua área, sem cruzar a coluna do texto.
- Até 1100px, grid vira coluna com texto e imagem lado a lado; até 600px, os cards ficam verticais, com texto de altura automática e imagem abaixo.
- Preservação da identidade, das raridades, do customizador e do fluxo de encomenda fictício.

**Verificação:**
- Antes, em 1440px: Lendária 260px externo / 285px conteúdo; Ultimate 260px / 305px; botão cortado.
- Depois da publicação, em 1440px: cards 330px, conteúdos 328px; os 3 botões íntegros, textos não ultrapassam as imagens, scrollWidth igual a 1440px.
- Sintaxe JS válida. O serviço de navegador bloqueou uma tentativa adicional a 390px com HTTP 429, então esse tamanho ainda não foi revalidado após a correção.
- Somente a demo/PR draft foi alterada; main e tenant reais não foram modificados.
