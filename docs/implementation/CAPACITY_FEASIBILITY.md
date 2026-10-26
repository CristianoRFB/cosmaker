# GOAL VIII — capacidade Free e decisão de viabilidade

**PROVA LOCAL CONCLUÍDA; MIGRAÇÃO BLOCKED / NOT_READY.** Referência remota inicial `06b9241e987829ac96eb206998ba740fabdf8796`, CI40223757231 aprovado. Branch isolada `codex/cosmaker-goal-viii-capacidade-free`; candidata antiga e GOAL VI/VII preservados. Revisão26/10/2026. Sem conta nova, cartão, billing, deploy, R2 ou dados reais.

## Modelo reproduzível

`infrastructure/feasibility` implementa um simulador puro sem novas dependências. [127 cenários](capacity-free/SCENARIOS.json), com [CSV compacto](capacity-free/SCENARIOS.csv):5provedores×1/5/20tenants×0/1/2/5arquivos/dia×20MiB/mistura=120, mais7stress (órfãos, aviso falho, holds, permanentes, crescimento, LOW e fluxo aberto). O primeiro checkpoint tinha125; foram acrescentados2cenários explícitos deLOWpermanente/fluxo aberto, sem mudar métricas funcionais congeladas ou contar cenários matemáticos como testes de software.

Cada arquivo é original de20*1024*1024bytes ou padrão determinístico1/2/4/8/20MiB. Mesma política canônica de classificação/retentionFor/updateActivity doGOALVII, sem alteração. Upload não vira data de conclusão: fluxo fecha após14dias assumidos; avisos e tolerância precisam terminar, mais1dia de atraso de processamento. HIGH30+7, MEDIUM90+14, LOW/NONE sem auto-delete, holds/protegidos/fixos/desconhecidos protegidos. PromessaMEDIUM não encurta apósHIGH. Queda de tier pode impedir limpeza de dados que se esperava temporários; é comportamento conservador do contrato, não capacidade recuperada automaticamente.

São hipóteses sintéticas, **não telemetria de clientes**. CadaJSON contém seus parâmetros:180dias para120cenários,365para7stress; crescimento20%a cada30dias no stress; mistura com preview64KiB, versão extra a cada10uploads, protegidos a cada20, fixos a cada25, hold a cada40 e legado desconhecido a cada50. Classes se sobrepõem com precedência documentada no código. Nenhuma imagem original é comprimida/perdida para caber. Defaults incluem1cópia de backup na mesma quota. A janelaLOWusa1arquivo1MiB/30dias, não tenta chamar deLOWuma carga que éHIGH.

Demanda sem limite e admissão guardada rodam separadamente. Rejeições mudam a atividade e os prazos: não reutilizar o tier da demanda ideal para justificar deletes no cenário limitado. p95 é nearest-rank das ocupações diárias projetadas; não representa95%de confiança nem pode substituir reserva para o pico. Day0 é o primeiro dia do horizonte. O simulador não chama provedores nem faz exclusões reais.

## Inventário dos bytes

| Categoria | Contabilização |
| --- | --- |
|Originais|Todos os bytes inteiros, sem truncamento;RTDB incluiBase64por parte e overhead conservador de manifesto/JSON |
|Previews|0no cenário20MiB;64KiBno cenário misto, explicitamente armazenado no modelo. A prévia doGOALVII era local no browser; não fingir que já há armazenamento real dessa cópia |
|Versões ocultas|Cópias adicionais separadas; por padrão excluir o nome atual não libera versões anteriores |
|PENDING|Reserva integral antes do upload; startup/concurrency explicitável. Expiração de lease não é prova de ausência de bytes |
|Órfãos|Reserva conservadora permanece enquanto reconciliação não foi provada; não conta como bytes certamente armazenados para ganhar franquiaB2 |
|Backups|Cópia de bytes além de metadados, na mesma quota por default; opção fora da quota é contabilizada à parte e exige outro destino privado/capacidade real, não armazenamento gratuito infinito |
|Firestore|Metadados/auditoria/avisos/índices têm quota independente. Fixture mínimo medido330bytesJSON, não tamanho faturável nem schema completo. Fórmula separada:Nassets×m_asset+Naudits×m_audit+Nnotices×m_notice+índices/tombstones; essesmreais permanecem desconhecidos, sem subtrair do bucket ou guardarblobnoFirestore |
|Egress|Leitura para verificação+download+backup, leituras recorrentes opcionais e overheadRTDB. Estimativa separada de telemetria faturável inexistente |
|Conta/provedor|Quota global inclui todos os tenants/projetos e usos externos da conta, que precisam de inventário futuro; não multiplicar1GBpelo número de ateliês nem criar contas para contornar franquias |

## Resultados de referência

Todos abaixo assumem backup1cópia e fechamento14dias; mistura usa as hipóteses anteriores. Bytes são demanda requerida, **não uso real autorizado acima da quota**.

| Provedor/volume | p95 requerido | Primeiro bloqueio no modelo guardado |
| --- | ---: | ---: |
|Supabase1tenant×1original20MiB/dia|2181038080|Day19|
|Supabase20×2originais20MiB/dia|87241523200|Day0|
|B2hipotético1×1original20MiB/dia|2181038080|Nenhum por storage em180dias; billing/egress continuam condicionais|
|B2hipotético5×2arquivos mistos/dia|17869701120|Day42|
|B2hipotético20×1arquivo misto/dia|35812933632|Day20|
|B2hipotético20×2originais20MiB/dia|87241523200|Day4|
|ImageKit1×1original20MiB/dia|2181038080|Nenhum por storage em180dias; outras garantias não aceitas|

O modelo mantém o20MiB e bloqueia novas reservas explicitamente antes de80%para uploads opcionais;70%alerta,90%é limite superior de suspensão. Não apaga antecipadamente para baixar percentual. Os guardados continuam permitindo leituras enquanto orçamento/serviço permitir, mas quota de egress pode interrompê-las. Reserva precisa usar pico atual mais backups/versões/pendentes, não média oup95. Foram modeladas retentativas/falhas conservadoras; nenhuma promessa de quota efetiva do provedor foi inventada.

Há **envelopes pequenos matematicamente úteis**, não aprovação comercial. Upper bound em steadyHIGH:

`r_global <= (0,8*C - fixos - pendentes - versões - órfãos)/(E[bytes físicos]*L_efetivo*cópias)`

`r_tenant <= r_global/N`

A saída inclui esse limite otimista comL=51dias e reserva de2originais20MiB/tenant. RTDBusa bytes físicos codificados, não20MiBcrus. Não é taxa garantida na fase inicialMEDIUM(pode exigir118dias incluindo fluxo), comholds/LOW/avisos falhos ou legado desconhecido. Qualquer quota/uso desconhecido deve impedir nova admissão até reconciliação. Não é entitlement Essencial/Pro/Premium. Não existe taxa comercialmente aprovada neste documento.

Para crescimento líquido positivo mínimo `g` bytes/dia: `U(t)>=U(0)+t*g`; logo qualquer capacidade finitaCatinge o limite em no máximo`ceil((C-U(0))/g)`. Comg=0e todos os temporários fechados/deletáveis em prazo máximo conhecido, throughput repetido pode caber; isso é diferente de crescimento ilimitado de dados retidos. LOW, contratos, holds e versões sempurgetornam falsa a hipótese de saída garantida. Um horizonte de180/365dias sem bloqueio não comprova sustentabilidade infinita.

## Provedores e custo estrito

Fontes e decisões detalhadas, comURLs/data, em [PROVIDERS.json](capacity-free/PROVIDERS.json). Documentação pública não é estado comprovado de uma conta.

| Candidato | Oferta/documentação | Decisão deste GOAL |
| --- | --- | --- |
|Supabase|1GBdecimal,5GBuncached+5GBcached,2projetos ativos, pausa após7dias;Freecom grace/restrições após excesso|CONDITIONAL. Não somar cached ao orçamento privado uncached. Cadastro sem cartão e hard-stop/read preservation não foram comprovados na conta |
|RTDBSpark|1GB/10GBdownloadsmês/100conexões; sem pagamento paraSpark, serviço pode desligar ao excederquota|Elegível por documentação; capacidade/operabilidade comercial bloqueadas no volume de referência, sem promoçãoHosted.1GBmodelado conservadoramente decimal |
|BackblazeB2|Primeiros10GB, cadastro sem cartão documentado; egress3×média mensal ou parcerias;caps monetários levam até10min, classeDnãoélimitável|CONDITIONAL, sem novo adaptador. Confirmar zero accrual/hard-stop sem cartão e inventário de versões/unfinished uploads antes de considerar consistente |
|Tigris|5GB=5×2^30bytes, sem cartão para iniciar, egress publicado grátis,10kA/100kB/mês; excesso de storage/requests medido e cobrável|BLOCKEDcomo zero-billing estrito: franquia não prova teto de cobrança; nenhum hard-stop/no-liability confirmado |
|ImageKit|3GBDAM/20GBbandwidth, sem cartão segundo página oficial; SDKoficialdocumenta25MBparaimagem/raw/áudio (maior que20MiB)|CONDITIONAL: fixos deFree e parâmetros não comprovam toda política privada, resume, restore, versões, revogação ou excesso na conta |

B2tem [rota oficial privada comWorkers/Cloudflare e transferência gratuita](https://www.backblaze.com/docs/cloud-storage-deliver-private-backblaze-b2-content-through-cloudflare-cdn). É alternativa relevante para egress, não prova de expansão dos10GB, caps, CPU ou recuperação. O exemplo do fornecedor não fornece oRBACmulti-tenant doCosmaker e sugere cache público; **não copiamos nem aplicamos essas partes**. Todo acesso privado continuaria exigindo autorização canônica atual e cache privado/no-store. Nenhuma parceria/routing/billing foi provisionada.

A estimativaB2sem rota parceira divide bytes-dia pelo mês completo, incluindo zero fora do horizonte parcial e excluindo reservas de bytes não medidos. Não presumir30GBde egress para uma conta quase vazia, franquias adicionais não confirmadas ou ausência de cobrança apenas porque falta cartão. A colunaegressGuardModelidentifica onde não foi provado cap fixo; null/blank não significa egress seguro ilimitado. Exposição calculada é hipótese conservadora, não fatura real. Name-delete/hide pode deixar versões cobrando: eventual adaptador deve paginar versões/fileIDs, unfinished parts, ObjectLock e tombstones, com reconciliação apósAPI, semSQLou lifecycle genérico que antecipe promessa.

R2excluído. Nenhuma soma de múltiplas contas, bucket público, segredo no browser, gateway pago, armazenamentoFirestoreBase64ou downgrade de original foi proposto como saída.

## Decisão

Não foi comprovado candidato completo que una volume de referência, zero billing estrito,20MiBprivados, execuçãoFree e recuperação/rollback. [Orçamento workerd](FREE_RUNTIME_BUDGET.md) reduziu chamadas e manteve integridade/autorização em diagnóstico, masCPU/RAM/conta continuam sem aceite. A [matriz](capacity-free/DECISIONS.json) mantém0/7gates completos,6parciais/1bloqueado;35cenáriosGOALVII e182/184/10/16antigos são históricos separados.

Conforme itens14/15doTXT, **faseDnão executada**: sem novo adaptadorB2/ImageKit/Tigris, coleta dePENDING, restoreSupabase, TUSbrowser ou leitor dual apenas para inflar cobertura. Essas pendências continuam explícitas, não foram rebatizadas como todas externas.

Próxima ação objetiva: escolher uma carga real medida e obter, sob autorização separada, comprovação de conta sem cartão/billing, hard caps/ausência de dívida e preservação de leitura, eCPU/RAMHosted do caminho privado. Para envelopes que excedem os limites, é necessária decisão de produto/infraestrutura; nenhuma mudança comercial ou upgrade foi aplicado. Se os requisitos permanecerem como20tenants×1–5fotos20MiB/dia mais histórico protegido crescente, este candidato continuaBLOCKED. Código e evidências locais estão preparados; comercialNOT_READY.
