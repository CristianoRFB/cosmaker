# Estrutura Firebase

Esta versão descreve o que o repositório implementa. Nenhuma estrutura foi implantada em projeto de produção nesta execução.

## Authentication

Firebase Auth atende contas públicas, clientes, membros de ateliê e administradores. As regras privadas consultam `request.auth`, estado de e-mail verificado quando requerido, perfil e membership. O Emulator Suite cria contas de teste fictícias; elas não são contas de produção.

## Firestore

- `users/{uid}` guarda perfil/estado e pode indicar `platform_admin`.
- `ateliers/{atelierId}` preserva o identificador interno e estado `active`.
- `ateliers/{atelierId}/members/{uid}` preserva `active`, `role` e `permissions`.
- `publicAteliers/{atelierId}` contém dados públicos e flags de publicação/intake já compatíveis com o modelo existente.
- `publicAtelierSlugs/{slug}` é o índice privado server-side do identificador público único.
- `ateliers/{atelierId}/quoteRequests/{requestId}` contém solicitações; `references/{referenceId}` contém metadados de upload e estado.
- Pedidos e domínios de produção continuam sob `ateliers/{atelierId}/orders/{orderId}`, incluindo itens/snapshots, etapas, fotos, aprovações, pagamentos e histórico conforme os módulos existentes.
- `auditLogs/{logId}` preserva auditoria administrativa.

Rules bloqueiam leitura pública de slug/configuração e gravações públicas diretas de solicitação/metadados. Dados privados seguem membership, permissões e estado ativo.

## Storage

Referências do intake usam `ateliers/{atelierId}/quoteRequests/{requestId}/references/{referenceId}`. Para criação, Storage requer solicitação nova e metadado Firestore pendente com path, tamanho e MIME coincidentes, além de ateliê ativo e intake habilitado. A validação da assinatura dos bytes ocorre no backend depois do upload. Leitura exige estado pronto e regra de membro/dono. Outros arquivos seguem os caminhos por tenant existentes para branding, pedidos, medidas e produção.

## Cloud Functions

- `resolvePublicTenant`: resolve slug e retorna allowlist pública.
- `createPublicQuoteRequest`: valida intake e cria solicitação/metadados.
- `completePublicQuoteReferenceUpload`: verifica arquivo e confirma metadado.
- `discardPublicQuoteReferenceUpload`: limpa uploads pendentes.
- Functions existentes continuam protegendo aprovação de proposta, criação de pedido, produção e administração da plataforma.

## Emulator Suite e Rules

O projeto local `demo-cosmaker` isola Auth, Firestore, Storage, Functions e Pub/Sub. `npm run seed:emulator` inclui Aurora e Luna fictícias com slugs distintos e fixtures de estado suspenso/não publicado. `npm run test:rules` verifica Firestore/Storage no Emulator; `npm run test:e2e` usa dados locais e bloqueia configuração diferente de demo para fluxos de escrita.

Não registrar chaves, tokens, senhas nem credenciais administrativas nesta documentação. Referência histórica: `docs/initial/estruturas/firebase.txt`.
