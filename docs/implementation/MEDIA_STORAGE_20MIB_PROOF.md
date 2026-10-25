# GOAL VII — prova privada20MiB (em implementação)

Base d659faa; branch codex/cosmaker-goal-vii-media-lifecycle. Feature flag OFF, nenhum cutover. Decisão/fonte em [MEDIA_LIFECYCLE_GVII](../decisions/MEDIA_LIFECYCLE_GVII.md).37arquivos de uso e14fluxos em [inventário](media-lifecycle/MEDIA_INVENTORY.json);47operações históricas preservadas em [matriz](media-lifecycle/OPERATIONS_47.json).

Primeira vertical:8/8integrações locais contra Auth/Firestore/RTDB Emulator e Supabase HTTP/TUS protocol double, mais7/7unitários de política. RTDBreal:20*1024*1024bytes inteiros com40chunks512KiB, SHA-256 global, private download, tenantA/B e auditoria idempotente. SupabaseDOUBLE:20MiB, chunksTUS6MiB, interrupção após primeiro chunk e resume HEAD/PATCH; não é provider real, RLSPostgres ou billing comprovado.0/6/19,99/20/20+1 limites e MIMEoriginais exercitados; GIF/SVG/ZIP não aceitos pelo contrato atual. FixturePDF sintética gerada em memória, nenhum assetdocs usado.

A verificação completa é um broker Node LOCAL, não processamento comprovado no WorkersFree. Primeiro ensaio RTDB exigiu332requestsFirestore para a jornada completa e41reads do provedor apenas para verificar a conclusão; transação, Auth, manifesto e demais chamadas podem ultrapassar50na mesma invocação. CPU/egress/memória ainda são gatesBLOCKED. Não aumentar limites ou habilitar transporte para produzirPASS artificial.

Supabase nativo: documentação confirma signed upload token emx-signature doTUS. Token é bearer para path, não membershipFirestore; double NÃO adiciona validação SHA256 ou revogação que o provedor não garante. Signed download previamente emitido continua válido depois de revogação do broker até expirar no double; evidência de bloqueio, não aprovação de segurança. Normal read usa gateway autenticado; service credential só no servidor, sintética e em memória.

Schemas novos isolados mediaAssetsV7/mediaUsageV7/mediaActivityV7 e providerproof/mediaV7. Nenhuma reescrita do banco de negócio ou de referências GCS/generation. PENDING/READY e reserva precedem upload; lease/fence/revalidação de pedido impedem publicação inconsistente. Reconciliação, backup/restauração completos, cron/UX e gates finais ainda em implementação neste checkpoint.

Reproduzir apenas local:

```bash
bash scripts/cloud-run.sh npm --prefix infrastructure/media test
bash scripts/cloud-run.sh node infrastructure/media/run-integration.mjs
```

O CI desta branch tem jobs focados media-proof/media-windows; não repete automaticamente104SDK/124unitários nem herda seusPASS. CI antigo preservado nas demais branches. Neste checkpoint não há aceite para substituição. ComercialNOT_READY.
