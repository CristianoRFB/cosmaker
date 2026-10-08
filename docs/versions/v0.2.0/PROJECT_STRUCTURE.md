# Estrutura do projeto v0.2.0

| Path | Responsabilidade |
| --- | --- |
| `functions/src/commercial/types.ts` | PlanId, SubscriptionStatus, TenantCommercialState e resoluções discriminadas |
| `functions/src/commercial/catalog.ts` | Catálogo local, preços/setup/trial, registries e invariantes |
| `functions/src/commercial/entitlements.ts` | Validação, canUse/getLimit, status/prazo e disponibilidade operacional |
| `functions/src/commercial/access.ts` | Identidade server-side, RBAC, leitura confiável e bloqueio de ações sensíveis da demo |
| `functions/src/commercial/data.ts` | Paths protegidos e detecção server-side de Functions Emulator |
| `functions/src/commercial/platform-management.ts` | Atribuição manual, status, trial, overrides, criação/encerramento de demo e auditoria |
| `functions/src/commercial/tenant-context.ts` | Callables de contexto/gating e entrada exclusiva do Emulator |
| `functions/src/commercial/test-only-probe.ts` | Consumo e contador por tenant em transação |
| `lib/commercial/`, `types/commercial.ts` | Reexports do contrato central para o frontend |
| `repositories/commercial.repository.ts`, `repositories/admin.repository.ts` | Adapters dos callables para UI de tenant e Platform Owner |
| `components/commercial/` | FeatureGating, banner comercial e probe TEST_ONLY |
| `components/admin/commercial-state-manager.tsx` | Revisão/confirmacão, motivos, operações e histórico de auditoria |
| `app/admin/planos/`, `app/admin/assinaturas/` | Catálogo local, demo e lista de atribuições |
| `app/admin/ateliers/[atelierId]/` | Administração comercial integrada ao detalhe existente |
| `app/atelier/` | Dashboard existente com estado comercial e probe somente em modo Emulator |
| `firestore.rules`, `storage.rules` | Segurança de acesso direto e proteção de estado/demo |
| `scripts/migrate-commercial-state.mjs` | Migração conservadora com dry-run, confirmação e idempotência |
| `scripts/test-commercial-emulator.mjs`, `firebase.commercial-test.json`, `firebase.rules-test.json` | Execução isolada de integração e Rules |
| `scripts/capture-commercial-screenshots.mjs` | Capturas reais das seis telas comerciais desktop/mobile |
| `tests/unit/commercial-standard.test.ts`, `tests/integration/commercial-functions.test.ts`, `tests/e2e/commercial-standard.spec.ts` | Contratos, callables/concorrência e jornada no browser |
| `docs/versions/v0.2.0/` | Documentação e evidências deste marco |

As áreas públicas por slug em `app/(tenant-public)/[tenantSlug]/`, providers, repositories e `functions/src/public/tenant.ts` permanecem. O core de quotes/orders/medidas/produção mantém os módulos existentes. `docs/versions/v0.1.0/` e `docs/initial/` são preservados; não existe fork por plano/tenant, projeto Firebase por tenant ou biblioteca global de outra vertical.

Os scripts `docs:diagrams` e `docs:check` encontram a versão apontada por `docs/CURRENT.md`. O apontamento é atualizado apenas após os artefatos finais desta versão estarem completos.
