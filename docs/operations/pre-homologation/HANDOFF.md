# GOAL MASTER V — handoff operacional

HEAD inicial8ad4a981f4d97f0a868ada10f0a1e3fa934c1385. Código operacional publicado inicialmente em1ec68b32d896fd9234e174b164b7cb98d0d464eb; CI [40118304144](https://github.com/CristianoRFB/cosmaker/actions/runs/40118304144) PASS Linux e Windows, antes da correção posterior do scheduler. Código final9ec5c66cdd369b287a75b1f8f43ca660855dc25b, CI40120417689 PASS com124unitários e11operacionais em cadaOS. Candidata/evidências em [CANDIDATE.json](CANDIDATE.json) e topo do progresso; checkpoint documental posterior deve recuperar HEAD/CI viafetch. Repositório CristianoRFB/cosmaker, branch codex/cosmaker-master-finalizacao. Sem reset/force/merge/main ou operação Firebase real.

## A — resolvível no Cloud

PreflightPS7 e suas recusas, guards/dry-run de manutenção, preparação de deploy sem executor, manifesto/verificação de artefatos, snapshot sintético com checksums/UIDs e restore/ACL, correção de paginação do scheduler, documentação operacional/Windows/custo/publicação/retorno e validações proporcionais. Resultados e fechamento final registrados no progresso; não inventar novas funcionalidades para preencher trabalho. Nenhum módulo aprovado foi reimplementado.

## B — implementado/preparado aguardando teste real

Contratos de Auth/Firestore/Storage/Functions/Eventarc, uploads/GCS preconditions/generation, domínios/e-mails/OAuth, sessões/revogação/IAM, índices, host/headers/cache, backups e retorno real com metadados/tokens/UIDs/histórico. Procedimentos reproduzíveis e critérios de parada preparados; execução real NOT_RUN. Nada aprovado por default ou por simulação. Reconciliação de generations/tokens reais depende do inventário/restore isolado e aprovação, não é reescrita automática de histórico.

## C — dependência externa

- Política da instância Cloud ainda sem apis.google.com: não repetir Google antes de aplicada. Teste está pronto, 0PASS/1SKIPPED anterior preservado.
- CLI15.34.1 instalado/latest e dispatcher sem assinaturahttp: transporte scheduler continua BLOCKED. Paginação/concorrência são de lógica HTTP, não relógio real.
- Proibição de billing/R$0 impede produto completo Firebase: Functions/Storage/Scheduler e hospedagem/backup precisam decisão externa. Não ativar Blaze automaticamente.
- Identidade autenticada/projeto/custo/IAM/serviços reais, recuperação operacional, jurídico e publicação exigem próxima sessão autorizada no PC.
- Alertas moderados/warning upstream sem patch compatível identificado na consulta; não maquiar com override ou force.

## Indicadores e aceitação

Conclusão funcional182/184=98,91%; formal10/16=62,5%; comercialNOT_READY. F1.1–F1.9/F4 aceites locais preservados; F2/F3/F5/F6 parciais, F7 blocked e F8 não aceita. Este pacote operacional não altera esses marcos ou a versão canônica. **CÓDIGO LOCAL PRONTO PARA HOMOLOGAÇÃO. HOMOLOGAÇÃO REAL PENDENTE.** Nenhuma tarefa local concreta/reproduzível identificada no escopo permanece; o CI do HEAD recuperado deve ser conferido antes de operar. Este estado não garante ausência de bugs ou sucesso dos testes reais.

## Retomada exata no PC

Abrir [WINDOWS.md](WINDOWS.md). Decidir custo antes de implantação; recuperar branch/HEAD/CI; instalar ferramentas; preencher cópia privada do destino; preflight offline e, depois de autorizado, somente leitura remoto. Resolver seus BLOCKED e revisar gates manuais. Backups/restore antes de operação mutável. Seguir publicação e aceite na ordem; não redirecionar fixtures Emulator para real. Passos manuais estão no checklist, sem pedir segredos no chat.

Logs/evidências reais ficam privados em .local e fora do Git. Código/testes sintéticos/evidências sanitizadas no repositório. Os scripts cloud-*.sh continuam exclusivamente Linux; o guia PC usa sintaxe PowerShell7 e seu parser é validado por testes.
