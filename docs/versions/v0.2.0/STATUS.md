# Status v0.2.0 — Global Standard v01

Atualizado em 09/10/2026. Implementação e evidências locais no Firebase Emulator; os resultados não implicam publicação no Firebase real.

## Implementação e políticas

- Catálogo local com Essencial/Pro/Premium, ranks 1/2/3, valores mensais/anuais aprovados, Pro recomendado, setup separado e trial Premium de 14 dias.
- Estado comercial em subdocumento protegido, validação estrita, atribuição pendente para legado e compatibilidade do CORE existente.
- `canUse`, `getLimit`, resolução unknown/not_configured/configured, status/prazo, overrides e disponibilidade que combina implementação + entitlement + config.
- Callables administrativos reais com autorização global server-side, motivo, confirmação na UI e auditoria atômica antes/depois. Trial calculado uma única vez no servidor; nenhum trial automático para todos os tenants.
- Demo criada com novo tenant/branding/config/conta/dados sintéticos. Intake público desabilitado, efeitos financeiros/upload sensível restringidos, encerramento preserva dados e estado operacional.
- FeatureGating reutilizável na UI, contexto comercial real e operação sintética com enforcement no backend e consumo transacional por tenant.
- Downgrade, upgrade, cancelamento e suspensão comercial preservam dados; `ateliers.active` mantém a responsabilidade de suspensão operacional independente.
- Migração dry-run por padrão, apply confirmado e idempotência validados apenas no Emulator, sem logs de PII.

Não existem limites numéricos ou distribuição comercial feature-a-feature aprovados. O catálogo de produção mantém `features: []`, `limits: {}`. Diferenciação e contagens sintéticas pertencem exclusivamente às fixtures `TEST_ONLY` do Emulator. CORE não recebeu bloqueios comerciais inventados. Features planejadas não foram declaradas entregues ou vendáveis.

## Validações observadas

| Comando | Resultado real recebido | Estado |
| --- | --- | --- |
| `npm test` | 79 testes unitários em 12 arquivos aprovados | PASS |
| `npm run test:rules` | 13 testes Firestore/Storage aprovados no Emulator | PASS |
| `npm run test:commercial` | 10 cenários de integração aprovados no Firebase Emulator | PASS |
| `npm run test:e2e` | 10 cenários aprovados no Firebase Emulator | PASS |
| `npm run lint` | Aprovado | PASS |
| `npx tsc --noEmit` | Aprovado | PASS |
| `npm run functions:build` | Aprovado | PASS |
| `npm run build` | Build Next.js de produção aprovado; 81 páginas estáticas geradas | PASS |
| `npm run screenshots:commercial` | Seis capturas reais geradas e inspecionadas | PASS |
| `npm run docs:diagrams` | Nove diagramas renderizados para a versão vigente | PASS |
| `npm run docs:check` | Aprovado após atualizar CURRENT e este registro final | PASS |

As evidências listadas correspondem às execuções observadas pelo agente principal. Nenhum PASS implica execução contra produção. O fechamento documental foi verificado com `docs:check` após este registro.

## Evidência de comportamento

Os unitários exercitam preços em centavos/anual, herança, seis estados, fronteira de trial, overrides, feature/config e semântica de limites. A integração exercita Platform Owner versus tenant_owner/staff/customer, tampering de payload, auditoria, A × B, consumo concorrente, políticas zero/positivo/null/ausente, expiração e demo. Rules impedem escrita direta de estado comercial/contagem e mantêm isolamento de domínio/Storage. O E2E cobre administração, trial/demo, negação de acesso, resolver multi-tenant, intake/upload público e aprovação de orçamento.

Os seis diagramas do core e as oito capturas reais da v0.1.0 foram copiados e suas fontes históricas preservadas. Três fontes novas descrevem atribuição manual, entitlement e UI/Functions/Rules. Três imagens ImageGen foram copiadas e registradas como CONCEITUAIS/IDEALIZADAS em [GENERATED_VISUALS](GENERATED_VISUALS.md). As seis capturas comerciais estão em [SCREENS](SCREENS.md).

## Produção, histórico e pendências

`PRODUCTION_MIGRATION=NOT_RUN` · `PRODUCTION_DEPLOY=NOT_RUN` · `BILLING=DEFERRED`

Nenhum dado real, preço aprovado ou tenant original foi convertido em fixture/demo/lead. Aurora/Luna e os demais tenants semeados são fictícios e locais. Nenhum lead confirmado foi inventado. Nenhum checkout, gateway, webhook, renovação, dunning, cobrança, marketplace ou serviço pago foi ativado.

Decisão futura de matriz comercial e cotas não bloqueia a conclusão da mecânica; permanece necessária antes de restringir/vender novas diferenças em produção. O rollout Firebase real exige operação separada e não faz parte deste goal.
