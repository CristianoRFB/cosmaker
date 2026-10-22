# Cosmaker Master Finalization — Progress

## F1.6 aceita e início F1.7 — 2026-10-22

- F1.6 **PASS** no escopo local aprovado. CI [`39706976082`](https://github.com/CristianoRFB/cosmaker/actions/runs/39706976082) do HEAD [`5231eda`](https://github.com/CristianoRFB/cosmaker/commit/5231edac52ad464859aed4b1857bb61bcf030419) e CI [`39706312371`](https://github.com/CristianoRFB/cosmaker/actions/runs/39706312371) ficaram verdes, além dos gates locais documentados abaixo. Sem aceite de produção/staging/global de segurança.
- F1.7 **WIP**: CRUD versionado de serviços/projetos, publicação explícita, projeções, branding, upload/preview autenticados de imagens e leitura pública por slug com revalidação da publicação. Raw Firestore de serviços/portfólio/cópias públicas/ops e novos bytes Storage negados nas Rules. Imagens legadas perderam leitura anônima via Rules; revogação global de tokens legados continua F2/F6, sem tocar dados reais.
- Gates F1.7 já observados: integração Functions **4/4 PASS**, exit 0, 24,10s; Rules completas **23/23 PASS**, exit 0, 48,50s; unitários da projeção/versões **2/2 PASS**. Functions compilou no lançador da integração. Logs `/tmp/cosmaker-f17-{integration,rules}.log`.
- Painel administrativo e previews em implementação; página pública, vínculo de solicitação de orçamento, build e E2E desktop/mobile ainda pendentes. **Não há aceite F1.7** neste checkpoint. F1.8–F1.9 e F2–F8 continuam TODO.


## Fechamento local F1.6 — 2026-10-22

- Financeiro implementado de ponta a ponta: lançamentos internos em centavos, categorias, planejado/realizado, receita por acordo, recebimentos manuais, margens, histórico paginado, compensações, auditoria, retry/fingerprint/referência duplicada, conciliação explícita de recebimentos anteriores e isolamento por perfil/tenant. Detalhes e limites em [FINANCE_OPERATIONS.md](FINANCE_OPERATIONS.md).
- Backend final: integração **7/7 PASS**; Rules **22/22 PASS** mais **1/1 direcionado PASS** após o último reforço de perfil; unitários financeiros **6/6 PASS**, transporte **1/1 PASS**. Não houve mudança posterior nas políticas backend cobertas por esses gates.
- E2E desktop **2/2 PASS**, exit 0, 1,7 min, `/tmp/cosmaker-f16-e2e-desktop-final.log`: financeiro (16,4s) e regressão orçamento→pedido→entrada→foto autenticada→aprovação→CRM (1,4 min). E2E mobile **1/1 PASS**, exit 0, 24,2s, `/tmp/cosmaker-f16-e2e-mobile-final.log`, viewport 390×844/toque. Inclui conciliação e compensação de recebimento anterior sem alterar produção. Capturas desktop/mobile inspecionadas visualmente e sem overflow horizontal, mantidas em `/tmp/cosmaker-finance-{desktop,mobile}.png`.
- O primeiro smoke falhou no rótulo acessível dos selects e a regressão antiga parou sem variáveis das contas sintéticas. Corrigidos rótulos com htmlFor/id, bloqueio do formulário até carregar dados e comando com fixture já documentada; somente as execuções finais acima são PASS. Build posterior à correção **PASS**, exit 0, 81 páginas, `/tmp/cosmaker-f16-build-accessibility.log`.
- Seed reforçado: recusa endpoints fora do loopback (prova negativa PASS); após a jornada real local, reseed removeu exatamente o ledger/índice do pedido sintético e preservou sentinela não relacionada (PASS). Nenhuma limpeza financeira global foi aplicada.
- Runtime completo Auth/Firestore/Storage/Functions/**PubSub** iniciado localmente, downloads permitidos por storage.googleapis.com. Inicialização de Pub/Sub não comprova o scheduler de expiração, que continua gate F6.
- Checkpoint anterior enviado: [`5e7a02e`](https://github.com/CristianoRFB/cosmaker/commit/5e7a02ead93c7f041804ab2c6a73daf0e232ddec). CI [39706312371](https://github.com/CristianoRFB/cosmaker/actions/runs/39706312371) ainda em andamento na última consulta (build; dependências e Functions já verdes). F1.6 **VALIDADO LOCALMENTE / CI PENDENTE**, sem promover CI a PASS.
- Próximo módulo executável: **F1.7 serviços e portfólio**, com projeção pública explícita, imagens sem tokens permanentes, manutenção administrativa, publicação e resolver central. F1.8–F1.9 e F2–F8 permanecem TODO.


## Gate intermediário F1.6 — 2026-10-22

- Checkpoint WIP enviado pelo conector GitHub CristianoRFB: [`e1b585e`](https://github.com/CristianoRFB/cosmaker/commit/e1b585e16c3414622260e7ea4588fb49e364d1d4). Árvore remota idêntica à local (`69eea93`); branch realinhada, original local `6ee6cf2` preservado em branch local de backup. CI desse checkpoint **PASS**, [39705402183](https://github.com/CristianoRFB/cosmaker/actions/runs/39705402183).
- Corrigido transporte local: Firebase CLI 15.32 ignorava NO_PROXY e enviava registro de trigger de `127.0.0.1` ao proxy externo. Preload limita bypass a loopback literal; proxy/CA externos preservados. Teste de transporte **1/1 PASS**. Downloads Firestore/Storage permitidos e concluídos.
- Integração final financeira **7/7 PASS**, exit 0, 31,88s de cenários (log `/tmp/cosmaker-f16-integration-final.log`): centavos, custos/categorias, auditoria, retry/fingerprint, referência duplicada, concorrência/excesso/compensação, A/B, papéis, perfil/tenant/demo, entrada existente, conciliação legada e paginação/período.
- Rules **22/22 PASS**, exit 0, 42,22s (log `/tmp/cosmaker-f16-rules.log`). Após o último reforço de perfil financeiro, gate direcionado **1/1 PASS**, 21 casos não selecionados, exit 0, 7,28s (log `/tmp/cosmaker-f16-rules-final-targeted2.log`); confirma negação de owner não verificado e perfil inativo além das escritas/read brutos. A tentativa direcionada anterior saiu 127 porque `vitest` estava fora do PATH do shell; corrigida com caminho explícito, sem promover aquela tentativa a PASS.
- Build local final **PASS**, exit 0, 81 páginas (log `/tmp/cosmaker-f16-build-final.log`); lint direcionado e `docs:check` **PASS**. TypeScript foi validado pelo build. Runtime `start:local` responde com meta `emulator`. E2Es desktop/mobile ainda **PENDING**; F1.6 permanece WIP até esses gates.

## Retomada Cloud — 2026-10-22 (F1.6 WIP)

- Remoto conferido antes de editar: `4d1da1d265b2d0f84fba4ae3b59a0035e1510d44`, branch `codex/cosmaker-master-finalizacao`, árvore inicial limpa. CI do HEAD inicial PASS: [39306454878](https://github.com/CristianoRFB/cosmaker/actions/runs/39306454878). Consulta via conector GitHub; `gh` recebe Forbidden na rede deste Cloud.
- Node 22.23.4 instalado em `/tmp/node-v22.23.4-linux-x64`; usar `export PATH=/tmp/node-v22.23.4-linux-x64/bin:$PATH` nesta sessão. Java 21.0.12.1 disponível. Dependências raiz e Functions instaladas com `npm ci` sob Node 22 e cache isolado `/tmp/cosmaker-npm-cache22`, após falha do cache padrão.
- Implementação F1.6 em andamento: ledger de custos/receitas/recebimentos, compensações imutáveis, idempotência e referência duplicada, auditoria transacional, integração da entrada existente, saldos reais/centavos consistentes, margens e UI financeira. Contrato: [FINANCE_OPERATIONS.md](FINANCE_OPERATIONS.md).
- Gates observados neste WIP: unitários financeiros **6/6 PASS**; Functions build **PASS**; TypeScript **PASS**; lint direcionado **PASS** após corrigir o componente Button e o narrowing do formulário.
- Integração inicial **NOT_RUN**: Emulator baixou Firestore e iniciou em Standard, mas o registro do trigger em Eventarc local falhou antes do Vitest. Investigar esse erro, sem repetir tentativas cegas. Rules e E2E **PENDING**.
- Download de navegador Playwright: HTTP 403 `Domain forbidden` para `cdn.playwright.dev`. Chromium 154 já está instalado em `/usr/bin/chromium`; configuração E2E agora aceita `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para reutilizá-lo.
- F1.6 segue **WIP**, F1.7–F1.9 e F2–F8 **TODO**. Nenhum novo aceite de fase. F1.1–F1.5 mantêm evidências anteriores, sujeito à regressão proporcional da entrada financeira alterada.
- Nenhum deploy, migração real, alteração remota administrativa ou cobrança executados.


## Retomada autônoma — 2026-10-19

Checkpoint pendente salvo e confirmado no remoto: [`fed3faff2d61bda1c0a62dc98feb6a2e0e389c6b`](https://github.com/CristianoRFB/cosmaker/commit/fed3faff2d61bda1c0a62dc98feb6a2e0e389c6b), WIP com os 19 arquivos preservados. Correção de dependências do CI: [`6204172`](https://github.com/CristianoRFB/cosmaker/commit/6204172).

| Gate da retomada | Resultado |
| --- | --- |
| CI do checkpoint WIP | FAILED: o workflow instalava somente dependências da raiz, e a checagem de tipos não encontrava `firebase-admin/firestore` importado pelos testes/política. Nenhum deploy foi executado. |
| CI após correção `6204172` | PASS, [run 39303473178](https://github.com/CristianoRFB/cosmaker/actions/runs/39303473178): instalação de dependências da raiz e Functions, compilação Functions, build Next e 109/109 unitários em Node 22. |
| `npm run test:orders` — rodada nova | PASS, 31/31 em 4 arquivos, exit 0, 189,08s: produção/fotos 10, agenda 3, revisões 7 e anexos 11. Log local `.local-orders-20261019.log`; dados exclusivamente sintéticos no Emulator. Este resultado é da retomada, sem promover a rodada interrompida anterior a PASS. |
| TypeScript após perfil mobile | PASS, `npx tsc --noEmit`, exit 0. |
| Runtime para E2E | Bundle local compilado existente respondeu 200 com meta `emulator`; Auth/Firestore/Functions/Storage locais iniciados, seed exclusivamente `demo-cosmaker` com exit 0. Desktop e mobile em execução/pendentes. |
| E2E desktop antes do reforço de ownership | PASS, 3/3, exit 0, 2,5 min: produção/revisões, anexos/ACL e orçamento→pedido→entrada→foto Blob decodificada→aprovação→CRM. |
| Prova adversarial de e-mail reutilizado (RED) | FAILED como esperado: novo teste recebeu acesso ao pedido vinculado a outro UID. 19/20 demais resultados: 19 passaram, 1 reproduziu a falha (`Expected request to fail, but it succeeded`). Correção necessária antes do aceite F1.5. |
| Reforço de ownership do pedido | Implementada listagem server-side com projeção explícita, prioridade de UID e verificação de vínculo de cliente, tenant/perfil ativos; consulta bruta collection-group de pedidos negada. Rules das leituras do pedido e seus metadados usam perfil ativo e staff verificado, impedindo e-mail antigo de contornar vínculo forte. Legado sem UID continua elegível por e-mail verificado somente sem outro vínculo forte. Índice por `clientUserId` preparado, sem deploy. |
| Rules após reforço (GREEN) | PASS, 21/21, exit 0, 17,24s. Cobre e-mail reutilizado, conflito de UIDs, perfil inativo, staff não verificado e tenant suspenso, além dos 19 casos anteriores. Uma execução intermediária teve 20/21 porque uma fixture de staff não declarava `email_verified`; fixture corrigida para a identidade verificada exigida. |
| Lint/TypeScript no reforço | Primeira checagem detectou um `let` desnecessário e dois símbolos não usados; corrigidos. Repetição passou sem erros, com TypeScript exit 0. |
| Gate ampliado de pedidos após ownership | PASS, `npm run test:orders`, 32/32, exit 0, 160,35s: produção/ownership/fotos 11, anexos 11, agenda 3 e revisões 7. Novo build local PASS, exit 0, 81 páginas. Correção enviada no commit [`fba83bc`](https://github.com/CristianoRFB/cosmaker/commit/fba83bc). E2E final desktop/mobile segue pendente antes do aceite F1.5. |
| E2E final desktop após ownership | PASS, 3/3, exit 0, 2,3 min. Arquivo `.local-f15-desktop-final-20261019.log`; inclui revisão/configuração, anexos/bytes/ACL e regressão completa com foto Blob decodificada e snapshot preservado. |
| E2E final mobile após ownership | PASS, 2/2, exit 0, 27,8s. `COSMAKER_E2E_MOBILE=true`, 390×844 e toque verificados nas sessões de equipe, cliente e tenant B. Percorre configuração/revisão/aplicação e upload/compartilhamento/download/revogação/arquivo/restauração. Log `.local-f15-mobile-final-20261019.log`. |
| Aceite F1.5 | PASS no escopo do módulo. CI [`39305775761`](https://github.com/CristianoRFB/cosmaker/actions/runs/39305775761) verde em Node 22 com build Functions/Next e 109 unitários; Rules 21/21; integração 32/32; desktop 3/3; mobile 2/2; docs:check e diff:check verdes. Referências pré-pedido, revogação global de links legados e scheduler continuam em F2/F6/F7, sem afirmar aceite global de segurança nem readiness de produção. |

- Checkout preservado na branch `codex/cosmaker-master-finalizacao`, HEAD `364f5ccabe7e5dc74a7061bc5e17d497551bfb6c`. `git fetch origin` confirmou 0 commits à frente/atrás; os 19 arquivos locais pendentes foram mantidos integralmente.
- Checkpoint WIP de preservação autorizado pelo proprietário. Varredura dos 19 arquivos não encontrou padrões de chaves privadas, tokens GitHub, credenciais AWS, Stripe live ou chaves Google reais. Os testes usam identidades sintéticas e emuladores; logs locais, `.env`, artefatos e credenciais não entram no commit.
- Publicação: único workflow local/remoto ativo é `.github/workflows/ci.yml`, somente instalação, build e unitários. A API GitHub retornou zero webhooks e nenhum deployment nos resultados consultados. Não há comando de deploy neste checkpoint; push somente à branch de desenvolvimento, sem merge/force-push.
- Evidências históricas preservadas separadamente: 109/109 unitários, 19/19 Rules e 10/10 integração isolada de produção/fotos. A primeira rodada combinada falhou por indisponibilidade do Emulator; não é PASS. Um log posterior local contém 31/31 e encerramento com código 0, mas o resultado não foi consolidado antes da interrupção: o novo gate repetirá a suíte inteira antes do aceite atual de F1.5.
- E2E anteriores: duas jornadas de pedidos/arquivos e uma regressão original passaram antes da última mudança de fotos. O bundle com fotos autenticadas compilou e teve smoke HTTP; sua aprovação E2E continua pendente e será executada em desktop/mobile.
- Conhecidos: referências legadas e revogação/migração global ainda exigem revisão; scheduler/PubSub não foi validado; F1.6–F8 permanecem pendentes. Nenhum desses itens é promovido a concluído por este WIP.
- A frase da retomada sobre deploy/migração/cobrança/merge é ambígua. Mantidos os bloqueios explícitos anteriores para operações reais e `main`; desenvolvimento local, testes, documentação, commits e pushes da branch estão autorizados continuamente.

`PRODUCTION_MIGRATION=NOT_RUN` · `PRODUCTION_DEPLOY=NOT_RUN` · `LIVE_BILLING=NOT_ENABLED` · `STAGING_EXECUTION=NOT_AUTHORIZED`

Última atualização: 2026-10-19 — checkpoint pendente preservado no GitHub; F1.1 a F1.4 validados e F1.5 fechando ownership, fotos autenticadas e gates desktop/mobile.

## Checkpoint imediato solicitado pelo proprietário — 2026-10-15

O proprietário autorizou explicitamente commit e push da branch de trabalho. Este snapshot salva o trabalho parcial de F1.5 e não representa release nem aceite: a transferência autenticada de bytes dos anexos está em adaptação após duas falhas de revogação de tokens; produção/agenda receberam correções adicionais ainda sem regressão final. A última evidência verde de unitários foi 107/107, mas houve alterações posteriores. Functions build, TypeScript e lint passaram antes desses últimos ajustes e precisam ser repetidos. Integrações, Rules, E2E e build final de F1.5 seguem pendentes. O goal permanece ativo e o trabalho prossegue após o push.

## Identidade e baseline

- Repositório: `CristianoRFB/cosmaker` — checkout local confirmado.
- Branch de referência: `main`.
- Commit-base aprovado e HEAD inicial: `dca70565f378298443ff7f7ca0b6e17e735d7908`.
- Branch de trabalho: `codex/cosmaker-master-finalizacao`.
- Versão canônica inicial: `docs/versions/v0.2.0/`.
- Working tree estava limpo antes da criação deste arquivo; nenhum arquivo existente foi descartado. Branch de trabalho criada a partir do mesmo SHA-base, sem reset.
- Objetivo: concluir os módulos operacionais internos aprovados, integrar e proteger as jornadas, fechar UX, integrações internas, estabilidade, staging/preparação, documentação e evidências, sem executar operações reais não autorizadas.

## Decisões preservadas e limites

- Preços locais permanecem Essencial R$ 59,90/R$ 599, Pro R$ 119,90/R$ 1.199 e Premium R$ 199,90/R$ 1.999; Pro recomendado; implantação R$ 299; trial manual de 14 dias Premium Demo.
- Não há matriz aprovada de quotas ou de diferenciação por plano. Produção permanece com `features: []` e `limits: {}`; nenhuma segurança, privacidade ou backup básico é benefício Premium.
- Billing, checkout, gateway, renovação automática, mensagens externas, reembolsos financeiros reais, alteração de DNS, serviços pagos, deploy/migração de produção e mutação de dados reais permanecem proibidos neste goal.
- Staging real não foi solicitado nem autorizado até este checkpoint; nenhuma execução de staging será simulada no Emulator.

## Checkpoints e estado por fase

| Fase / módulo | Estado | Evidência/pendência atual |
| --- | --- | --- |
| Baseline e instruções do repositório | PASS (baseline; falhas E2E registradas) | Checkout correto; `main`/`origin/main` no SHA-base aprovado e branch de trabalho criada. Working tree inicial limpo, `AGENTS.md` ausente; README/CURRENT/STATUS/v0.2 lidos. Padrões genéricos localizados em `Manicures/docs/ecosystem/`; documentos de aprovação encontrados são de outras verticais e não decidem o Cosmaker. README/`docs/STATUS.md` ainda contradizem v0.2 e serão corrigidos na fase documental. Commit de checkpoint inicial `b08f6cc`. Ambiente Emulator isolado iniciado em portas 19099/18080/15001/19199; fixture `demo-cosmaker` semeada e `dev:local` confirmado em `127.0.0.1:3000` com resposta HTTP 200. |
| F1.1 CRM e clientes | PASS | Listagem por prefixo/paginação, cadastro/edição transacional com unicidade por tenant, vínculo por e-mail verificado, histórico de solicitações/propostas/pedidos/pagamentos internos/medidas/interações com mascaramento por permissão e anotações idempotentes via Functions. Regras bloqueiam leitura/listagem/escrita bruta por equipe; cliente autenticado lê somente o próprio perfil. Integração Functions 11/11, Rules 14/14, jornada Playwright CRM 1/1 e jornada integrada de orçamento/pedido/depósito/foto/aprovação/CRM 1/1 verdes. Backfill Emulator-only exercitado com legado sintético, dry-run/apply e repetição sem novas alterações. Uma falha inicial de upload de foto e uma asserção ambígua não se reproduziram após reseed/correção; a última jornada completa passou. |
| F1.2 Equipe, onboarding e permissões | PASS | Rotas de equipe, convites, aceite e permissões implementadas com callables transacionais. Token aleatório de uso único fica armazenado somente como hash; expiração/revogação, verificação de e-mail e bloqueio de reuso, perfil de cliente existente, isolamento A×B, escalada, desativação e transferência para exatamente um titular foram comprovados no Emulator. Regras bloqueiam escrita direta em `members`, convites, índice de e-mail, `ownerId` e `active` do ateliê. Link mantém o token no fragmento e, durante login/verificação, somente em `sessionStorage`; nenhum e-mail é enviado. Unit 84/84, Rules 15/15, integração Team 4/4, E2E Team 1/1, lint, TypeScript, Functions build e Next build passaram. |
| F1.3 Agenda, capacidade, eventos e risco | PASS | Rotas de agenda/capacidade/bloqueios/eventos/cronograma conectadas a Functions; capacidade, slots e bloqueios persistidos com validação de fuso e transações/travas por dia; CRUD autenticado de eventos; risco categórico com dados persistidos de slots, capacidade, pausas, prazos e eventos. Rules negam mutação direta. Unit 91/91, Rules 16/16, Scheduling Functions 2/2, CRM regression 11/11, Team regression 4/4 e Playwright 1/1 passaram. Lint, TypeScript, Functions build e Next build passaram. |
| F1.4 Estoque, materiais e fornecedores | PASS | Cadastro/edição/arquivo de materiais e fornecedores; SKU único transacional; entrada, saída, reserva e liberação com ledger imutável, saldo inteiro em milésimos, trava contra negativo, idempotência e auditoria; BOM/reserva/consumo associados ao pedido; alertas de baixo estoque e UI responsiva. Rules negam mutação direta. Unit 95/95, Rules 17/17, Inventory Functions 3/3, Playwright 1/1, lint, TypeScript, Functions build, Next build e docs:check passaram. A paginação ampla das listas é parte do refinamento transversal F3; esta versão protege a listagem com teto operacional explícito de 500 itens por coleção. |
| F1.5 Pedidos, produção e change requests | PASS | Anexos/fotos por bytes autenticados, revogação, histórico paginado, configuração/etapas próprias, snapshots de evidências, revisões aprovadas com acordo versionado em centavos e integridade de agenda. Ownership por UID prevalece sobre e-mail antigo, perfis/tenant ativos e projeção segura no portal. Retomada 2026-10-19: integração 32/32, Rules 21/21, desktop 3/3, mobile 2/2; CI Node 22 com 109 unitários, Functions/Next build verdes. Segurança transversal e migração/revogação global permanecem gates F2/F6/F7. |
| F1.6 Financeiro operacional, custos e margens | PASS | Ledger, compensações, conciliação legada, pagamentos manuais e margens; integração 7/7, Rules 22/22 + 1 direcionado, desktop 2/2 e mobile 1/1; build local e CI 39706976082 verdes. |
| F1.7 Serviços e portfólio | WIP | Backend/catálogo/branding/imagens com integração 4/4, Rules 23/23 e unitários 2/2; painel em andamento, página pública/vínculo ao orçamento/build/E2E pendentes. |
| F1.8 Mensagens e notificações internas | TODO | Conversas, leitura, anexos protegidos e deduplicação de eventos. |
| F1.9 Relatórios e configurações | TODO | Métricas reproduzíveis, filtros/timezone, preferências e escopo de Platform Owner. |
| Checkpoint F1 — completude funcional | TODO | Cada módulo operacional precisa criar→ler→alterar/ação→persistir e provar denial em outra fronteira. |
| F2 — jornada integrada A×B | TODO | E2E ponta a ponta com persistência no Emulator, falhas, concorrência, retry e ACL. |
| F3 — UX/UI e white-label | TODO | Rotas/estados reais em três papéis, desktop/mobile, acessibilidade e sem stubs ativos. |
| F4 — coerência comercial | TODO | Preservar Global Standard v01; criar proposta separada de matriz não aprovada. |
| F5 — integrações internas/externas | TODO | Operações internas persistidas; adaptadores externos disabled/mock e respostas honestas. |
| F6 — segurança, CI, backup/restore | TODO | Testes adversariais, dependências/config/privacidade, pipeline e restauração apenas em ambiente permitido. |
| F7 — staging e preparação de produção | TODO | Preflight, backup/dry-run/rollback/runbooks; staging real só com acesso e autorização explícitos. |
| F8 — documentação e evidências v0.3.0 | TODO | Preservar v0.1/v0.2; atualizar CURRENT só após documentação, capturas, diagramas e docs:check verdes. |

## Comandos e evidências

| Comando/evidência | Resultado | Ambiente |
| --- | --- | --- |
| Inspeção do checkout/branch/HEAD/status | PASS; `main`, SHA `dca70565f378298443ff7f7ca0b6e17e735d7908`, árvore inicial limpa | Local |
| `npm ci` | PASS após corrigir o lockfile: 1.017 pacotes instalados; exit 0. npm audit reportou 24 vulnerabilidades (6 moderate, 16 high, 2 critical), pendentes de triagem F6. | Local, Node 24.11.1/npm 11.6.4 |
| `npm test` | PASS, 79/79 em 12 arquivos; exit 0 | Local, antes de alterações funcionais |
| `npm run test:rules` | PASS, 13/13; exit 0 | Firebase Emulator isolado |
| `npm run test:commercial` | PASS, 10/10; exit 0 (inclui build Functions) | Firebase Emulator isolado |
| `npm run test:commercial` — repetição com cobertura CRM e minimização de IDs | PASS, 11/11; exit 0. Cobre A×B, papéis, e-mail duplicado sob concorrência, conta vinculada, histórico financeiro/medidas por permissão, interação idempotente e ausência de UIDs na resposta. | Firebase Emulator isolado, `demo-cosmaker` |
| `npm test` — após helpers de busca do CRM | PASS, 82/82 em 13 arquivos; exit 0 | Local, Node 24.11.1/npm 11.6.4 |
| `npm run test:rules` — após fechamento de acesso bruto aos clientes | PASS, 14/14; exit 0. Inclui negação de leitura/listagem/escrita direta por equipe e leitura restrita ao cliente dono. | Firebase Emulator isolado |
| `npm run test:team` | PASS, 4/4. Cobre hash e normalização de convite, duplicidade concorrente, isolamento A×B, aceite/reuso, cliente existente, revogação/expiração, perfil em outro tenant, Platform Admin, limites de concessão, desativação, titular protegido e transferência/auditoria. | Firebase Emulator isolado, `demo-cosmaker` |
| `npm run test:commercial` — regressão após F1.2 | PASS, 11/11; exit 0, incluindo build Functions. | Firebase Emulator isolado, `demo-cosmaker` |
| `npm run test:rules` — após F1.2 | PASS, 15/15. Inclui negação de gravação direta em membros, convites, índice, `ownerId` e estado do ateliê. | Firebase Emulator isolado |
| `npx playwright test tests/e2e/team-invitation.spec.ts` | PASS, 1/1. Titular cria convite na UI; conta verificada autentica, aceita e abre o ateliê. O token fica fora do parâmetro `next` e não aparece na URL de login. | `dev:local` e Firebase Emulator, dados sintéticos |
| `npm test` — após F1.2 | PASS, 84/84 em 14 arquivos. | Local, Node 24.11.1/npm 11.6.4 |
| `npm run lint`, `npx tsc --noEmit`, `npm run functions:build` — após F1.2 | PASS; exit 0. Uma execução concorrente de `tsc` com `next build` perdeu arquivos temporários `.next/types`; a repetição após a build terminou com exit 0. | Local, Node 24.11.1/npm 11.6.4 |
| `npm run build` — após F1.2 | PASS; Next 15.5.27 compilou, validou tipos e gerou 81 páginas estáticas. | Local, sem dev server concorrente |
| `npm run docs:check` — checkpoint F1.2 | PASS; documentação canônica vigente v0.2.0 e links/manifests verificados. | Local |
| `npm test -- --reporter=dot` — após F1.3 | PASS, 91/91 testes em 15 arquivos. | Local, Node 24.11.1 |
| `npm run test:rules` — após F1.3 | PASS, 16/16; inclui bloqueio de escrita direta às coleções de agenda. | Firebase Emulator |
| `npm run test:scheduling` | PASS, 2/2 suítes de integração; valida capacidade, concorrência, idempotência, bloqueios, eventos, riscos, permissões, auditoria e isolamento de tenant. | Firebase Emulator, `demo-cosmaker` |
| `npm run test:commercial` — regressão CRM após F1.3 | PASS, 11/11. | Firebase Emulator, `demo-cosmaker` |
| `npm run test:team` — regressão após F1.3 | PASS, 4/4. | Firebase Emulator, `demo-cosmaker` |
| `npx playwright test tests/e2e/scheduling-workflow.spec.ts` | PASS, 1/1; percorre configuração de capacidade, alocação/cancelamento, bloqueio e criação de evento, confirmando persistência no Firestore Emulator. | `dev:local` e Firebase Emulator, dados sintéticos |
| `npm run lint`, `npx tsc --noEmit`, `npm run functions:build` — após F1.3 | PASS; exit 0. | Local, Node 24.11.1 |
| `npm run build` — após UI F1.3 | PASS; Next 15.5.27 compilou, validou tipos e gerou 81 páginas estáticas. Execução anterior aos últimos ajustes backend-only de cálculo de risco e rejeição de horário passado; Functions build e integração foram repetidos depois desses ajustes. | Local, sem dev server concorrente |
| `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8'))"` | PASS após remover fechamento duplicado no final do manifesto de índices. | Local, Node 24.11.1 |
| `npm run docs:check` — checkpoint F1.3 | PASS; documentação vigente v0.2.0, links/manifests e estrutura Firebase verificados. | Local |
| `components/agenda/README.md` | PASS; descreve jornadas, Functions, coleções, autorização, risco e validação do módulo F1.3. | Documentação do repositório |
| `npm test -- --reporter=dot` — após F1.4 | PASS, 95/95 em 16 arquivos. | Local, Node 24.11.1 |
| `npm run test:rules` — após F1.4 | PASS, 17/17; gravação direta em materiais, fornecedores, ledger, reservas, índice e BOM negada. | Firebase Emulator isolado |
| `npm run test:inventory` | PASS, 3/3 na repetição final; cobre CRUD/arquivo, SKU, A×B/papel, saldo, reserva/BOM, auditoria, idempotência e concorrência. A primeira repetição após ampliar o teste falhou só na expectativa de caixa do SKU; asserção corrigida para a normalização em maiúsculas e 3/3 passaram. | Firebase Emulator isolado, `demo-cosmaker` |
| `npx playwright test tests/e2e/inventory-workflow.spec.ts` | PASS, 1/1; criação de fornecedor e material, entrada, reserva e consumo pela UI com verificação de documentos persistidos. | `dev:local` e Firebase Emulator, dados sintéticos |
| `npm run lint`, `npx tsc --noEmit`, `npm run functions:build`, `npm run build` — após F1.4 | PASS; Next 15.5.27 compilou 81 rotas e Functions compilaram. | Local, Node 24.11.1 |
| `npm run docs:check`, `git diff --check`, JSON dos índices — após F1.4 | PASS; manifesto de índices válido e sem erro de whitespace no diff. | Local |
| `npm test -- --reporter=dot` — F1.5 em desenvolvimento | PASS, 107/107 em 18 arquivos, incluindo 7 unitários de produção e 5 de política de mudanças. | Local, Node 24.11.1 |
| Functions build, TypeScript e lint — F1.5 em validação | PASS após corrigir inferência de snapshots do servidor e warnings de refs/destructuring. A primeira Functions build falhou em tipos das etapas; a repetição final terminou com exit 0. | Local |
| Harness de integração de anexos — primeira tentativa F1.5 | FAILED antes dos testes: invocação direta do script não tinha Vitest no PATH. Lançador corrigido para usar Node/Vitest locais com paths explícitos; repetição em andamento. | Emulator isolado, nenhuma suíte executada na tentativa inicial |
| Integração de anexos — segunda tentativa F1.5 | FAILED, 7/9 passaram; 2 casos provaram que limpar metadados não revogava tokens permanentes no Emulator. O servidor de bytes e o browser estão sendo ajustados para upload/download autenticados, com Storage direto negado e revogação de tokens residuais. Nenhum PASS amplo foi inferido desta execução. | Emulator isolado com Auth/Firestore/Functions/Storage |
| Checkpoint imediato no GitHub | PASS; commit WIP `ecc701b` enviado à branch `codex/cosmaker-master-finalizacao` em 2026-10-15, por solicitação explícita do proprietário. `main` não foi alterada. | `origin` / CristianoRFB/cosmaker |
| `npm test -- --reporter=dot` — após snapshot de evidências de produção | PASS, 109/109 em 19 arquivos. | Local, 2026-10-15 |
| `npm run functions:build`, `npx tsc --noEmit` — endpoints autenticados de anexos | PASS, exit 0; upload valida hash/tipo/bytes e download confere ACL sem fornecer URL permanente. | Local, 2026-10-15 |
| `npm run test:rules` — ACL de acordos e anexos autenticados | PASS, 19/19; inclui negação direta aos objetos de anexos para todos os papéis e aos ledgers privados. | Firebase Emulator isolado, 2026-10-15 |
| Integração de anexos — tentativa após endpoints HTTP | Interrompida antes dos testes por encerramento do Pub/Sub Emulator (exit 1); nenhum teste foi classificado como PASS nesta tentativa. Suíte de dez casos preparada, com perfil inativo, vínculo conflitante e hash incorreto; repetição em andamento após confirmar término do processo anterior. | Firebase Emulator isolado |
| Integração de anexos HTTP — execução isolada | 9/10 passaram; a prova inicial que usa vários handlers atingiu 60s sem falha de asserção. Limite das duas jornadas iniciais ajustado para 120s; prova adicional de concorrência inserida. O resultado final da execução combinada abaixo supersede esta tentativa. | Emulator isolado, 2026-10-15 |
| `npm run test:orders` | PASS, 30/30 em quatro arquivos: anexos HTTP/ACL/hash/concorrência/revogação 11/11; change requests/financeiro/versões 7/7; configuração/aprovação/evidências de produção 9/9; regressão de capacidade/agenda 3/3. Inclui build Functions. | Auth, Firestore, Functions e Storage Emulator; dados fictícios, 2026-10-15 |
| TypeScript e lint — após trava de envio e integração das jornadas | PASS, exit 0 em ambos. | Local, 2026-10-15 |
| `npm run build` — checkpoint F1.5 | PASS, exit 0; Next 15.5.27 compilou e gerou 81 páginas estáticas, incluindo arquivos, histórico, financeiro do pedido e produção. | Local, 2026-10-15 |
| Checkpoint de integridade F1.5 no GitHub | PASS; commit `8073a7b` enviado à branch de trabalho, após 30/30 testes integrados de pedidos. | `origin` / CristianoRFB/cosmaker |
| Playwright pedidos — tentativas de diagnóstico | FAILED nas primeiras tentativas: seletores exatos de labels que incluíam o texto de opções/textarea; corrigidos para roles acessíveis. Em outra tentativa a compilação fria da rota levou 34–44s e excedeu a expectativa de 30s. Harness agora usa expectativas de 60s, ações de 30s, captura de falha e trace. A execução inicial combinada foi interrompida após os diagnósticos, sem inferir PASS para cenários não terminados. | Chromium / `dev:local`, dados sintéticos |
| `npx playwright test tests/e2e/order-change-production.spec.ts tests/e2e/order-files-workflow.spec.ts --output=test-results/orders-final --reporter=line` | PASS, 2/2, exit 0, 4,6 min. Configuração de etapa própria com responsável/datas/peso/aprovação; revisão de escopo/prazo/valor com confirmação explícita, aplicação e snapshots; financeiro e histórico; bytes de upload/download idênticos, compartilhamento, revogação, arquivo/restauração, mobile e isolamento A×B com persistência/auditoria conferidas. | Auth/Firestore/Functions/Storage Emulator `demo-cosmaker`, 2026-10-15 |
| Regressão Playwright orçamento — diagnóstico após F1.5 | FAILED em duas tentativas: espera legada de 10s para a confirmação, apesar de o servidor concluir a aprovação; depois seletor genérico de valor na ficha de medidas. Removidos os limites curtos em favor dos 60s do harness e escolhido o campo de tórax por role, com prova adicional da medida original atualizada no Firestore. Repetição em andamento; estas tentativas não validam o fluxo completo. | Somente Emulator, dados sintéticos |
| Regressão Playwright orçamento — execução com campo de tórax preciso | FAILED pelo limite total de 300s na última navegação para CRM. A execução passou pelas asserções de orçamento/pedido, medida 101 versus snapshot 88, entrada manual 600, foto, aprovação de produção, saldo/progresso e eventos persistidos. Não foi classificada como PASS geral. Orçamento total ajustado para 600s; limites individuais de ação e asserção permanecem 30s e 60s. | `dev:local`, várias rotas compiladas frias, 2026-10-15 |
| `npx playwright test tests/e2e/quote-approval.spec.ts --output=test-results/quote-complete --reporter=line` | PASS, 1/1, exit 0, 5,0 min. Jornada completa de aprovação do orçamento, snapshot comercial/medidas, alteração persistida da medida de tórax para 101 mantendo 88 no pedido, confirmação manual de entrada 600, produção/foto/aprovação do cliente e histórico CRM com pagamento. Supersede as tentativas de diagnóstico acima. | Chromium, `dev:local` + Emulator `demo-cosmaker`, 2026-10-15 |
| `npm run lint` — após ajustes do harness e jornadas de pedidos | PASS, exit 0. | Local, 2026-10-15 |
| Fotos de produção autenticadas — implementação adicional | IN_PROGRESS; removido `getDownloadURL` do carregamento do pedido, imagem recebe Blob autenticado e libera a URL local ao desmontar/trocar identidade. Novo endpoint verifica perfil/membership/cliente, visibilidade, caminho, geração e conteúdo; upload finalizado revoga tokens anteriores. Storage direto de fotos negado inclusive pela regra genérica. Referências públicas legadas ainda exigem revisão equivalente e migração/revogação real continua não autorizada. | Código local; integração e E2E pendentes |
| Unitários, Rules, Functions build, lint e TypeScript — fotos autenticadas | PASS: 109/109 unitários, 19/19 Rules, Functions build exit 0, lint sem erros e TypeScript exit 0. Rules agora provam negação direta das fotos inclusive para equipe. Leitura autorizada dos bytes é coberta pela nova integração ainda em execução. | Local/Emulator, 2026-10-15 |
| Primeira `build:local` | INTERROMPIDA intencionalmente antes da conclusão, após compilação e checagem de tipos; o código de fotos foi alterado durante a preparação. A repetição final usa o snapshot consistente da interface nova. Nenhum PASS foi inferido da tentativa interrompida. | Local, nenhum deploy |
| `npm run build:local` — fotos autenticadas | PASS, exit 0; Next 15.5.27 compilou, checou tipos e gerou 81 páginas com a configuração fixa de Emulator. Smoke e E2E deste bundle ainda pendentes. | Local, nenhum deploy |
| `npm run test:orders` — fotos autenticadas, primeira tentativa | FAILED por encerramento inesperado do Emulator durante o primeiro upload da nova prova de fotos (`ECONNRESET`, seguido de falhas de rede de Auth). Agenda 3/3 passou antes da falha; produção 10 casos afetados por indisponibilidade, anexos e revisões não concluídos nesta execução. Havia uma suíte Rules independente simultânea, que terminou 19/19; a causa do encerramento ainda não foi confirmada. Repetição isolada de produção com diagnóstico detalhado em andamento. | Somente Emulator; nenhum PASS amplo inferido |
| `COSMAKER_TEST_DEBUG=true npm run test:production-configuration` | PASS, 10/10, exit 0; duração Vitest 124,21s. Nova prova HTTP: bytes iguais para titular, leitor autorizado e cliente; negação sem sessão, outro tenant/cliente, perfil inativo, vínculo conflitante, visibilidade interna, path ou geração adulterados; token antigo revogado na conclusão do upload. A queda da tentativa combinada não se repetiu nesta execução isolada. | Auth/Firestore/Functions/Storage Emulator, 2026-10-15 |
| `npm run start:local` e smoke HTTP | PASS; servidor compilado iniciou em 3,9s, `/login` respondeu 200 com `<meta content="emulator" name="cosmaker-firebase-mode"/>`. O primeiro regex de smoke esperava atributos em outra ordem e retornou `false`; inspeção do elemento confirmou o modo correto, sem alterar a aplicação. E2E do bundle novo ainda pendente. | `127.0.0.1:3000`, configuração fixa `demo-cosmaker` |
| Pub/Sub no harness | O lançador do Pub/Sub local encerrou com exit 1 antes dos testes em duas tentativas. As suítes callable/HTTP não invocam handlers agendados e agora iniciam seus serviços necessários; `COSMAKER_TEST_PUBSUB=true` mantém opção de ligar Pub/Sub para o gate de scheduler, que permanece pendente de correção/execução em F2/F6. Nenhuma cobertura de expiração agendada é inferida dos 30 testes. | Limitação local registrada, não bloqueia fluxos independentes |
| `npm run lint` — após F1.1 inicial | PASS; exit 0 | Local, Node 24.11.1/npm 11.6.4 |
| `npx tsc --noEmit` — após F1.1 inicial | PASS; exit 0 | Local, Node 24.11.1/npm 11.6.4 |
| `npm run functions:build` — após F1.1 inicial | PASS; exit 0 | Local, Node 24.11.1/npm 11.6.4 |
| `npx playwright test tests/e2e/client-crm.spec.ts` | PASS, 1/1; abre ficha vinculada, confirma medidas, registra interação, cadastra e busca novo cliente. A primeira execução fria excedeu 90s durante inicialização; a escrita foi confirmada no Emulator e a execução estável passou após aumentar o limite de jornada. | `dev:local` e Firebase Emulator, dados fictícios |
| `npm run test:e2e -- tests/e2e/quote-approval.spec.ts` | PASS, 1/1 na execução final (1,7 min). Percorre aprovação do orçamento, criação do pedido com snapshot imutável, edição de medidas, depósito manual, foto de produção, aprovação do cliente e ficha CRM com solicitação, proposta, pedido, pagamento e medidas. Uma execução anterior falhou temporariamente no upload de Storage; após reseed, o fluxo passou. | `dev:local` e Firebase Emulator, `demo-cosmaker` |
| `npm test` — repetição antes do checkpoint F1.1 | PASS, 82/82 em 13 arquivos; exit 0. | Local, Node 24.11.1/npm 11.6.4 |
| `npm run lint` — repetição antes do checkpoint F1.1 | PASS; exit 0. | Local, Node 24.11.1/npm 11.6.4 |
| `npm run functions:build` — repetição antes do checkpoint F1.1 | PASS; exit 0. | Local, Node 24.11.1/npm 11.6.4 |
| `npm run test:rules` — repetição antes do checkpoint F1.1 | PASS, 14/14; exit 0. A primeira tentativa não iniciou por disputa do hub do Emulator local; a suíte foi repetida após encerrar somente a sessão local iniciada para E2E. | Firebase Emulator isolado, `demo-cosmaker` |
| `npm run test:commercial` — repetição antes do checkpoint F1.1 | PASS, 11/11; exit 0. | Firebase Emulator isolado, projeto demo e portas dinâmicas |
| `npm run build` — repetição antes do checkpoint F1.1 | PASS; Next 15.5.27 compilou e gerou 81 páginas estáticas; exit 0. As rotas ainda estruturais permanecem registradas para F1/F3. | Local, sem dev server concorrente |
| `npx tsc --noEmit` — após build F1.1 | PASS; exit 0. | Local, Node 24.11.1/npm 11.6.4 |
| `npm run build` — após F1.1 | PASS; Next 15.5.27 compilou e gerou 81 páginas estáticas. A tabela de rotas ainda exibe outras áreas estruturais, registradas como trabalho F1/F3. | Local, Node 24.11.1/npm 11.6.4 |
| `npm run docs:check` | PASS; exit 0 para o pacote v0.2.0 vigente. | Local |
| Backfill de busca de clientes | PASS somente no Emulator: dry-run identificou 1 legado e 1 atual; apply local migrou os candidatos; repetição dry-run/apply terminou com 2 atuais, 0 novas migrações e 0 conflitos. Saída não contém PII. | `demo-cosmaker`, Emulator local; nenhum dado real |
| `npm run test:e2e` — tentativa inicial | FAILED, 0/10; exit 1. A porta 3000 servia `next start -p 3000` sem meta de Emulator; foi encerrado após confirmar que pertencia ao checkout Cosmaker. | Runtime local anterior mal configurado; Emulator demo-cosmaker |
| Harness Emulator local | PASS; `npm ci` seguido de `functions:build`, Emulator iniciou nos ports 19099/18080/15001/19199/8085, seed de fixture saiu apenas para `demo-cosmaker`; `dev:local` respondeu HTTP 200. Alterações locais em `firebase.local-emulator.json`, script `firebase:emulators:local` e defaults de ports em `scripts/dev-local.mjs`. | Local/Emulator, Node 24.11.1 |
| `npm run test:e2e` — baseline em `dev:local` | FAILED, 6/10; exit 1. Falharam: métricas da visão geral Platform Owner não renderizam; navegação para `/admin/logs` excede 60s após suspensão/reativação; botão de prova `TEST_ONLY` fica em “Executando…” sem resultado; aviso de aprovação do orçamento não aparece no prazo embora a fixture termine aprovada e o snapshot do contexto mostre “Aprovação registrada”. Demais 6 cenários passaram, incluindo A×B/slug, intake/upload e regras comerciais. Dados continuam somente no Emulator; reseed antes da regressão. | Local, dev server + `demo-cosmaker`; Playwright Chromium, 1 worker |
| `npm run lint` | PASS; exit 0 | Local, Node 24.11.1/npm 11.6.4 |
| `npx tsc --noEmit` | PASS; exit 0 | Local, Node 24.11.1/npm 11.6.4 |
| `npm run build` | PASS; exit 0; Next 15.5.27 compiled and generated 81 static pages. Several module routes are still 297 B/structural and remain implementation work. | Local, Node 24.11.1/npm 11.6.4 |
| `npm run docs:diagrams` | PASS; exit 0; regenerated nine v0.2.0 SVGs from committed Mermaid sources. | Local |
| `npm run docs:check` | PASS; exit 0 for current v0.2.0; does not yet enforce future v0.3.0 package. | Local |
| `npm test`, `test:rules`, `test:commercial`, `functions:build` | PASS baseline já registrado acima; pendente repetir na regressão final após implementações. | Local/Emulator |
| Vulnerability triage | TODO; nenhum `npm audit fix` aplicado; registrar plano mitigatório em F6 após avaliar caminhos transitivos e impacto. | Local |
| Segurança/isolamento A×B e jornadas F1/F2 | TODO | Firebase Emulator, fixtures fictícias |
| Capturas reais desktop/mobile | TODO; somente Emulator, sem PII | Local/Playwright |

## Bloqueios externos e riscos

- Staging/Firebase/hosting real: acesso e autorização não confirmados; manter `STAGING_EXECUTION=NOT_AUTHORIZED` até prova/decisão do proprietário. Isso não impede desenvolvimento e testes locais.
- Provedores de e-mail, WhatsApp, shipping e pagamentos não foram selecionados/autorizados; adaptadores devem permanecer `disabled` ou sandbox e registrar `BLOCKED_EXTERNAL`/`DEFERRED`.
- Decisões de matriz comercial feature/limit seguem pendentes; não podem ser codificadas como política de produção.
- Backup/restauração não pode tocar em produção; preparar e testar somente Emulator ou staging explicitamente autorizado.
- A correção de anexos revelou o risco dos tokens permanentes do Firebase Storage. Os novos anexos passam por bytes autenticados; a revisão equivalente dos fluxos anteriores de fotos de produção e referências continua necessária antes do aceite global de ACL em F2/F6. Não inferir privacidade de URLs somente a partir de Rules verdes.
- Firebase Emulator passou as suítes de agenda, CRM e equipe usando Node 24.11.1, enquanto Functions declara runtime Node 22; avisos de metadados do Google Auth apareceram no Emulator, sem falha dos testes. Repetir os gates em Node 22 quando o runtime estiver disponível.

## Migrações, produção e segurança dos dados

`PRODUCTION_MIGRATION=NOT_RUN` · `PRODUCTION_DEPLOY=NOT_RUN` · `LIVE_BILLING=NOT_ENABLED` · `STAGING_EXECUTION=NOT_AUTHORIZED`

Nenhuma migração, deploy, envio externo, cobrança ou mutação de dados reais foi executada. IDs, histórico, arquivos e dados existentes devem permanecer íntegros.

## Commits e arquivos

- SHAs de commits deste goal: `b08f6cc` (checkpoint inicial), `9ebfb67` e `7382873` (F1.1 CRM), `c19b887` (base F1.2), `5f8d584` (F1.2 equipe), `45681dd` (checkpoint documental F1.2), `d5385e9` e `59fb0ec` (F1.3 agenda e checkpoint), `257bfd9` e `bdd23b7` (F1.4 estoque e checkpoint), `ecc701b` (WIP F1.5 enviado ao GitHub por solicitação do proprietário), `8073a7b` (anexos autenticados e histórico, com 30/30 integrações verdes).
- Arquivos tocados após o checkpoint: harness local e lockfile; F1.1 adicionou `functions/src/clients/`, rotas `/atelier/clientes`, repository/schema/types, índice Firestore, regras, integração ao vínculo de resposta de orçamento, seed, testes unitários/integrados/E2E e backfill Emulator-only. F1.2 implementou callables e política de equipe, rotas de equipe/convites/aceite/permissões, regras server-managed, retorno seguro do convite, e testes unitários, Functions, Rules e Playwright.
- O antigo `next start -p 3000` foi encerrado após confirmar seu caminho e erro. As sessões `dev:local` e Emulator iniciadas para E2E foram encerradas após as provas; a porta 8080, ocupada por outro projeto, não foi tocada.

## Próximos passos seguros

1. Executar F1.6: registros financeiros internos em centavos, confirmações manuais, compensações, custos/margens e acesso próprio do cliente; preservar depósito, snapshot e gates de produção de F1.5.
2. Preservar prova A×B/role e executar os gates de testes a cada módulo antes de seguir para o próximo.
3. Manter staging, produção, migração real e billing desativados até autorização separada.
