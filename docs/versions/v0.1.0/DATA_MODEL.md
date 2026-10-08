# Modelo de dados

`atelierId` permanece a chave interna de tenant para dados e autorização. `slug` é um localizador público estável, único e normalizado; não autentica usuários nem substitui memberships.

## Índice de resolução e configuração

- `publicAtelierSlugs/{slug}` → `atelierId` e slug canônico. Escrita reservada ao backend/admin; leitura pública direta bloqueada.
- `ateliers/{atelierId}` → estado operacional do tenant, memberships e dados do ateliê.
- `publicAteliers/{atelierId}` → configuração pública existente, incluindo `slug`, `published`, `quoteRequestsEnabled`, `name`, `tagline` e `brandColor`. O callable expõe apenas campos allowlisted.

Os dois documentos de slug/configuração são consistidos pela migração e validados pelo resolver. Uma associação conflitante ou inconsistente não resolve para outro ateliê.

## Solicitação pública

`ateliers/{atelierId}/quoteRequests/{requestId}` contém os dados validados do pedido de orçamento, estado `new` e timestamps do servidor. Os dados não incluem um `atelierId` definido pelo cliente. Referências ficam em `.../references/{referenceId}` com `storagePath`, nome original, MIME, tamanho e estado `pending`/`ready`; o Storage correspondente é `ateliers/{atelierId}/quoteRequests/{requestId}/references/{referenceId}`.

## Modelo privado preexistente

O restante das entidades segue o tenant já existente: `ateliers/{atelierId}/members/{uid}`, `clients`, `quotes`, `orders`, dados de medidas, produção e subcoleções de histórico/pagamentos/aprovações. Snapshots do pedido preservam valores e medidas aplicáveis. Ações administrativas da plataforma ficam em `auditLogs` e perfis de usuário em `users`.

O detalhamento histórico de domínios continua em `docs/initial/estruturas/firebase.txt`; este documento descreve apenas a relação atual do slug e o fluxo público acrescentado.
