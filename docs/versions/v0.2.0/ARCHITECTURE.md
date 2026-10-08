# Arquitetura v0.2.0

## Fronteira entre operação e política comercial

O Next.js App Router mantém o core público por slug e as áreas privadas por `atelierId`. Firebase Auth, perfis, memberships, permissões, Functions e Rules continuam autorizando o CORE. A camada comercial é adicional e local à vertical Cosmaker; não cria projeto Firebase por tenant, fork de demo ou pacote npm compartilhado.

`functions/src/commercial/catalog.ts` é a fonte central de nomes, preços, ranks, setup e prazo de trial. `lib/commercial/catalog.ts`, `lib/commercial/entitlements.ts` e `types/commercial.ts` reexportam os contratos para a UI. Preços e setup não conferem direitos de uso. `features: []` e `limits: {}` refletem a ausência de matriz detalhada aprovada, sem bloquear módulos operacionais existentes.

## Resolução determinística

`resolveCommercialState` classifica estado como `assigned`, `pending_assignment` ou `invalid_state`. `resolveEntitlement`/`canUse` exigem chave registrada e feature implementada, validam estado e status/prazo, depois usam override booleano explícito ou a lista do plano. `false` bloqueia e `true` substitui o plano, mas nenhum override ignora status, implementação, configuração operacional ou RBAC.

`resolveFeatureAvailability` combina entitlement, feature implementada e `featureConfig[key] === true`. FeatureFlag/config controla disponibilidade operacional, entitlement controla direito comercial; as duas condições são necessárias para uma nova operação protegida. `resolveLimit` distingue `unknown`, `not_configured` e `configured`. `getLimit` retorna número/null somente no último caso e lança erro tipado nos demais. Override de limite explícito precede a entrada do plano, usando presença da chave para distinguir ausência de `null`.

| Estado | Nova operação comercial configurada | CORE e dados |
| --- | --- | --- |
| `active` | Conforme plano/override, implementação/config e RBAC | Regras operacionais existentes |
| `trial` | Somente enquanto `now < trialUntil` válido | Dados preservados; expiração não cria plano pago |
| `demo` | Recursos implementados e autorizados; sem efeitos sensíveis reais | Tenant sintético marcado; encerramento preserva dados |
| `past_due` | Negada | Leitura/histórico e CORE seguem regras existentes |
| `suspended` | Negada | Não muda automaticamente `ateliers.active` |
| `cancelled` | Negada | Nenhum registro é apagado |

O relógio é injetável nas funções puras e usa hora do servidor nos callables. O limite exato de `trialUntil` já é expirado, com razão `expired` e indicador `temporaryAccessExpired` no contexto do tenant para a UX de término. Demo sem prazo explícito não expira implicitamente; quando um prazo existir, o servidor também compara `now < trialUntil`.

## Functions e interface

`getTenantCommercialContext` deriva o tenant do perfil ativo autenticado, confirma membership e ateliê operacionalmente ativo e devolve o estado para o banner. `getTenantFeatureAccess` retorna disponibilidade por chave e também exige owner/admin ou `atelier:settings`. A UI reutiliza `FeatureGating` para loading, negação e conteúdo permitido; ela não é a fronteira de autorização.

`runTestOnlyCommercialOperation` existe apenas com `FUNCTIONS_EMULATOR=true`. Não aceita tenant/plano/role no payload. O servidor aplica identidade, RBAC e disponibilidade e a transação relê ateliê, estado, config e contagem antes de criar a operação sintética e incrementar uso. O contador e os registros ficam no namespace do próprio tenant. Downgrade para teto inferior mantém registros existentes e impede somente nova criação da operação que consome a política configurada.

As únicas chaves registradas hoje são `test_only.operation_probe` e `test_only.operation_count`. Não há gate de produção conectando orçamento, medidas, Kanban ou outros módulos a uma distinção não aprovada entre planos. Futuras políticas devem ser registradas explicitamente, com feature implementada/configuração e enforcement no endpoint consumidor correspondente.

## Administração, trial e demo

Callables comerciais administrativos exigem claim `platformAdmin=true` e reutilizam `requirePlatformAdmin` para validar perfil ativo/e-mail verificado. A UI permite revisão e confirmação da alteração com motivo; o backend valida campos e chaves e grava estado + audit log em transação, comparando o estado anterior para rejeitar concorrência administrativa. O trial é concedido uma única vez, com Premium e ISO UTC de servidor; alterações posteriores preservam `trialUntil` para impedir reinício.

Criar demo gera novo tenant, conta específica, membros, branding/config pública e dados fictícios, sem copiar cliente real. O intake público da demo fica desabilitado. `requireNonDemoWorkspace` bloqueia confirmação financeira de depósito e uploads de produção; Storage bloqueia uploads da demo. Encerrar demo muda seu status para `cancelled`, desativa perfil/membership/Auth e despublica a página. A condição operacional do ateliê permanece preservada.

## Core público preservado

`PublicTenantProvider` chama `resolvePublicTenant`, que consulta `publicAtelierSlugs/{slug}`, valida `ateliers/{atelierId}.active` e configuração allowlisted de `publicAteliers/{atelierId}`. `createPublicQuoteRequest` resolve o slug novamente, valida disponibilidade e cria solicitação/metadados pendentes. Storage verifica tenant, path, MIME/tamanho e estado; `completePublicQuoteReferenceUpload` confirma assinatura dos bytes. Não existe fallback global nem autorização privada por slug.

Veja [fontes Mermaid](diagrams/source/), [SVGs](diagrams/rendered/) e o [manifesto](../../DIAGRAMS_MANIFEST.md). Os seis diagramas históricos foram preservados; os três novos descrevem atribuição manual, resolução e enforcement comercial real.
