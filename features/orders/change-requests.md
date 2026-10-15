# Revisões formais de acordo do pedido

F1.5 acrescenta propostas de mudança em escopo, materiais descritos no acordo, prazo e valor total. A proposta original aprovada e `approvedQuoteSnapshot` permanecem preservados. O acordo vigente usa centavos inteiros e versão própria; a revisão proposta tem um contador separado para manter recusas, ajustes e cancelamentos no histórico.

## Jornada implementada

1. A equipe com `orders:manage` lê o acordo vigente e propõe condições, motivo, versão base e assinatura do snapshot. Alteração de valor também exige `payments:write` ou `finance:write`; owner/admin mantém as permissões existentes. Demo não aceita mudança financeira.
2. O cliente ativo com e-mail verificado e vínculo ao pedido lê a comparação de condições. A aprovação exige confirmação explícita da revisão exibida, seu número e sua assinatura. Recusa ou pedido de ajustes exige comentário. E-mail coincidente sozinho não autoriza a resposta: o pedido ou o cadastro de cliente precisa estar vinculado ao UID e um vínculo conflitante é recusado.
3. A equipe aplica somente a revisão aprovada. A transação relê conta, membership, ateliê, pedido, saldo pago, acordo base e snapshot aprovado. Revisão desatualizada não é aplicada; concorrência permite apenas uma aplicação por versão.
4. A aplicação congela a versão original e a nova em `agreementVersions`, atualiza `currentAgreement`, o escopo, o prazo e o saldo interno do pedido. Não confirma depósito, não altera pagamento, não reinicia etapas nem processa dinheiro. Pedidos na fase financeira final têm as etapas relidas na mesma transação: trabalho pendente, inclusive etapas próprias, mantém a fase operacional correspondente; trabalho concluído com saldo vira `waiting_final_payment`, e sem saldo vira `ready_to_ship`. O envio ainda exige as etapas anteriores e o saldo confirmado.
5. Rejeição/ajustes/cancelamento permite emitir nova revisão com `supersedesId`. A versão anterior permanece íntegra e recebe somente o vínculo de substituição. Revisão aplicada não pode ser cancelada; nova correção requer outro acordo explícito.

## Persistência e integridade

- `ateliers/{atelierId}/orders/{orderId}/changeRequests/{requestId}`: revisão, estados, termos, motivo, snapshots base/proposto, ator, assinatura e aprovação. Subcoleção `events` registra respostas/aplicação/cancelamento.
- `agreementVersions/{version}`: versões imutáveis do acordo, snapshot, assinatura, aprovação e aplicação.
- `changeRequestOperations/{requestId}`: deduplicação de respostas, aplicação e cancelamento. Criação usa o próprio ID da revisão e fingerprint do payload normalizado.
- `statusHistory` e `auditLogs` recebem os eventos na mesma transação. Proposta também cria uma notificação interna persistida para o cliente vinculado, sem envio externo.
- Novos totais menores que a entrada original ou que o valor já registrado como pago são recusados. Compensação/reversão financeira pertence ao módulo financeiro; este fluxo não simula estorno.
- O prazo aplicado alimenta as consultas atuais de risco e marca `planningNeedsReview` para revisão do planejamento. A mudança de acordo não desloca automaticamente alocações nem movimenta/reserva materiais.
- Lista por versão descendente com cursor e até 30 revisões por página, como limite de leitura operacional. Não constitui cota comercial.

## Integração

Callables: `listOrderChangeRequests`, `proposeOrderChangeRequest`, `respondToOrderChangeRequest`, `applyOrderChangeRequest`, `cancelOrderChangeRequest`. UI compartilhada `OrderChangeRequests` recebe `order`, `clientView` e `reload` opcional. Os paths de revisão, eventos, versões de acordo e operações negam escrita direta do browser; as operações de deduplicação também negam leitura direta.

Testes adicionados: `tests/unit/order-change-policy.test.ts` e `tests/integration/order-change-functions.test.ts`. Execução e resultados ficam no checkpoint geral; a existência dos testes não significa validação executada.

`PRODUCTION_MIGRATION=NOT_RUN` · `PRODUCTION_DEPLOY=NOT_RUN` · `LIVE_BILLING=NOT_ENABLED`
