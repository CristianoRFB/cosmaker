# Estoque operacional

As rotas `/atelier/estoque`, `/atelier/estoque/materiais`, `/atelier/estoque/fornecedores` e `/atelier/estoque/movimentacoes` usam a experiência compartilhada em `components/inventory/inventory-workspace.tsx`.

O espaço mostra saldos físico, reservado e disponível; cadastro de materiais e fornecedores; alertas por ponto de reposição; e o histórico permanente de entradas, saídas, reservas, consumo e liberações. As ações de alteração exigem `inventory:write`; as consultas exigem `inventory:read` ou `inventory:write`.

Nenhum botão de fornecedor envia pedidos, e-mail ou mensagem. Reservas registram uma lista de material vinculada ao pedido, e o consumo reduz o saldo físico com trilha de auditoria.
