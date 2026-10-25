# GOAL VII — operação sintética, retenção e recuperação

**NOT_READY. Flags OFF. Nenhum cutover, agendamento remoto, migração ou live delete autorizado.**
O broker desta prova é Node local. O Worker executa somente o transporte privado do evento scheduled para esse broker; isso não é uma solução completa Workers Free.

## Preparar e repetir somente a superfície necessária

Checkout: `codex/cosmaker-goal-vii-media-lifecycle`. Node 22 e Java 21, dependências já previstas da raiz/Functions/Spark. `infrastructure/media` não acrescenta dependências npm. Não executar login, deploy ou provisionamento. Todos os lançadores de prova fixam `demo-cosmaker`, Auth/Firestore/Database em loopback e regras RTDB deny-all. Não rodar os comandos simultaneamente nas mesmas portas.

```bash
bash scripts/cloud-run.sh npm --prefix infrastructure/media test
bash scripts/cloud-run.sh node infrastructure/media/run-integration.mjs
# Só o ensaio Auth/broker/cron alterado:
bash scripts/cloud-run.sh node infrastructure/media/run-integration.mjs security
# Só integridade/lease e retomada após atualização legítima do pedido:
bash scripts/cloud-run.sh node infrastructure/media/run-integration.mjs transfer
# Só atividade fechada + capacidade agregada de 21 tenants:
bash scripts/cloud-run.sh node infrastructure/media/run-integration.mjs activity
# Interface e persistência reais no Emulator, com Next local:
bash scripts/cloud-run.sh node infrastructure/media/run-integration.mjs ui
# Reteste isolado de avisos/governança, sem repetir os quatro uploads grandes:
bash scripts/cloud-run.sh node infrastructure/media/run-integration.mjs ui-notices
# Docker Linux local, Storage OSS oficial; sem projeto Supabase hospedado:
bash scripts/cloud-run.sh node infrastructure/media/run-native.mjs
```

No Windows com Node 22/Java 21 já preparados, usar `node infrastructure/media/run-integration.mjs` e `npm --prefix infrastructure/media test` em PowerShell, sem o prefixo Bash. O lançador Docker usa o socket Unix e foi validado apenas no Linux; não é anunciado como compatível com Docker Desktop/Windows. CI Windows cobre política e guards, não esse runtime Docker.

Portas sintéticas: Auth19099, Firestore18080, Database19000, hub14403, logging14404, websocket9150; UI3107; Storage OSS15400 publicado apenas em127.0.0.1. Serviço ocupado → parar e identificar; não matar processos de outro projeto. `run-native` cria seus próprios containers com nomes aleatórios e os remove após o teste. Arranque frio pode levar minutos; prazo5min, sem tentativas infinitas. Falhas de startup continuam falhas, não skips/PASS. Para instância criada manualmente e com manifesto próprio presente: `node infrastructure/media/test/local-supabase.mjs --stop`. Esse comando valida caminhos/nomes locais antes de remover somente os recursos sintéticos próprios. Nunca usar Docker prune.

## Política e fontes de autoridade

Classificação vem do domínio servidor. Só TEMP_WORKFLOW pode ser candidato. PNG/JPEG/WebP de referências/fotos são temporários; documentos PDF são PROTECTED_REGULATED. Marca, avatar e portfólio publicado são persistentes. TEMP_DERIVED não recebe TTL genérico nesta versão. UNKNOWN_LEGACY, documentos regulados, legal hold, arquivos docs versionados e vínculos abertos/desconhecidos nunca são removidos pela política genérica.

Contagem vem dos fatos de upload confirmado no Firestore; leitura/download não renova. Subida é imediata. Fechamento processa até duas janelas UTC de30dias por invocação; descida só após duas janelas fechadas consecutivas abaixo do limiar. Tenants sem atividade não ganham registro NONE artificial. Consulta limitada a30fatos já determina HIGH; abaixo disso soma todos os bytes. Concorrência de upload invalida a versão da apuração antes de persistir o novo nível. Índices propostos isolados em `infrastructure/media/firestore.indexes.proposed.json`; Emulator não comprova índices reais instalados.

HIGH:30dias após a última conclusão canônica entre todos os vínculos +7dias de tolerância. MEDIUM:90+14. LOW/NONE:sem auto-delete. Nunca encurtar promessa anterior, nem após transição intermediária LOW/hold. Aviso prévio e aviso de vencimento exigem registro interno para todos os destinatários canônicos ativos. Não são e-mail/WhatsApp entregue. Falha mantém arquivo e restringe novos uploads opcionais. Novo destinatário/prazo exige novo aviso e tolerância; replay da mesma decisão não cria nova auditoria.

Cursor do sweep sobrevive à meia-noite, evita starvation por100+legados inválidos e guarda lease. Links malformados ficam protegidos. O cron não tem acionador público: fetch do Worker404; endpoint interno do broker exige segredo sintético, loopback e horário até60s do relógio de teste. Segredo nunca vai para UI/Git. O modo retornado é sempre DRY_RUN. O executor de remoção física só existe para ensaios com `SYNTHETIC_APPLY`, provider local, projeto demo e fixture marcada; nenhum endpoint permite ao navegador executá-lo.

## Estados, retry e falha parcial

Reserva global/tenant precede bytes: PENDING + lease/fence → verificação de tamanho/SHA-256/magic bytes → READY e fato/auditoria únicos. Pedido e membership são revalidados antes da publicação. Retry idempotente exige mesmo fingerprint; outro conteúdo não sobrescreve. Mesmo20MiB+1 é rejeitado; sem truncamento. MIME/magic não são varredura antivírus nem prova de renderização de todo documento. Downloads são attachment/nosniff/no-store.

Metadados e bytes não compartilham ACID. PENDING falho continua privado e reserva conservadora não é liberada por timeout de rede. `reconcile` tenta finalizar somente com lease e autorização válidos. Uploads abandonados exigem inventário/expiração de capabilities/ausência positiva antes de liberar capacidade. **Coleta automática de PENDING abandonado ainda não aceita; não liberar por idade nem apagar antecipadamente.**

Plano de retenção captura revisão. Extensão/hold/pedido reaberto invalidam a decisão. Antes da remoção sintética a capability precisa estar expirada; DELETING+tombstone precedem a API, impedindo restore/replay. Crash após API retoma o mesmo fence e contabiliza uma vez. Remoção Supabase é Storage API, jamais SQL. Objetos legados não são alvo deste ensaio; [inventário sintético de tokens anterior](../implementation/security/SYNTHETIC_TOKEN_INVENTORY_2026-10-24.json) é preservado e não comprova revogação real.

## Backup e restauração

`backupMedia` exporta, em memória, metadados sintéticos e os bytes originais, SHA do objeto e checksum do snapshot. Somente READY/demo, provider local e staff autorizado. Nunca versionar o JSON com Base64, manifests privados, tokens ou traces. Backup de PostgreSQL/Firestore sozinho não contém os objetos.

`restoreMedia` é DRY_RUN por padrão. Aplicação só sintética RTDB, mesmo tenant/provedor, autorização atual, metadados imutáveis compatíveis e nenhum tombstone. Reserva adicional vem antes da escrita; usa nova geração, RESTORING, chunks imutáveis e verificação completa. Retry após interrupção usa o mesmo identificador. Preserva datas, classe e extensões vigentes; snapshot antigo não regride política. Reserva do objeto anterior permanece até `reconcileRecovery` comprovar ausência, nunca por erro HTTP. Tombstone proíbe ressurreição. A prova restaurou os20MiB, não apenas documentos. **Restore Supabase nativo, inventário de órfãos no serviço hospedado e recuperação operacional real continuam não aceitos.**

## Capacidade, parada e retorno

Meter agrega ativos+reservas e consumo por tenant.70%alerta; projeção80%limita novos uploads opcionais;90%suspende novos envios. Falha de aviso também limita opcionais. Platform Owner pode pausar uploads, sem apagar, baixar TTL, alterar planos ou impedir leitura por essa pausa. Downloads reservam orçamento mensal antes da leitura; falha mantém reserva até revisão. Contadores são estimativas locais separadas de telemetria faturável, inexistente no ensaio; não há alegação de contabilização exata do serviço hospedado.

Limite1GB é global, não1GB por ateliê. Proposta comercial futura: compatibilizar capacidade real, crescimento e retenção antes de aceitar clientes; nenhuma cota Essencial/Pro/Premium é criada aqui. Quota cheia deve preservar dados e explicar a suspensão, nunca acelerar vencimentos.

Rollback pré-cutover: flags `COSMAKER_MEDIA_PROOF` ausentes/false (rotas404), conservar leitura/anexos da candidata anterior e GOAL VI. Namespaces proof/mediaV7/mediaAssetsV7 não substituem referências legadas.37hashes de código anterior são conferidos em teste; duas rotas públicas antigas passam no smoke. Não existe migração de referências a desfazer. **O adaptador antigo6MiB não passa a ler os20MiB novos automaticamente**: uma migração futura exigiria leitor dual, inventário de gerações e rollback byte-a-byte antes de cutover. Não apagar os objetos da prova por TTL de negócio.

Os sete gates cumulativos e bloqueios estão em [ACCEPTANCE.json](../implementation/media-lifecycle/ACCEPTANCE.json). Sem todos aceitos, não avançar para portar outras Functions nem declarar equivalência comercial.
