# Matriz formal — 16 marcos do GOAL

Revisão de 24/10/2026. Cada marco vale uma unidade; somente PASS completo entra no numerador. As nove entregas F1 e as sete fases F2–F8 totalizam16. Critérios comprovados dentro de uma fase parcial continuam registrados no inventário funcional, sem promover a fase inteira.

| Marco | Estado formal | Critérios comprovados / pendência obrigatória |
| --- | --- | --- |
| F1.1 CRM | PASS LOCAL | Persistência, busca/paginação, vínculos/histórico, permissões e A×B. Regressão comercial/CRM e jornada. |
| F1.2 Equipe | PASS LOCAL | Convite hash/uso único/expiração, aceite, permissões, revogação por membership e único titular. Backend4/4 e UI final com transferência/toast. |
| F1.3 Agenda | PASS LOCAL | Capacidade, bloqueios, eventos, slots/concorrência e risco real. Conversão pelo fuso do responsável corrigida e validada no fechamento atual. |
| F1.4 Estoque | PASS LOCAL | SKU/fornecedores, movimentos, BOM/reserva/consumo/liberação, saldo não negativo, concorrência e A×B. |
| F1.5 Pedidos/produção | PASS LOCAL | Snapshots/revisões, etapas/aprovação, anexos/fotos por servidor, ownership durável e detalhe sem custos internos. |
| F1.6 Financeiro | PASS LOCAL | Centavos inteiros, ledger/correções/auditoria, recebimentos declarados, conciliação legada e idempotência/concorrência. Sem gateway. |
| F1.7 Serviços/portfólio | PASS LOCAL | Conteúdo administrativo, branding, fotos/publicação e orçamento por slug; negações/despublicação. |
| F1.8 Mensagens/notificações | PASS LOCAL | Conversa de pedido, UID, leitura/paginação, anexos revogáveis e deduplicação. Sem canais externos. |
| F1.9 Relatórios/configurações | PASS LOCAL | Indicadores reais/período/fuso/permissões, preferências persistidas e controles globais. |
| F2 Integração | PARCIAL / TESTADO_LOCALMENTE | Jornada contínua e104cenários por domínio; ownership legado e exposição de custos corrigidos. Falta comprovar acionamento automático da expiração; alternativa HTTP valida lógica, não o transporte agendado. |
| F3 UX/UI | PARCIAL / TESTADO_LOCALMENTE | Portal, rotas públicas/privadas, formulários e navegação por papel exercitados; home/perfil/pagamentos persistem. Popup Google local não comprovado por bloqueio de rede. Smoke representativo em320/375/768/1440 não é auditoria exaustiva de toda combinação de tela/teclado/dispositivo. |
| F4 Comercial | PASS LOCAL | Global Standard v01, preços/anuais/implantação, trial manual/demo, estados, CORE e downgrade sem apagar histórico. Sem quotas inventadas ou cobrança. |
| F5 Segurança | PARCIAL / TESTADO_LOCALMENTE | Rules negativas, UID/tenant/RBAC, bytes/capabilities/hash/leases, raw Storage negado/zero cross-service e inventário sintético. Tokens antigos reais e autorização/configuração de serviços reais não homologados; achados upstream mantidos. |
| F6 Estabilidade/recuperação | PARCIAL / TESTADO_LOCALMENTE | Builds/CI, sessões/revogação nos endpoints, retries/concorrência, encerramento Linux e export/import sintético com ACL. Scheduler Pub/Sub bloqueado no CLI; recuperação operacional/RPO/RTO e trigger real sem homologação. |
| F7 Homologação/release | BLOCKED / NÃO EXECUTADO | Firebase/GCS/Auth/IAM/índices/relógio/observabilidade/backup/rollback reais exigem ambiente e autorização específicos. Deploy continua proibido. |
| F8 Fechamento documental da versão | NÃO ACEITO | Evidências e handoff atuais versionados; empacotamento final de release/capturas/diagramas e mudança da versão canônica dependem dos gates anteriores. v0.2.0 continua canônica, sem release fictícia. |

**Aceite formal:10/16=62,5%.** Este índice não representa a proporção de funcionalidades implementadas nem autoriza receber clientes reais. [Inventário funcional](FUNCTIONAL_COMPLETION.md) usa critérios fracionáveis; [evidências](security/EVIDENCE_LEDGER.json) distinguem execuções aprovadas, falhas, repetições direcionadas e bloqueios.

As evidências históricas permanecem em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md). Não se apagam falhas anteriores nem se transforma um lote misto em PASS integral. A aceitação comercial continua **NÃO HOMOLOGADA**.
