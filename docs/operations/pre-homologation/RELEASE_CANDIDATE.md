# Candidata técnica 0.2.0-rc.goal-v.1

Não é versão publicada nem mudança da documentação canônica v0.2.0. package.json mantém sua versão histórica; o identificador acima organiza o pacote operacional. **Commercial readiness: NOT_READY. Homologação real: NOT_RUN.** Jurídico/termos/privacidade continuam preliminares, sem empresa/CNPJ/responsável inventados.

Código-base e hashes finais são registrados no arquivo CANDIDATE.json deste diretório; manifesto completo de artefatos fica privado em .local/ e é regenerado por prepare-release.mjs. Bundle local de Emulator é não publicável. A futura candidata real precisa novo build com configuração real, manifesto e aceite próprios; não reutilizar buildId/hashes de outra compilação.

## Escopo preservado

CRM, equipe/convites/RBAC, agenda, estoque, orçamentos/propostas/aprovação, pedidos/medidas/produção/revisões/fotos, financeiro operacional em centavos, serviços/portfólio/white-label, mensagens/notificações internas, relatórios, portal e administração/comercial existentes. [Inventário congelado](../../implementation/FUNCTIONAL_COMPLETION.md):182/184=98,91%,47operações/quatro critérios de peso1, sem alterar denominador. [Formal](../../implementation/FORMAL_ACCEPTANCE.md):10/16=62,5%; nenhum gate real promovido.

Global Standard v01/preços/anuais/implantação/trial manual/CORE/entitlements preservados. Sem gateway, checkout, WhatsApp, e-mails pagos ou novas quotas/benefícios. Nenhuma migração de dados reais prevista automaticamente. Legados só por inventário e autorização separados; não reatribuir ownership por e-mail.

## Mudanças GOAL V

- Preflight PowerShell offline/somente leitura, destino/identidade/custo conferidos; fixtures não podem consultar real. Testado em PowerShell7 no Linux e job Windows nativo.
- Admin/slug antigos agora começam em dry-run sem SDK/rede; real exige projeto confirmado/autorização explícita e adminUID existente verificado. Atalho de deploy Functions virou preparação local.
- Manifesto/validador de artefatos e snapshot sintético com completude/checksums/UIDs/recusa de corrupção; recuperação em runtime novo com ACL preservada.
- Correção real no scheduler: paginação impede100legados inválidos de bloquearem expiração válida; concorrência/replay/UTC/A×B/histórico aprovados pelo wrapper HTTP. Transporte agendado não homologado.

Ambiente: Node22/Java21/Next15, locks raiz/Functions, CLI15.34.1; variáveis públicas mínimas em web.env.example e destino privado target.example.json. Runtime usa ADC/FIREBASE_CONFIG; não requer chaves privadas versionadas. Region us-central1 atual; buckets não inferidos por sufixo. O host dinâmico ainda depende de decisão/custo externos.

Resultados novos detalhados no [handoff](HANDOFF.md) e no [progresso](../../implementation/MASTER_FINALIZATION_PROGRESS.md); falhas vermelhas e ensaios intermediários preservados.104cenários SDK/Rules/UX prévios só reutilizados onde fonte/configuração relevante não mudou. Novos guards/recovery e scheduler têm evidência própria. CI final deve incluir Linux, Windows, build,124unitários, testes operacionais e verificador do inventário; CI não executa automaticamente104integrações ou homologação real.

## Riscos e gates restantes

Google local sem permissão efetiva; transporte scheduler Emulator incompatível; Blaze/custo não autorizados; identidade/IAM/Auth/domínios/e-mails/índices/GCS preconditions/URL legada/App Check/abuso/host reais; backup operacional/RPO/RTO, gerações/tokens no restore e responsabilidade/jurídico/release. Não há demonstração de segurança operacional exaustiva. Não vender recursos futuros como entregues.

Ordem da próxima sessão: [Windows](WINDOWS.md) → [custo](COST_AND_DEPENDENCIES.md) → [matriz](ENVIRONMENT_MATRIX.md) → [backup](BACKUP_RESTORE.md) → [publicação/retorno](PUBLICATION_ROLLBACK.md) → [aceite real](REAL_ACCEPTANCE.md). Parar por custo/identidade/privacidade/saldo/hash/histórico divergentes. Somente todos os gates reais aprovados, CI e autorização permitem reconsiderar READY_FOR_PRODUCTION.
