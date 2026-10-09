# Cosmaker Master Finalization — Progress

Última atualização: 2026-10-09T16:46:13-03:00

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
| Baseline e instruções do repositório | IN_PROGRESS | Checkout correto; `main`/`origin/main` no SHA-base aprovado e branch de trabalho criada. Working tree inicial limpo, `AGENTS.md` ausente; README/CURRENT/STATUS/v0.2 lidos. Padrões genéricos localizados em `Manicures/docs/ecosystem/`; documentos de aprovação encontrados são de outras verticais e não decidem o Cosmaker. README/`docs/STATUS.md` ainda contradizem v0.2 e serão corrigidos na fase documental. |
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
| `npm ci` | FAILED na primeira tentativa: npm 11.6.4, Node 24.11.1 relata que o lockfile não registra `@emnapi/runtime@1.11.3` e `@emnapi/core@1.11.3`; investigar/fixar antes de considerar instalação reproduzível. `node_modules` preexistente permanece instalado. | Local |
| Baseline unit/Rules/commercial/E2E/lint/typecheck/build/docs | TODO; nenhum teste de baseline foi executado ainda | Local/Emulator |
| Unit, Rules, commercial, E2E, lint, typecheck, Functions build, Next build | TODO para novo baseline; não reutilizar PASS histórico como prova desta revisão | Local/Emulator |
| Segurança/isolamento A×B e jornadas F1/F2 | TODO | Firebase Emulator, fixtures fictícias |
| `npm run docs:diagrams` / `npm run docs:check` | TODO para versão final posterior | Local |
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

- SHAs de commits deste goal: nenhum ainda.
- Arquivos tocados neste checkpoint: `docs/implementation/MASTER_FINALIZATION_PROGRESS.md`.
- Nenhuma alteração de implementação foi feita antes do baseline local. `npm ci` falhou antes de instalar/remover dependências, e o tree da aplicação permanece inalterado.
- Processo local confirmado no caminho Cosmaker: Next.js na porta 3000 e Emulator Suite nas portas Auth 19099, Functions 15001, Firestore 18080/9151, Storage 19199; nenhum processo foi encerrado.

## Próximos passos seguros

1. Localizar normas canônicas disponíveis e mapear rotas/repositories/Functions/testes diretamente ligados às fases.
2. Instalar dependências reprodutivelmente (`npm ci`) e executar/registrar a suíte baseline no Emulator.
3. Implementar cada submódulo incrementalmente, testar o fluxo e a fronteira A×B/role, atualizar este checkpoint e fazer commits pequenos enquanto o working tree permanecer exclusivo deste goal.
