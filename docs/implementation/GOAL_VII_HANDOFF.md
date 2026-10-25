# GOAL VII — handoff de implementação e prova local

25/10/2026. **CANDIDATO INCOMPLETO / STORAGE CUTOVER BLOCKED / NOT_READY.** Não confundir com a candidata antiga funcionalmente preparada para homologação.

Origin: CristianoRFB/cosmaker. HEAD inicial remoto confirmado: `d659faa40bd8dff3929daac2f6a39aa47bccea19`. Branch isolada `codex/cosmaker-goal-vii-media-lifecycle`. GOAL VI preservado em d659faa; candidata `codex/cosmaker-master-finalizacao` em cca4e23281afd4bcfcc5eb0dc69c38e8b641eba2. Sem reset destrutivo, force push, merge ou migração. HEAD final é o commit que inclui este documento: conferir `git log -5` e CI do SHA exato.

Checkpoints enviados: `03a77ca` inventário/política; `06df2a8` vertical20MiB; `ff9fa34` Storage OSS oficial; `a2a895c` recuperação/retenção/cron. O checkpoint seguinte reúne UX, atividade fechada, admission21tenants, evidências e CI proporcional. Nenhum WIP deliberadamente deixado fora do Git.

## Implementação e validação

- **IMPLEMENTADO, VALIDADO_LOCALMENTE:** adaptadores RTDB chunked/Supabase local,20MiB íntegros, MIME/magic, SHA, key imutável, quota reservada, retry/lease/fence, PENDING/READY, identidade atual e autorização canônica por UID/tenant/member/pedido/compartilhamento.
- **IMPLEMENTADO, VALIDADO_LOCALMENTE:** retenção v01 conforme TXT, classes protegidas, UTC, duas janelas fechadas para descida, promessa preservada, vínculos/holds, avisos internos para todos os destinatários, deduplicação, paginação/leases e scheduled workerd para broker secreto DRY_RUN.
- **IMPLEMENTADO, VALIDADO_LOCALMENTE:** backup bytes+metadados20MiB, restore RTDB em nova geração, crash/retry, ausência positiva/reserva conservadora, tombstones, API de exclusão sintética e retomada após falha parcial.
- **IMPLEMENTADO, VALIDADO_LOCALMENTE:** laboratório Next isolado, download/exportação individual com SHA no browser, classificação/prazo/tolerância/avisos, erro/empty, prévia PNG opt-in com original preservado, governança global; quatro larguras e duas rotas antigas.
- **NÃO TESTADO NO PROVEDOR:** Supabase hospedado Free/conta/cartão, Firebase JWT/RLS canônico, CORS/gateway/cache/revogação, identidade/secrets reais, cron remoto, Workers Free CPU/telemetria, backup/restore operacional.
- **PENDÊNCIAS LOCAIS NÃO ACEITAS:** restore Supabase nativo, coleta/reconciliação de abandonados, verificação incremental adequada ao Worker Free, TUS no browser e leitor dual/rollback20MiB. Não são descritas como exclusivamente externas. Migração parou nos gates estruturais de capacidade/Free; não portar outras Functions antes disso.

Broker é **Node local**, não implementação integral Workers Free ou serviço gratuito hospedado disponível. Nenhuma conta real, billing, R2, Blaze, IAM, login externo, deploy ou dados reais utilizados. JWTs Docker são sintéticos, privados e ignorados no Git. PostgreSQL serve só ao Storage oficial local, não ao negócio.

## Evidências e métricas

35 cenários distintos:9unitários/guards +15integrações +4Storage OSS oficiais +7E2E. Retestes não somam crédito. Next15/TypeScript/lint integrado e lint direcionado sem warnings passaram; pacote novo0vulnerabilidades/0dependências.104SDK/124unitários antigos não repetidos. CI a2a895c consultado e aprovado. Conferir o CI do checkpoint final em [Actions desta branch](https://github.com/CristianoRFB/cosmaker/actions?query=branch%3Acodex%2Fcosmaker-goal-vii-media-lifecycle), pelo SHA e jobs.

Tentativas falhas/retestes no [ledger próprio](media-lifecycle/EVIDENCE.json), sem traces/capabilities no Git: seletor alert e timeout do teste global corrigidos; cinco uploads aprovados e reteste focado avisos/governança2/2. Docker startup90s falhou sob carga; recursos próprios removidos, prazo300s/limpeza Created e reteste oficial4/4. Falhas não viraram skips.

Capacidade:1GBglobal a2×20MiB/dia/tenant satura antes de37dias até com1tenant.21tenants/42reservas:28admitidas,14recusadas,784.198.352bytespendentes, nenhum delete. Não cria quota comercial ou reduz teto20MiB.41reads só de verificação maisAuth/transação podem exceder50subrequests. Tempo local não éCPU faturada; Node não resolve o requisitoFree.

1. Stack antiga:182/184=98,91%funcional e10/16=62,5%formal, **somente histórico**. Conjunto congelado intacto.
2. GOALVII:35cenários locais distintos; [sete gates](media-lifecycle/ACCEPTANCE.json),0/7aceitos para cutover,6parciais e1bloqueado. Não é0%de implementação. [47operações](media-lifecycle/OPERATIONS_47.json) conservam evidências parciais,0equivalências inteiras novas.
3. Comercial: **NOT_READY**. Nenhuma promoção de F2/F3/F5/F6 por POC de mídia; F7/F8 seguem sem aceite de produção/release.

## Retomada objetiva

Ler [prova/comparação](MEDIA_STORAGE_20MIB_PROOF.md), [decisão](../decisions/MEDIA_LIFECYCLE_GVII.md), [runbook](../operations/MEDIA_RETENTION_DRY_RUN.md) e gates. TXT literal materializado é fonte autorizada; documento77externo não foi encontrado nem inventado.

Próximo passo: demonstrar capacidade e verificação/autorização sustentáveis no Free para uso esperado, antes de cutover. Nenhuma solução torna1GB armazenamento crescente ilimitado preservando tudo. Não recomendar upgrade como solução automática ou aplicar novas restrições Essencial/Pro/Premium. Uma alternativa precisa preservar segurança e explicitar limites sem mudar contrato silenciosamente.

Com estratégia viável, fechar pendências locais listadas e repetir só a superfície alterada. Depois, mediante autorização separada, homologar conta/quota real, identidade mínima, gateway/RLS/CORS/cache, índices, cron/CPU, backup/restore e rollback. Nunca executar deploy por rodar testes/preflight.

Retomada Git: fetch, checkout da branch isolada, conferir árvore e preservar commits. Lançadores do runbook fixam demo/loopback. Flags OFF fora dos harnesses. Namespaces novos não reescrevem referências legadas; leitor antigo6MiB não lê automaticamente20MiB novos. Não excluir legado nem chamar snapshot sintético de backup/revogação real.

Correção adicional comprovada: renovação de lease atualiza o snapshot canônico de pedido ainda ativo. Um pedido legitimamente editado não deixa upload preso para sempre; corrida de atualização continua bloqueando a conclusão até renovação. Reteste direcionado1/1, sem repetir15integrações.
