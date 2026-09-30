# Status do produto

Atualizado em 30/09/2026. Os estados descrevem comportamento implementado e verificado; a existência de pastas ou arquivos não é evidência de funcionalidade.

## Auditoria inicial

| Módulo | Estado antes desta entrega | Evidência |
| --- | --- | --- |
| Fundação Next.js / TypeScript | Parcialmente implementado | App Router e configurações existiam; o build falhava por ausência do plugin PostCSS do Tailwind. |
| Autenticação | Somente estrutura | Rotas eram placeholders; não havia sessão Firebase ativa nem perfil carregado. |
| Multi-tenancy e permissões | Quebrado | Middleware liberava rotas; regras permitiam acesso amplo a dados de ateliês e Storage. |
| Site público | Somente estrutura | Rotas exibiam texto de placeholder. |
| Solicitações e orçamentos | Somente estrutura | Schemas, repositories e páginas eram stubs. |
| CRM, pedidos e medidas | Somente estrutura | Sem operações Firestore implementadas. |
| Produção, agenda e capacidade | Somente estrutura | Cálculos e Functions eram comentários; o teste de capacidade só verificava `true`. |
| Pagamentos e financeiro | Quebrado | Handlers respondiam `{ ok: true, todo: true }` sem operação real. |
| Estoque, fornecedores, portfólio e notificações | Somente estrutura | Pastas e arquivos não entregavam fluxos funcionais. |
| Functions | Somente estrutura | Handlers eram stubs e `index.ts` não exportava operações. |
| Testes | Somente estrutura | Havia um teste placeholder, sem validação de regra de negócio. |

## IMPLEMENTADO

- `npm install` conclui e o lockfile está versionado. Plugin PostCSS do Tailwind v4 configurado.
- Build de produção Next.js 15 concluído após a fundação, layouts, autenticação e fluxo público desta entrega.
- ESLint, TypeScript e testes Vitest configurados; os cálculos puros de orçamento, progresso, capacidade e financeiro, além das permissões por papel, possuem testes unitários.
- Layout público responsivo com identidade visual Cosmaker OS e páginas reais para `/` e `/orcamento`.
- Solicitação de orçamento validada com Zod, com personagem, obra/franquia, categoria, descrição, referências, datas, faixa de investimento, urgência, observações e contato.
- Repository da solicitação grava no tenant configurado e envia referências JPEG/PNG/WebP com limite de 10 MB por arquivo. O envio real exige Firebase configurado e ateliê habilitado para intake público.
- Cadastro, login por e-mail/senha, recuperação de senha, verificação de e-mail e opção Google usando Firebase Authentication; perfis novos recebem papel de cliente.
- Providers para estado de sessão, perfil de usuário e contexto de tenant; layouts de cliente, ateliê e admin com estados de carregamento/erro e guard de navegação. Dados continuam protegidos pelas regras Firebase, não pelo guard do navegador.
- Primitivos reutilizáveis de UI: Button, Input, Textarea, Select, Dialog, Drawer, Card, Badge, Table, Tabs, Dropdown, Avatar, Toast, Skeleton, EmptyState e ConfirmDialog.
- Regras Firestore e Storage substituíram as regras permissivas. As rotas HTTP de integrações sem backend recusam a operação com status de indisponibilidade, em vez de responder sucesso falso.
- `docs/screenshots/` contém capturas do build de produção para as rotas desenvolvidas nesta entrega — landing, solicitação, autenticação, confirmação e estados protegidos de cliente/ateliê/admin — mais variantes móveis da landing, solicitação e login.
- README documenta execução, credenciais necessárias, comandos de validação e contém as capturas das telas entregues.

## EM DESENVOLVIMENTO

- Fundação Firebase, autenticação, perfil e seleção de tenant: código presente; ainda depende de projeto Firebase configurado e validação integrada no Emulator.
- Intake público de solicitações: código e persistência estão implementados; upload e gravação dependem da configuração Firebase e de `publicAteliers/{atelierId}.quoteRequestsEnabled` habilitado.
- Regras Firebase: autorização multi-tenant foi endurecida, mas precisa ser compilada e testada com Firebase Emulator antes de deploy.
- UI pública de rotas existentes fora da landing e solicitação ainda precisa substituir placeholders antes de ser considerada pronta.

## PENDENTE

- Onboarding protegido de ateliê e membros, associações de usuário e resolução completa de tenant ativo.
- CRM e consultas de clientes; editor e aprovação de orçamentos; pedidos e snapshot imutável de medidas.
- Kanban e produção, fotos, aprovações, alterações, agenda baseada em capacidade e cálculo de risco.
- Pagamentos e livro financeiro, estoque e fornecedores, portfólio, notificações, administração SaaS e relatórios.
- Implementações seguras de Cloud Functions para operações privilegiadas.
- Testes de integração das regras Firestore/Storage no Emulator e fluxos E2E de cadastro, orçamento, aprovação e produção.
- Adapter de App Check, limites e monitoramento contra abuso no intake público antes de produção.

## BLOQUEADO

- Teste de ponta a ponta em Firebase: aguarda projeto e variáveis de ambiente reais. Sem elas, a UI declara indisponibilidade e não simula gravações.
- Gateway de pagamento, e-mail transacional e WhatsApp aguardam contas e credenciais externas.

## DECISÕES TÉCNICAS

- Manter a arquitetura existente e a persistência multi-tenant descrita em `docs/initial/estruturas/firebase.txt`.
- Contas públicas começam como clientes. Não há criação pública de membro ou atribuição privilegiada de papel.
- Guardas client-side organizam a navegação; as regras de banco e Storage são a fronteira de autorização.
- Não mostrar números de demonstração como KPIs reais. Estados sem dados devem continuar vazios e explicativos.
- Endpoints de integrações ainda sem implementação retornam indisponibilidade explícita e não indicam operação concluída.

## INTEGRAÇÕES QUE EXIGEM CREDENCIAIS

- Firebase Web: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` e `NEXT_PUBLIC_DEFAULT_ATELIER_ID`.
- Firebase Admin / Cloud Functions: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL` e `FIREBASE_ADMIN_PRIVATE_KEY`.
- Pagamentos: `PAYMENT_PROVIDER_TOKEN` e `PAYMENT_WEBHOOK_SECRET`.
- WhatsApp: `WHATSAPP_API_TOKEN`.
- E-mail transacional: `EMAIL_API_KEY`.
