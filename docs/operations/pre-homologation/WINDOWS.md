# Sessão no computador — PowerShell7

Ler [custo](COST_AND_DEPENDENCIES.md) primeiro. ZERO_BILLING bloqueia publicação completa; preflight não habilita Blaze. Instalar Git, Node22, Java21, PowerShell7 e Google Cloud CLI pelos distribuidores oficiais. Autenticação acontece no navegador/PC autorizado, sem senha/chave/token no chat. Não contornar política corporativa de execução; assinar scripts conforme política local se necessário.

## Recuperação

Comandos PowerShell; escolher a pasta real antes de começar. Se houver WIP, preservar em commit/stash revisado antes de switch/merge. Não usar reset/force. Scripts cloud-*.sh são para Linux, não PowerShell.

```powershell
Set-Location 'C:\src\cosmaker'
git status --short --branch
git remote get-url origin
git fetch origin codex/cosmaker-master-finalizacao
git switch codex/cosmaker-master-finalizacao
git merge --ff-only FETCH_HEAD
git rev-parse HEAD
node --version
java -version
$PSVersionTable.PSVersion
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Instalação raiz falhou.' }
npm ci --prefix functions
if ($LASTEXITCODE -ne 0) { throw 'Instalação Functions falhou.' }
$FirebaseCli = Join-Path $PWD 'node_modules\firebase-tools\lib\bin\firebase.js'
node $FirebaseCli --version
pwsh -NoLogo -NoProfile -File .\scripts\operations\preflight.ps1
```

Origin esperado CristianoRFB/cosmaker. Sem destino, diagnóstico retorna BLOCKED/LOCAL_OFFLINE: resultado esperado, sem consulta remota, login, seed ou deploy.

## Destino e identidade — manual indispensável

No Console Firebase/Google Cloud, conferir projeto e número, bucket, regiões, finalidade e billing; .firebaserc não comprova destino e possui default histórico real. Homologação deve usar projeto da plataforma só com dados de teste; não criar projeto por ateliê.

```powershell
New-Item -ItemType Directory -Force .local | Out-Null
Copy-Item .\docs\operations\pre-homologation\target.example.json .\.local\target.json
notepad .\.local\target.json
```

Preencher somente a cópia privada. Selecionar host; não mudar costPolicy para passar no diagnóstico sem decisão autorizada. Referência de autorização não habilita billing. Não remover requiredServices. Somente após decisão externa autorizando consumo, costPolicy pode ser USAGE_BASED_EXPLICITLY_AUTHORIZED e billingAuthorizationReference deve identificar essa decisão (ao menos12caracteres sem espaços, não é segredo). Isso não ativa billing. Após autorização para autenticar, conferir contas; login apenas se necessário:

```powershell
gcloud auth list --filter='status:ACTIVE'
node $FirebaseCli login:list
# Apenas se autorizado e faltar identidade correta:
# gcloud auth login
# node $FirebaseCli login
pwsh -NoLogo -NoProfile -File .\scripts\operations\preflight.ps1 -TargetFile .\.local\target.json -InspectRemote |
    Set-Content -Encoding utf8 .\.local\preflight.json
$Preflight = Get-Content .\.local\preflight.json -Raw | ConvertFrom-Json
if ($Preflight.blocked -ne 0) { throw 'Resolver BLOCKED antes de teste mutável/deploy.' }
```

Não usar login:list --json: pode incluir tokens. Preflight captura saída textual e só publica comparação, sem identidade pessoal. CLI/gcloud não comprovam ADC ou identidade de execução: revisar IAM separadamente. Resultado automático aprovado ainda exige gates manuais Auth/IAM/Rules/GCS/scheduler/host/backup/jurídico/autorização listados no relatório. Não é READY.

## Build e candidata

Copiar web.env.example para .env.local e preencher configuração pública em Console > Configurações do projeto > Seus apps. Nunca colocar private key em NEXT_PUBLIC. Para build real: emuladores=false, hosts de Emulator ausentes. Não usar build:local/cloud-run no PC para bundle real.

```powershell
npm run functions:build
if ($LASTEXITCODE -ne 0) { throw 'Functions não compilou.' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Next não compilou.' }
node .\scripts\operations\prepare-release.mjs --write=.local/pc-candidate-manifest.json
node .\scripts\operations\prepare-release.mjs --verify=.local/pc-candidate-manifest.json
```

Manifesto exige checkout limpo, detecta adulteração e não sobrescreve candidata. Bundle Emulator é não publicável. npm --prefix functions run deploy só produz DRY_RUN, nunca publica.

## Checklist da sessão

- [ ] Custo decidido; nenhum billing/serviço pago implícito.
- [ ] Origin/branch/HEAD/CI corretos; WIP preservado.
- [ ] Node22/Java21/PS7/Git/CLI e npm ci raiz/Functions aprovados.
- [ ] Destino privado ID/número/bucket/operador/finalidade conferidos no Console.
- [ ] Preflight local/remoto sem BLOCKED; gates manuais registrados.
- [ ] [Matriz](ENVIRONMENT_MATRIX.md) preenchida com evidência real, sem presumir defaults.
- [ ] [Backup/restore](BACKUP_RESTORE.md) comprovados, incluindo UIDs/claims/gerações.
- [ ] Autorização específica para configuração, custo e execução real registrada.
- [ ] [Publicação/retorno](PUBLICATION_ROLLBACK.md) e [aceite](REAL_ACCEPTANCE.md) executados na ordem.
- [ ] Pós-deploy/A×B/revogação/arquivos/financeiro/scheduler/recuperação aprovados.
- [ ] Jurídico revisado; nenhum cliente real liberado antes de READY.

Seleção do projeto, autenticação, decisão de custo/host, revisão IAM/Auth/domínios/e-mails e autorização são etapas manuais porque exigem titularidade e acesso externo, não desenvolvimento de módulos.
