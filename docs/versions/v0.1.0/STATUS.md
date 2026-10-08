# Status v0.1.0 — core multi-tenant público

Atualizado em 08/10/2026. Classificação baseada em código e execução local no Firebase Emulator; não implica publicação no Firebase real.

## Entregue

- Resolver central callable por slug que diferencia slug inválido, inexistente, ateliê não publicado e suspenso e retorna apenas nome, tagline, cor de marca e flags públicas.
- Rotas `/[tenantSlug]`, `/[tenantSlug]/orcamento` e `/[tenantSlug]/orcamento/sucesso`; o fluxo mantém o slug resolvido até a solicitação, upload e confirmação.
- Backend valida os campos, rejeita `atelierId` enviado pelo browser, cria a solicitação em `ateliers/{atelierId}/quoteRequests/{requestId}`, cria metadados pendentes e valida MIME, tamanho e assinatura dos arquivos.
- Rules bloqueiam criação direta pública de solicitações e referências; Storage restringe path, tamanho, MIME, estado do ateliê e registro pendente.
- Migração idempotente adiciona slug sem trocar o ID interno ou recriar dados.
- Fixtures de teste isoladas para Tenant A e Tenant B, tenant suspenso e não publicado.
- A autorização de rotas internas continua baseada em Auth, membership, estado ativo e permissões já existentes; slug não concede autorização privada.

## Validações executadas

| Comando | Resultado observado |
| --- | --- |
| `npm test` | 30 testes unitários aprovados |
| `npm run test:rules` | 10 testes Rules aprovados no Emulator |
| `npm run test:e2e` | 5 testes Playwright aprovados no Emulator, incluindo intake/upload A × B, tampering e aprovação/criação de pedido |
| `npm run lint` | aprovado |
| `npx tsc --noEmit` | aprovado |
| `npm run functions:build` | aprovado |
| `npm run build` | aprovado; as rotas tenant são dinâmicas |
| `npm run docs:diagrams` | fonte Mermaid convertida para SVG; resultado registrado em `DIAGRAMS_MANIFEST.md` |
| `npm run docs:check` | verifica documentos, links locais, manifests, screenshots e visuais |

## Não executado no ambiente real

- Nenhum dado real foi convertido em fixture, removido ou recriado. Não houve migração, deploy, alteração de billing ou uso de credenciais reais. A migração real de slug deve ser feita pelo responsável do projeto após escolher o slug e confirmar o Firebase project ID.
- As fixtures Aurora/Luna são exclusivamente locais e não identificam clientes reais.
- O intake ainda se beneficiaria de App Check, rate limiting/abuse controls e alertas operacionais; estes não foram incluídos neste core.
- Capturas autenticadas de dashboard/Kanban são preservadas nos marcos anteriores; este marco adiciona capturas públicas executadas com dois tenants no Emulator.
- O GLOBAL STANDARD v01 de planos, entitlements, limites e gating **não foi implementado**.

## Readiness recomendado

`READY_FOR_GLOBAL_STANDARD_IMPLEMENTATION` — o gate técnico deste core passa pelos comandos e provas acima. A futura implementação comercial deve continuar usando autorização server-side e manter segurança fora de qualquer gating premium. A migração de slugs em um ambiente real é uma operação de rollout por ambiente, não uma alteração já aplicada nesta tarefa.
