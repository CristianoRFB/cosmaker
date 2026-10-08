# Cosmaker OS — documentação v0.1.0

Este marco conclui o core multi-tenant público por slug. Cada ateliê continua identificado internamente por `atelierId`; slug apenas resolve contexto público.

## Fluxo público

- `/{tenantSlug}` — landing pública do ateliê.
- `/{tenantSlug}/orcamento` — formulário de solicitação de orçamento e referências.
- `/{tenantSlug}/orcamento/sucesso` — confirmação da solicitação com protocolo.
- `/orcamento` e `/orcamento/sucesso` — compatibilidade sem seleção de tenant; orientam a entrar pela página pública do ateliê.

O frontend chama `resolvePublicTenant`. A Cloud Function consulta `publicAtelierSlugs/{slug}`, verifica `ateliers/{atelierId}.active` e lê `publicAteliers/{atelierId}`. Só devolve a configuração pública allowlisted. Não há fallback global.

## Migração de slug

`npm run tenant:slug -- --project=<id> --atelier=<atelierId> --slug=<slug> --confirm-project=<id>` associa um slug a um ateliê e configuração pública existentes. Fora do Emulator, `--confirm-project` precisa repetir o projeto. A transação é idempotente para a mesma associação, não sobrescreve slug existente e preserva `atelierId` e dados. A execução em produção depende da escolha do slug e do projeto pelo responsável; esta tarefa não executou migração ou deploy em projeto real.

O seed local mantém o ateliê fictício legado `atelier-aurora` e adiciona `atelier-luna`, com slugs independentes. Para criar outro tenant de produção, provisionar seus dados e membros pelo fluxo administrativo vigente, definir configuração pública, escolher slug e executar o script de migração com as confirmações. Não altere código nem reutilize o ID de outro tenant.

## Rodar e validar

Use os passos do [README do repositório](../../../README.md#aplicação-e-testes-locais). O Emulator oferece `aurora-cosplay` e `luna-cosplay` para exercitar isolamento.

```bash
npm test
npm run test:rules
npm run test:e2e
npm run lint
npx tsc --noEmit
npm run functions:build
npm run build
npm run docs:diagrams
npm run docs:check
```

Veja [STATUS](STATUS.md), [arquitetura](ARCHITECTURE.md), [dados](DATA_MODEL.md), [segurança](SECURITY.md), [Firebase](FIREBASE_STRUCTURE.md), [estrutura do projeto](PROJECT_STRUCTURE.md), [screenshots reais](SCREENS.md), [visuais conceituais](GENERATED_VISUALS.md) e [leads](LEADS_OVERVIEW.md).

## Escopo

O GLOBAL STANDARD v01 comercial (catálogo de planos, entitlements, limites e gating) permanece uma etapa posterior e não é apresentado como implementado. Nenhum deploy de produção ou alteração de billing ocorreu neste marco.
