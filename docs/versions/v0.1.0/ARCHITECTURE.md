# Arquitetura

## Runtime público

O Next.js App Router entrega uma página dinâmica para `/{tenantSlug}` e seus caminhos de orçamento. `PublicTenantProvider` pede ao callable `resolvePublicTenant` a configuração associada ao slug. A camada de cliente não consulta índices de slug nem resolve o ID interno.

O callable faz lookup em `publicAtelierSlugs/{slug}`, lê o ateliê correspondente e sua configuração em `publicAteliers/{atelierId}`, verifica `active` e prepara uma resposta allowlisted. A rota só fica disponível quando `published == true`; o intake também exige `quoteRequestsEnabled == true`. Não há fallback para um ateliê padrão. Estados `invalid_slug`, `not_found`, `unpublished`, `suspended` e `available` têm apresentação distinta.

## Intake e referências

`QuoteRequestForm` recebe o tenant do provider. `createPublicQuoteRequest` resolve o slug novamente no backend, valida a disponibilidade do intake e cria a solicitação em `ateliers/{atelierId}/quoteRequests/{requestId}`. Se houver imagens, cria metadados pendentes e devolve caminhos no namespace desse mesmo ateliê. Após Storage aceitar o upload restrito, `completePublicQuoteReferenceUpload` valida metadados e assinatura dos bytes e muda o estado para `ready`. Falhas podem ser limpas por `discardPublicQuoteReferenceUpload`.

## Área autenticada

A aplicação continua usando Firebase Auth, `TenantProvider`, memberships em `ateliers/{atelierId}/members/{uid}`, permissões existentes, Rules e validação nas Cloud Functions. O slug serve apenas como endereço público. `/admin` e as áreas internas não foram migradas para slug.

## Ambientes

O mesmo codebase e configuração Firebase podem hospedar vários ateliês. A suíte local usa Firebase Emulator e tenants fictícios A/B. Produção continua exigindo deploy explícito das Functions/Rules e migração de slug por ambiente; esta execução não publicou recursos.

## Componentes

- Interface: `app/(tenant-public)/[tenantSlug]/`, `components/public/`, `providers/public-tenant-provider.tsx`.
- Client Firebase: `services/firebase/public-tenant.ts` e repositories.
- Backend: `functions/src/public/tenant.ts` e exports em `functions/src/index.ts`.
- Fronteiras: `firestore.rules`, `storage.rules`.
- Fixtures/migração: `scripts/seed-emulator.mjs`, `scripts/migrate-public-tenant-slug.mjs`.

Veja os [diagramas renderizados](diagrams/rendered/) e suas [fontes Mermaid](diagrams/source/).
