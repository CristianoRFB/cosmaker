# Produção por pedido

O pedido mantém as seis etapas canônicas com os IDs originais: `stage-start`, `stage-modeling`, `stage-production`, `stage-fitting`, `stage-finishing` e `stage-shipping`. Os pesos padrão e os snapshots comerciais existentes permanecem compatíveis. A etapa de prova e ajustes conserva a aprovação obrigatória do cliente.

## Configuração e planejamento

`getOrderProductionConfiguration` devolve a configuração atual e os membros ativos elegíveis. `saveOrderProductionConfiguration` permite editar nomes, pesos proporcionais, exigência de aprovação, responsável, início planejado e prazo. Permite incluir etapas próprias com ID `custom-*` e fase explícita `modeling | in_production | fitting | finishing`. A sequência das fases é crescente e o envio canônico permanece por último.

Uma etapa `pending` pode ser removida ou reordenada somente quando não possui execução, fotos, aprovações ou qualquer alocação histórica, inclusive cancelada. As etapas canônicas são preservadas. Nome, peso, aprovação, fase e posição ficam imutáveis após o início. Metadados de etapas concluídas e da versão enviada para aprovação permanecem históricos; responsável e datas de etapas ativas podem ser ajustados sem contradizer horas já alocadas. Um responsável histórico posteriormente inativado é preservado; novas atribuições exigem membro e perfil ativos do tenant.

Datas são dias de calendário `YYYY-MM-DD`. Início não pode superar o prazo e as datas precisam incluir as horas já planejadas. Reatribuir uma etapa com horas ativas exige cancelar essas horas na agenda primeiro. Alocação/cancelamento recusam alterações de uma etapa aguardando aprovação, concluída ou aprovada. Não há integração externa ou envio de mensagem neste módulo.

O limite de 100 etapas por operação e peso inteiro entre 1 e 10.000 são limites técnicos de payload/transação; não constituem cotas de plano. Os pesos são normalizados pelo total, sem exigir soma de 100.

## Transações, histórico e autorização

`orders/{orderId}.productionConfigurationVersion` identifica a revisão da configuração. Cada etapa tem `version`, incrementada em configuração, avanço, aprovação e alteração de responsável pela agenda. Configuração usa `expectedVersion` e a atualização completa de cada etapa (segundos e nanossegundos), impedindo que uma tela antiga sobrescreva alterações simultâneas de produção ou agenda.

Revisões imutáveis ficam em `orders/{orderId}/productionConfigurations/{version}`, incluindo configuração anterior, nova, ator e timestamp. Recibos privados em `productionOperations/{hash(actor, requestId)}` deduplicam salvamento e avanço; reutilizar a chave com outro payload é recusado. Escritas são exclusivamente server-side. Todas as transações relêem ateliê, perfil, membership e permissão `orders:manage`.

`updateProductionStage` exige conclusão/aprovação de todas as etapas anteriores em todas as ações. A UI usa versão e chave de retry; clientes legados sem os novos campos conservam o contrato anterior, com transições condicionais e sem reaplicar uma conclusão. Bloqueio exige motivo, preservado nos updates e na auditoria; retomada registra resolução.

## Aprovação e envio

A conclusão de uma etapa com aprovação exigida precisa de foto pronta e visível. A solicitação captura definição e versão da etapa; o cliente verificado e vinculado ao pedido responde explicitamente. A mesma resposta repetida retorna o resultado salvo sem novo evento. Ajuste solicitado restaura o último progresso real anterior à solicitação, em vez de atribuir um percentual arbitrário. Configuração histórica, updates de etapa, aprovação/events, statusHistory e auditLogs são preservados.

Finalização permanece ativa se ainda houver trabalho próprio antes do envio. A última etapa operacional leva a `waiting_final_payment` ou `ready_to_ship`. Início, conclusão e aprovação do envio validam saldo zero e coerência entre o valor legado em reais e `amountRemainingCents`, quando presente. Nenhuma configuração altera proposta aprovada, acordo vigente ou saldo financeiro.

Fotos usam metadados pendentes e paths exatos do tenant/pedido. Criação e finalização revalidam autorização, demo e estado do pedido transacionalmente; pedidos enviados/concluídos recusam novas mutações. Storage é create-only e o servidor confere MIME, tamanho, bytes de assinatura e metadados de correlação. Retry de uma finalização já pronta preserva a auditoria única.

## Evidências

As regras puras estão cobertas em `tests/unit/production-configuration.test.ts`. A suíte `tests/integration/production-configuration-functions.test.ts` cobre configuração, inclusão/reordenação/remoção, responsável/datas, histórico, isolamento, perfil inativo, concorrência, retry, bloqueio, aprovação, financeiro e agenda. O cenário de bytes/finalização de foto requer Storage Emulator. Os resultados executados e o checkpoint são registrados em `docs/implementation/MASTER_FINALIZATION_PROGRESS.md`; este README não substitui a evidência de execução.
