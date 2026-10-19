# Pedidos: arquivos, acordo e histórico

## Jornadas

- `OrderFiles` envia os bytes do arquivo, permite compartilhar, retirar o compartilhamento, arquivar, restaurar e cancelar um envio pendente. O cliente consulta somente arquivos prontos, compartilhados e não arquivados. Downloads exigem uma sessão válida em cada solicitação.
- `OrderChangeRequests` registra uma proposta de mudança de escopo, materiais, prazo ou valor. O cliente confirma explicitamente o acordo apresentado. A equipe aplica somente uma revisão aprovada e compatível com a versão vigente.
- `OrderHistory` pagina o histórico persistido em grupos de 50 registros.
- `OrderFinancialRecords` apresenta os pagamentos internos já registrados e o saldo do acordo vigente. O módulo financeiro completo é o checkpoint F1.6.

## Persistência e autorização

Os repositories chamam Functions; a interface não altera os ledgers diretamente. Arquivos usam `files` e `fileActions`, mudanças usam `changeRequests`, `changeRequestOperations` e `agreementVersions`. A proposta aprovada original permanece em `approvedQuoteSnapshot`; revisões aplicadas ficam em `currentAgreement`, com valores em centavos.

Os endpoints de anexos verificam identidade, perfil ativo, vínculo ao ateliê ou ao cliente, caminho, tamanho, MIME, assinatura e hash SHA-256. O upload tem uma trava transacional e preserva a geração do objeto. O Storage direto de anexos está negado. Não há URL permanente de download retornada ao navegador. Mudanças de visibilidade verificam revisão, registram ator e revogam tokens residuais conhecidos.

Mudanças financeiras exigem a permissão financeira além da gestão do pedido. Os valores não podem ficar abaixo do que já foi pago ou da entrada original. Alterações de prazo sinalizam revisão do planejamento. Pedidos concluídos ou cancelados preservam seu histórico.

## Evidências e pendências

Gate de 2026-10-19: `npm run test:orders` 32/32 (11 anexos, 7 revisões, 11 produção/ownership e 3 agenda); Rules 21/21; CI Node 22 com 109/109 unitários e builds Functions/Next. TypeScript, lint e build local também passaram.

Playwright desktop 3/3 e mobile 2/2 passaram na retomada, com efeitos persistidos e isolamento A×B. Fotos usam Blobs autenticados; a regressão confere o protocolo Blob e a imagem decodificada antes da aprovação. A listagem do cliente valida UID e projeta campos no servidor, mantendo candidatos legados sem contornar vínculos existentes. Referências pré-pedido e revogação global de URLs históricas permanecem no gate transversal de privacidade. Evidências em [MASTER_FINALIZATION_PROGRESS.md](../../docs/implementation/MASTER_FINALIZATION_PROGRESS.md).

Nenhum deploy, migração real, cobrança ou envio externo é executado por esses fluxos.
