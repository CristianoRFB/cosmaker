# GOAL VI — adaptação Spark isolada (WIP)

Base preservada: cca4e23281afd4bcfcc5eb0dc69c38e8b641eba2, CI40121145818 aprovado. Branch nova codex/cosmaker-spark-zero-billing. Nenhum código/domínio/Rules/configuração Firebase anterior foi substituído. Sem deploy, provisionamento, credenciais reais ou billing.

Implementação experimental em infrastructure/spark: Worker local restrito a demo-cosmaker/loopback, identidade/Auth Emulator com consulta atual, verificador RS256/jose separado, adaptador REST Firestore com transação/retry, recordFinanceEntry e política monetária canônica, evento scheduled paginado/limitado, transporte privado RTDB com pending/ready, ETag, leases, hash e quotas experimentais. Não é aceite das47 operações nem equivalência do armazenamento anterior.

Primeiro checkpoint: bundle Wrangler dry-run39,80KiB;3/3 testes de assinatura/recusas/runtime aprovados. Integração real com Auth/Firestore/Database Emulator em execução; primeiros erros de configuração do harness corrigidos (paths e API Miniflare5 via conversor oficial), sem PASS antecipado.

Bloqueios de paridade conhecidos: candidato de arquivo6MiB não preserva20MiB do contrato atual; compressão/redimensionamento seguros não implementados; quotas RTDB globais/tráfego real precisam validação, não são entitlements comerciais. CPU10ms/50subrequests Free e SSR exigem medição. Produção está desabilitada; credenciais/JWKS/revogação remotos NÃO homologados. Inventário anterior182/184 e10/16 pertencem exclusivamente à arquitetura anterior. Nova matriz por47 operações e testes/frontend/hosting ainda pendentes neste checkpoint.

Retomar pelo resultado de /tmp/cosmaker-spark-integration.log e infrastructure/spark/run-integration.mjs; depois comparar viabilidade de arquivos/hosting antes de expandir migração. Preservar arquivos antigos, não publicar esta prova.


Segundo checkpoint:14/14 cenários Emulator/workerd reais passaram em /tmp/cosmaker-spark-integration-extended-3.log. Inclui transação/retry e saldo financeiro/auditoria única, ACL/revogação, bytes/hash/ETag/leases, falha parcial após PUT real com mudança do pedido, compensação por retomada sem delete, quota global/tenant/tráfego e round-trip de snapshot RTDB privado. Snapshot é de namespace sintético, não restauração operacional completa Auth/Firestore/RTDB. Testes não simulam respostas Firebase: hook de concorrência encaminha requisições reais com fetch oficial do Miniflare e apenas altera o pedido após PUT real.

Bloqueio concreto de transporte: JSON contendo Base64 de20MiB recebe400 no RTDB Emulator, sem gravar o caminho; limite oficial de string10MB exige outro desenho para os20MiB. Medida Linux do processo workerd (ticks10ms, inclui runtime/proxy e não é CPU faturável da borda):64KiB20/20ms upload/download;1MiB30/40ms;6MiB140/50ms, RSS final~182MB de processo. RSS não é heap do isolate128MB. Não converter estas aproximações em aceite ou prova de impossibilidade de todo desenho alternativo. Controle Free real e compressão segura permanecem pendentes. Transportes de arquivos e47 operações não aprovados.

Preview OpenNext gerado em Next15.5.28 com adaptador1.20.13, sem R2. Bundle11061,72KiB/gzip1882,04KiB,284assets. Primeira inicialização500/EvalError por protobuf do SDK Node do Firestore, investigação ativa no próximo checkpoint. Não é aceite de hosting.


Terceiro checkpoint: frontend técnico Next /spark-proof e proxy opt-in a Worker local. OpenNext15.5.28/1.20.13 gerado/preview, sem R2; primeira falha por eval de protobufNode foi corrigida com alias SSR opt-in para distribuição web do SDK (não Lite). Default Next preservado/testado; hash contextual do next.config atualizado com aviso explícito de escopo antigo no inventário, sem promover critérios Spark. Build usa scripts/dev-local.mjs, pois build sem config Firebase não valida Auth: primeira tentativa UI falhou com authnull, corrigida e retestada.

Playwright4/4 PASS em320/375/768/1440,9,2s, com4entradas/auditorias canônicas confirmadas por SDK no mesmo Firestore Emulator. Não é jornada das47operações. Unitários da adaptação5/5 (inclui matriz/default de config); tsc/lint direcionado/docs:check PASS. Integração14/14 após patches e métricas. O CI anterior28e3c4a teve LinuxPASS/WindowsFAIL (URL.pathname produzia /D:/... no esbuild); agora usa fileURLToPath e aguarda novoCI. Não esconder a falha histórica.

Patches nos subprojetos:undici7.30.1,postcss8.5.31,glob10.5.0,adm-zip0.6.1; ambos npm audit0. Sem auditfixforce/Next16/alteração de dependências raiz. OpenNext completo após patches PASS. Bundle final10400,99KiB/gzip1736,74KiB,284assets; backend40,46KiB/gzip11,61KiB.

Medição final local de processo, não CPU faturável/heap: arquivos64KiB20/20ms,1MiB30/30ms,6MiB90/50ms upload/download;18/19subrequests. Hosting após warmup,10requests/rota:41ms /,26ms /login,14ms /spark-proof por request, somando dois processos do preview; RSS agregado não é memória do isolate. Não aprovar10msFree por estes resultados. Artefatos privados .local/spark/resources.json e hosting-resources.json ignorados.

Matriz47 e mapa101Functions versionados, baselinecongelado e rollbackcandidata preservados. Nenhuma operação inteiraSpark aceita;7parciais retêm evidência da prova. Migração fica interrompida antes da substituição por falta de equivalência de arquivos/recursos. Isto é impedimento do desenho/protótipo atual, não afirmação de que todo projeto gratuito é impossível. Alternativas gratuitas documentadas, não provisionadas nem anunciadas como equivalentes. Próximo passo exato: provar transporte de arquivos que preserve20MiB/compressão/quotas/CPU dentro doFree, ou alternativa gratuita semR2; só depois portar outroshandlers e revalidar47operações. Autorização atual não inclui deploy/IAM/contas/secrets reais.
