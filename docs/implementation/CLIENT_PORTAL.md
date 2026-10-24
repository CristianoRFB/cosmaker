# Portal do cliente — dados e fronteiras

Home consulta as projeções existentes de pedidos, propostas, conversas e notificações. Exibe projetos recentes, produção/prazos, propostas para analisar, próximos passos e atalhos para os fluxos reais. Cada recurso tem erro explícito; falha não vira contagem zero nem dado demonstrativo. Os limites/paginação de cada domínio continuam próprios. Esta Home não apresenta totais globais a partir de páginas parciais.

Perfil edita somente name/phone/updatedAt em users/{UID autenticado}, com validação e schema das Rules. E-mail Auth/verificação são somente leitura; papéis, permissões, tenant, createdAt, vínculos CRM e históricos não são modificados. Refresh atualiza o nome na navegação; toast confirma a gravação mesmo durante atualização da sessão. Cadastros mantidos pelos ateliês permanecem separados.

Pagamentos utiliza listClientOrderPayments/getClientPayment. A sessão Auth é verificada com revogação; cada transação exige cliente ativo, tenant ativo e ownership do pedido por UID/CRM, com UID durável no pedido ou no CRM explicitamente vinculado; e-mail de contato não concede histórico. Equipe usa o financeiro administrativo. A projeção contém tipo/status/método/centavos/datas, sem referência interna, ator, ledger ou motivo privado de compensação. Listagem50+1 e detalhe compartilham autorização. Compensações preservam o registro, e o saldo vem do acordo vigente/recebimentos atuais. Legado em reais é convertido com validação e comparado a centavos quando ambos existem. Inconsistência gera erro para conferência, sem saldo fictício.

Firestore raw de pagamentos de pedidos permanece somente para staff financeiro autorizado; cliente usa a projeção servidor. O detalhe de pedido cliente não consulta mais pagamentos que não renderizava e oferece link para a tela canônica. Hook de pedidos inclui UID na chave e elimina respostas da sessão anterior, inclusive reutilização do mesmo e-mail.

A interface não emite cobrança, chave Pix, checkout, promessa de transferência ou gateway. Registros são declarações internas do ateliê. Loading, falha/retry, acesso negado, ausência de pedido/registro e detalhe estão implementados.

Gates em 2026-10-24: backend pagamentos3/3; Rules33/33; E2E portal1/1 em320/375/768/1440 com persistência, erro/retry, registro vazio, UID de outra conta e e-mail reutilizado; unitários120/120, Functions/Next81/TypeScript/lint verdes no checkpoint. Capturas320 e1440 inspecionadas. Teste inicial de backend excedeu5s e E2Es iniciais tinham proposta sintética incompleta/seletor ambíguo; não contam como PASS e foram corrigidos sem relaxar os contratos.

Atualização24/10: histórico de pedidos paginado com cursor e carregamento incremental também no seletor de pagamentos;52pedidos foram exercitados no navegador. Home/Perfil/Pagamentos, medidas/revisão, diretório global e rotas secundárias passaram nos gates de retomada descritos no progresso canônico. Homologação jurídica/comercial permanece separada. Não houve Firebase real nem homologação comercial.


## Detalhe privado do pedido (24/10)

`getOrder(..., viewer=client)` consulta `getClientOrder` em vez de ler o root Firestore. A sessão é conferida com revogação Auth e a transação relê perfil cliente/tenant/vínculo durável. Lista/detalhe usam a mesma allowlist de dados comerciais, status, prazos, saldos e acordo vigente. `approvedQuoteSnapshot` expõe somente total/entrada/percentual/datas; custos internos, notas e atores ficam fora da projeção. O snapshot integral continua no banco para staff, sem migração nem exclusão.

Root raw do pedido é somente staff com leitura de pedidos. Itens/histórico/medidas/etapas/aprovações e fotos compartilhadas mantêm as Rules de filhos por UID confiável; arquivos e pagamentos usam suas projeções específicas. UID/CRM malformado, ausente ou conflitante falha fechado. Legado sem vínculo exige conferência pelo ateliê, sem reatribuir por e-mail. Backend novo7/7 e restauração sintética passaram; portal/anexos2/2 PASS, incluindo detalhe320/375/768/1440 e payload sem custos; regressões adicionais não equivalem ao aceite global das fases.
