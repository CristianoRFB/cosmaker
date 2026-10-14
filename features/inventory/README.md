# Estoque, materiais e fornecedores

## Modelo persistido

- `ateliers/{atelierId}/materials/{materialId}` guarda nome, SKU único por ateliê, unidade, custo unitário em centavos, fornecedor, ponto de reposição e os acumuladores de saldo físico/reservado.
- `ateliers/{atelierId}/suppliers/{supplierId}` guarda contato manual e estado ativo/arquivado. Nenhuma integração de compra ou mensagem é presumida.
- `ateliers/{atelierId}/inventoryMovements/{requestId}` é o ledger somente de criação: tipo, quantidade em milésimos da unidade, material/custo snapshot, pedido/reserva vinculados, saldo anterior/posterior, ator e chave de idempotência.
- `ateliers/{atelierId}/inventoryReservations/{requestId}` mantém a quantidade ainda reservada para um pedido. `orders/{orderId}/materialRequirements/{materialId}` soma o planejamento, a reserva e o consumo daquele material.
- `ateliers/{atelierId}/inventorySkuIndex/{sku}` protege códigos duplicados sob concorrência.

## Regras de saldo

Quantidade é armazenada como inteiro em milésimos da unidade e custo em centavos. `disponível = físico − reservado`; cada transição e ledger são gravados na mesma transação Firestore. Entrada aumenta o físico; reserva reduz o disponível; liberação reduz a reserva; saída/consumo reduz o físico e, quando vinculada a reserva, também reduz o reservado. Saídas não podem consumir quantidade reservada ou produzir saldo negativo. Repetir o mesmo `requestId` e payload devolve o resultado já gravado; reutilizar a chave com outro payload é recusado.

O servidor recusa material com acumuladores ausentes ou inconsistentes. A unidade só pode ser alterada depois de zerar saldo físico e reservas, para não reinterpretar quantidades antigas. O alerta e a lista de reservas consideram apenas reservas ativas.

Reservar para pedido cria ou atualiza sua linha de materiais planejados e exige pedido existente e ativo. Consumo associado a pedido exige saldo planejado; a trilha mantém nome, unidade e custo unitário registrados no momento do movimento. Ajustes manuais de saldo e integração automática com fornecedores permanecem fora do contrato implementado.

## Acesso

As Functions autenticam membro e tenant ativo e revalidam permissão dentro da transação. `owner`/`admin` têm acesso; `inventory:write` permite consulta e mutação; `inventory:read` permite apenas consulta. Rules permitem leitura autorizada das projeções e negam escrita direta em materiais, fornecedores, saldo, reservas, índice SKU, requisitos e ledger.

Callables: `listInventoryWorkspace`, `listInventoryMovements`, `saveInventoryMaterial`, `saveInventorySupplier`, `applyInventoryMovement`.

## Alertas e validação

O alerta de reposição é calculado quando o saldo disponível está no ponto configurado ou abaixo dele. `npm run test:inventory` cobre tenant A×B, permissão, unicidade SKU, entrada idempotente, reserva/BOM, liberação, consumo, auditoria, saída acima do saldo e corrida de saídas concorrentes. `npm run test:rules` cobre o bloqueio de gravação direta. A jornada Playwright `tests/e2e/inventory-workflow.spec.ts` confirmou criação de fornecedor e material, entrada, reserva e consumo pela UI e persistência no Firebase Emulator.
