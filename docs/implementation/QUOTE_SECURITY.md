# Reforço das operações de orçamento — F2/F5

A revisão encontrou criação/publicação que verificavam membership antes da transação, sem conferir perfil ativo ou e-mail verificado. `createQuoteDraft` e `publishQuote` agora exigem identidade verificada, derivam tenant do perfil e recusam divergência do tenant legado do payload. `requireQuoteWriter` relê perfil, tenant, membership e permissão de orçamento dentro da transação que grava os dados.

Os contratos de payload passam a ser estritos, IDs não aceitam caminhos, datas precisam existir no calendário e cálculos não podem ultrapassar centavos seguros. A publicação só aceita a versão ativa da solicitação e validade ainda vigente. Repetir a publicação de uma proposta já enviada retorna confirmação sem duplicar auditoria; requisições concorrentes serializam na mesma transação.

`respondToQuote` exige perfil de cliente e tenant ativos na transação, além do e-mail verificado anterior. UID forte no orçamento, quando presente, não pode ser contornado por e-mail. O vínculo CRM existente continua recusando reuso de e-mail por outra conta. A aprovação mantém snapshot de itens, vínculo do cliente, histórico e criação do pedido existente.

A leitura do cliente usa `listClientQuotes`/`getClientQuote`: identidade Auth verificada e perfil de cliente ativo são relidos na transação. Tenant precisa estar ativo; caminho deve ser canônico. UID da proposta, aprovação/recusa e CRM têm prioridade sobre e-mail. Vínculos contraditórios ou malformados são recusados. Também se consultam CRM por e-mail sem índice e `clientEmailIndex`, impedindo que dados legados sem índice se tornem um bypass. E-mail verificado só aceita um convite ainda realmente sem vínculo a UID.

O histórico continua disponível para o UID depois de trocar e-mail: busca por UID direto/aprovação/recusa e por `clientId` dos cadastros CRM vinculados. A resposta a uma proposta ainda exige o mesmo e-mail verificado do convite; mudança de endereço de uma proposta pendente exige revisão pelo ateliê, sem reatribuir o histórico automaticamente. Um CRM já vinculado é preservado ao responder, mesmo se seu e-mail de contato tiver sido editado separadamente.

A projeção retorna campos comerciais conhecidos, itens e decisões/comentários, com timestamps ISO/null. Não retorna actorId/UIDs, notas internas, snapshots internos ou URLs privadas. Listagem e respostas têm páginas de 50; registros sem data continuam visíveis. Limites técnicos defensivos (500 por consulta, 100 vínculos CRM, 1000 candidatos; 100 itens/500 respostas por detalhe) retornam erro explícito ao exceder, sem fingir histórico completo. Não são direitos ou cotas comerciais. Índices exigidos estão em `firestore.indexes.json`; Emulator não homologa disponibilidade de índices em Firebase real.

Rules bloqueiam o wildcard por e-mail e todos os documentos raw de proposta/itens/respostas/solicitações/referências para clientes. Equipe com quotes:read mantém o acesso do painel; cliente recebe somente projeção servidor. `isAtelierMember` Firestore exige tenant, perfil e membership ativos, e-mail verificado, accountType/tenant corretos; `isOwnClient` exige perfil cliente verificado/ativo e tenant ativo. Storage permanece separado por seu limite cross-service de dois documentos.

O frontend troca por UID, não pelo e-mail salvo no perfil, limpa dados ao trocar sessão e descarta respostas atrasadas. Há botões explícitos de paginação e feedback de erro; pedido de ajuste atualiza o histórico persistido.

Limites: o inventário/revogação de URLs antigas e os uploads Storage com excesso de consultas ainda impedem aceite global F5. Estas correções locais não significam homologação global de privacidade. Rascunhos intencionalmente versionados continuam criando nova versão; idempotência de criação do rascunho por chave de intenção precisa de contrato próprio antes de alterar a UX existente.

Gates reais em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md). Sem deploy ou mutação de Firebase real.
