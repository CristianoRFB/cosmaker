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


## Classificação corrigida após feedback do cliente — 05/11/2026
**Ivsoy (DPS) / Dino Punk = 💗 Ultimate**, confirmado pelo cliente com a mensagem “Esse aqui é ‘Ultimate’”. O filtro Ultimate deve exibir **uma** peça, Épica **duas**, Lendária **duas** e Todos **cinco**; não pode mais exibir estado vazio da categoria Ultimate. Raridades restantes ainda dependem de confirmação individual. Sem mudança de preços, disponibilidade ou tenant.


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


### Revalidação responsiva adicional (mesma publicação, 05/11/2026)
- **390px:** os três cards foram medidos em navegador real. Épica 480px; Lendária 472px; Ultimate 472px. Os três CTAs ficaram visíveis, nenhum título colidiu com a área da ilustração e o documento apresentou largura exatamente 390px.
- **768px:** três CTAs visíveis, títulos dentro das áreas corretas e document.scrollWidth igual a 768px.
- **1440px:** validação desktop anterior permanece vigente (3 cards sem corte nem sobreposição).
- Tentativa de 320px interrompida por limite temporário HTTP 429 do serviço de renderização; não alegar teste final desse tamanho nesta alteração.
