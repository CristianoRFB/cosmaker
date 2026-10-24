#requires -Version 7.0
[CmdletBinding()]
param(
    [string]$TargetFile,
    [switch]$InspectRemote,
    [string]$FixturePath
)
# Read-only diagnostics. No deployment, login, API enablement, seed or write SDK.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$checks = [Collections.Generic.List[object]]::new()
$fixture = $null
if ($FixturePath) {
    if ($InspectRemote) { throw 'Fixture e consultas reais são mutuamente exclusivos.' }
    $fixture = Get-Content -LiteralPath $FixturePath -Raw | ConvertFrom-Json -AsHashtable
    if ($fixture.syntheticOnly -ne $true -or $fixture.projectId -ne 'demo-cosmaker') { throw 'Fixture deve ser sintética de demo-cosmaker.' }
}
if (-not $TargetFile) { $TargetFile = Join-Path $root 'docs/operations/pre-homologation/target.example.json' }
$target = Get-Content -LiteralPath $TargetFile -Raw | ConvertFrom-Json -AsHashtable
if ($target.schemaVersion -ne 1) { throw 'Contrato de destino incompatível.' }
if ($fixture -and $target.projectId -ne 'demo-cosmaker') { throw 'Fixture não aceita destino real.' }

function Add-Check([string]$Name, [bool]$Pass, [string]$Detail) {
    $checks.Add(@{ name = $Name; state = $(if ($Pass) { 'PASS' } else { 'BLOCKED' }); detail = $Detail })
}
function Probe([string]$Name) {
    if ($fixture) {
        if (-not $fixture.probes.ContainsKey($Name)) { return '' }
        return [string]$fixture.probes[$Name]
    }
    try {
        $cli = Join-Path $root 'node_modules/firebase-tools/lib/bin/firebase.js'
        $value = switch ($Name) {
            node { & node --version 2>&1 }
            npm { & npm --version 2>&1 }
            java { & java -version 2>&1 }
            git { & git --version 2>&1 }
            firebase { & node $cli --version 2>&1 }
            origin { & git remote get-url origin 2>&1 }
            branch { & git branch --show-current 2>&1 }
            head { & git rev-parse HEAD 2>&1 }
            status { & git status --porcelain 2>&1 }
            gcloud { & gcloud version --format=json 2>&1 }
            identity { & gcloud auth list --filter='status:ACTIVE' --format=json 2>&1 }
            # Never login:list --json: that CLI response can contain account tokens.
            firebaseIdentity { & node $cli login:list --non-interactive 2>&1 }
            project { & gcloud projects describe $target.projectId --account=$($target.operatorEmail) --format=json 2>&1 }
            firebaseProject { & node $cli projects:list --account $target.operatorEmail --json --non-interactive 2>&1 }
            billing { & gcloud billing projects describe $target.projectId --account=$($target.operatorEmail) --format=json 2>&1 }
            services { & gcloud services list --enabled --project=$($target.projectId) --account=$($target.operatorEmail) --format=json 2>&1 }
            bucket { & gcloud storage buckets describe "gs://$($target.storageBucket)" --project=$($target.projectId) --account=$($target.operatorEmail) --format=json 2>&1 }
            database { & gcloud firestore databases describe --database='(default)' --project=$($target.projectId) --account=$($target.operatorEmail) --format=json 2>&1 }
            iam { & gcloud projects get-iam-policy $target.projectId --account=$($target.operatorEmail) --format=json 2>&1 }
            default { throw 'Consulta não permitida.' }
        }
        if ($LASTEXITCODE -ne 0) { return '' }
        # Captured responses stay in memory; never print raw output or environment.
        return (($value | Out-String).Trim() -replace '\x1b\[[0-9;]*m', '')
    } catch { return '' }
}
function Json-Probe([string]$Name) {
    try { return (Probe $Name | ConvertFrom-Json -AsHashtable) } catch { return $null }
}

Push-Location $root
try {
    Add-Check 'node22' ((Probe 'node') -match '^v22\.') 'Node22 exigido.'
    Add-Check 'npm' ((Probe 'npm') -match '^\d+\.') 'npm disponível.'
    Add-Check 'java21' ((Probe 'java') -match 'version "21\.') 'Java21 para Emulator.'
    Add-Check 'git' ((Probe 'git') -match '^git version ') 'Git disponível.'
    $lock = Get-Content -LiteralPath (Join-Path $root 'package-lock.json') -Raw | ConvertFrom-Json -AsHashtable
    Add-Check 'firebaseCLI' ((Probe 'firebase') -eq $lock.packages['node_modules/firebase-tools'].version) 'CLI local precisa corresponder exatamente ao lockfile aprovado.'
    Add-Check 'origin' ((Probe 'origin') -eq 'https://github.com/CristianoRFB/cosmaker.git') 'Origin esperado, sem aceitar repositório de outra organização.'
    Add-Check 'branch' ((Probe 'branch') -eq 'codex/cosmaker-master-finalizacao') 'Branch autorizada.'
    $head = Probe 'head'
    Add-Check 'head' ($head -match '^[0-9a-f]{40}$') 'HEAD disponível; comparar com manifesto e CI aprovado.'
    Add-Check 'checkout' ((Probe 'status') -eq '') 'Checkout limpo; preservar qualquer WIP.'
    Add-Check 'dependencies' ($fixture -or ((Test-Path (Join-Path $root 'node_modules')) -and (Test-Path (Join-Path $root 'functions/node_modules')))) 'Dependências raiz e Functions instaladas.'
    $configured = ($target.projectId -match '^[a-z][a-z0-9-]{4,28}[a-z0-9]$') -and ($target.projectNumber -match '^\d+$') -and ($target.operatorEmail -match '^[^\s@]+@[^\s@]+\.[^\s@]+$') -and ($target.storageBucket -match '^[a-z0-9][a-z0-9._-]+$')
    Add-Check 'explicitTarget' $configured 'Preencher projeto, número, bucket e operador no arquivo privado; não usar o default de .firebaserc.'
    Add-Check 'region' ($target.region -eq 'us-central1') 'Região atual dos clientes/endpoints e Functions; não mudar silenciosamente.'
    $requiredServices = @('identitytoolkit.googleapis.com', 'firestore.googleapis.com', 'storage.googleapis.com', 'cloudfunctions.googleapis.com', 'run.googleapis.com', 'cloudbuild.googleapis.com', 'artifactregistry.googleapis.com', 'eventarc.googleapis.com', 'pubsub.googleapis.com', 'cloudscheduler.googleapis.com')
    Add-Check 'serviceContract' (@($requiredServices | Where-Object { $_ -notin $target.requiredServices }).Count -eq 0) 'Catálogo de APIs não pode omitir dependências do trigger Firestore/Eventarc ou scheduler.'
    $originValid = $false
    try { $uri = [Uri]$target.appOrigin; $originValid = $uri.IsAbsoluteUri -and $uri.Scheme -eq 'https' -and -not $uri.UserInfo -and $uri.AbsolutePath -eq '/' } catch {}
    Add-Check 'hostingDecision' ($originValid -and $target.hostingMode -in @('NEXT_NODE', 'APP_HOSTING')) 'Decidir hospedagem Next15; Hosting estático não aceita sozinho as rotas dinâmicas atuais.'
    $costApproved = $target.costPolicy -eq 'USAGE_BASED_EXPLICITLY_AUTHORIZED' -and [string]$target.billingAuthorizationReference -match '\S{12,}'
    Add-Check 'economicViability' $costApproved 'Produto completo exige billing/Blaze; ZERO_BILLING bloqueia implantação. Referência de autorização não habilita billing.'
    if ($InspectRemote -or $fixture) {
        if (-not $configured -or (-not $fixture -and $target.projectId.StartsWith('demo-'))) { throw 'Consulta real requer destino real explícito válido; fixture exige demo-cosmaker.' }
        Add-Check 'gcloud' ([bool](Json-Probe 'gcloud')) 'Google Cloud CLI disponível.'
        $identities = @(Json-Probe 'identity')
        $active = @($identities | Where-Object { $_ -and $_.ContainsKey('status') -and $_.status -eq 'ACTIVE' })
        Add-Check 'operatorIdentity' ($active.Count -eq 1 -and $active[0].account -eq $target.operatorEmail) 'Identidade ativa deve corresponder ao operador esperado; e-mail não é exportado.'
        $firebaseIdentity = Probe 'firebaseIdentity'
        Add-Check 'firebaseIdentity' ($firebaseIdentity -match ('Logged in as ' + [regex]::Escape($target.operatorEmail) + '(\s|$)')) 'Identidade CLI Firebase conferida separadamente de gcloud; ADC/identidade de execução continuam revisão manual.'
        $project = Json-Probe 'project'
        Add-Check 'projectIdentity' ($null -ne $project -and $project.projectId -eq $target.projectId -and [string]$project.projectNumber -eq [string]$target.projectNumber -and $project.lifecycleState -eq 'ACTIVE') 'ID/número/estado devem corresponder, sem provisionar projeto.'
        $projects = Json-Probe 'firebaseProject'
        $found = @()
        if ($projects -and $projects.status -eq 'success') { $found = @($projects.result | Where-Object { $_.projectId -eq $target.projectId -and [string]$_.projectNumber -eq [string]$target.projectNumber }) }
        Add-Check 'firebaseProject' ($found.Count -eq 1) 'Projeto Firebase visível ao operador explícito.'
        $billing = Json-Probe 'billing'
        Add-Check 'billing' ($billing -and $billing.billingEnabled -eq $true -and $costApproved) 'Billing somente consultado; limites gratuitos não garantem conta zero.'
        $services = @(Json-Probe 'services')
        $enabled = @($services | Where-Object { $_ -and $_.ContainsKey('config') } | ForEach-Object { $_.config.name })
        $missing = @($requiredServices | Where-Object { $_ -notin $enabled })
        Add-Check 'services' ($missing.Count -eq 0) 'APIs necessárias já habilitadas; este script não habilita serviços.'
        $bucket = Json-Probe 'bucket'
        $bucketProject = $null
        if ($bucket -and $bucket.ContainsKey('project_number')) { $bucketProject = [string]$bucket.project_number }
        elseif ($bucket -and $bucket.ContainsKey('projectNumber')) { $bucketProject = [string]$bucket.projectNumber }
        Add-Check 'bucket' ($bucket -and $bucket.name -eq $target.storageBucket -and $bucketProject -eq [string]$target.projectNumber) 'Nome e projeto proprietário exatos do bucket; não presumir sufixo ou aceitar bucket alheio legível.'
        $database = $null
        if ('firestore.googleapis.com' -in $enabled) { $database = Json-Probe 'database' }
        Add-Check 'database' ($database -and $database.type -eq 'FIRESTORE_NATIVE' -and $database.name -in @("projects/$($target.projectId)/databases/(default)", "projects/$($target.projectNumber)/databases/(default)")) 'Database(default) Native no projeto correto; se API ausente, nenhuma tentativa de habilitação.'
        $iam = Json-Probe 'iam'
        Add-Check 'iamReadable' ($iam -and $iam.ContainsKey('bindings')) 'Política legível; isso não comprova permissões efetivas, grupos, deny policies ou menor privilégio.'
    } else {
        $checks.Add(@{ name = 'remoteEvidence'; state = 'NOT_RUN'; detail = 'Padrão offline: identidade, projeto, IAM, APIs, billing e bucket reais não foram consultados.' })
    }
    $manual = @('Auth/provedores/domínios/e-mails/enumeração/sessões', 'ADC e service accounts/menor privilégio', 'Firestore/índices e Rules reais', 'GCS preconditions/tokens legados', 'Scheduler OIDC/relógio/replay', 'Hospedagem/headers/cache', 'Backup/restauração/rollback comprovados', 'Autorização de custo e execução/jurídico')
    $blocked = @($checks | Where-Object { $_.state -eq 'BLOCKED' }).Count
    $report = @{ schemaVersion = 1; evidenceKind = $(if ($fixture) { 'SYNTHETIC' } elseif ($InspectRemote) { 'LIVE_READ_ONLY' } else { 'LOCAL_OFFLINE' }); projectId = $target.projectId; head = $head; checks = @($checks); blocked = $blocked; manualGates = $manual; deployExecuted = $false; readyForProduction = $false; status = $(if ($blocked) { 'BLOCKED' } elseif ($fixture) { 'SYNTHETIC_PASS' } else { 'AUTOMATED_CHECKS_PASSED_MANUAL_REVIEW_REQUIRED' }) }
    $report | ConvertTo-Json -Depth 8
    if ($blocked) { exit 2 }
} finally { Pop-Location }
