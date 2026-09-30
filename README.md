# Cosmaker OS

Plataforma de gestão para cosmakers e ateliês de cosplay. O repositório preserva a arquitetura inicial e está sendo implementado em módulos, conforme as especificações do produto e do modelo multi-tenant.

> O primeiro corte funcional cobre a base Next.js, telas públicas iniciais, autenticação Firebase e envio de solicitação de orçamento. Os outros módulos ainda estão em implementação; consulte o [status detalhado](docs/STATUS.md).

## Executar localmente

Requisitos: Node.js compatível com Next.js 15 e npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sem as variáveis do Firebase, o site público e as telas de autenticação abrem, mas cadastro, login e envio da solicitação ficam indisponíveis. Preencha `.env.local` com as configurações do Firebase Web e o `NEXT_PUBLIC_DEFAULT_ATELIER_ID` para conectar Authentication, Firestore e Storage. Nunca coloque credenciais administrativas ou segredos de serviços em variáveis `NEXT_PUBLIC_*`.

## Verificações

```bash
npm test
npm run lint
npx tsc --noEmit
npm run functions:build
npm run build
```

Para atualizar as imagens no README, execute o app local e rode `npm run screenshots`. O script Playwright salva capturas em `docs/screenshots/` e falha em erro de navegação ou exceção de página.

## Telas desenvolvidas

As imagens abaixo são capturas do build de produção e mostram todas as rotas implementadas nesta entrega. As rotas de outros módulos ainda estruturais não são apresentadas como telas concluídas.

<details open>
<summary>Site público — página inicial</summary>

![Página inicial do Cosmaker OS](docs/screenshots/landing.png)

Versão móvel:

![Página inicial em tela móvel](docs/screenshots/landing-mobile.png)
</details>

<details open>
<summary>Solicitação de orçamento</summary>

![Formulário de solicitação de orçamento](docs/screenshots/quote-request.png)

Versão móvel:

![Formulário de orçamento em tela móvel](docs/screenshots/quote-request-mobile.png)
</details>

<details>
<summary>Autenticação — entrar</summary>

![Tela de login](docs/screenshots/login.png)

Versão móvel:

![Login em tela móvel](docs/screenshots/login-mobile.png)
</details>

<details>
<summary>Autenticação — criar conta</summary>

![Tela de cadastro](docs/screenshots/registration.png)
</details>

<details>
<summary>Autenticação — recuperar senha</summary>

![Tela de recuperação de senha](docs/screenshots/password-recovery.png)
</details>

<details>
<summary>Autenticação — verificar e-mail</summary>

![Tela de verificação de e-mail](docs/screenshots/email-verification.png)
</details>

<details>
<summary>Solicitação — confirmação e estado vazio</summary>

![Confirmação de solicitação sem protocolo](docs/screenshots/quote-request-success-empty.png)
</details>

<details>
<summary>Área do cliente — acesso protegido e configuração necessária</summary>

![Estado protegido da área do cliente](docs/screenshots/protected-client-setup.png)
</details>

<details>
<summary>Área do ateliê — acesso protegido e configuração necessária</summary>

![Estado protegido da área do ateliê](docs/screenshots/protected-atelier-setup.png)
</details>

<details>
<summary>Administração — acesso protegido e configuração necessária</summary>

![Estado protegido da administração](docs/screenshots/protected-admin-setup.png)
</details>

## Arquitetura e documentação

- [Status do produto e auditoria](docs/STATUS.md)
- [Especificação funcional](docs/initial/estruturas/sistema.txt)
- [Modelo Firebase e multi-tenancy](docs/initial/estruturas/firebase.txt)
- [Documentação inicial](docs/initial/README.md)

Organização da aplicação: `app/`, `components/`, `features/`, `services/`, `repositories/`, `hooks/`, `providers/`, `lib/`, `types/`, `schemas/` e `functions/`.
