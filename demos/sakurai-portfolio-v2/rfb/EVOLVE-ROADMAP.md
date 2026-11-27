# Sakurai | EVOLVE ROADMAP — V14 → V25
**Fonte do método:** `CristianoRFB/rfb-method-gpt` `main@5f73ee2b48507234431706e4c6313773bae72a5a`.
**Candidato:** `develop/sakurai-portfolio-v14-rfb` • PR #37 (draft) • Worker: `77-sakurai-portfolio-v14-staging.on7.workers.dev`.
**Congelado:** V13 `b81653482c26fb0ea81817940cbc7c06db9ff1f6` • PR #35 • Worker `77-sakurai-portfolio-v2`. Nenhum EVOLVE pode alterá-los sem aprovação.

## Missão e verdade do produto
Portfólio artístico autoral (não loja de encomendas). Público: fãs, eventos, criadores e possíveis parceiros. Jornadas: conhecer a artista → explorar Franco/Caitlyn → ver resultado/refências/bastidores → navegar diários e buildbooks → consultar biblioteca/moldes → contato/colaboração. Autora confirmou Franco e Caitlyn concluídos, Coco e Gwayne como intenções futuras; imagens reais de Caitlyn e arquivos originais ainda não estão disponíveis. Não afirmar que o conteúdo demonstrativo é o trabalho real da artista. Mensagem de aviso de preview única e crédito específico por item.
A proposta financeira do desenvolvedor e agendamento de encomendas são OUT_OF_SCOPE por decisão explícita do usuário/lead. Gates V7 de proposta/gestão comerciais: analisar, registrar desvio de escopo e não mascarar como PASS. Admin artístico somente se necessário para atualização do acervo; sem conta ou dados de artista real na demo pública.
Arquitetura inicialmente estática: GitHub + Cloudflare Worker isolado, meta de R$0/mês recorrentes sem prometer quota ilimitada.

## Estado inicial verificável
- V13 arquivada; V14 publicada como homologação técnica com /health e imagens básicas verificadas.
- Home com links Franco/Caitlyn, galeria de 13 registros, diário, filme, biblioteca interativa, coleção, editor RGB e drawer.
- Caitlyn: buildbook com 14 peças e 5 capítulos de EXEMPLO, não fontes comprovadas do cosplay.
- Falta evidência atual de Triple Verification, browser QA no domínio V14, VSC, distribuição de direitos de mídia e CI de homologação.
- **Estado de EVOLVE 01..12: PLANNED**; nenhuma funcionalidade futura considerada concluída por já existir uma estrutura visual.

## Contratos e EVOLVEs
Todo EVOLVE começa reconsultando method main/AGENTS, CI do HEAD anterior, Issues/PRs, estado, baseline e regressões; encerra com commit/checkpoint, provas, TV (funcional/adversarial/regressão), VSC para UI e status P0/P1. Se falhar, BLOCKED/NOT_RUN e não promover. Revisar PC 1440x900 e 1920x1080, tablet 768x1024, celulares 320x720 e 390x844; teclado, touch, esc, prefer-reduced-motion, claro/escuro, reset RGB, reload/cache, low bandwidth, console/HTTP. Dois ciclos de screenshot/inspeção/correção/recaptura reais para UI.

### EVOLVE 01 — Baseline, confiabilidade e QA inicial [P0]
**Entrega:** inventário de rotas, dados, links, imagens, diálogos, galerias, vídeo, drawer, paleta; eliminar elementos que prometem clique mas não agem; corrigir 404, erros JS, foco, overflow, conflito de animações e cache.
**Aceite:** 100% das ações inventariadas testadas em mouse/teclado/touch; nenhum bloqueio P0; capturas VSC e matriz TV inicial; V13 intacta. **Dependências:** nenhuma.

### EVOLVE 02 — Information Architecture & Navegação [P0]
**Entrega:** percurso curto home→projeto→processo→referência→voltar; menu lateral mobile e menu desktop consistentes, breadcrumbs, navegação entre projetos, estados vazios e foco visível; filtros relevantes.
**Aceite:** chegar a qualquer projeto em até dois cliques a partir da home, sem perda de contexto; back/forward, deep link, teclado, menu e scroll testados. **Dep:** 01.

### EVOLVE 03 — Project Experience: Franco & Caitlyn [P0]
**Entrega:** fichas editoriais por personagem com hero, imagens reais claramente rotuladas, referências atribuídas separadamente, créditos, bastidores, linha do tempo, galeria e CTA para navegação; Caitlyn permanece exemplo até mídia real autorizada; pontos interativos acessíveis.
**Aceite:** nenhum retrato de terceiro fingindo ser a Sakurai; cada mídia com fonte/autor/status; 14 peças do buildbook demarcadas como ficção; navegação consistente. **Dep:** 02.

### EVOLVE 04 — Ateliê Vivo, Diário & Tutoriais [P1]
**Entrega:** timeline com posts curtos, imagens, etapas, capítulos, filtros por projeto e status; tutorial de exemplo completo, acessível e não atribuído falsamente; links editoriais entre post→peça→referência.
**Aceite:** cada cartão tem destino e conteúdo útil; cronologia clara; mobile/desktop e estados vazios testados. **Dep:** 03.

### EVOLVE 05 — Biblioteca, Moldes & Proveniência [P1]
**Entrega:** biblioteca com fichas pesquisáveis e tags; moldes próprios vs referências externas; autoria, URL, licença/permissão e versão por item; downloads somente quando arquivos verificáveis existirem. Sem links falsos.
**Aceite:** referências, moldes, materiais e tutoriais clicáveis e navegáveis; fonte explícita; link quebrado/ausente tratado. **Dep:** 04.

### EVOLVE 06 — Buildbooks & Coleção Artística [P1]
**Entrega:** livro digital por personagem com capítulos, equipamentos fictícios rotulados, fotos, itens, bastidores; preview de photocards, pôsteres e merch SEM checkout e sem promessa de disponibilidade. Exportação PDF só se viável e autorizada.
**Aceite:** um buildbook de demonstração navegável de ponta a ponta; cards de coleção com detalhes, nenhum CTA de compra falso. **Dep:** 05.

### EVOLVE 07 — Identidade Visual & Brand Studio [P1]
**Entrega:** guia visual autoral da Sakurai; favicon SVG cerejeira; refinamento de fotos, paleta RGB/HEX com cores derivadas e tema, tipografia, componentes consistentes; importação futura de manual de marca mediante autorização, sem publicar materiais confidenciais.
**Aceite:** reset para rosa, persistência, contraste WCAG pertinente, modo claro/escuro, correção de identidade sem uso de emoji em UI autoral; VSC completo. **Dep:** 01–06.

### EVOLVE 08 — Motion Art Direction [P1]
**Entrega:** carrossel infinito de borda, hover/foco, transições entre seções, SVGs de ícones sociais, botão global de pausa, respeitar motion reduzido; simplificar animação excessiva ou redundante. Motion com propósito, não ruído.
**Aceite:** sem reflow/CLS perceptível causado por motion, links continuam clicáveis, scroll fluido sob teste real, pausa e preferência de sistema funcionam. **Dep:** 07.

### EVOLVE 09 — Gestão Editorial (somente conteúdo) [P1/P2]
**Entrega:** interface sandbox para editar projetos, passos, créditos, mídia e estados e ver preview refletido no público; persistência local para demo, reset e export/import JSON opcionais; autenticação/CRUD remoto somente após escopo e aprovação.
**Aceite:** atualizar um título, crédito, imagem autorizada e capítulo → refletir no preview → persistir/recarregar → restaurar demonstração; sem painel de encomendas. **Dep:** 03–07.

### EVOLVE 10 — Performance, Acessibilidade e Segurança [P0 release]
**Entrega:** otimização responsive images (srcset/formatos sem upscaling enganoso), mídia lazy/priority, cache versionado, CSP, rotas e headers, sem dependências pagas, sem dados privados, foco e contraste, auditoria de peso.
**Aceite:** medições reais antes/depois em mesmo ambiente/rede, orçamento de bytes explícito, sem regressão em fotos/vídeo; sem inventar Lighthouse score. **Dep:** 07–09.

### EVOLVE 11 — Total QA, Triple Verification & VSC [P0 release]
**Entrega:** matriz funcional/adversarial/regressão por jornada, dois ciclos visuais mobile+desktop, smoke Cloudflare, screenshot/trace sanitizados, tratamento de todos os P0/P1, CI e relatório AntiVibe.
**Aceite:** ações P0/P1 PASS com evidências no SHA imutável, nenhuma mídia sem proveniência apresentada como obra real, testes de teclado/mouse/touch e cache. **Dep:** 01–10.

### EVOLVE 12 — Homologação, Handoff & Release opcional [P0 gated]
**Entrega:** pacote para feedback da Sakurai, revisão do que é fictício, envio de fotos originais/manual de marca, revisão de créditos/licenças, README, guia de conteúdo, backup/rollback e checklist. Trocar Worker V13 ou publicar como site oficial SOMENTE após autorização específica.
**Aceite:** aprovação humana dos conteúdos, direitos e marca; CI/QA verde; plano de rollback; caso contrário permanecer em staging com status PREVIEW. **Dep:** 11.

## Priorização e cortes
Primeiro entregar EVOLVE 01→03; em seguida 04→06; depois 07→09; por fim 10→12. Gastos ou banco externo não entram por padrão. Integrações comerciais D04–D06 (orçamento/proposta) não serão implementadas neste portfólio sem mudança explícita do objetivo. Se o método V7 exigir tais gates para homologação de demo comercial, registrar NOT_APPLICABLE_BY_EXPLICIT_USER_SCOPE / CONFLICT_REVIEW em vez de afirmar aprovação de V7.

## Integração FSC e QA
**13 áreas FSC:** Produto, Experiência, Engenharia, Dados, Integrações, Segurança, Qualidade, Entrega, Operações, Observabilidade, Sustentação, Comercial, Evolução; inventariar conforme catalog.json por ID e justificar áreas fora do escopo. **15 níveis:** registrar em `rfb/STATE.json` sem promover maturidade por uma demo visual. **Triple Verification:** funções reais, casos adversariais e regressão independente por jornada. **VSC:** imagem capturada e INSPECIONADA antes e depois, não apenas produzida. Todas as etapas devem guardar SHA, browser, viewport, evidência e pendência.

## Próxima execução recomendada
**EVOLVE 01 — Baseline, confiabilidade e QA inicial**. Não alterar V13, não mergear PR #37, não editar Worker público. Investigar o que usuários clicam e falha, antes de melhorar aparência.
