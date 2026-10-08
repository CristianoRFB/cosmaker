# Screenshots reais v0.2.0

As capturas históricas mostram o app real contra Firebase Emulator com Aurora e Luna fictícias. São evidência de UI renderizada pelo código. As novas capturas comerciais estão **PENDENTES DE CAPTURA E INSPEÇÃO** nesta redação; os paths abaixo são o contrato de saída de `scripts/capture-commercial-screenshots.mjs`, não prova de comportamento até os arquivos serem produzidos.

## Capturas comerciais esperadas

| Tela / estado | Rota / fixture | Formato | Arquivo esperado | Estado |
| --- | --- | --- | --- | --- |
| Catálogo/preços e gestão manual | `/admin/planos`, Platform Owner | Desktop 1440 × 1000 | `screenshots/commercial-plans-desktop.png` | PENDING |
| Catálogo/preços responsivo | `/admin/planos`, Platform Owner | Mobile 390 × 844 | `screenshots/commercial-plans-mobile.png` | PENDING |
| Edição de estado comercial e auditoria | `/admin/ateliers/atelier-premium` | Desktop 1440 × 1000 | `screenshots/commercial-state-assignment.png` | PENDING |
| Aviso de trial Premium com fim explícito | `/atelier`, Trial | Desktop 1440 × 1000 | `screenshots/commercial-trial-banner.png` | PENDING |
| Aviso demo Premium e probe local | `/atelier`, Demo | Desktop 1440 × 1000 | `screenshots/commercial-demo-banner-and-probe.png` | PENDING |
| Acesso negado pela política sintética de status | `/atelier`, past_due | Mobile 390 × 844 | `screenshots/commercial-policy-denied.png` | PENDING |

O script verifica o marcador de modo Emulator antes de autenticar, espera o conteúdo da tela e captura página completa. Use app/emuladores locais sem dados reais e seeds sintéticos. A edição visual do estado não substitui os testes de autorização/auditoria do servidor. Uma captura de probe `TEST_ONLY` não anuncia diferença de plano nem cota comercial.

## Oito capturas reais preservadas do core v0.1.0

As cópias abaixo preservam os arquivos do marco anterior; cada origem é referenciada para rastreabilidade.

| Tela | Tenant | Formato | Cópia nesta versão | Origem preservada |
| --- | --- | --- | --- | --- |
| Landing | A — Aurora | Desktop | ![Landing de Aurora desktop](screenshots/tenant-a-landing-desktop.png) | [v0.1.0](../v0.1.0/screenshots/tenant-a-landing-desktop.png) |
| Landing | A — Aurora | Mobile | ![Landing de Aurora mobile](screenshots/tenant-a-landing-mobile.png) | [v0.1.0](../v0.1.0/screenshots/tenant-a-landing-mobile.png) |
| Solicitação de orçamento | A — Aurora | Desktop | ![Formulário de Aurora desktop](screenshots/tenant-a-quote-request-desktop.png) | [v0.1.0](../v0.1.0/screenshots/tenant-a-quote-request-desktop.png) |
| Solicitação de orçamento | A — Aurora | Mobile | ![Formulário de Aurora mobile](screenshots/tenant-a-quote-request-mobile.png) | [v0.1.0](../v0.1.0/screenshots/tenant-a-quote-request-mobile.png) |
| Landing | B — Luna | Desktop | ![Landing de Luna desktop](screenshots/tenant-b-landing-desktop.png) | [v0.1.0](../v0.1.0/screenshots/tenant-b-landing-desktop.png) |
| Landing | B — Luna | Mobile | ![Landing de Luna mobile](screenshots/tenant-b-landing-mobile.png) | [v0.1.0](../v0.1.0/screenshots/tenant-b-landing-mobile.png) |
| Solicitação de orçamento | B — Luna | Desktop | ![Formulário de Luna desktop](screenshots/tenant-b-quote-request-desktop.png) | [v0.1.0](../v0.1.0/screenshots/tenant-b-quote-request-desktop.png) |
| Solicitação de orçamento | B — Luna | Mobile | ![Formulário de Luna mobile](screenshots/tenant-b-quote-request-mobile.png) | [v0.1.0](../v0.1.0/screenshots/tenant-b-quote-request-mobile.png) |

Reprodução histórica: `npm run screenshots:tenants` com Emulator/app e seed local. As capturas anteriores de plataforma, cliente e produção em `docs/screenshots/` continuam preservadas como referência de marcos anteriores.
