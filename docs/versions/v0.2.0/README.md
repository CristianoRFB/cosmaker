# Cosmaker OS — documentação v0.2.0

Este marco implementa o Global Standard v01 comercial dentro do Cosmaker, sobre o core multi-tenant público do baseline `1dc8133`. O catálogo é local, a atribuição de plano/status é manual pelo Platform Owner e a autorização comercial lê documentos confiáveis no servidor. A versão foi validada localmente com Firebase Emulator, capturas reais, diagramas renderizados e `docs:check`; isso não representa migração ou deploy em produção.

## Decisões comerciais e disponibilidade

| Plano | ID / rank | Mensal | Anual | Destaque |
| --- | --- | --- | --- | --- |
| Essencial | `essencial` / 1 | R$ 59,90 | R$ 599,00 | — |
| Pro | `pro` / 2 | R$ 119,90 | R$ 1.199,00 | Recomendado |
| Premium | `premium` / 3 | R$ 199,90 | R$ 1.999,00 | — |

O anual corresponde a 12 meses pelo valor de 10 mensalidades. Implantação de R$ 299,00 é metadado separado. Trial Premium de 14 dias é concedido manualmente, sem cartão ou cobrança. Não existem add-ons pagos aprovados nesta versão.

Não há matriz aprovada de recursos por plano nem cotas numéricas de usuários, clientes, pedidos, storage ou operações. Por isso `features` e `limits` do catálogo comercial estão vazios. O CORE operacional existente permanece disponível conforme Auth, membership, permissões e suspensão operacional. Isso não constitui uma nova matriz comercial detalhada. A demonstração de diferenciação, gating e limite usa somente chaves `TEST_ONLY` no Firebase Emulator; elas não são vantagens comerciais vendáveis.

## Contratos e pontos reais de integração

- `functions/src/commercial/` contém tipos, catálogo, entitlements, resolução de disponibilidade, adapters server-side, operações administrativas e consumo transacional da fixture. Os módulos do frontend reexportam o contrato central.
- O estado fica em `ateliers/{atelierId}/commercial/state`; configuração operacional fica em `commercial/config`. Ausência de estado resulta em **atribuição pendente**, preservando o CORE legado e recusando novas operações comerciais protegidas.
- `/admin/planos` mostra preços aprovados e cria demonstrações isoladas. `/admin/assinaturas` lista atribuições/status. O detalhe `/admin/ateliers/{atelierId}` permite plano/status, trial e overrides conhecidos com motivo, confirmação e auditoria.
- `FeatureGating` apresenta a resposta do servidor. A operação sintética real `runTestOnlyCommercialOperation` deriva o tenant do perfil autenticado e exige RBAC, ateliê ativo, entitlement, implementação, configuração e limite dentro de transação.
- Demo usa tenant novo, branding/config e dados sintéticos. Depósito manual e uploads sensíveis têm bloqueio no backend; Storage também impede gravações de arquivos da demo. Encerrar demo desativa seu acesso e publicação, preservando dados e `ateliers.active`.

## CORE preservado

As rotas `/{tenantSlug}`, `/{tenantSlug}/orcamento` e `/{tenantSlug}/orcamento/sucesso` mantêm resolução pública por slug sem fallback. Slug não concede acesso privado. Orçamentos, snapshots, pedidos, medidas, produção, Kanban, fotos e aprovações continuam usando os domínios e fronteiras de segurança existentes. [A versão v0.1.0](../v0.1.0/README.md) permanece íntegra como evidência histórica.

## Migração e validação local

`scripts/migrate-commercial-state.mjs` executa dry-run por padrão. Somente valores antigos explícitos e válidos de `plan`/`planId` e `subscriptionStatus` são candidatos; o status operacional não é inferido como status comercial. Apply exige confirmação literal do project ID e a transação não sobrescreve estado já existente. Os testes exercitam dry-run, apply e repetição somente no Emulator, com logs agregados sem PII.

```bash
npm test
npm run test:rules
npm run test:commercial
npm run test:e2e
npm run lint
npx tsc --noEmit
npm run functions:build
npm run build
npm run docs:diagrams
npm run docs:check
```

As evidências e eventuais pendências ficam em [STATUS](STATUS.md). Consulte [arquitetura](ARCHITECTURE.md), [dados](DATA_MODEL.md), [segurança](SECURITY.md), [Firebase](FIREBASE_STRUCTURE.md), [estrutura](PROJECT_STRUCTURE.md), [capturas reais](SCREENS.md), [visuais conceituais](GENERATED_VISUALS.md), [leads](LEADS_OVERVIEW.md) e o [manifesto de diagramas](../../DIAGRAMS_MANIFEST.md).

`PRODUCTION_MIGRATION=NOT_RUN` · `PRODUCTION_DEPLOY=NOT_RUN` · `BILLING=DEFERRED`
