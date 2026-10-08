# Estrutura do projeto

- `app/(tenant-public)/[tenantSlug]` — layout, landing e orçamento públicos no contexto de slug.
- `app/(public)/` — páginas públicas legadas e páginas de compatibilidade.
- `components/public/` — contexto visual e formulário público reutilizável.
- `providers/` — contextos público e autenticado.
- `services/firebase/` e `repositories/` — integração client Firebase e acesso de domínio existente.
- `functions/src/public/tenant.ts` — resolver e operações de intake; `functions/src/index.ts` exporta os callables.
- `firestore.rules`, `storage.rules` — fronteiras de acesso direto.
- `scripts/seed-emulator.mjs` — tenants e contas exclusivamente locais.
- `scripts/migrate-public-tenant-slug.mjs` — associação idempotente slug→atelier existente.
- `tests/unit/`, `tests/rules/`, `tests/e2e/` — contratos e regressões unitárias, Rules e browser.
- `docs/versions/v0.1.0/` — documentação técnica e evidência visual deste marco.

Outras áreas preexistentes estão indexadas em `docs/initial/estruturas/arvore_completa.txt` e seus próprios READMEs. Esta implementação não criou um fork por ateliê nem uma biblioteca compartilhada global.
