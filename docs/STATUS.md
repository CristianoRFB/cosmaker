# Status do produto

Atualizado em 30/09/2026. A classificação indica comportamento verificado; a existência de arquivos ou pastas não é evidência de funcionalidade.

## Auditoria inicial

| Módulo | Estado antes da implementação | Evidência observada |
| --- | --- | --- |
| Fundação Next.js / TypeScript | Parcialmente implementado | App Router e configuração existiam; o build falhava por falta do plugin PostCSS do Tailwind. |
| Autenticação | Somente estrutura | Rotas sem sessão Firebase ativa nem perfil do usuário carregado. |
| Multi-tenancy e permissões | Quebrado | Middleware liberava rotas e regras permitiam acesso amplo a dados e Storage dos ateliês. |
| Site público | Somente estrutura | Páginas continham texto placeholder. |
| Solicitações e orçamentos | Somente estrutura | Schemas, repositories e páginas eram stubs. |
| CRM, pedidos e medidas | Somente estrutura | Sem operações Firestore completas. |
| Produção, agenda e capacidade | Somente estrutura | Functions eram comentários e testes verificavam apenas condições triviais. |
| Pagamentos e financeiro | Quebrado | Handlers respondiam sucesso sem executar operação. |
| Estoque, fornecedores, portfólio e notificações | Somente estrutura | Arquivos sem fluxos funcionais. |
| Administração SaaS | Somente estrutura | Rotas administrativas mostravam uma tela inicial sem dados nem ações. |
| Testes | Somente estrutura | Teste placeholder sem cobertura das regras do negócio. |

## IMPLEMENTADO

- Fundação Next.js 15, React 19, TypeScript e Tailwind; scripts de build, lint, TypeScript, Vitest, Firebase Emulator e Playwright.
- Layout público e layouts protegidos para cliente, ateliê e plataforma; login/cadastro por e-mail e senha, recuperação/verificação de e-mail e criação de perfil público restrita a cliente.
- Contexto de autenticação e tenant. Guardas client-side controlam navegação, enquanto Firestore, Storage e funções callable validam permissões no backend.
- Site público, intake de orçamento com Zod, upload de referências por MIME/tamanho, consulta de solicitações pelo ateliê, editor de rascunho e publicação de propostas.
- Cliente autenticado com e-mail verificado pode consultar propostas, aprovar, recusar ou solicitar ajustes. A aprovação salva snapshot comercial imutável; o trigger cria pedido com status `waiting_deposit`, itens, arquivos e histórico.
- Painel SaaS para indicadores reais, lista paginada, detalhe de ateliê, suspensão/reativação com confirmação e trilha de auditoria. Dados administrativos são servidos por Cloud Functions autorizadas e não por leituras diretas da UI.
- Provisionamento de plataforma por `scripts/provision-platform-admin.mjs`: custom claim e perfil `platform_admin`, com opção segura de criar a conta usando segredo fornecido por variável de ambiente. Nenhuma senha administrativa real está no repositório.
- Suspender ateliê atualiza o estado em transação e registra auditoria. As regras Firestore e Storage verificam o estado ativo, interrompendo acesso interno e novas solicitações/upload público.
- Primitivos UI reutilizáveis e Empty States; o menu administrativo mostra apenas módulos com fluxo implementado.
- Capturas em `docs/screenshots/` cobrem telas públicas, autenticação, solicitações/orçamentos do ateliê, portal de orçamentos do cliente e área administrativa, incluindo layouts móveis definidos nesta etapa.
- Verificações executadas: 24 testes unitários, 7 testes Firestore/Storage Rules no Emulator, 3 fluxos Playwright (incluindo aprovação que gera pedido), ESLint, TypeScript, build das Cloud Functions e build otimizado Next.js.

## EM DESENVOLVIMENTO

- Administração SaaS: visão geral, diretório/detalhe de ateliês, controle ativo/suspenso e auditoria funcionam no Emulator. Usuários, planos, assinaturas, métricas avançadas e configurações ainda são estruturas sem fluxo e não aparecem no menu.
- Firebase em execução: cliente e funções estão verificados nos emuladores locais. As funções, regras e índices ainda precisam ser publicados e validados no projeto real.
- Site e captação: landing e solicitação estão implementados; o upload e a gravação dependem de `NEXT_PUBLIC_DEFAULT_ATELIER_ID` e de `publicAteliers/{atelierId}.quoteRequestsEnabled` ativo.
- Orçamentos e pedidos: aprovação e criação automatizada do pedido foram verificadas; dashboards/detalhes de pedido, medidas, pagamentos, materiais e acompanhamento da produção ainda não foram concluídos.
- Login Google: integração do Firebase Auth está prevista no fluxo. O provedor precisa estar habilitado na configuração do projeto. O login social padrão está na faixa sem custo do Firebase Authentication; telefone/SMS não está incluído nesta decisão ([planos oficiais](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)).

## PENDENTE

- CRM de clientes, perfil e histórico; gestão de equipe/membros e onboarding de ateliê.
- Portal de pedidos do cliente e operação administrativa detalhada do pedido; snapshot de medidas no momento de confirmação.
- Kanban, etapas, fotos, aprovações de produção, pedidos de alteração, calendário por carga/capacidade e cálculo consistente de risco.
- Pagamentos e livro financeiro; adapter de gateway com confirmação protegida por backend/webhook.
- Estoque, fornecedores, transações de inventário, portfólio publicável e notificações internas.
- Módulos SaaS de usuários, planos, assinaturas, relatórios e configurações.
- E2E de cadastro, solicitação pública com upload, produção e aprovação do cliente em todas as etapas.
- Proteção adicional para intake público: App Check, limite de abuso, alertas e monitoramento operacional.
- Auditoria operacional abrangente das ações críticas de todos os módulos.
- Cobertura E2E ainda não inclui cadastro, upload de referências, etapas de produção nem aprovação de fotos de produção.

## BLOQUEADO

- O administrador inicial informado ainda não foi provisionado no Firebase real. O repositório contém a rotina segura para isso, mas este ambiente tem apenas configuração Firebase Web; a rotina requer credencial Firebase Admin (Application Default Credentials ou service account) e confirmação do projeto alvo. Contas de teste locais dos emuladores são separadas das contas reais.
- Publicação do painel no Cloudflare fica condicionada à conclusão da etapa utilizável e da auditoria ampla solicitadas pelo usuário.
- Pagamentos, e-mail transacional e WhatsApp aguardam credenciais externas e definição de provedor.

## DECISÕES TÉCNICAS

- Manter a arquitetura e o modelo de dados multi-tenant definidos em `docs/initial/estruturas/firebase.txt`.
- Contas públicas começam como clientes. `platform_admin` é provisionado fora do cadastro público; as operações de plataforma exigem e-mail verificado e claim/perfil ativo.
- A camada visual chama repositories; operações de privilégio ficam em Cloud Functions. Regras Firebase continuam como fronteira de acesso direto.
- Identidade administrativa usa custom claim `platformAdmin` e `users/{uid}` ativo. O script nunca grava senha em arquivo ou imprime seu valor.
- Suspensão altera `ateliers/{atelierId}.active`; Firestore e Storage negam novos acessos internos e intake público.
- Indicadores da plataforma vêm de consultas/counts reais. Um ambiente sem auditoria mostra Empty State; nenhum dado de teste é apresentado como métrica de produção.
- `demo-cosmaker` é o identificador técnico do projeto Firebase Emulator; suas contas e registros de exemplo só existem no ambiente local de teste.

## INTEGRAÇÕES QUE EXIGEM CREDENCIAIS

- Firebase Web: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` e `NEXT_PUBLIC_DEFAULT_ATELIER_ID`.
- Firebase Admin e provisionamento de plataforma: Application Default Credentials ou `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL` e `FIREBASE_ADMIN_PRIVATE_KEY`; confirme o ID de projeto em `COSMAKER_CONFIRM_PLATFORM_ADMIN`. Para criar o primeiro login pelo script, informe o e-mail e senha somente em variáveis de ambiente seguras.
- Gateway de pagamento: `PAYMENT_PROVIDER_TOKEN` e `PAYMENT_WEBHOOK_SECRET`.
- WhatsApp: `WHATSAPP_API_TOKEN`.
- E-mail transacional: `EMAIL_API_KEY`.
