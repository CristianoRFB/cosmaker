# GOAL VI — adaptação Spark isolada (WIP)

Base preservada: cca4e23281afd4bcfcc5eb0dc69c38e8b641eba2, CI40121145818 aprovado. Branch nova codex/cosmaker-spark-zero-billing. Nenhum código/domínio/Rules/configuração Firebase anterior foi substituído. Sem deploy, provisionamento, credenciais reais ou billing.

Implementação experimental em infrastructure/spark: Worker local restrito a demo-cosmaker/loopback, identidade/Auth Emulator com consulta atual, verificador RS256/jose separado, adaptador REST Firestore com transação/retry, recordFinanceEntry e política monetária canônica, evento scheduled paginado/limitado, transporte privado RTDB com pending/ready, ETag, leases, hash e quotas experimentais. Não é aceite das47 operações nem equivalência do armazenamento anterior.

Primeiro checkpoint: bundle Wrangler dry-run39,80KiB;3/3 testes de assinatura/recusas/runtime aprovados. Integração real com Auth/Firestore/Database Emulator em execução; primeiros erros de configuração do harness corrigidos (paths e API Miniflare5 via conversor oficial), sem PASS antecipado.

Bloqueios de paridade conhecidos: candidato de arquivo6MiB não preserva20MiB do contrato atual; compressão/redimensionamento seguros não implementados; quotas RTDB globais/tráfego real precisam validação, não são entitlements comerciais. CPU10ms/50subrequests Free e SSR exigem medição. Produção está desabilitada; credenciais/JWKS/revogação remotos NÃO homologados. Inventário anterior182/184 e10/16 pertencem exclusivamente à arquitetura anterior. Nova matriz por47 operações e testes/frontend/hosting ainda pendentes neste checkpoint.

Retomar pelo resultado de /tmp/cosmaker-spark-integration.log e infrastructure/spark/run-integration.mjs; depois comparar viabilidade de arquivos/hosting antes de expandir migração. Preservar arquivos antigos, não publicar esta prova.
