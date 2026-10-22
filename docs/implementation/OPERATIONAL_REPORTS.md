# Relatórios e preferências operacionais — F1.9

`getAtelierOperationalReport` deriva o tenant do perfil autenticado; exige e-mail verificado, perfil/membership/tenant ativos e permissões dos domínios. Um snapshot Firestore somente leitura mantém coerência entre pedidos, propostas, solicitações e ledger. Pedidos, propostas e finanças são projetados separadamente conforme `orders:read/manage`, `quotes:read/write` e `finance:read/write`; nenhuma permissão de relatórios ou direito comercial novo foi criado. Platform Owner não recebe acesso às métricas privadas dos tenants por esta operação.

A coorte de pedidos/propostas/solicitações considera a criação no período em datas civis no fuso configurado. Status e progresso são atuais. Os prazos contam pedidos ainda abertos com entrega no período, mesmo quando criados antes dele. Cancelados/reembolsados podem ser excluídos dos indicadores de pedidos. Progresso ausente é informado e não substituído por zero.

O financeiro reaproveita os contratos F1.6: custos/receitas avulsas seguem a data efetiva do ledger; acordos e recebimentos dos pedidos são a posição atual de todos os pedidos. O filtro não pretende reconstruir um balanço histórico. A UI informa essa diferença junto às métricas. Totais e margens usam centavos inteiros, sem duplicar pagamentos do ledger. Dados financeiros inconsistentes falham explicitamente. Volumes acima de 500 pedidos/propostas/solicitações ou 5.000 lançamentos exigem agregação paginada; não são apresentados totais truncados. Esses tetos são técnicos e não limites de planos.

`getOperationalPreferences` lê fuso, período padrão (1–366 dias), inclusão de cancelados e versão. Ausência usa fuso do cadastro ou America/Sao_Paulo, 30 dias e inclusão de cancelados. Valor explicitamente inválido não vira default silencioso. `saveOperationalPreferences` exige `atelier:settings`, transação com releitura de autorização, versão esperada, chave idempotente vinculada ao UID/fingerprint e auditoria atômica. Não altera agendamentos existentes, planos, preços, quotas nem assinatura.

A identidade pública usa `saveAtelierPublicProfile` existente e sua auditoria/versão. O formulário de configurações recebe apenas allowlist pública se tiver `atelier:settings`; não precisa ganhar leitura de serviços. Preferências e registros de idempotência não admitem acesso Firestore direto.

`/atelier/relatorios`, `/atelier/configuracoes` e `/atelier/configuracoes/geral` usam essas operações. `/admin/metricas` reutiliza a consulta protegida de métricas reais já existente; “Ateliês com plano ativo” descreve atribuições manuais, sem sugerir cobrança. `/admin/configuracoes` organiza os controles operacionais/comerciais/auditoria existentes. Não foram inventadas preferências globais sem contrato.

Os gates e resultados reais ficam em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md). Implementação não implica aceite antes de completar integração, Rules, build e smoke.
