# components/pedidos

Os componentes operacionais estão em `components/orders`: detalhe e listagem, arquivos com ACL, histórico paginado e change requests com snapshots/aprovação. As rotas de pedido reutilizam os repositories e a autorização do servidor; ações sensíveis mantêm chaves de retry e revisões esperadas.
