# Mensagens e notificações internas — contrato F1.8

Implementação local iniciada em 2026-10-22. Gates observados ficam em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md); telas ou testes escritos, isoladamente, não representam aceite.

## Conversa e identidade

Uma conversa pertence ao pedido e ao tenant: `ateliers/{atelierId}/conversations/{orderId}`. `sendOrderMessage`, `getOrderConversation`, `markOrderConversationRead` e `listMessageInbox` validam Auth/e-mail, perfil ativo, ateliê ativo e acesso atual ao pedido. Equipe lê com `orders:read`/`orders:manage` e escreve com `orders:manage`; owner/admin preservam as permissões existentes. Cliente precisa ser dono pelo UID do pedido/perfil vinculado, sem conflito. E-mail verificado só é fallback quando nenhum vínculo forte existe; não contorna outro UID. Platform Owner não herda acesso ao conteúdo privado.

O UID do cliente fica fixado na conversa. Equipe sem vínculo confirmado aguarda o primeiro acesso do cliente; um vínculo conflitante não transfere o histórico automaticamente. Não há convite nem contato externo implícito. Inbox do cliente consulta somente conversas do próprio UID e revalida cada pedido; a da equipe deriva o tenant do perfil.

Conteúdo anterior escrito pelas Rules permissivas não é considerado prova de identidade do remetente. Conversas novas têm prova de criação no audit log protegido; mensagens têm operação protegida com sequência/remetente/fingerprint. Sem essas provas, o histórico fica preservado e exige conciliação, sem leitura de conteúdo não verificado. A caixa informa quantas conversas acessíveis exigem conciliação e continua mostrando as válidas. Nenhum dado real foi migrado ou removido.

## Escrita, sequência e leitura

Texto tem até 4.000 caracteres; até cinco referências únicas de anexos. Schema estrito rejeita remetente, UID destinatário, role e campos extras enviados pelo browser. A chave de request por UID/conversa e o fingerprint normalizado impedem retry com outro texto/conjunto de anexos. Envio concorrente serializa a sequência; mensagem, posição de leitura do remetente, auditoria e notificação são gravadas na mesma transação. Repetir não duplica eventos.

Histórico tem páginas de 50 mensagens por sequência, mantendo ordem cronológica e cursor anterior. Leitura é monotônica por UID e não ultrapassa a última mensagem existente; leitura antiga não desfaz uma posição mais recente. Enviar confirma leitura até a própria mensagem enviada. Cliente vê a maior posição de leitura registrada por equipe autorizada; equipe vê a posição do cliente. UI mostra somente “Enviada” e “Lida”, sem inventar estado de entrega externa, presença ou digitação.

Atualização da UI é explícita pelo botão de atualizar, com persistência/reload e proteção contra respostas de outra conta/seleção. Atualização em tempo real/polling suave é refinamento F3, sem depender de canal pago. Inbox tem teto técnico explícito de 100 conversas e anexos de 500 por pedido; excesso falha sem truncar silenciosamente. Isso não é cota comercial de plano.

## Referências a anexos

A mensagem armazena IDs, nunca URL permanente ou caminho fornecido pelo cliente. Só arquivos `order_upload` do mesmo pedido, prontos, não arquivados e já compartilhados com o cliente podem ser associados. Arquivo privado não é compartilhado implicitamente ao enviar mensagem. O cliente pode referenciar arquivos já compartilhados; não recebeu permissão nova de upload.

Cada leitura da conversa revalida compartilhamento e disponibilidade. Revogar/arquivar oculta nome/tipo/tamanho e remove o download, preservando apenas a indicação de anexo indisponível. Bytes passam pelo endpoint autenticado de F1.5 e continuam exigindo acesso atual. A auditoria de mensagens guarda identidade/evento/contagem de anexos, sem copiar texto privado ao log global.

## Notificações internas

`writeInternalNotification` grava no tenant, com ID derivado de tipo/pedido/evento/UID destinatário. Staff → cliente notifica o UID vinculado; cliente → equipe notifica o titular ativo atual do ateliê. Demais membros autorizados acompanham a caixa de conversas e seu contador de leitura; não é inventado disparo externo para todos os membros. Se o destinatário estiver indisponível, a mensagem continua registrada e o audit log informa que a notificação não foi criada.

Solicitações de aprovação de produção usam o mesmo helper idempotente e preservam o tipo `approval_required` existente. Histórico anterior desse tipo continua elegível pela autorização do próprio pedido.

`listInternalNotifications` consulta por UID, pagina 50 registros e revalida o acesso atual ao pedido antes de expor texto ou link. Cursor de outro UID é negado. Equipe não recebe itens de outro tenant mesmo se existirem documentos antigos com seu UID. `markInternalNotificationRead` afeta somente a notificação do próprio UID e não pode mudar proprietário/conteúdo. Notificações/mensagens/participantes/leituras/operações negam leitura e escrita bruta nas Rules, inclusive para owner.

Índices de collection-group para inbox e notificações foram preparados, sem deploy. E-mail, WhatsApp, push externo, gateway e serviços pagos permanecem desativados e fora deste contrato.

## Gates necessários

Integração cobre retry/fingerprint, sequência concorrente, leitura, destinatário, notificações de pedidos com a mesma chave, cursor/UID, A/B, e-mail reutilizado, conflito de vínculo, perfil inativo/não verificado, papéis, anexos/revogação, paginação e legado não verificado. Rules exercitam get/list/create/update/delete por owner, cliente, outro tenant e anônimo. Regressão de produção é obrigatória por causa do helper de aprovação; UI exige desktop/mobile com duas partes, bytes reais sintéticos e negação do terceiro tenant.

Gates locais finais em 2026-10-22: integração 5/5, produção 11/11, Rules 24/24, build/TypeScript/lint verdes; E2E desktop 1/1 (50,1s) e mobile 1/1 (25,4s), com bytes autenticados, revogação e A/B. CI remoto é acompanhado separadamente no checkpoint.
