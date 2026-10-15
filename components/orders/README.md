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

`npm run test:orders`: 30/30 testes de integração no Emulator em 2026-10-15 (11 arquivos, 7 revisões, 9 produção e 3 agenda). `npm run test:rules`: 19/19. Unitários: 109/109. Functions build, TypeScript, lint e Next build passaram.

As duas jornadas Playwright de configuração/revisão e de arquivos passaram em 2026-10-15 (2/2, exit 0). Conferem alterações persistidas, snapshots, financeiro, histórico, bytes de download, revogação, mobile e isolamento A×B. A regressão do orçamento original está em execução. O acesso por URLs permanentes dos fluxos legados de fotos de produção e referências ainda requer revisão antes do aceite global de privacidade. O estado atualizado e os comandos executados estão em [MASTER_FINALIZATION_PROGRESS.md](../../docs/implementation/MASTER_FINALIZATION_PROGRESS.md).

Nenhum deploy, migração real, cobrança ou envio externo é executado por esses fluxos.
