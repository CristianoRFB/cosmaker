# Cosmaker Master Finalization — Progress

Última atualização: 2026-10-13T13:51:39-03:00

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
| F1.1 CRM e clientes | TODO | Inspecionar rotas, repositories, domínio e testes; fluxo persistido + negação A×B/role. |
| F1.2 Equipe, onboarding e permissões | TODO | Convites, expiração/revogação, escalada e proteção do último owner. |
| F1.3 Agenda, capacidade, eventos e risco | TODO | Persistência, alocação transacional, prazos e risco baseado em dados reais. |
| F1.4 Estoque, materiais e fornecedores | TODO | Movimentações imutáveis, saldo confiável, concorrência/idempotência e pedidos. |
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

## Migrações, produção e segurança dos dados

`PRODUCTION_MIGRATION=NOT_RUN` · `PRODUCTION_DEPLOY=NOT_RUN` · `LIVE_BILLING=NOT_ENABLED` · `STAGING_EXECUTION=NOT_AUTHORIZED`

Nenhuma migração, deploy, envio externo, cobrança ou mutação de dados reais foi executada. IDs, histórico, arquivos e dados existentes devem permanecer íntegros.

## Commits e arquivos

- SHAs de commits deste goal: `b08f6cc` (checkpoint de progresso).
- Arquivos tocados após o checkpoint: `package-lock.json` (adições mínimas de `@emnapi/core` e `@emnapi/runtime` 1.11.3 para `npm ci`), `package.json`, `scripts/dev-local.mjs`, `firebase.local-emulator.json` e este registro.
- Nenhuma alteração funcional foi feita antes do baseline local.
- O antigo `next start -p 3000` foi encerrado após confirmar seu caminho e erro. Para o baseline correto, `dev:local` está ativo na porta 3000 e os Emulators na configuração isolada; a porta 8080 segue ocupada por outro projeto e não foi tocada.

## Próximos passos seguros

1. Corrigir e cobrir as quatro falhas E2E do baseline, preservando os seis cenários aprovados.
2. Salvar checkpoint do harness e da evidência baseline; em seguida iniciar F1 pelo CRM, corrigindo lacunas estruturais com persistência e autorização.
3. Inspecionar somente as rotas/repositories/Functions dos módulos F1 e implementar cada lacuna por submódulo com persistência, autorização, prova A×B/role, testes e commits pequenos.
