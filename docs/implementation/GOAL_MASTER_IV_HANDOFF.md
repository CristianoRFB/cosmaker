# GOAL MASTER IV — continuidade técnica

**INCOMPLETO / WIP global.** Branch exclusiva codex/cosmaker-master-finalizacao, repositório CristianoRFB/cosmaker. Último remoto anterior a este checkpoint:67e94ea5ca3c6ea894ce318233cd0a2db7dc964b. Fazer fetch/confirmar HEAD e CI na retomada, preservar WIP. Somente demo-cosmaker, Node22/Java21, dados sintéticos; nenhuma operação Firebase real/deploy/IAM/billing/merge/force foi feita ou autorizada.

## Implementação atual

Upload público com capabilities/hash/expiração/bytes por servidor, Storage deny-all e leitores legados protegidos; transporte de produção anterior preservado. Portal Home/Perfil/Pagamentos, paginação52pedidos, medidas CRM≠UID, revisão de proposta, diretório global/Auth e assinatura conectados. Rotas públicas globais usam slug explícito; menu móvel e conteúdo informativo funcionais, textos jurídicos em homologação.

Corrigido reuso de e-mail nos leitores de pedidos: UID durável/CRM consistente obrigatório, incluindo arquivos/fotos/mensagens/pagamentos/revisões/aprovações. Legados sem vínculo são preservados para revisão deliberada staff, sem backfill automático por e-mail. Detalhe cliente migrou a getClientOrder; lista/detalhe compartilham allowlist. Root raw privado somente staff; snapshot completo de custos permanece no banco. PRIVATE_ORDER_SECURITY.md e auditoria JSON têm evidências dos dois achados críticos resolvidos localmente.

Lançador Linux acompanha sua árvore por PID+startTime e encerra PubSub destacado. Unitário e nove portas liberadas após runtime completo passaram. Dependências atuais Vitest4.1.12/CLI15.34.1/Admin14.5/Functions7.4/Next15.5.28; root prod0/Functions prod0 e root completo5moderados na última revisão. Sem force ou peers ignorados.

## Evidências e limites atuais

- Commercial12/12 na retomada (inclui CRM/diretório/RBAC/Auth/paginação), logs cosmaker-resume-commercial-backend. Não repetir sem alteração pertinente.
- SDKs: oito lotes isolados63/63 PASS (pagamentos6, client-quotes5, orders33/quatro arquivos, fotos4, mensagens5, jornada1, referências5, quotes4). Após projeção do detalhe, pagamentos/detalhe7/7 PASS mais repetição dirigida1/1 da mesma operação com negativos adicionais; não somar repetições como testes únicos.
- Rules finais:34PASS/1FAIL por fixture reservada; fixture corrigida e teste final direcionado1PASS/34skipped. Mesmas Rules finais,35casos cobertos em execuções complementares; não afirmar lote integral35/35.
- Unitários121/121 no marco de ownership; Functions/Next81/TypeScript e lint passaram. Build/TypeScript novos da projeção também passaram; CI do novo HEAD ainda precisa consulta.
- E2Es retomada: portal/paginação, diretório/configurações/entrega e medidas/revisão aprovados em quatro larguras; público2/2. Mais recente portal/anexos2/2 PASS1,6min inclui detalhe projetado320/375/768/1440, resposta sem custos internos e bytes/revogação/A×B. Capturas inspecionadas. Execuções novas em andamento abaixo.
- Recuperação com stack atual PASS: Auth/Firestore/Storage export/import em instâncias novas, bytes/hash, centavos/histórico, ACL A/B e raw privado. Artefatos sintéticos97a2222e ignorados no Git. Não valida restore real ou replay de Functions.
- Scheduler CLI15.34.1: publicação/entrega/ack PubSub confirmados, mas Unsupported trigger signature:http; timeout25s, não PASS. Wrapper HTTP atual PASS; não é homologação do agendamento real.
- Trace de MaxListeners em teeny-request:461/pipeline via Storage8.4.0. Não foi suprimido nem diagnosticado como vazamento comprovado. Examinar patch compatível proporcionalmente.

## Próxima ação exata

1. Conferir execução Playwright59094, log /tmp/cosmaker-private-regression-ui.log: revisões/produção, mensagens e navegação owner/staff/client/platform em quatro larguras (seis testes). Runtime atual cloud-start PID31134, sessão49956; encerrar por TERM antes de SDK/Rules/recuperação. Não rodar outro .next ou runtime sobre o existente. Esses resultados ainda NÃO são PASS neste checkpoint.
2. Executar SDKs independentes ainda pendentes após majors: finance,showcase,reports,delivery,team,inventory. Harness por domínio sequencial, sem navegador simultâneo. Lote único17arquivos anterior foi interrompido por memória8,7/9,9GiB e nunca foi aprovado. Preservar concorrência interna dos testes.
3. Fechar inventário funcional verificável conforme FUNCTIONAL_INVENTORY_METHOD.md, auditar ações/rotas restantes, verificar dependência upstream e CI do HEAD final. Não inventar módulos/quotas e não repetir gates inalterados.

## Estado e restrições

F1.1–F1.9 e F4 aceitos localmente em marcos históricos; regressões relevantes acima. F2/F3/F5/F6 parciais até fechamento dos critérios; F7/F8 pendentes. Formal10/16=62,5%; percentual funcional ainda sem inventário fechado. Há tarefas locais executáveis. Produto não homologado para clientes reais.

Externos: Firebase/GCS/IAM/índices/scheduler reais, inventário e revogação autorizados de tokens reais já distribuídos, operação/recuperação real/RPO/RTO, jurídico e release. Pagamentos bancários/gateway/canais pagos ficam fora do escopo.

Publicação GitHub: terminal tem identidade sem push; usar conector CristianoRFB link_6ad2df3229d48191bd0ef1a65deeb821, árvore idêntica/commit/ref expected_sha e force:false. Guardar commit local em local/cloud-checkpoint-* e fetch/rebase que reconhece patch; sem reset. Progresso canônico e histórico completo em MASTER_FINALIZATION_PROGRESS.md; /tmp é temporário.
