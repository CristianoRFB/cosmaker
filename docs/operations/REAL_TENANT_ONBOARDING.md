# Onboarding conservador para ateliês reais — Cosmaker OS

**Status:** preparação de código e procedimento; NÃO é deploy nem homologação de produção.
**Base:** main SHA 859f9050f3cd895c312e6d385361297d06049683.

## Objetivo
Preparar criação controlada de tenants distintos, sem hardcodes, cópia de dados de lead, edição de clientes legados, envio de senhas, billing ou publicação automática. Inicia com landing não publicada e intake desligado.

## Operação
1. Confirme dados comerciais, autorização do responsável, identidade Firebase Auth já existente, e-mail **verificado** e sem perfil Cosmaker associado.
2. Confirme operador Platform Owner com claim e perfil ativos; credenciais administrativas em cofre. Nunca criar owner com base apenas em e-mail.
3. Instale dependências do projeto e das Functions com npm ci. Em ambiente local, configure ambos FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST com projeto demo-*.
4. Faça preflight read-only:

    node scripts/onboard-real-tenant.mjs --mode=preflight --project-id=demo-cosmaker --name="Atelie Exemplo" --slug=atelie-exemplo --owner-uid=<UID_VERIFICADO> --owner-email=<EMAIL_CONFIRMADO> --operator-uid=<UID_PLATFORM_OWNER>

5. Depois de verificar os dados e somente em Emulator, use --mode=apply. O script cria atelier, membro owner, perfil, slug, branding não publicado, config comercial vazia e audit log em UMA transação.
6. Fora do Emulator, apply exige **autorização humana externa prévia**, backup testado e quatro argumentos explícitos: --mode=apply --production-apply=true --confirm-project=<project-id> --confirm-slug=<slug> --confirm-owner-uid=<uid>. A presença das flags não constitui autorização.
7. Atribua plano/trial manualmente no Platform Owner. Não invente cotas ou entitlements comerciais; não transforme status comercial em suspensão operacional.
8. Antes de publicar: Rules, Functions, Auth, Storage, uploads, relatórios, incidentes, backups/restauração e Tenant A × B homologados. Habilite published e quoteRequestsEnabled **somente em operação separada e auditada**.

## Limites de infraestrutura e funcionalidade
- Cloud Functions for Firebase requer **Blaze**, não executa deploy novo no Spark. Aprovar infraestrutura e orçamento antes de lançar o fluxo público que depende de Functions. Não confundir billing da infraestrutura com billing automático das assinaturas do SaaS.
- Preflight não provisiona conta Firebase Auth, não envia convite nem senha; conta autenticada e e-mail verificado são pré-requisitos.
- Não existe prontidão para checkout automático, marketplace, frete ou catálogo de venda de produto pronto. Demo externa (ex. bonés autorais) não prova funcionalidade do Cosmaker OS.
- Testar política de privacidade, consentimento LGPD, retenção, exportação/exclusão, App Check, rate limiting e alertas antes de aceitar pedidos com dados reais.
- Não importar lead, identidade visual ou fotos sem permissão; não usar fixtures reais. Não marcar PRODUCTION_READY sem evidência.

## Testes
  node --test scripts/tests/tenant-onboarding-contract.test.mjs

**Rollback:** não apagar dados reais automaticamente. Se houver falha, bloquear publicação/intake, preservar dados e seguir procedimento de restore auditado.
