# Estrutura Firebase v0.2.0

Esta versão descreve os contratos implementados no repositório e exercitados localmente. Um único projeto Firebase mantém namespaces por tenant. Não houve criação de projeto por ateliê, migração ou deploy em produção.

## Firebase Auth

Auth autentica clientes, membros de ateliê e Platform Owner. Os callables comerciais confirmam e-mail verificado, perfil ativo e vínculo privado do usuário. Operações comerciais globais exigem claim `platformAdmin=true` e verificação server-side da plataforma; ter plano Premium nunca confere papel administrativo. A demo cria conta própria, membership e perfil sintéticos e retorna sua credencial de criação uma única vez ao administrador. Nenhuma senha, token ou credencial real é registrada nesta documentação.

## Firestore

| Namespace | Uso |
| --- | --- |
| `users/{uid}` | Perfil, conta ativa, tipo de conta e vínculo ao tenant |
| `ateliers/{atelierId}` | Identidade interna, suspensão operacional `active` e marcador demo protegido |
| `ateliers/{atelierId}/members/{uid}` | Membership, role e permissões |
| `ateliers/{atelierId}/commercial/state` | Estado comercial e overrides validados |
| `ateliers/{atelierId}/commercial/config` | FeatureFlag/config operacional explícita |
| `ateliers/{atelierId}/commercialUsage/{documentId}` | Contagem sintética apenas nas fixtures do Emulator |
| `ateliers/{atelierId}/commercialOperations/{operationId}` | Consumos sintéticos criados em transação com o contador |
| `publicAtelierSlugs/{slug}` | Índice privado usado pelo resolver server-side |
| `publicAteliers/{atelierId}` | Branding e flags públicas allowlisted pelo callable |
| `auditLogs/{logId}` | Histórico das ações administrativas com antes/depois e motivo |

Solicitações, referências, clientes, quotes, orders, itens/snapshots, medidas, etapas, fotos, aprovações, pagamentos e histórico permanecem nos namespaces existentes. Plano/status/override não apaga nem recria essas entidades. O status comercial `suspended` é diferente de `ateliers.active=false`.

Firestore Rules negam acesso direto aos documentos comerciais, contagem e operações sintéticas e bloqueiam alteração de campos protegidos no ateliê. Também preservam membership/RBAC e as negações do intake público direto. Functions com Admin SDK são responsáveis por validar autorização antes de usar esses paths.

## Storage

Referências públicas usam `ateliers/{atelierId}/quoteRequests/{requestId}/references/{referenceId}` com solicitação nova e metadado Firestore pendente, path/MIME/tamanho coincidentes, ateliê ativo e intake habilitado. A assinatura dos bytes é validada pelo backend depois do upload. Arquivos de medidas, pedidos, produção e branding mantêm seus namespaces e permissões existentes.

Gravações de arquivos da demo ficam restritas pelas Storage Rules e uploads sensíveis de produção também são recusados nas Functions. Demo não pode usar URLs assinadas para contornar a restrição. Não há nova cota de GB aprovada nem cobrança por storage.

## Cloud Functions

| Callable | Contrato real |
| --- | --- |
| `getTenantCommercialContext` | Deriva tenant do perfil autenticado e entrega atribuição/estado/banner |
| `getTenantFeatureAccess` | Resolve disponibilidade por chave com identidade, membership e RBAC |
| `runTestOnlyCommercialOperation` | Exclusivo do Emulator; enforcement e consumo atômico por tenant |
| `updatePlatformTenantCommercialState` | Plano/status, trial e overrides conhecidos por ação administrativa auditada |
| `createPlatformDemoTenant` | Cria tenant/conta/config/dados sintéticos e auditoria |
| `endPlatformDemoTenant` | Encerra demo sem apagar dados ou suspender operacionalmente o ateliê |
| `resolvePublicTenant` | Resolver por slug e allowlist pública, preservado |
| `createPublicQuoteRequest` | Intake validado server-side, preservado |
| `completePublicQuoteReferenceUpload` | Validação de arquivo e confirmação de metadado, preservada |
| `discardPublicQuoteReferenceUpload` | Limpeza de upload pendente, preservada |

Functions existentes de proposta/pedido/produção/plataforma continuam no mesmo runtime. Confirmação de depósito e fotos de produção chamam a restrição de demo adicional. Novas features comerciais de produção devem registrar política explícita e integrar o guard ao endpoint consumidor; a UI isolada não substitui esse enforcement.

## Emulator e migração

O projeto local `demo-cosmaker` atende Auth, Firestore, Storage, Cloud Functions e Pub/Sub. `scripts/seed-emulator.mjs` cria somente fixtures fictícias: Aurora/Luna A × B, Premium, Trial, Demo e estados comerciais restritos. Os runners isolam portas para não depender de serviços locais preexistentes. Nenhuma fixture é cliente real ou lead confirmado.

`npm run test:commercial` inicia emuladores e executa callables reais, incluindo migração dry-run/apply/idempotência no projeto demo. `scripts/migrate-commercial-state.mjs` exige destino explícito fora do Emulator, mantém dry-run padrão e só aplica com confirmação literal do project ID. A migração de produção deste goal não foi executada.

`PRODUCTION_MIGRATION=NOT_RUN` · `PRODUCTION_DEPLOY=NOT_RUN` · `BILLING=DEFERRED`
