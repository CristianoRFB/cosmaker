# Cosmaker Master Finalization — Progress

Última atualização: 2026-10-14 — F1.1 a F1.4 validados; F1.5 é o próximo módulo.

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
| F1.5 Pedidos, produção e change requests | TODO | Arquivos/ACL, etapas configuráveis, alterações versionadas e aprovação/snapshot do cliente. |
| F1.6 Financeiro operacional, custos e margens | TODO | Registros internos em centavos, compensações/auditoria, sem movimentar dinheiro real. |
| F1.7 Serviços e portfólio | TODO | Conteúdo publicado tenant-aware, imagens autorizadas e privacidade. |
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
- Firebase Emulator passou as suítes de agenda, CRM e equipe usando Node 24.11.1, enquanto Functions declara runtime Node 22; avisos de metadados do Google Auth apareceram no Emulator, sem falha dos testes. Repetir os gates em Node 22 quando o runtime estiver disponível.

## Migrações, produção e segurança dos dados

`PRODUCTION_MIGRATION=NOT_RUN` · `PRODUCTION_DEPLOY=NOT_RUN` · `LIVE_BILLING=NOT_ENABLED` · `STAGING_EXECUTION=NOT_AUTHORIZED`

Nenhuma migração, deploy, envio externo, cobrança ou mutação de dados reais foi executada. IDs, histórico, arquivos e dados existentes devem permanecer íntegros.

## Commits e arquivos

- SHAs de commits deste goal: `b08f6cc` (checkpoint inicial), `9ebfb67` e `7382873` (F1.1 CRM), `c19b887` (base F1.2), `5f8d584` (F1.2 equipe), `45681dd` (checkpoint documental F1.2), `d5385e9` e `59fb0ec` (F1.3 agenda e checkpoint), `257bfd9` (F1.4 estoque).
- Arquivos tocados após o checkpoint: harness local e lockfile; F1.1 adicionou `functions/src/clients/`, rotas `/atelier/clientes`, repository/schema/types, índice Firestore, regras, integração ao vínculo de resposta de orçamento, seed, testes unitários/integrados/E2E e backfill Emulator-only. F1.2 implementou callables e política de equipe, rotas de equipe/convites/aceite/permissões, regras server-managed, retorno seguro do convite, e testes unitários, Functions, Rules e Playwright.
- O antigo `next start -p 3000` foi encerrado após confirmar seu caminho e erro. As sessões `dev:local` e Emulator iniciadas para E2E foram encerradas após as provas; a porta 8080, ocupada por outro projeto, não foi tocada.

## Próximos passos seguros

1. Iniciar F1.5 (pedidos, produção configurável e change requests), preservando seis etapas, proposta aprovada, bloqueios financeiros e ACL de arquivos.
2. Preservar prova A×B/role e executar os gates de testes a cada módulo antes de seguir para o próximo.
3. Manter staging, produção, migração real e billing desativados até autorização separada.
