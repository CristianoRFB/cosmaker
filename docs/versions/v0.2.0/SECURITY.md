# Segurança e isolamento v0.2.0

## Condições cumulativas

Segurança permanece independente do plano. A interface apresenta disponibilidade, mas Functions e Rules impõem autorização. Uma nova operação comercial protegida requer Auth, perfil ativo, e-mail verificado, membership ativo, ateliê operacionalmente ativo, RBAC, política conhecida, feature implementada/configurada e entitlement/status permitido. Nenhum `planId`, slug, role, override ou `atelierId` enviado pelo browser concede privilégios.

Os callables de contexto comercial derivam `atelierId` de `users/{uid}` e consultam o membership desse usuário. A operação sintética só admite payload vazio. Sua transação relê estado/config/contagem no namespace derivado e não compartilha contadores entre tenants. A falta de estado, política ou configuração não vira permissão ou infinito por acidente.

## Platform Owner e auditoria

Operações comerciais administrativas exigem sessão Firebase autenticada e claim `platformAdmin=true`, seguida de `requirePlatformAdmin`, que confirma e-mail verificado e perfil ativo no mecanismo existente. A UI exige motivo e confirmação; o servidor valida motivo de 8 a 500 caracteres, campos estritos, plano/status permitidos e chaves de override registradas. Tenant owner, staff, customer e usuário sem claim global não ganham autorização por ter Premium ou por alterar payload.

A atualização comercial e audit log são atômicos. O registro inclui `actorId`, `atelierId`, ação, entidade, `before`, `after`, motivo e timestamp do servidor. Se o estado mudou desde a leitura inicial, a transação aborta para que o admin atualize a tela. Trial e demo têm operações específicas; assign_plan não aceita esses status como atalhos.

## Escritas diretas e arquivos

Firestore Rules negam qualquer leitura/escrita direta dos documentos comerciais, contadores e registros sintéticos. Também impedem que tenant owners alterem no documento raiz marcadores `demoWorkspace`, `plan`, `planId`, `subscriptionStatus`, `trialUntil`, `entitlementOverrides` e `limitOverrides`.

O core público conserva intake via callable, metadados pendentes, allowlist pública e upload restrito por path/MIME/tamanho/estado. Slugs/configuração pública não recebem leitura pública direta. A suspensão operacional impede intake/uploads e os callables privados independentemente do plano/status comercial.

Demo tem `demoWorkspace` confiável no documento do tenant. Backend recusa confirmação de depósito real e emissão/finalização de uploads sensíveis de produção. Storage recusa gravações de arquivos da demo; sua configuração pública desabilita intake. Encerrar demo despublica a página, inativa perfil/membership e tenta desativar Auth; o resultado informa eventual necessidade de desativação manual da conta. Dados sintéticos e estado operacional do ateliê são preservados.

## Trial e estados restritos

Trial exige `now < trialUntil` no servidor; exatamente na data final o direito temporário está expirado e a resolução informa `expired`. O contexto devolve `temporaryAccessExpired` por relógio do servidor para banner/UI. Override true não contorna expiração, status restrito, implementação, configuração, RBAC ou suspensão operacional. `past_due`, `suspended` e `cancelled` negam novas operações comerciais configuradas. O CORE legado e a leitura/histórico continuam sujeitos às fronteiras operacionais existentes; não há exclusão automática, cobrança, plano pago implícito, grace period ou dunning.

## Evidências e fronteira do teste

Unitários cobrem preços/contratos, status, relógio de trial, overrides, desconhecido/ausente/zero/null/positivo e disponibilidade. Rules cobrem tampering direto, permissões, namespaces A × B e uploads. A integração executa callables reais com fixtures isoladas, auditoria, limites/concorrência, expiração, demo e migração idempotente. A suite E2E e as capturas desta versão ainda precisam de registro final em [STATUS](STATUS.md) antes de aprovação documental.

As chaves `TEST_ONLY` são rejeitadas fora do Functions Emulator e não são anunciadas como política comercial. App Check, rate limiting/anti-abuso e monitoramento avançado do intake permanecem trabalhos futuros já registrados pelo core. `PRODUCTION_MIGRATION=NOT_RUN`, `PRODUCTION_DEPLOY=NOT_RUN`, `BILLING=DEFERRED`.
