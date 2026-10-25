# GOAL VII — prova de mídia privada de 20 MiB

**VALIDADO LOCALMENTE / SUBSTITUIÇÃO BLOCKED / NOT_READY.** Base `d659faa40bd8dff3929daac2f6a39aa47bccea19`, branch isolada `codex/cosmaker-goal-vii-media-lifecycle`. Flags OFF, sem cutover. Candidatas GOAL V/VI preservadas. Prova local não homologa serviço hospedado, custo ou produção.

## Evidências

35 cenários distintos aprovados: 9 unitários/guards, 15 integrações Auth/Firestore/RTDB Emulator/workerd, 4 testes do Storage OSS oficial e 7 E2E. Não soma retestes. Build Next 15, TypeScript/lint integrado, lint direcionado sem warnings, inventário histórico e audit do novo pacote (zero dependências e vulnerabilidades) passaram. Resumos, comandos e hashes dos logs em [EVIDENCE.json](media-lifecycle/EVIDENCE.json). CI precisa ser conferido no SHA exato.

RTDB real: 20.971.520 bytes em 40 partes de 512 KiB, manifesto imutável, SHA por parte e global, reserva global/tenant, lease/fence, replay e leitura staff/cliente explicitamente compartilhada. A/B e membership revogada negados. Matriz 0/6/19,99/20/20+1 MiB exercitada. SVG/GIF/ZIP não aceitos no contrato atual; nenhum ZIP é extraído. JPEG/WebP usam fixtures de assinatura: não comprova renderização completa. Nenhum asset de docs ou arquivo real utilizado.

Double HTTP/TUS identificado: 20 MiB interrompidos após 6 MiB, HEAD/PATCH resume e hash na leitura. Não é RLS ou billing real. Signed download prévio continua utilizável após revogação do broker até TTL no double; evidência de limitação, não PASS de revogação imediata. Downloads normais usam gateway autenticado, sem token permanente.

Storage OSS **oficial**, Docker local: bucket privado e RLS sem políticas permissivas; PostgreSQL somente para metadados internos do Storage. 4/4 testes transferiram 20 MiB por signed TUS, retomaram após 6 MiB, conferiram SHA, negaram público/anon/authenticated, chave cruzada, capability forjada e sobrescrita, e recusaram 20 MiB+1 com 413. Exclusão só da chave sintética pela API Storage, jamais SQL. Não houve conta/projeto Supabase hospedado ou migração do banco de negócio.

Protocolo comprovado no OSS fixado: `/upload/resumable/sign` com `x-signature`. Endpoint comum recusou por autorização/RLS; não relaxamos permissões. POST pode criar sessão para chave existente; PATCH deve recusar e preservar o hash anterior. Correspondência do gateway hospedado, CORS no browser, Firebase JWT/claims e revogação/cache hospedados NÃO TESTADOS NO PROVEDOR. Claim `role:authenticated` não torna memberships Firestore visíveis ao RLS. O broker mantém autoridade sobre UID, tenant e pedido.

Imagens fixadas: Storage `sha256:7112e91307968d3eceffb5228291202d7bac8015a27af25d4b5a4b0543eadf22`; PostgreSQL `sha256:f4610795587492cd4fb887c2dc3de301b813278bb6f616992061141b5f15ac36`. Storage oficial Apache-2.0 ativo na consulta de 25/10. Nenhuma biblioteca comunitária de Storage adicionada; review incremental não é scan completo de CVEs/SBOM das imagens.

Backup incluiu metadados e os 20 MiB originais, snapshot hash, interrupção após 3 partes, retomada em nova geração, leitura autorizada exata e datas/classificação preservadas. Reserva órfã só libera após ausência positiva. Tombstones impedem restore e leitura inconsistente. Crash entre API de exclusão sintética e commit retoma sem decrementar meters duas vezes. **Restore Supabase nativo e coleta automática de PENDING abandonado não aceitos**; reservas falhas permanecem conservadoras.

Retenção: só TEMP_WORKFLOW; HIGH 30+7 / MEDIUM 90+14 dias após conclusão canônica de todos os vínculos. Fixos, contratos, docs, legados, hold e pedidos abertos não expiram. Subida imediata, descida após duas janelas fechadas com fatos persistidos, sem encurtar promessa inclusive ao passar por LOW. Avisos internos para todos os destinatários; falha adia exclusão e limita uploads opcionais. Lease, retry, cursor entre dias, 110 registros inválidos e revisão de extensão testados. Evento scheduled workerd chamou endpoint secreto DRY_RUN. **Processamento no broker Node local: não comprova implementação integral Workers Free.**

UI técnica `/api/media-proof/lab`, gated demo+flag, usa persistência real RTDB/Firestore: 320/375/768/1440 px, upload/download 20 MiB com SHA no navegador, erro de tamanho, classificação/prazo/tolerância/avisos. Prévia PNG opt-in com dimensões limitadas antes de decode, original preservado; não usa transforms Pro. Platform Owner pausa novos uploads sem mudar planos/TTL ou leituras. Smoke das rotas antigas `/` e `/login`. Não migra componentes comerciais nem habilita TUS hospedado no browser.

Tentativas preservadas: seletor alert corrigido por também encontrar o anunciador Next; teste global 30 s excedido durante compilação de rotas antigas. Os 5 E2E de upload passaram e avisos/governança tiveram reteste isolado 2/2 com 90 s; a execução combinada inicialmente falha não é declarada 7/7. Reteste adicional Docker excedeu startup de 90 s sob carga concorrente; recursos próprios removidos, lançador passou a 300 s/limpeza de Created, e reteste oficial 4/4 passou. Timeout não foi convertido em skip.

## Comparação e capacidade

Fontes oficiais verificadas em 25/10/2026: [Firebase Spark](https://firebase.google.com/pricing), [Supabase preços](https://supabase.com/pricing), [limite por objeto](https://supabase.com/docs/guides/storage/uploads/file-limits), [TUS](https://supabase.com/docs/guides/storage/uploads/resumable-uploads), [Firebase Third-Party Auth](https://supabase.com/docs/guides/auth/third-party/firebase-auth), [backup](https://supabase.com/docs/guides/platform/backups), [Workers limites](https://developers.cloudflare.com/workers/platform/limits/).

| Critério | RTDB Spark chunked | Supabase Storage candidato |
| --- | --- | --- |
| 20 MiB privado | Emulator real, 40 partes e SHA | Serviço OSS oficial local/TUS; hospedado não testado |
| Armazenamento global publicado | 1 GB; Base64 ≥ 4/3 + JSON | 1 GB; objeto Free até 50 MB; bucket da prova 20 MiB |
| Egress publicado | 10 GB/mês, inclui protocolo | 5 GB uncached + 5 GB cached; não presumir cache para privados |
| Concorrência | 100 conexões; reservas Firestore | Reservas Firestore; signedcap reserva teto 20 MiB inclusive para arquivo menor |
| Verificação local | 41 reads de provedor para 20 MiB | 41 reads por Range; upload direto em 4 chunks TUS |
| RBAC | Broker canônico, RTDB direto deny-all | Broker + bucket privado; RLS não consulta Firestore sozinho |
| Revogação | Revalidação antes de liberar bytes | Broker revalida; signedURL prévia tem janela TTL/cache |
| Backup | Metadados+bytes 20 MiB restaurados localmente | Backup DB não contém blobs; restore nativo pendente |
| Pausa/transformações | Limites Spark, sem transform servidor | 2 projetos Free ativos, pausa após 7 dias inativos, transforms fora do Free |
| R$ 0 sem billing | Catálogo Spark; execução só Emulator | Oferta pública $0; conta/cartão/eligibilidade não verificados; nenhum projeto criado |

Workers Free publica 10 ms CPU, 50 subrequests, 128 MB e 100 mil requests/dia; espera I/O não é CPU. O broker Node não impõe orçamento agregado de uma invocação Worker. Jornada RTDB inicial: 332 requests Firestore; revisão final: 340, mais chamadas do provedor, conforme ledger. Não são 340 numa única requisição, mas verificação de 41 reads mais Auth/transação pode ultrapassar 50 na conclusão. CPU, memória agregada e modelo de verificação no Free continuam BLOCKED; tempo de parede local não é CPU faturada.

Hipótese explícita: 1 GB = 1.000.000.000 bytes conservadores, projeto vazio, 2 uploads de 20 MiB/dia por tenant, sem outros dados ou deletes antecipados:

| Tenants | Supabase dias até 1 GB | RTDB dias até 1 GB (Base64, sem JSON) |
| ---: | ---: | ---: |
| 1 | 23,84 | 17,88 |
| 5 | 4,77 | 3,58 |
| 20 | 1,19 | 0,89 |

Todos saturam antes dos 37 dias do primeiro HIGH+grace. Com MEDIUM ou mídia persistente, pressão maior. Admission suspende antes: 70% alerta, projeção 80% limita opcionais, 90% suspende. Ensaio com 21 tenants × 2 reservas: 28 admitidas, 14 recusadas, 784.198.352 bytes pendentes RTDB, nenhum objeto apagado. Limitação real da proposta, sem inventar cotas comerciais ou diminuir o contrato. Egress também é finito; estimativas locais não são telemetria faturável.

## Decisão e retomada

[Inventário](media-lifecycle/MEDIA_INVENTORY.json): 37 fontes anteriores com hashes preservados e 14 fluxos classificados. [Matriz de 47 operações](media-lifecycle/OPERATIONS_47.json): anterior/GOAL VI/GOAL VII separados, nenhuma operação inteira promovida. [Gates](media-lifecycle/ACCEPTANCE.json): **0/7 aceitos para cutover; 6 parciais e 1 bloqueado**. Não zera o trabalho parcial nem herda 182/184 (98,91%) e 10/16 (62,5%) da stack antiga.

Próximo passo: definir estratégia verificável de capacidade e verificação/autorização dentro do Free antes de migrar. Pendências locais explícitas: restore Supabase nativo, coleta de órfãos, leitor dual/rollback de 20 MiB e TUS no browser. Dependências externas: conta Free/quota efetiva, identidade/JWKS/secrets mínimos, gateway/CORS/RLS/cache, índices reais, cron/CPU/telemetria, recuperação operacional e jurídico. Nenhum recebe PASS por esta prova. Não portar outras Functions com gate aberto.

Reprodução, estados, backup e retorno: [runbook](../operations/MEDIA_RETENTION_DRY_RUN.md). Fonte global aplicada é o snapshot autorizado do TXT; arquivo 77 externo ausente foi registrado sem inventar seu conteúdo e sem solicitar confirmação.
