# Financeiro operacional — contrato F1.6

Implementação validada localmente em 2026-10-22; o aceite remoto e os resultados observados ficam em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md).

## Contrato e fontes de verdade

- `financeEntries` é um ledger imutável por ateliê. `expense` distingue custos `planned`/`actual` nas categorias materiais, produção, mão de obra, despesas operacionais, entrega, taxas declaradas e outros. `income` registra receita avulsa sem vínculo a pedido. `payment` registra recebimento manual de pedido e exige situação realizada.
- Todos os novos valores usam centavos inteiros seguros. Os saldos em reais legados são mantidos atomicamente e comparados com centavos e acordo vigente antes de confirmar ou compensar recebimentos. Valor fracionário, negativo, excesso do saldo e inconsistência impedem a gravação.
- Receita contratada de pedidos vem do acordo vigente, inclusive revisões aplicadas. Recebimentos atuais vêm do saldo canônico do pedido, incluindo entradas legadas; o ledger não os soma novamente. Pedidos cancelados/reembolsados saem da receita prevista e preservam recebimentos históricos.
- Custos planejados e realizados são comparativos separados: registrar o realizado não apaga o planejado. Despesas gerais não são rateadas arbitrariamente por pedido. A margem por pedido compara acordo vigente com custos realizados vinculados; resultado de caixa compara recebimentos declarados com custos realizados. Nenhum desses indicadores representa extrato bancário.
- Filtros de datas de competência aplicam-se ao ledger e a seus custos/receitas avulsas. Acordos e saldos dos pedidos são posições atuais, explicitadas na tela e no retorno `periodAppliesTo=ledger_only`. Não é apresentado um balanço histórico de recebimentos como se fosse posição do período.

## Operações, histórico e correções

`recordFinanceEntry`, `reverseFinanceEntry` e `listFinanceWorkspace` derivam o tenant do perfil autenticado. Payloads com tenant, ator ou campos extras são rejeitados. A conciliação reutiliza a mesma autorização. Exigem e-mail verificado, perfil/membership/tenant ativos e `finance:read` ou `finance:write`, com leitura implícita para quem escreve. Escritas revalidam perfil/permissão/tenant na transação e mantêm o bloqueio de `demoWorkspace` aprovado na v0.2. O projeto Emulator `demo-cosmaker` contém tenants sintéticos operacionais e não se confunde com esse marcador comercial.

`financeOperations` usa chave de requisição por UID e fingerprint normalizado: repetir a mesma requisição devolve o mesmo resultado; reutilizá-la com dados diferentes falha. `financePaymentReferences` impede reusar a mesma referência interna, normalizada sem distinção de maiúsculas, no mesmo pedido. Uma referência compensada permanece reservada como histórico; o registro correto deve usar nova referência. Sem referência informada, a proteção é a chave idempotente da operação e o teto do saldo.

A correção exige motivo de 8–500 caracteres, cria lançamento inverso e trava em `financeReversals`; nenhuma edição/destruição do original é permitida. Corrigir o valor exige compensar e registrar o lançamento correto. Correções concorrentes aplicam somente uma compensação. A auditoria é gravada atomicamente com ator, tenant, ação, original/resultado e hora do servidor.

Recebimentos criam registro em `orders/{id}/payments`, mantêm o histórico do cliente/CRM e atualizam os dois formatos de saldo. A confirmação de entrada existente continua criando etapas/histórico e agora cria seu ledger na mesma transação. Compensação de recebimento marca o pagamento como reversão interna (`refunded`), reabre somente o saldo financeiro e preserva o estado/histórico de produção. Isso permite corrigir declaração sem desfazer trabalho executado. Não ocorre transferência, devolução bancária ou cobrança real.

Entradas anteriores ao ledger continuam nos saldos e histórico do pedido. A ação explícita `reconcileLegacyFinancePayment` concilia um recebimento manual anterior com evidência de confirmação (ator, meio e data), sem mudar saldos. Ela permite a compensação posterior com motivo; repetir não duplica o vínculo. Originais são preservados. Registros inconsistentes ou sem evidência manual falham fechados para revisão. Nenhum dado real foi migrado nem convertido silenciosamente.

## Segurança e limites técnicos

Rules negam leitura/escrita bruta de ledger, operações, referências e travas. Coleções financeiras legadas `transactions` e `expenses` mantêm leitura por permissão e passam a negar escrita direta. Cliente consulta seus pagamentos por listClientOrderPayments/getClientPayment; raw financeiro permanece staff-only. Detalhe de pedido usa projeção getClientOrder para não expor custos do snapshot interno. Custos e lançamentos internos não são concedidos ao portal.

A listagem devolve projeção explícita, sem UIDs de atores, com histórico de 50 registros por página e compensações identificadas independentemente da página/período. Agregação local tem teto técnico explícito de 5.000 lançamentos e 500 pedidos; exceder esse volume falha com `resource-exhausted`, sem devolver métricas truncadas. Esses tetos não são direitos/limites comerciais e a paginação analítica escalável fica no refinamento F3/F6.

## Gates preparados

- Unitários: comparação de bases, margens/prejuízo/zero, centavos/overflow e inconsistência legada.
- Functions: categorias, idempotência/fingerprint/referência, auditoria, compensação única, concorrência de recebimentos, excesso de saldo, A/B, papéis/cliente/anônimo, payload adulterado, suspensão/demo/perfil, entrada existente e paginação/datas.
- Rules: ledger/índices inacessíveis, create/update/delete negados inclusive para owner, mutação de UID/timestamp/tipos negada, consulta pública negada e coleções legadas protegidas.
- E2E desktop/mobile: custo, margem, compensação, recebimento, persistência/reload, navegação pelas seis rotas afetadas e overflow horizontal.

Nenhum gate é PASS somente por estar escrito. Os resultados reais serão registrados no checkpoint.

Gates locais finais: unitários financeiros 6/6, transporte 1/1, integração 7/7, Rules 22/22 + 1 direcionado após reforço de perfil, E2E desktop 2/2 (financeiro e regressão integrada) e mobile 1/1, build local de 81 páginas, lint e docs:check aprovados. CI remoto é acompanhado separadamente no checkpoint.
