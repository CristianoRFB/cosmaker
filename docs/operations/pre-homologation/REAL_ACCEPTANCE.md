# Aceite real controlado — NÃO EXECUTADO

Pré-requisitos: [Windows/preflight](WINDOWS.md) sem BLOCKED, gates manuais revisados, custo/autorização específicos, backup comprovado e projeto de homologação da plataforma **inteiramente sintético**. Nenhum comando deste documento foi executado no Firebase real. Testes demo/emuladores nunca são redirecionados a serviços reais. Operações de Console/UI abaixo também exigem autorização futura, pois criam/alteram dados de teste reais na infraestrutura.

## 1. Captura somente leitura após autorização

Variáveis vêm do arquivo privado, não do alias default. Salvar evidências privadas; não publicar respostas contendo contas/nomes/objetos.

```powershell
$Target = Get-Content .\.local\target.json -Raw | ConvertFrom-Json
$ProjectId = $Target.projectId
$Region = $Target.region
$Bucket = $Target.storageBucket
$Operator = $Target.operatorEmail
gcloud firestore databases describe --database='(default)' --project=$ProjectId --account=$Operator --format=json |
    Set-Content -Encoding utf8 .\.local\database.json
gcloud firestore indexes composite list --database='(default)' --project=$ProjectId --account=$Operator --format=json |
    Set-Content -Encoding utf8 .\.local\indexes.json
gcloud functions list --gen2 --project=$ProjectId --account=$Operator --format=json |
    Set-Content -Encoding utf8 .\.local\functions.json
gcloud storage buckets describe "gs://$Bucket" --project=$ProjectId --account=$Operator --format=json |
    Set-Content -Encoding utf8 .\.local\bucket.json
gcloud scheduler jobs list --location=$Region --project=$ProjectId --account=$Operator --format=json |
    Set-Content -Encoding utf8 .\.local\jobs.json
```

Conferir Node22/região/trigger, índices READY, bucket/projeto/privacidade, SA runtime e invoker do scheduler no Console. IAM configurado, não apenas código, protege o scheduler. Transportes de navegador precisam alcançar Functions; handlers impõem UID/tenant/permissões. Não trocar isso por invoker que aceite só IAM esperando que ID token Firebase seja token Google Cloud.

## 2. Auth e quatro papéis

No navegador real HTTPS, criar/usar contas controladas de clienteA/clienteB, equipeA, ownerA/ownerB e Platform Owner. Não usar dados de clientes reais. Verificar e-mail em caixa de teste consentida; endereços .test não comprovam entrega real. Google real exige identidade controlada no provedor e aprovação; nunca usar conta Google real no Emulator.

| Ação | Evidência obrigatória |
| --- | --- |
| Cadastro→verificação→login→logout/relogin | UID igual, papel client sem tenant/claim indevidos, e-mail realmente entregue, domínio/redirect corretos. |
| Reset de senha | Código único/expirado/replay negados, senha anterior recusada, UID e vínculos preservados, recibo condicional para conta ausente. |
| Sessão expirada/revogada | Chamada nova negada, UI limpa dados/reautentica; distinguir refresh token revogado de sessão ainda válida antes da checagem. |
| Membership/perfil/tenant inativos | Negar acesso sem depender de menu oculto; reativação preserva histórico. |
| UID/e-mail reutilizado | Outra conta com contato semelhante não recupera histórico, arquivos ou pagamentos. Nenhuma mudança de UID automática. |
| Platform Owner | Operador explicitamente escolhido, verificado e UID conferido; staff/owner não acessam diretório global. |

Provisionamento, se necessário, é operação separada após revisão IAM/backup e autorização. Script padrão é dry-run; real exige todos os guards abaixo e não cria conta real. Não colocar e-mail/UID reais em arquivo versionado:

```powershell
$env:FIREBASE_ADMIN_PROJECT_ID = $ProjectId
$env:COSMAKER_ADMIN_EMAIL = Read-Host 'Conta administrativa existente e verificada'
$env:COSMAKER_EXPECTED_ADMIN_UID = Read-Host 'UID existente conferido no Console'
$env:COSMAKER_CONFIRM_PLATFORM_ADMIN = $ProjectId
$env:COSMAKER_CONFIRM_REAL_PROJECT = $ProjectId
$env:COSMAKER_REAL_OPERATION_AUTHORIZATION = Read-Host 'Referência da autorização: mínimo12caracteres sem espaços'
# Exige ADC autorizado e verificado separadamente; não criar/download de chave por conveniência.
npm run admin:provision
# Somente após revisar o dry-run, identidade, backup e autorização:
# npm run admin:provision -- --apply "--confirm-project=$ProjectId"
```

Não deixar variáveis de Emulator no processo real. Capturar antes/depois privado e renovar sessão. Guardas não verificam por si só a autoridade humana, orçamento, backup ou menor privilégio; são recusas adicionais, não autorização automática.

## 3. Jornada integrada e integridade

Pelo navegador/fluxos existentes: visitante slugA→solicitação/referências→CRM→proposta→aprovação→pedido→medidas→agenda→reserva de material→entrada declarada→produção/foto→revisão→aprovação→saldo→entrega/conclusão→histórico/mensagens/notificações/relatório. Repetir fronteira A/B e cliente alheio nos pontos sensíveis. Recarregar telas para provar persistência, não apenas toast.

Registrar IDs sintéticos/runId e saldos em centavos na evidência privada. Dois operadores/tabs fazem envios concorrentes controlados: reserva/saída não tornam estoque negativo; recebimento/retry com a mesma intenção não duplica ledger; aprovação/revisão/reentrega não duplicam pedido/auditoria. Para replay exato, usar a ferramenta de rede do navegador autorizado (por exemplo Firefox: Rede > solicitação selecionada > Editar e reenviar), mantendo o mesmo endpoint/payload/requestId e a sessão do operador. Enviar duas vezes, conferir IDs devolvidos e contar ledger/auditoria pelo requestId no Console. Não copiar/exportar headers de autorização, cookies ou tokens para relatório/Git/chat. Para concorrência de saldo, duas intenções distintas disputam o mesmo estoque/saldo sintético; uma operação incompatível deve ser recusada. Registrar antes/depois/versão/IDs. Os104testes Emulator não podem ser apontados para real removendo guards.

Parar em qualquer discrepância de saldo, ownership, snapshot, histórico ou duplicação. Comparar totais de relatórios com os registros reais do runId; nenhum valor estático substitui evidência. Financeiro é operacional/manual, sem gateway ou movimentação bancária.

## 4. Arquivos privados e GCS

Enviar PNG/JPEG/WebP e PDF quando permitido pelo contrato; bytes/assinatura/MIME/tamanho e SHA256 devem conferir. Referências/fotos/galeria têm limites dos contratos; anexos até20MiB, imagens até10MiB. Ensaiar tamanho excessivo, MIME falso, hash errado, replay/expiração de capability, colisão e dois uploads concorrentes. Preservar primeiro objeto/geração. No GCS real, comprovar ifGenerationMatch=0; Emulator não basta.

Requisição sem sessão/UID errado/tenantB deve negar metadados e bytes. Raw Storage permanece negado até para staff; leitura legítima passa pelo handler. Revogar compartilhamento/perfil/membership e repetir nova leitura, incluindo URL antiga. Inventário/revogação global de tokens requer janela própria, nunca exclusão de arquivos. Conferir no-store/nosniff e ausência de download tokens permanentes nas respostas.

## 5. Scheduler v2 — não confundir lógica com transporte

Código usa onSchedule every60minutes/UTC, paginação por snapshot e transação com revalidação de estado/data/namespace. Lógica HTTP local tem evidência; o transporte Emulator segue BLOCKED. O deploy v2 cria job+HTTP; confirmar nome real listado, alvo, OIDC/audience, SA e invoker restrito. Não presumir o sufixo -0 do Emulator em produção.

Em projeto totalmente sintético, montar propostas ontem/hoje/amanhã UTC, inválidas suficientes para ultrapassar uma página, duas tenants, versão antiga com solicitação apontando à nova e namespace externo. Preparar pelo contexto autorizado de testes; não editar dados comerciais de pessoas reais. Capturar ledger/auditoria antes. Primeiro observar execução pelo relógio real; depois executar o mesmo job duas vezes para comprovar redelivery, sob autorização:

```powershell
$JobName = Read-Host 'Nome exato do job confirmado no arquivo privado jobs.json'
gcloud scheduler jobs describe $JobName --location=$Region --project=$ProjectId --account=$Operator --format=json |
    Set-Content -Encoding utf8 .\.local\scheduler-before.json
# Operações mutáveis futuras, somente após aprovação e confirmação de projeto inteiramente sintético:
# gcloud scheduler jobs run $JobName --location=$Region --project=$ProjectId --account=$Operator
# gcloud scheduler jobs run $JobName --location=$Region --project=$ProjectId --account=$Operator
```

Ontem expira uma vez; hoje/futuro/inválidos/namespace externo permanecem; pedido/solicitação de versão nova não é alterado por proposta antiga; auditoria não duplica. Scheduler é system, não concede UID de cliente; preservar ownership/tenant. IAM deve negar invocação anônima; headers forjados não autorizam chamada. Registar scheduledTime/job/execução e UTC. Job pode sobrepor execuções: transações devem manter resultado idempotente. Falha: pausar autorizado, preservar evidência e seguir rollback, sem tornar cron público.

## 6. Recuperação e interface

Executar [restore isolado](BACKUP_RESTORE.md), depois repetir login, A/B, revogação, financeiro, histórico e leitura protegida. Conferir geração dos objetos, não só presença de arquivos. No host final:320/375/768/1440, menus/modais, teclado móvel, loading/erro/retry/vazio, uploads, deep links/404, fontes/assets/TLS/headers/cache. Nenhuma falha vira PASS por build verde. Só registrar HOMOLOGAÇÃO_REAL_COMPROVADA quando todas as evidências obrigatórias estiverem aprovadas.
