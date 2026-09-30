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
- Pedidos: listagens e detalhes do cliente e do ateliê usam consultas escopadas pelas regras Firebase; mostram dados da proposta aprovada, estado, datas, itens, referências e histórico. Perfil de cliente só é associado à solicitação após resposta autenticada e verificada.
- Medidas: cliente pode criar e editar fichas com campos dinâmicos, unidade e observação. Na criação do pedido, o backend copia as medidas para `measurementSnapshot`; alteração posterior da ficha não altera esse snapshot.
- Produção: a confirmação protegida do sinal libera seis etapas iniciais ponderadas; início, conclusão e bloqueio são operações server-side auditadas, com progresso calculado pelas etapas concluídas. O Kanban organiza pedidos por etapa/status e não inventa risco de atraso.
- Fotos e aprovação: uploads de JPEG/PNG/WebP são validados quanto a tamanho e assinatura pelo backend; permissões de Storage isolam equipe e cliente. Fotos podem ser internas ou visíveis, etapas podem exigir aprovação, e aprovar/solicitar ajuste cria eventos históricos sem apagar decisões anteriores.
- Segurança da produção: confirmar a entrada requer permissão financeira e não pode ser feito pelo cliente. O avanço para envio é recusado enquanto houver saldo restante. As regras bloqueiam gravações diretas de estado de pedido, etapas, pagamentos e aprovações.
- Painel SaaS para indicadores reais, lista paginada, detalhe de ateliê, suspensão/reativação com confirmação e trilha de auditoria. Dados administrativos são servidos por Cloud Functions autorizadas e não por leituras diretas da UI.
- Provisionamento de plataforma por `scripts/provision-platform-admin.mjs`: custom claim e perfil `platform_admin`, com opção segura de criar a conta usando segredo fornecido por variável de ambiente. Nenhuma senha administrativa real está no repositório.
- Suspender ateliê atualiza o estado em transação e registra auditoria. As regras Firestore e Storage verificam o estado ativo, interrompendo acesso interno e novas solicitações/upload público.
- Primitivos UI reutilizáveis e Empty States; o menu administrativo mostra apenas módulos com fluxo implementado.
- Capturas em `docs/screenshots/` cobrem as telas públicas, autenticação, solicitações/orçamentos, pedidos, produção, aprovação do cliente, medidas, administração e layouts móveis desenvolvidos.
- Verificações executadas neste marco: 28 testes unitários, 10 testes Firestore/Storage Rules no Emulator, 3 testes Playwright no build de produção apontado somente aos emuladores (inclui proposta aprovada, criação de pedido, snapshot de medidas, sinal, etapas, upload de foto e aprovação do cliente), ESLint, TypeScript, build das Cloud Functions e build otimizado Next.js.

## EM DESENVOLVIMENTO

- Administração SaaS: visão geral, diretório/detalhe de ateliês, controle ativo/suspenso e auditoria funcionam no Emulator. Usuários, planos, assinaturas, métricas avançadas e configurações ainda são estruturas sem fluxo e não aparecem no menu.
- Firebase em execução: cliente e funções estão verificados nos emuladores locais. As funções, regras e índices ainda precisam ser publicados e validados no projeto real.
- Site e captação: landing e solicitação estão implementados; o upload e a gravação dependem de `NEXT_PUBLIC_DEFAULT_ATELIER_ID` e de `publicAteliers/{atelierId}.quoteRequestsEnabled` ativo.
- Pedidos e medidas: o fluxo da proposta aprovada até criação do pedido, snapshot imutável e produção com foto/aprovação foi verificado ponta a ponta no Emulator. CRM completo, editor de etapas/responsáveis e gestão operacional de materiais/arquivos continuam pendentes.
- Produção: etapas padrão, quadro Kanban, progresso ponderado, upload de fotos e aprovação do cliente estão funcionais. Edição de etapas, atribuição de responsáveis/prazos, pedidos formais de alteração e cálculo de risco com base em capacidade ainda não foram implementados.
- Pagamentos: registro administrativo protegido da entrada recebida está funcional. Gateway, cobranças automáticas, parcelas, reembolso e livro financeiro seguem pendentes.
- Login Google: a chamada Firebase Auth e o botão estão implementados; o provedor precisa estar habilitado nas configurações do projeto. O login social padrão está na faixa sem custo do Firebase Authentication no limite do Spark (3.000 DAUs para a maioria dos provedores); telefone/SMS fica fora desta decisão ([preços e limites oficiais](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [limites do Auth](https://firebase.google.com/docs/auth/limits)).

## PENDENTE

- CRM completo de clientes (histórico consolidado de pedidos, orçamentos, medidas e pagamentos); gestão de equipe/membros e onboarding de ateliê.
- Operação administrativa detalhada do pedido, incluindo edição de estado, anexos, materiais, pagamentos, entrega e ações operacionais.
- Medidas ainda precisam de controles de acesso/consentimento e experiência administrativa do ateliê para coleta e revisão.
- Editor de etapas configuráveis, responsáveis e prazos de produção; pedido formal de alteração com impacto comercial e aprovação prévia.
- Agenda por carga/capacidade, alocações, bloqueios, férias e cálculo de risco de atraso com dados operacionais reais.
- Gateway de pagamento, cobranças/parcelas, reembolsos e livro financeiro; confirmação de pagamento externo por backend/webhook.
- Estoque, fornecedores, transações de inventário, portfólio publicável e notificações internas.
- Módulos SaaS de usuários, planos, assinaturas, relatórios e configurações.
- E2E de criação de conta, envio público de solicitação e upload de referências, pedido de alteração comercial e integração de pagamento.
- Proteção adicional para intake público: App Check, limite de abuso, alertas e monitoramento operacional.
- Auditoria operacional abrangente das ações críticas de todos os módulos.
- Cobertura E2E ainda não inclui criação de conta, solicitação pública com upload de referências nem pedidos de alteração comercial.

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
- `demo-cosmaker` é apenas o identificador técnico do projeto usado pela Firebase Emulator Suite; contas e registros de teste só existem no ambiente local isolado. O Cosmaker OS é o sistema empresarial real em desenvolvimento; o Emulator é a fronteira local de integração e testes.

## INTEGRAÇÕES QUE EXIGEM CREDENCIAIS

- Firebase Web: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` e `NEXT_PUBLIC_DEFAULT_ATELIER_ID`.
- Firebase Admin e provisionamento de plataforma: Application Default Credentials ou `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL` e `FIREBASE_ADMIN_PRIVATE_KEY`; confirme o ID de projeto em `COSMAKER_CONFIRM_PLATFORM_ADMIN`. Para criar o primeiro login pelo script, informe o e-mail e senha somente em variáveis de ambiente seguras.
- Gateway de pagamento: `PAYMENT_PROVIDER_TOKEN` e `PAYMENT_WEBHOOK_SECRET`.
- WhatsApp: `WHATSAPP_API_TOKEN`.
- E-mail transacional: `EMAIL_API_KEY`.
