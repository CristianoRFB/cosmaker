# Manifesto de diagramas — histórico e v0.2.0

As fontes são Mermaid editável. Os SVGs são renderizados localmente por `npm run docs:diagrams`; representam o sistema implementado no marco, não um desenho de arquitetura comercial futura.

As seis linhas v0.1.0 abaixo são preservadas como histórico. Para v0.2.0 os mesmos sources foram copiados sem alterar a versão anterior, e três fluxos comerciais reais foram acrescentados. Os paths source/render de cada linha são relativos à pasta `docs/versions/<Versão>/`. Os novos renders aguardam a execução final; a tabela é o registro dos pares esperados até esse gate.

| Nome | Objetivo | Source | Render | Versão | Observação |
| --- | --- | --- | --- | --- | --- |
| Contexto do sistema | Limites entre usuário, aplicação e Firebase | `diagrams/source/system-context.mmd` | `diagrams/rendered/system-context.svg` | v0.1.0 | Runtime local e cloud, sem afirmar deploy realizado |
| Tenant resolver público | Resolução e intake por slug | `diagrams/source/public-tenant-resolution.mmd` | `diagrams/rendered/public-tenant-resolution.svg` | v0.1.0 | Implementação validada no Emulator |
| Dados multi-tenant | Relação entre slug, ateliê e documentos | `diagrams/source/firebase-data-model.mmd` | `diagrams/rendered/firebase-data-model.svg` | v0.1.0 | IDs internos permanecem `atelierId` |
| Auth, membership e RBAC | Fronteiras privadas de autorização | `diagrams/source/auth-membership-rbac.mmd` | `diagrams/rendered/auth-membership-rbac.svg` | v0.1.0 | Preserva o modelo existente |
| Solicitação à produção | Fluxo comercial e operacional já existente | `diagrams/source/quote-to-production.mmd` | `diagrams/rendered/quote-to-production.svg` | v0.1.0 | Snapshots e transições validados nas suites atuais |
| Runtime | Componentes de execução local e Firebase | `diagrams/source/runtime.mmd` | `diagrams/rendered/runtime.svg` | v0.1.0 | Não significa que recursos foram publicados |
| Contexto do sistema | Limites entre usuário, aplicação e Firebase | `diagrams/source/system-context.mmd` | `diagrams/rendered/system-context.svg` | v0.2.0 | Source histórico preservado nesta versão |
| Tenant resolver público | Resolução e intake por slug | `diagrams/source/public-tenant-resolution.mmd` | `diagrams/rendered/public-tenant-resolution.svg` | v0.2.0 | CORE por slug preservado |
| Dados multi-tenant | Relação entre slug, ateliê e documentos | `diagrams/source/firebase-data-model.mmd` | `diagrams/rendered/firebase-data-model.svg` | v0.2.0 | Source do core; contrato comercial detalhado em DATA_MODEL |
| Auth, membership e RBAC | Fronteiras privadas de autorização | `diagrams/source/auth-membership-rbac.mmd` | `diagrams/rendered/auth-membership-rbac.svg` | v0.2.0 | Segurança permanece independente do plano |
| Solicitação à produção | Fluxo operacional existente | `diagrams/source/quote-to-production.mmd` | `diagrams/rendered/quote-to-production.svg` | v0.2.0 | Não introduz gating sem matriz aprovada |
| Runtime | Componentes de execução local e Firebase | `diagrams/source/runtime.mmd` | `diagrams/rendered/runtime.svg` | v0.2.0 | Mesmo codebase e projeto por ambiente |
| Atribuição manual de plano | Autorização global, validação, trial/overrides e auditoria atômica | `diagrams/source/manual-plan-assignment.mmd` | `diagrams/rendered/manual-plan-assignment.svg` | v0.2.0 | PENDING render; atribuição não apaga dados nem muda active |
| Resolução de entitlement | Registry, implementação, status/prazo, override/plano e config | `diagrams/source/entitlement-resolution.mmd` | `diagrams/rendered/entitlement-resolution.svg` | v0.2.0 | PENDING render; featureFlag é condição distinta do entitlement |
| Enforcement comercial | UI, identidade/RBAC, backend transacional e Rules | `diagrams/source/commercial-enforcement.mmd` | `diagrams/rendered/commercial-enforcement.svg` | v0.2.0 | PENDING render; consumo TEST_ONLY exclusivo do Emulator |
