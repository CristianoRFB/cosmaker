# Prova local de arquitetura Spark (incompleta)

Nenhum deploy/credencial real. `MODE=disabled` é o default e todo modo diferente de Emulator/loopback/demo-cosmaker é recusado. Não conectar este código ao frontend principal ou publicar enquanto a matriz de paridade estiver pendente. O transporte de produção/JWKS/OAuth de serviço não está habilitado.

Com Node22/Java21/dependências raiz e Functions já instaladas:

```bash
bash scripts/cloud-run.sh npm ci --prefix infrastructure/spark
bash scripts/cloud-run.sh npm --prefix infrastructure/spark test
bash scripts/cloud-run.sh node infrastructure/spark/run-integration.mjs
bash scripts/cloud-run.sh npm --prefix infrastructure/spark run bundle
```

O harness usa Auth/Firestore/Realtime Database Emulator e workerd local, sem Functions ou Storage. Ports exclusivos19099/18080/19000/14403/14404/9150 devem estar livres. O conversor `convertV4MiniflareOptions` é a API oficial do Miniflare5 incluído pelo Wrangler4.152, não patch do runtime. Compilação com nodejs_compat para a política monetária canônica que usa node:crypto. Testes de assinatura usam chaves RSA sintéticas em memória; Auth Emulator emite tokens unsigned e não comprova criptografia remota.

Arquivos usam namespace experimental `sparkFiles`/RTDB `spark`, não alteram documentos/objetos antigos. Candidato limitado6MiB, validação de prefixos MIME e SHA-256; não há ainda decodificador/compressor seguro. Limites de teste são infraestrutura sintética, não regras comerciais/quotas de planos. Falha parcial retém objeto/reserva e metadado pending, nega leitura e exige retomada/reconciliação. Não há GC destrutivo nem revogação global de URLs legadas.

Arquivos novos ficam privados para staff por default. Compartilhamento com cliente exige header x-visible-to-client:true por staff autorizado e participa do fingerprint; retry com escolha divergente é recusado. Não há UI de anexos comercial portada. A prova de frontend fica em /api/spark-proof/lab, sem capturar slug de tenant. Negativas raw verificam Permission denied com token válido, além do status HTTP.
