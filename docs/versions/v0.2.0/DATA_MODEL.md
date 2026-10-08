# Modelo de dados v0.2.0

`atelierId` continua a chave interna de tenant e autorização. Slug localiza configuração pública; não autentica usuários, substitui membership ou confere plano.

## Estado e configuração comercial protegidos

| Path | Conteúdo / responsabilidade |
| --- | --- |
| `ateliers/{atelierId}` | Estado operacional `active`, dados do ateliê e marcador server-side `demoWorkspace` |
| `ateliers/{atelierId}/commercial/state` | `planId`, `subscriptionStatus`, `trialUntil`, `entitlementOverrides`, `limitOverrides` |
| `ateliers/{atelierId}/commercial/config` | Mapa `featureConfig` de disponibilidade operacional explícita |
| `ateliers/{atelierId}/commercialUsage/test-only-operation-probe` | Contador confiável da fixture isolada de consumo |
| `ateliers/{atelierId}/commercialOperations/{operationId}` | Registro sintético de consumo com ator, chave e timestamp |
| `auditLogs/{logId}` | Ator, tenant, ação, entidade, motivo, timestamp, valor anterior e novo |

Todos os documentos `commercial`, `commercialUsage` e `commercialOperations` negam acesso direto do browser nas Rules. Callables leem e gravam com Admin SDK após validar autorização. O documento do tenant não aceita preço arbitrário; o schema comercial é estrito e rejeita campos fora do contrato.

```ts
type PlanId = 'essencial' | 'pro' | 'premium';
type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'demo';
type TenantCommercialState = {
  planId: PlanId;
  subscriptionStatus: SubscriptionStatus;
  trialUntil?: string | null;
  entitlementOverrides?: Record<string, boolean>;
  limitOverrides?: Record<string, number | null>;
};
```

IDs, status, tipos de overrides e chaves conhecidas são validados server-side. Inteiros de limite são seguros, não negativos e sem teto numérico inventado. Datas aceitas usam ISO 8601 com offset; datas geradas pelo servidor são ISO UTC (`toISOString`). Trial exige prazo válido para autorizar direitos temporários e a concessão calcula exatamente 14 dias a partir do servidor. Demo sem prazo explícito não recebe expiração implícita.

## Ausência, zero, null e override

Estado comercial ausente é `pending_assignment`: o admin mostra atribuição pendente, fluxos CORE legados seguem sua autorização existente e novas operações comerciais protegidas falham fechadas. Estado malformado é `invalid_state` e exige revisão administrativa, sem inventar plano substituto.

| Resolução de limite | Significado |
| --- | --- |
| Chave desconhecida | `unknown`; `getLimit` lança `CommercialPolicyError('unknown')` |
| Chave reconhecida ausente no plano e overrides | `not_configured`; `getLimit` lança `CommercialPolicyError('not-configured')` |
| `0` explícito | Nenhuma nova criação que consuma aquela política |
| Inteiro positivo | Teto para nova criação; uso existente não é apagado |
| `null` explícito | Sem teto comercial definido para aquela chave configurada |

Presença de override vence a entrada do plano, inclusive `false`, `0` e `null`. Excluir override volta à política do plano; se essa política estiver ausente, volta a `not_configured`. No catálogo comercial de produção os mapas estão vazios. Os números usados nas fixtures `TEST_ONLY` demonstram a mecânica e não são cotas comerciais.

## Migração conservadora

`scripts/migrate-commercial-state.mjs` lê campos antigos `plan`, `planId`, `subscriptionStatus`, `trialUntil` e o marcador `demoWorkspace`. Reutiliza o contrato compilado das Functions, exige Premium para trial/demo e marcador demonstrativo confiável para demo; datas válidas com timezone são normalizadas para ISO UTC. Não converte `status`/`active` operacional em status comercial. Sem plano/status explícitos válidos, contabiliza pendência e não modifica dados. Dry-run é padrão; apply exige `--confirm-project=<mesmo-id>` e usa criação transacional apenas quando `commercial/state` ainda não existe. Repetir apply preserva estado atribuído. Logs são agregados e não exibem IDs de tenants ou PII.

Somente fixtures locais do Emulator foram migradas nesta execução. Migração/atribuição não recria IDs, usuários, memberships, clientes, propostas, snapshots, pedidos, arquivos, fotos, etapas, histórico, slugs ou branding. Upgrade, downgrade e estados comerciais alteram esse documento protegido; não excluem registros de negócio nem mudam `ateliers.active`.

## Domínios existentes

`publicAtelierSlugs/{slug}` relaciona slug canônico e `atelierId`; `publicAteliers/{atelierId}` mantém branding, publicação e flag de intake. Solicitações permanecem em `quoteRequests/{requestId}` e referências em `references/{referenceId}` com path/MIME/tamanho/estado. Membros, clientes, quotes, orders, medidas, produção e histórico continuam nos namespaces existentes. A demo é tenant novo com dados declaradamente sintéticos e seu encerramento desativa acesso/publicação sem apagar esses registros.
