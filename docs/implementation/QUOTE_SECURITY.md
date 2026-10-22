# Reforço das operações de orçamento — F2/F5

A revisão encontrou criação/publicação que verificavam membership antes da transação, sem conferir perfil ativo ou e-mail verificado. `createQuoteDraft` e `publishQuote` agora exigem identidade verificada, derivam tenant do perfil e recusam divergência do tenant legado do payload. `requireQuoteWriter` relê perfil, tenant, membership e permissão de orçamento dentro da transação que grava os dados.

Os contratos de payload passam a ser estritos, IDs não aceitam caminhos, datas precisam existir no calendário e cálculos não podem ultrapassar centavos seguros. A publicação só aceita a versão ativa da solicitação e validade ainda vigente. Repetir a publicação de uma proposta já enviada retorna confirmação sem duplicar auditoria; requisições concorrentes serializam na mesma transação.

`respondToQuote` exige perfil de cliente e tenant ativos na transação, além do e-mail verificado anterior. UID forte no orçamento, quando presente, não pode ser contornado por e-mail. O vínculo CRM existente continua recusando reuso de e-mail por outra conta. A aprovação mantém snapshot de itens, vínculo do cliente, histórico e criação do pedido existente.

Limites: a interface/Rules de leitura de textos de propostas e solicitações legadas ainda usam fronteiras históricas por e-mail em alguns caminhos. A projeção por UID e a conciliação desse legado continuam pendentes em F5; estas correções de mutação não significam aceite global de privacidade. Rascunhos intencionalmente versionados continuam criando nova versão; idempotência de criação do rascunho por chave de intenção precisa de contrato próprio antes de alterar a UX existente.

Gates reais em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md). Sem deploy ou mutação de Firebase real.
