# Manifesto de diagramas — v0.1.0

As fontes são Mermaid editável. Os SVGs são renderizados localmente por `npm run docs:diagrams`; representam o sistema implementado no marco, não um desenho de arquitetura comercial futura.

| Nome | Objetivo | Source | Render | Versão | Observação |
| --- | --- | --- | --- | --- | --- |
| Contexto do sistema | Limites entre usuário, aplicação e Firebase | `diagrams/source/system-context.mmd` | `diagrams/rendered/system-context.svg` | v0.1.0 | Runtime local e cloud, sem afirmar deploy realizado |
| Tenant resolver público | Resolução e intake por slug | `diagrams/source/public-tenant-resolution.mmd` | `diagrams/rendered/public-tenant-resolution.svg` | v0.1.0 | Implementação validada no Emulator |
| Dados multi-tenant | Relação entre slug, ateliê e documentos | `diagrams/source/firebase-data-model.mmd` | `diagrams/rendered/firebase-data-model.svg` | v0.1.0 | IDs internos permanecem `atelierId` |
| Auth, membership e RBAC | Fronteiras privadas de autorização | `diagrams/source/auth-membership-rbac.mmd` | `diagrams/rendered/auth-membership-rbac.svg` | v0.1.0 | Preserva o modelo existente |
| Solicitação à produção | Fluxo comercial e operacional já existente | `diagrams/source/quote-to-production.mmd` | `diagrams/rendered/quote-to-production.svg` | v0.1.0 | Snapshots e transições validados nas suites atuais |
| Runtime | Componentes de execução local e Firebase | `diagrams/source/runtime.mmd` | `diagrams/rendered/runtime.svg` | v0.1.0 | Não significa que recursos foram publicados |
