# Backup, restauração e falha parcial

**Sintético aprovado; recuperação real NOT_RUN.** O harness existente agora sela export completo Auth/Firestore/Storage com hashes/UID inventory antes do import em instâncias novas. Recusa arquivo ausente, extra, alterado, UID duplicado, destino arbitrário e symlink. A importação é só demo-cosmaker; não aceitar snapshots reais nesse harness.

## Procedimento local já preparado

PowerShell, sem Bash; encerrar outros emuladores antes:

```powershell
npm run test:recovery
```

Esse teste cria/remaneja só suas fixtures sintéticas. `synthetic-snapshot.mjs <export-dir>` inspeciona sem gravar; --seal cria manifesto exclusivo; --verify impede import adulterado. Paths aceitos só em .firebase/recovery-<nonce>/export. Não é ferramenta de backup real/RPO/RTO nem restauração de Functions.

## Preflight obrigatório para dados reais, em sessão futura

Confirmar autorização de leitura/exportação, ID+número origem/destino, operador e ADC, IAM, billing, localização, bucket de backup privado, criptografia, retenção e espaço. Congelar writes e pausar triggers/jobs sob autorização antes de obter um conjunto consistente. Exports de serviços distintos não são transação global. Capturar Rules/índices/IAM/Auth/host/versão/job antes e checkpoint consistente. Não usar dados reais como fixture ou publicar inventário/PII.

Bucket de backup deve ser distinto do bucket servido pelo app, privado, com localização compatível e acesso mínimo. Confirmar ausência de allUsers, retenção/versionamento/soft-delete e sua janela de recuperação: defaults não contam como prova. Retenção/retenção imutável e habilitação de versionamento podem gerar custos e demandam decisão própria.

## Inventário e exportação futuros

Exemplo PowerShell. Variáveis ProjectId/Bucket/Operator vêm do destino privado do preflight. Não executar por existir neste documento; export cria arquivos/dados privados e pode cobrar. Aplicar apenas na janela/autorização registrada. Diretório .local é ignorado, mas não substitui criptografia/ACL do computador.

```powershell
$RunId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$BackupRoot = Join-Path $PWD ".local\backup-$RunId"
$BackupBucket = Read-Host 'Bucket privado aprovado, sem prefixo gs://'
New-Item -ItemType Directory $BackupRoot | Out-Null
gcloud storage ls "gs://$Bucket/**" --json --all-versions --project=$ProjectId --account=$Operator |
    Set-Content -Encoding utf8 (Join-Path $BackupRoot 'storage-inventory-private.json')
# Após autorização explícita de exportação/custo:
# node $FirebaseCli auth:export (Join-Path $BackupRoot 'auth-private.json') --format=json --project $ProjectId --account $Operator
# gcloud firestore export "gs://$BackupBucket/$RunId/firestore" --database='(default)' --project=$ProjectId --account=$Operator
# gcloud storage cp --recursive "gs://$Bucket/**" "gs://$BackupBucket/$RunId/storage/" --project=$ProjectId --account=$Operator
Get-ChildItem $BackupRoot -File -Recurse |
    Get-FileHash -Algorithm SHA256 |
    Select-Object Path, Hash |
    ConvertTo-Json |
    Set-Content -Encoding utf8 (Join-Path $BackupRoot 'local-checksums-private.json')
```

Inventário Storage contém metadados potencialmente secretos; manter privado e criptografado, sem stdout público/transcript/Git. Comando de cópia acima serve para snapshot, não restaura automaticamente vínculos/generation. Incluir versões não atuais necessárias ao histórico; cotejar lista/completude e checksum GCS CRC32C/MD5 disponíveis, além de SHA256 calculado dos bytes. Metadados/custom metadata, MIME, tamanho, geração/metageração e cache devem acompanhar o inventário; não presumir que download para disco preserve metadata.

Auth: conferir contagem e conjunto de UIDs/provedores/claims/disabled, não só e-mails. Export de senha depende do algoritmo; hashes legados ausentes/incompatíveis impedem declarar backup completo de credenciais e exigem decisão explícita de recuperação, sem excluir/recriar UIDs ou presumir login recuperado; parâmetros de hash ficam em Authentication > Users > menu de parâmetros de hash. São segredos: guardar separadamente no cofre privado; nunca Git/log/transcript/clipboard compartilhado. [CLI Auth oficial](https://firebase.google.com/docs/cli/auth). Firestore: aguardar operação concluída e metadados de export íntegros, registrar contagens/centavos/timestamps/auditoria; export gerenciado não inclui Rules/índices. [Export/import oficial](https://firebase.google.com/docs/firestore/manage-data/export-import).

## Restore isolado: ordem e critérios

1. Confirmar destino isolado vazio, ID+número e autorização específica de importação. **Não importar sobre usuários/documentos reais por conveniência.** Guards do harness sintético não são removidos para isso.
2. Manter app/Functions/Eventarc/scheduler fora de tráfego/escrita e capturar estado para reativação. Implantar Rules restritivas/configuração segura autorizadas; Admin bypassa Rules, portanto congelar só frontend não basta.
3. Auth: importar UIDs originais/claims/provedores/disabled e hashes via procedimento oficial; não criar contas novas com outro UID ou marcar e-mail verificado por inferência. CLI aceita hash por argumentos: usar estação protegida sem transcript/debug e valores carregados do cofre, nunca digitados no histórico nem publicados. Revisão operacional dessa exposição é gate manual; não há executor real automático neste pacote.
4. Storage: restaurar bytes e metadata com hashes conferidos. **Cópia entre buckets/projetos cria outra generation.** Referências atuais de anexos/fotos/referências pinam generation/storageGeneration. Conferir versões originais ainda retidas ou reconciliar todos os vínculos documentados sob plano aprovado, preservando antes/depois/auditoria e hashes. Não remover checagens do leitor nem declarar restore completo só porque os objetos existem. Snapshots de aprovação/histórico exigem revisão própria; nenhuma reescrita automática deste pacote.
5. Tokens: não ressuscitar metadata de download token revogado. Backup é privado; restaurar para bucket servido exige política explícita de remoção/revogação e teste da URL antiga antes de abrir tráfego. Rules verdes não bloqueiam token permanente previamente distribuído.
6. Firestore: importar snapshot verificado, preservar vínculos UID/CRM/tenant, centavos/timestamps/versões/ledger/auditoria e índice de idempotência. Após import, conferir relações com Auth e Storage, incluindo versões/gerações. Esperar índices READY.
7. Habilitar runtime só após comparar invariantes. Login do UID original; leitura pelo handler de arquivo/hash legítimos; root raw/financeiro/Storage raw/A×B negados; revogação e e-mail reutilizado recusados. Replay de trigger/job exige ensaio explícito antes de reativar relógio real.
8. Medir RPO/RTO observados (ainda NOT_MEASURED), escopo/perdas/erros e aprovação. Nenhum RPO/RTO numérico foi prometido. Só então reabrir gradualmente e monitorar.

Comandos oficiais de import, **comentados e não executados**; substituir somente após todas as revisões acima:

```powershell
# node $FirebaseCli auth:import "$BackupRoot\auth-private.json" --project $ProjectId --account $Operator --hash-algo=SCRYPT --hash-key=$HashKey --salt-separator=$SaltSeparator --rounds=$HashRounds --mem-cost=$HashMemoryCost
# gcloud firestore import "gs://$BackupBucket/$RunId/firestore" --database='(default)' --project=$ProjectId --account=$Operator
```

## Falha parcial e retorno

Parar imediatamente se faltar UID, geração, objeto, índice, hash, saldo, perfil ou auditoria. Manter app fechado/jobs pausados; preservar original e snapshot falho para diagnóstico privado. Não deletar dados legados nem aplicar rsync com delete. Restaurar a versão anterior conhecida/configuração segura ou recomeçar o restore em outro destino isolado aprovado; nunca continuar um import parcial sobre produção sem plano. Auth/Firestore/Storage não oferecem rollback transacional conjunto. Migração/cópia de projeto e conciliação de gerações/tokens reais continuam B: preparadas como procedimento, aguardando inventário e teste reais, sem resultado inventado.
