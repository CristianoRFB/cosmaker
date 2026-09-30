# Cosmaker OS

O Cosmaker OS é um sistema empresarial para gestão de cosmakers e ateliês de cosplay. A implementação segue a arquitetura multi-tenant existente no repositório e avança por fluxos verticais auditáveis. O [status do produto](docs/STATUS.md) distingue o que já funciona dos módulos que continuam em desenvolvimento.

## Fluxos funcionais nesta versão

- Site público com apresentação do produto e solicitação de orçamento estruturada.
- Autenticação por e-mail e senha, cadastro de cliente, recuperação e verificação de e-mail. O login Google usa Firebase Authentication sem cobrança por login social padrão; o plano Spark tem limites de uso, e o botão só deve ser habilitado se a configuração do projeto permanecer sem cobrança ([preços e limites oficiais](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [configuração do Google](https://firebase.google.com/docs/auth/web/google-signin)).
- Área do ateliê para analisar solicitações, compor propostas, disponibilizar orçamento e consultar respostas do cliente.
- Área do cliente para consultar, aprovar, recusar ou pedir ajuste em uma proposta. A aprovação preserva os valores e itens e cria um pedido pelo backend.
- Portal de pedidos para cliente e ateliê, com listagens e detalhes protegidos pelo tenant/cliente, status inicial, valores aprovados, itens, prazo, histórico e referências.
- Fichas de medidas reutilizáveis do cliente com campos dinâmicos, unidades, observações e edição. Ao criar o pedido, o backend congela uma cópia das medidas; alterar a ficha atual não modifica pedidos anteriores.
- Produção com seis etapas iniciais ponderadas, transições explícitas, bloqueios, progresso consolidado e quadro Kanban por etapa atual. O ateliê confirma o recebimento da entrada por operação protegida no backend; a aprovação do cliente preserva autor, comentário, data e resultado em eventos históricos.
- Fotos de andamento são validadas pelo servidor e armazenadas no Firebase Storage. A equipe define se cada foto é interna ou visível ao cliente; etapas de prova podem exigir aprovação, e as próximas etapas ficam bloqueadas até a resposta.
- Administração SaaS com indicadores calculados no Firestore, diretório e detalhe de ateliês, suspensão/reativação e auditoria. As operações administrativas são autorizadas por Cloud Functions e registradas na trilha de auditoria.
- Regras Firestore e Storage com isolamento entre tenants, proteção de dados financeiros, verificação de e-mail para leitura de propostas e restrições de upload. A suspensão de um ateliê interrompe o acesso interno e o intake público.

CRM completo, editor de etapas e responsáveis, cálculo de risco, agenda de capacidade, pagamentos externos, livro financeiro, estoque e outras áreas continuam no plano de implementação; telas estruturais não são contadas como funcionalidades prontas. A confirmação operacional da entrada do pedido já funciona; ainda não há integração com gateway.

## Executar com o Firebase do projeto

Requisitos: Node.js 22 ou superior e npm.

```bash
npm install
```

Copie `.env.example` para `.env.local` e preencha a configuração Firebase Web e `NEXT_PUBLIC_DEFAULT_ATELIER_ID` para iniciar:

```bash
npm run dev
```

As credenciais administrativas do Firebase nunca devem ser expostas em `NEXT_PUBLIC_*`. A rotina `npm run admin:provision` usa credenciais Google Application Default Credentials; antes de executá-la contra um projeto real, informe o projeto e confirme explicitamente o ID de destino. Ela cria a conta inicial quando necessário, concede a função administrativa e atualiza o perfil `users/{uid}`.

## Ambiente local de integração

Os emuladores são usados para validar Authentication, Firestore, Storage e Cloud Functions com dados isolados. Inicie os comandos em terminais separados; os dados locais não são gravados no projeto Firebase real.

```bash
npm run firebase:emulators:local
npm run seed:emulator
npm run dev:local
```

O Emulator Suite precisa de Java 11 ou superior. `seed:emulator` cria contas de teste terminadas em `cosmaker.test`, um ateliê local e solicitações de exemplo. Ele recusa a execução sem os endpoints dos emuladores.

## Verificações

```bash
npm test
npm run test:rules
npm run test:e2e
npm run lint
npx tsc --noEmit
npm run functions:build
npm run build
```

`npm run test:rules` requer os emuladores Firestore/Storage e Java 11+. Os testes E2E requerem o Emulator Suite, o seed local e o servidor iniciado por `npm run dev:local` em `127.0.0.1:3000` (ou `E2E_BASE_URL` definido para outro endereço local); forneça `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_CLIENT_EMAIL`, `E2E_CLIENT_PASSWORD`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` e `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` no ambiente usando as credenciais locais impressas pelo seed. Os testes verificam o modo Emulator antes do login e bloqueiam a aprovação se o Admin SDK não estiver apontando para os emuladores locais.

## Capturas das telas entregues

As capturas abaixo cobrem as telas funcionais implementadas, incluindo produção, aprovação do cliente, administração e os fluxos móveis prioritários. As telas internas foram capturadas com contas e dados isolados dos emuladores Firebase.

### Site público

![Página inicial do Cosmaker OS](docs/screenshots/landing.png)

![Solicitação de orçamento](docs/screenshots/quote-request.png)

![Confirmação de solicitação](docs/screenshots/quote-request-success-empty.png)

### Autenticação

![Login](docs/screenshots/login.png)

![Cadastro](docs/screenshots/registration.png)

![Recuperação de senha](docs/screenshots/password-recovery.png)

![Verificação de e-mail](docs/screenshots/email-verification.png)

### Ateliê — solicitações e orçamentos

![Lista de solicitações](docs/screenshots/atelier-quote-requests.png)

![Detalhe de uma solicitação](docs/screenshots/atelier-quote-request-detail.png)

![Lista de orçamentos](docs/screenshots/atelier-quotes.png)

![Editor de orçamento](docs/screenshots/atelier-quote-editor.png)

![Detalhe do orçamento no ateliê](docs/screenshots/atelier-quote-detail.png)

### Cliente — orçamentos

![Orçamentos do cliente](docs/screenshots/client-quotes.png)

![Detalhe e ações do cliente sobre um orçamento](docs/screenshots/client-quote-detail.png)

![Lista de orçamentos em tela móvel](docs/screenshots/client-quotes-mobile.png)

![Detalhe do orçamento em tela móvel](docs/screenshots/client-quote-detail-mobile.png)

### Ateliê — pedidos

![Lista de pedidos do ateliê](docs/screenshots/atelier-orders.png)

![Detalhe do pedido no ateliê](docs/screenshots/atelier-order-detail.png)

### Ateliê — produção

![Visão geral da produção](docs/screenshots/atelier-production.png)

![Quadro Kanban por etapa atual](docs/screenshots/atelier-production-kanban.png)

![Detalhe de produção do pedido](docs/screenshots/atelier-order-production.png)

![Visão geral da produção em tela móvel](docs/screenshots/atelier-production-mobile.png)

![Quadro Kanban em tela móvel](docs/screenshots/atelier-production-kanban-mobile.png)

![Detalhe de produção em tela móvel](docs/screenshots/atelier-order-production-mobile.png)

### Cliente — pedidos e medidas

![Pedidos do cliente](docs/screenshots/client-orders.png)

![Detalhe do pedido do cliente](docs/screenshots/client-order-detail.png)

![Aprovação de etapa de produção pelo cliente](docs/screenshots/client-production-approval.png)

![Aprovação de produção em tela móvel](docs/screenshots/client-production-approval-mobile.png)

![Pedidos do cliente em tela móvel](docs/screenshots/client-orders-mobile.png)

![Detalhe do pedido em tela móvel](docs/screenshots/client-order-detail-mobile.png)

![Fichas de medidas do cliente](docs/screenshots/client-measurement-profiles.png)

![Edição da ficha de medidas](docs/screenshots/client-measurement-detail.png)

![Fichas de medidas em tela móvel](docs/screenshots/client-measurement-profiles-mobile.png)

![Edição de medidas em tela móvel](docs/screenshots/client-measurement-detail-mobile.png)

### Administração SaaS

![Visão geral administrativa](docs/screenshots/admin-dashboard.png)

![Diretório de ateliês](docs/screenshots/admin-ateliers.png)

![Detalhe do ateliê e controles administrativos](docs/screenshots/admin-atelier-detail.png)

![Trilha de auditoria](docs/screenshots/admin-audit.png)

![Visão geral administrativa em tela móvel](docs/screenshots/admin-dashboard-mobile.png)

![Lista de ateliês em tela móvel](docs/screenshots/admin-ateliers-mobile.png)

### Layouts móveis públicos

![Página inicial em tela móvel](docs/screenshots/landing-mobile.png)

![Solicitação de orçamento em tela móvel](docs/screenshots/quote-request-mobile.png)

![Login em tela móvel](docs/screenshots/login-mobile.png)

Para atualizar as imagens, inicie a aplicação local conectada aos emuladores, execute o seed e rode `npm run screenshots` com `SCREENSHOT_LOCAL_ADMIN=true` e `SCREENSHOT_ADMIN_PASSWORD` definidos no ambiente. A captura percorre as telas autenticadas e verifica o ciclo de suspender/reativar no ambiente local.

## Documentação

- [Status, auditoria e pendências](docs/STATUS.md)
- [Especificação do sistema](docs/initial/estruturas/sistema.txt)
- [Modelo Firebase e multi-tenancy](docs/initial/estruturas/firebase.txt)
- [Documentação inicial](docs/initial/README.md)
