# Screenshots reais

As imagens abaixo são capturas do app executando contra o Firebase Emulator após o build. Aurora e Luna são tenants fictícios de teste. Estas capturas mostram estado real renderizado pelo código, não mockups.

| Tela | Tenant | Formato | Evidência |
| --- | --- | --- | --- |
| Landing | A — Aurora | Desktop | ![Landing de Aurora em desktop](screenshots/tenant-a-landing-desktop.png) |
| Landing | A — Aurora | Mobile | ![Landing de Aurora em mobile](screenshots/tenant-a-landing-mobile.png) |
| Solicitação de orçamento | A — Aurora | Desktop | ![Formulário de Aurora em desktop](screenshots/tenant-a-quote-request-desktop.png) |
| Solicitação de orçamento | A — Aurora | Mobile | ![Formulário de Aurora em mobile](screenshots/tenant-a-quote-request-mobile.png) |
| Landing | B — Luna | Desktop | ![Landing de Luna em desktop](screenshots/tenant-b-landing-desktop.png) |
| Landing | B — Luna | Mobile | ![Landing de Luna em mobile](screenshots/tenant-b-landing-mobile.png) |
| Solicitação de orçamento | B — Luna | Desktop | ![Formulário de Luna em desktop](screenshots/tenant-b-quote-request-desktop.png) |
| Solicitação de orçamento | B — Luna | Mobile | ![Formulário de Luna em mobile](screenshots/tenant-b-quote-request-mobile.png) |

Reprodução: inicialize Emulator e app local, aplique `npm run seed:emulator`, depois execute `npm run screenshots:tenants`. O script captura somente as rotas públicas A/B em desktop e mobile. Capturas anteriores de dashboard, produção e plataforma estão preservadas em `docs/screenshots/` e pertencem a marcos anteriores.
