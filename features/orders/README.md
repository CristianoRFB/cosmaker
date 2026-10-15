# Pedidos, acordos e produção

O pedido preserva `approvedQuoteSnapshot`, itens, referências e medidas capturados na aprovação original. Um acordo posterior só é aplicado por change request versionado, aprovado explicitamente pelo cliente vinculado; os snapshots anteriores ficam em `agreementVersions`. O valor vigente usa centavos e é conferido contra os campos legados antes de liberar envio ou confirmar entrada. O depósito continua sendo confirmação manual interna.

## Arquivos

`orders/{orderId}/files/{requestId}` guarda a intenção de envio, nome, tipo, tamanho, hash SHA-256, categoria, visibilidade, revisão e estado. Novos objetos ficam em `ateliers/{atelierId}/orders/{orderId}/attachments/{fileId}`. Endpoints autenticados recebem e servem bytes; o servidor valida assinatura JPEG/PNG/WebP/PDF, tamanho e hash antes de marcar `ready`. O browser não acessa diretamente os objetos de anexos. Tornar interno/arquivar revoga tokens residuais e cada download confere a ACL atual, sem retornar uma URL permanente.

`listOrderFiles` entrega ao cliente apenas arquivos prontos, compartilhados e não arquivados; metadados internos não podem ser consultados diretamente no Firestore. A equipe consulta conforme `orders:read` e altera conforme `orders:manage`, com tenant/perfil ativos, identidade verificada e revalidação transacional. Arquivamento mantém documento e auditoria; referências herdadas da solicitação preservam o snapshot original. Envios incompletos/recusados podem ser cancelados. O fluxo rejeita reutilização de chave com outro payload ou bytes, grava revisões e recusa atualização concorrente sem a revisão esperada.

## Histórico e acesso

A rota de histórico lê eventos imutáveis de `statusHistory` em páginas de 50, com cursor dentro do mesmo pedido. A produção mantém as seis etapas canônicas e configura etapas próprias sem apagar execução anterior, aprovações ou alocações. Ledger de operações, versões e escritas de estado são gerenciados no servidor. O detalhe de pedido deixa de consultar pagamentos quando a equipe não tem permissão financeira.

## Validação

Gates previstos para F1.5: unitários de política/configuração, Functions de anexos/change requests/produção, Rules de Firestore/Storage e jornadas reais Playwright, com bytes e estados persistidos conferidos no Emulator. O checkpoint em `docs/implementation/MASTER_FINALIZATION_PROGRESS.md` registra os resultados executados; esta descrição não substitui a execução dos gates.
