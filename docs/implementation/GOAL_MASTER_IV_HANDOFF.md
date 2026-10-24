# GOAL MASTER IV — handoff de parada solicitada

**INCOMPLETO / WIP. Usuário solicitou encerrar e commitar imediatamente em24/10/2026.**

Repositório CristianoRFB/cosmaker; branch exclusiva codex/cosmaker-master-finalizacao. Último remoto anterior a este checkpoint:9d53e8fc20d6dc4385273f02c3c73025d36d7441. Na retomada, fetch/confirmar HEAD e working tree/CI. Nenhum Firebase real, deploy, IAM, billing, merge ou force push foi feito ou autorizado. Somente demo-cosmaker, Node22/Java21 e fixtures sintéticas.

## Implementado e preservado

Referências públicas com capabilities/hash/expiração/MIME/assinatura/limites/SHA-256 e bytes por servidor; Storage deny-all, zero cross-service. Leitores legados protegidos e snapshots sem capabilities; produção anterior preservada. Portal Home/Perfil/Pagamentos, histórico paginado52pedidos, medidas CRM≠UID e revisão de proposta conectados; diretório global/Auth, assinatura e rotas públicas por slug sem dados demonstrativos fingindo persistência.

Pedidos privados exigem UID durável/CRM consistente em mensagens, pagamentos, arquivos, fotos, revisões/aprovações. Legados sem vínculo são preservados para revisão staff, sem backfill automático por e-mail. getClientOrder/listClientOrders compartilham allowlist; root raw de pedido é staff-only e custos/notas/atores internos não saem no DTO. Snapshot integral permanece no banco.

Recuperação de senha corrigida para recibo condicional de conta ausente, com erros de rede/rate limit preservados. Login usa mensagem genérica de credenciais. Transferência de titularidade usa toast global que sobrevive ao refresh de sessão. Lançador Linux acompanha PID+startTime e encerra PubSub destacado; runtime38403 recebeu TERM nesta parada.

## Últimas evidências reais

- Backend atual104cenários distintos por domínio (inclui commercial12, client-payments/detalhe7 e os lotes SDK detalhados no progresso). Não somar repetições como cenários novos.
- Unitários121/121 no marco de ownership; modelos relevantes preservados. Functions/Next81/TypeScript e lint passaram nos marcos registrados. Último build do toast Next81/Functions e TypeScript PASS; o novo harness de inventário ainda não recebeu lint final. CI do checkpoint final precisa consulta.
- Rules finais: lote34PASS/1FAIL por fixture reservada, corrigida e repetida isoladamente1PASS/34skipped. Mesmas Rules,35casos cobertos por execuções complementares; não afirmar lote integral35/35.
- Portal/detalhe/anexos2/2 PASS1,6min, detalhe320/375/768/1440 e payload sem custos; público2/2 PASS. Mensagens/navegação quatro papéis5PASS, com revisão/produção1FAIL por expectativas financeiras antigas; repetição só da revisão1/1 PASS32,7s. Jornada foto/aprovação/CRM adicional1/1 PASS1,3min com quatro larguras.
- Recuperação de senha1/1 PASS15,1s: quatro larguras, OOB único/replay inválido, senha antiga recusada, UID/perfil/papel preservados, conta ausente, rede abortada e retry. Google popup NÃO PASSOU: bloqueio de biblioteca estática pelo proxy.
- Equipe final1/1 PASS20,2s (17,7s de teste), /tmp/cosmaker-team-transfer-accepted-e2e.log: convite/aceite, papéis/permissões, revogação somente da membership, acesso negado, reativação, único titular e confirmação persistente. Ensaios anteriores falharam por seletores/expectativa de conta global e pelo bug real de feedback; não viram PASS retroativamente.
- Recuperação sintética Auth/Firestore/Storage export/import em instâncias novas PASS, bytes/hash, centavos/histórico e ACL A/B/raw privado. Sem replay de Functions ou restore real.
- Inventário sintético de tokens PASS: script test-storage-token-inventory.mjs detecta objeto com token por delta1, não altera token/geração/bytes, exporta só contagens e recusa projeto/endpoint indevidos. Resultado sanitizado versionado; fixture própria removida. Não houve inventário/revogação global real.

## Pendências locais exatas

1. Conferir CI do HEAD final e confirmar encerramento do runtime/working tree. Sem novos testes extensos para retomar.
2. Lint/diff/checks estáticos proporcionais do novo script e últimas alterações de testes; corrigir falhas reais. Não repetir104integrações, Rules, recuperação ou E2Es aprovados sem mudança pertinente.
3. Concluir atribuição de evidências em FUNCTIONAL_INVENTORY.json:47operações congeladas, quatro critérios de peso1. Arquivo ainda DRAFT e functionalPercent=null. Gerar cálculo/relatório reproduzível, sem inventar porcentagens; Google e scheduler devem preservar seus bloqueios, com crédito apenas dos critérios comprovados.
4. Consolidar matriz formal de16marcos, documentação/handoff/CI. Fases inteiras só recebem PASS com todos os critérios obrigatórios comprovados. Não inventar módulos, cotas comerciais ou redesign para aumentar percentuais.

## Bloqueios externos comprovados

- Popup Google local precisa apis.google.com/js/api.js; proxy recusa CONNECT403 antes do popup. Teste registra skip somente nessa falha exata, nunca PASS. Proposta mínima de rede em CLOUD_NETWORK_REVIEW.md; conector disponível apenas lê runtime, não publica configuração. Nenhuma conta Google real foi usada.
- Scheduler CLI15.34.1 entrega/ack PubSub mas rejeita Unsupported trigger signature:http. Wrapper HTTP atual passou; não homologa timer/transporte real. Não repetir indefinidamente nem modificar node_modules para disfarçar.
- Dependências runtime produção0 na última auditoria; root completo5moderados upstream CLI. Storage8.4.0/teeny-request11.1.1 já latest; warning de pipeline/listeners conhecido, sem patch oficial, supressão ou vazamento de heap comprovado.
- Firebase/GCS/IAM/índices/agendamento reais, inventário/revogação de tokens reais, recuperação operacional/RPO/RTO, OAuth/e-mails/Auth reais, jurídico e release exigem sessão/autorização externa futura.

## Estado formal e comercial

F1.1–F1.9 e F4 aceitos localmente em marcos históricos. F2/F3/F5/F6 PARCIAIS / WIP global; F7/F8 pendentes. Formal10/16=62,5%. Conclusão funcional ainda não calculada. Produto não homologado para clientes reais/produção. Há pendências locais de consolidação além dos bloqueios externos.

## Transporte GitHub

Usar conector CristianoRFB link_6ad2df3229d48191bd0ef1a65deeb821 (terminal tem identidade sem push), árvore idêntica/commit/ref com expected_sha e force:false. Preservar commit local em local/cloud-checkpoint-* e fetch/rebase reconhecendo patch; sem reset. Progresso histórico completo em MASTER_FINALIZATION_PROGRESS.md; logs /tmp são temporários e não foram publicados com tokens ou dados pessoais.
