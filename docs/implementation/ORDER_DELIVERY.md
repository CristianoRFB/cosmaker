# Entrega e conclusão manual — integração F2

`finalizeOrder` deriva tenant do perfil autenticado e exige e-mail verificado, perfil/membership/tenant ativos e `orders:manage`. Não aceita tenant, role, status ou valores financeiros do browser. Uma transação relê autorização e estado, valida versão esperada e conserva uma chave de operação por UID/pedido/fingerprint.

A sequência é `shipped → delivered → completed`. `shipped` é alcançado pelas etapas existentes de expedição/retirada; o registro manual de entrega informa modalidade (`pickup`/`shipping`) e observação explicitamente visível ao cliente. Encerramento exige confirmação separada. Nenhum frete é contratado, pagamento movimentado, ledger alterado ou histórico excluído.

Em cada transição o servidor exige acordo/recebimentos consistentes em centavos e saldo zero; todas as etapas concluídas/aprovadas com progresso 100; nenhum pedido de aprovação ou revisão pendente/aprovada ainda não aplicada; planejamento sem revisão; reservas de materiais zeradas após consumo ou liberação explícitos; nenhuma hora futura ainda agendada. Registros acima dos tetos técnicos existentes exigem conciliação paginada. A operação não cancela nem consome materiais/horas silenciosamente.

Status e datas, histórico, auditoria, idempotência e notificação interna `order_updated` do UID forte do cliente são gravados atomicamente. O retry preserva o resultado original sem novo evento. Uma operação concorrente perde a comparação de versão. As leituras transacionais dos pedidos/consultas e as mutações dos domínios de estoque/agenda mantêm as mesmas fronteiras de concorrência. A coleção `lifecycleOperations` não admite acesso direto nas Rules.

O painel oferece registro após expedição e conclusão após entrega, com modal de confirmação, estados de erro e repetição segura. O cliente acompanha as datas, observações de entrega e histórico e recebe notificações privadas. Perfis de leitura não ganham ações de gestão. O histórico de outras operações não tem notas internas expostas por este refinamento.

Gates e limites do aceite em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md). Completar esta operação não significa aceitar toda a fase F2; referências pré-pedido/legado, scheduler e jornada global continuam pendentes até evidências próprias.
