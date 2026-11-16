# Clientes reais — readiness e onboarding seguro do Cosmaker OS

Estado: preparação de código e procedimento. Nenhum tenant, cobrança, dado pessoal, DNS ou deploy de produção foi criado nesta tarefa.

## Fronteiras entre ambientes

- DEMO: Worker/HTML/localStorage usado para apresentação, sem autenticação e sem pedidos reais.
- STAGING: Auth, Firestore, Functions e Storage em ambiente segregado, com dados fictícios e provas de isolamento.
- REAL: tenant específico em Firestore, usuário verificado, operador Platform Owner autorizado e dados privados. Publicação e ativação do recebimento de orçamentos são operações separadas.

O código existente já suporta businessType=caps, formulário de boné e intake no backend, além do onboarding transacional. A demo Dogstar é referência de UX, não backend confiável.

## Checklist verificável por candidato

Cada interessado recebe um manifesto estrito em onboarding/candidates/<slug>.json. Ele guarda apenas slug, vertical, estágio e checks booleanos. Nunca salvar nomes de pessoas, e-mail, telefone, CPF/CNPJ, senha, token, ID de usuário, valores negociados ou dados de pagamento num repo público.

Estágios: INTERESTED, CONTRACTED, PROVISIONED_UNPUBLISHED e LIVE. Interesse ou previsão de Pix não são contrato nem autorização para publicar.

Gate de provisionamento (precisa estar CONTRACTED):
- contractAccepted — contrato aceito;
- scopeAccepted — escopo e responsabilidades acertados;
- ownerIdentityVerified — titular e e-mail Firebase Auth verificados;
- brandAndMediaRightsVerified — autorização de marca, fotos, modelos e outros conteúdos;
- productionProjectAndCostsApproved — projeto/infraestrutura e custos aprovados;
- platformOperatorAuthorized — operador autorizado e perfil Platform Owner confirmado.

Gate de publicação (precisa estar PROVISIONED_UNPUBLISHED e cumprir todos os itens acima):
- privacyAndRetentionApproved — LGPD, consentimento, política e retenção aprovados;
- tenantIsolationAndRolesTested — testes A versus B, RBAC, revogação, admin, Functions e Rules;
- storageAndUploadsTested — uploads, limites e arquivos por tenant;
- abuseProtectionReviewed — proteção antiabuso, rate limiting e App Check revisados;
- backupAndRestoreTested — restauração/rollback testados;
- productionSmokeTested — login, orçamento, proposta, produção e cliente validados em ambiente autorizado;
- clientAcceptanceRecorded — aceite do responsável registrado;
- publicationExplicitlyAuthorized — autorização específica de publicação.

Os checks são evidências declaradas por pessoas responsáveis, não autenticação técnica. Marcar true num JSON nunca substitui verificar contrato, identidade, Rules e infraestrutura.

## Comandos read-only

    npm ci
    npm --prefix functions ci
    npm run test:readiness
    npm run test:onboarding
    npm run tenant:readiness -- --file=onboarding/candidates/dogstar-cap.json
    npm run tenant:readiness -- --file=onboarding/candidates/dogstar-cap.json --require=provisioning
    npm run tenant:readiness -- --file=onboarding/candidates/dogstar-cap.json --require=publication

Os dois últimos retornam exit code 2 quando os requisitos não estão cumpridos. O verificador só lê JSON e não se conecta ao Firebase.

## Onboarding técnico já disponível

Somente após autorização comercial e formal do responsável, executar o contrato existente em modo preflight (read-only), usando IDs e e-mails obtidos por canal seguro e nunca gravados em arquivos públicos:

    npm run tenant:onboard -- --mode=preflight --project-id=<PROJECT_ID> --name="<MARCA>" --slug=<SLUG> --business-type=caps --owner-uid=<UID_VERIFICADO> --owner-email=<EMAIL_VERIFICADO> --operator-uid=<UID_PLATFORM_OWNER>

Preflight verifica Auth, perfil do operador, slug e colisões. A operação apply dentro do Emulator cria tenant, member, slug, audit log e configuração pública DESLIGADA. Fora do Emulator, apply requer três confirmações literais adicionais e autorização externa. Este preparo não executa apply.

Não reutilizar a fixture dogstar-cap-preview como tenant real. Não importar os pedidos guardados no localStorage da demo. O plano comercial é atribuído pelo Platform Owner; pagamento Pix e orçamento de hospedagem são processos distintos.

## Gate operacional para go-live

1. Obter contrato, escopo e direitos de uso documentados, sem guardar dados pessoais em Git.
2. Aprovar projeto de hosting e custos (Firebase Cloud Functions pode exigir Blaze), privacidade e armazenamento.
3. Homologar no staging com dois tenants independentes; testar Auth/Rules/Functions/Storage, uploads, App Check, antiabuso, backup e restore.
4. Provisionar tenant privado de forma autorizada; confirmar owner e atribuir plano manualmente.
5. Aprovar domínio/deploy; habilitar published e quoteRequestsEnabled em etapa separada, auditada.
6. Testar as rotas /<slug>, /<slug>/orcamento e /<slug>/orcamento/sucesso, consentimento e alertas.
7. Em incidente, desativar intake/publicação e preservar dados. Não apagar clientes automaticamente.

## Limites para a Dogstar

O core já suporta orçamento de boné personalizado, mas não contém integralmente o Studio visual da demo, todas as variações Ultimate, o catálogo autoral, o jogo Dual Monstera, checkout, estoque ou frete. Eles só devem ser prometidos como produção após escopo, contrato, implementação compartilhada e QA. A demo permanece no Worker isolado.

Documentos relacionados: docs/implementation/DOGSTAR_CAP_PREPARATION.md, scripts/lib/tenant-onboarding-contract.mjs, docs/versions/v0.2.0/STATUS.md e docs/CURRENT.md.
