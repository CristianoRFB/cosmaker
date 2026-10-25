# Next15/OpenNext — prova isolada de hosting

Não executa deploy, provisionamento ou R2. Build somente demo-cosmaker. Preserva App Router/Next15.5.28 e o backend anterior; adaptador não torna as47operações portadas automaticamente.

```bash
bash scripts/cloud-run.sh npm ci --prefix infrastructure/hosting
COSMAKER_SPARK_BUILD=true WRANGLER_SEND_METRICS=false bash scripts/cloud-run.sh infrastructure/hosting/node_modules/.bin/opennextjs-cloudflare build --config infrastructure/hosting/wrangler.jsonc --openNextConfigPath infrastructure/hosting/open-next.config.ts
```

O build usa scripts/dev-local.mjs, força config fictícia e herda o output standalone do OpenNext. Não usar --skipNextBuild com um .next comum que não tenha standalone. Sem preview rodando durante build. Configuração Next normal permanece sem alias; opt-in escolhe a distribuição web do SDK Firestore SOMENTE no SSR experimental. A distribuição Node traz gRPC/protobuf com geração dinâmica de código, recusada no Worker. Não há patch de eval nem substituição pelo Firestore Lite que removeria recursos do cliente.

Configurar arquivo privado infrastructure/hosting/.dev.vars (ignorado), exclusivamente para o teste:

```text
COSMAKER_SPARK_PROOF=true
COSMAKER_SPARK_ORIGIN=http://127.0.0.1:8787
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-cosmaker
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

Preview em um terminal; em outro, harness que inicia Auth/Firestore/RTDB e Worker8787, sem Functions/Storage:

```bash
WRANGLER_SEND_METRICS=false bash scripts/cloud-run.sh infrastructure/hosting/node_modules/.bin/wrangler dev --local --config infrastructure/hosting/wrangler.jsonc --port 8788 --ip 127.0.0.1
bash scripts/cloud-run.sh node infrastructure/spark/run-integration.mjs ui
```

Caso de UI em320/375/768/1440 verifica login sintético, identidade Workspace via Worker/REST, despesa canônica e ausência de overflow. Harness exige4entradas/auditorias reais no Firestore Emulator; não basta toast. O teste fica explicitamente SKIPPED fora deste harness, para não exigir infraestrutura experimental na regressão antiga.

Página /spark-proof e proxy /api/spark-proof só existem com três gates: flag opt-in, projeto demo e emuladores. Proxy recusa destinos não loopback, caminhos fora da allowlist, redirects e bytes acima6MiB. Não passa tokens por query nem deixa disparar scheduler HTTP. Não é uma tela comercial nova nem substitui painéis antigos.

```bash
bash scripts/cloud-run.sh node infrastructure/hosting/measure-local.mjs
```

Medição Linux somente leitura exige exatamente dois processos workerd deste subprojeto. Aproxima CPU/RSS de processos locais; não mede CPU faturável/heap do isolate nem impõe10ms. Não publicar ou aceitar hostingFree por esse ensaio. Arquivos gerados .open-next/.wrangler/.local ficam fora do Git. Rollback local: encerrar preview, remover flag experimental do processo e voltar à candidata preservada; não houve migração ou deploy a reverter.
