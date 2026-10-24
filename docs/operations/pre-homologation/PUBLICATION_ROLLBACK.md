# Publicação e retorno — preparação sem execução

Deploy, IAM, billing, migração e alteração de rede NÃO EXECUTADOS. Preflight não chama esta rotina. Preparador só inventaria hashes e produz DRY_RUN; não existe --execute. Autorização deste GOAL não autoriza executar os comandos reais abaixo. Usar apenas no PC após decisão de custo, destino/preflight/gates manuais/backup comprovados e autorização específica.

## Registro privado antes de publicar

Registrar projeto+número/operador, commit/CI/candidata, manifesto local de artefatos, configuração pública compilada, estado Auth/IAM/bucket/job, export/restore comprovados, Rules/índices/versionamento e release anterior do host. Referências de retorno são reais: no primeiro deploy podem ser **NONE**, nunca inventar SHA/revisão anterior. Sem versão anterior: plano é manter tráfego fechado e corrigir, não prometer rollback inexistente.

Usar worktree separado para versão anterior; não resetar branch. Não sobrescrever .env/credenciais com Git. Verificar candidatas com prepare-release --verify antes de cada operação. Não publicar bundle EMULATOR_ONLY_NOT_DEPLOYABLE. Migração não é obrigatória por default; nenhuma migração de dados reais está planejada automaticamente. Legados requerem inventário/dry-run e autorização por operação.

## Ordem futura

1. Custo/identidade/projeto/hospedagem/autorização aprovados; apps reais ainda fechados. Configurar Auth/domínios/IAM/bucket/serviços conscientemente pelo roteiro, sem defaults presumidos.
2. Backup/export e restore de teste aprovados; pausar writers/jobs conforme janela, registrar estado anterior. Registrar rollback por camada.
3. Publicar primeiro Rules Firestore seguras e Storage deny-all, antes de qualquer carga de dados; depois índices e aguardar READY, Functions/trigger; nenhum tráfego antes de consistência entre servidor e Rules. Se houver sistema anterior com raw Storage, negar raw pode interrompê-lo: janela/cutover aprovada obrigatória.
4. Confirmar identidade/runtime/region/endpoints e invoker privado do scheduler. O deploy v2 pode ativar job automaticamente: projeto de homologação deve conter só dados sintéticos e já ter janela/backup aprovados. Não criar cron público alternativo.
5. Publicar host Next escolhido com configuração real compilada, TLS/headers/cache corretos. firebase.json atual não tem hosting: não rodar deploy hosting ou inventar rewrites. Decisão de provedor continua externa. NEXT_NODE: build+start Node22 por host/reverse proxy aprovados; App Hosting: fluxo oficial do backend/rollout escolhido após autorização de custo.
6. [Aceite real](REAL_ACCEPTANCE.md), pós-deploy abaixo e monitoramento. Só liberar clientes reais após READY verificável.

Comandos PowerShell deliberadamente comentados; abrir/rodar o documento não publica nada. ProjectId/Operator vêm do destino privado conferido.

```powershell
# node $FirebaseCli deploy --only firestore:rules --project $ProjectId --account $Operator
# node $FirebaseCli deploy --only storage --project $ProjectId --account $Operator
# node $FirebaseCli deploy --only firestore:indexes --project $ProjectId --account $Operator
# node $FirebaseCli deploy --only functions --project $ProjectId --account $Operator
```

Não usar --force, ignorar deleções propostas pelo CLI, habilitar APIs/billing por prompt ou aceitar identidade sem revisão. Se o CLI sugerir excluir função/alterar trigger/região, parar e comparar manifesto antes de responder. Verificar índices por consulta real; emulador não exige todos os índices.

## Rollback por camada

| Camada | Retorno preparado | Validação antes de reabrir |
| --- | --- | --- |
| Web/host | Release anterior identificada ou build do commit/lock/config anterior em worktree privado; rollout do provedor escolhido | Meta de ambiente/config, deep links, Auth, 404, headers/cache e quatro larguras. |
| Functions/trigger | Reimplantar fonte/lock/env anterior seguro com projeto explícito; conferir diff de exports/IAM/trigger antes | Não remover auditoria nem duplicar Eventarc; uma ordem por aprovação/retry e bytes privados. |
| Firestore Rules | Fonte anterior revisada/segura e ID do ruleset guardado; deploy só dessa camada | A×B/UID/raw negativos e positivos; nunca permissiva global como retorno. |
| Storage Rules/IAM | Rules deny-all ou anterior segura compatível com clientes; bindings anteriores revisados | Raw/URL antiga negados, servidor legítimo positivo; token permanente não é revogado por rollback de Rules. |
| Índices | Preservar antigos durante a janela; novos podem coexistir | Consultas críticas sem erro; não apagar índice para voltar por tentativa. |
| Scheduler | Pause autorizado, preservar nome/config/IAM; resume só após aceite | Job/OIDC UTC/at-most-one efeito por estado; não excluir/recriar gerenciado manualmente. |
| Auth | Reverter só provedor/domínio/claim/concessão específica; revogar sessão sob autorização | UID/vínculos/conta histórica preservados; evitar bulk delete/recriação. |
| Dados/Storage | [Restore isolado e conferência](BACKUP_RESTORE.md); retorno de versão não desfaz writes já feitos | Contagens/UIDs/hash/generation/centavos/histórico/ACL/replay antes de tráfego. |

## Pós-deploy e critérios de parada

- [ ] Projeto/número/SA/região/Node22 e configuração real no bundle conferidos.
- [ ] Auth e-mail/Google/domínios/expiração/reset/revogação comprovados.
- [ ] Índices READY; queries não truncadas; perfil/membership/tenant ativos exigidos.
- [ ] A×B, UID alheio e e-mail reutilizado negados em banco/Functions/bytes.
- [ ] MIME/assinatura/hash/limite/retry/colisão/GCS preconditions aprovados; tokens antigos tratados.
- [ ] Financeiro/reservas/revisões/produção/histórico/relatórios consistentes sob retry/concorrência.
- [ ] Scheduler real agendado e redelivery aprovados; invoker anônimo negado.
- [ ] Backup/restore/rollback completos e RPO/RTO medidos; nenhuma falha parcial pendente.
- [ ] Monitoramento de erros/custo e responsabilidade operacional aprovados; jurídico deixou de preliminar mediante revisão.

Parar por qualquer acesso indevido, saldo/hash divergente, duplicação, token privado, custo não aprovado, perfil errado, índice ausente ou recuperação incompleta. Registrar falha/ID de execução privado e acionar retorno da camada; não mascarar erro com relaxamento de permissão.

**READY_FOR_PRODUCTION** somente com todos os checks reais obrigatórios PASS, duas operações bloqueadas com evidência correspondente, matriz formal revisada, custos/infra/segurança/recuperação/operação/jurídico aprovados, CI do HEAD e autorização de publicação. Até lá: NOT_READY / HOMOLOGAÇÃO_REAL_PENDENTE.
