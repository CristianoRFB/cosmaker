# Runtime local para jornadas e capturas

O lançador `scripts/dev-local.mjs` fixa o projeto `demo-cosmaker`, o host `127.0.0.1` e a conexão aos emuladores de Auth, Firestore, Storage e Functions. Não contém credenciais reais. As portas padrão são 19099, 18080, 19199 e 15001; as variáveis `NEXT_PUBLIC_FIREBASE_*_EMULATOR_PORT` permitem portas locais alternativas.

## Desenvolvimento

Com os emuladores em execução, use `npm run dev:local`. As rotas são compiladas sob demanda. Nas jornadas longas, cada rota fria e troca de área pode exigir uma nova compilação.

## Interface compilada para E2E

Encerre o `dev:local` deste checkout antes de compilar, pois ambos usam `.next`. Execute `npm run build:local` e depois `npm run start:local`. O servidor continua local e a interface usa os mesmos emuladores, com a indicação de ambiente local. Os testes e capturas apontam para `http://127.0.0.1:3000`.

Depois de alterar a interface, encerre o servidor local, repita `build:local` e inicie `start:local` novamente. Dados persistidos continuam pertencendo aos emuladores; compilar não faz seed, migração ou deploy.

Este bundle é específico do Emulator. Para um build de outro ambiente, use `npm run build` com a configuração daquele ambiente em um checkout/runtime apropriado. Os comandos locais não publicam arquivos nem alteram Firebase real.

## Validação e evidências

O lançador recusa modos diferentes de `dev`, `build` e `start`. Build, smoke e E2Es desktop 3/3 e mobile 2/2 passaram em 2026-10-19. `COSMAKER_E2E_MOBILE=true` aplica viewport 390×844 e toque às sessões independentes dos workflows de pedidos. O histórico está em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md). Estes resultados são locais e não provam staging ou produção.


## Codex Cloud Linux — retomada 2026-10-22

Use Node 22 (nesta sessão: `/tmp/node-v22.23.4-linux-x64/bin`) e Java 21. A versão Firebase CLI 15.32.0 usa `ProxyAgent` para requisições ao loopback e ignora `NO_PROXY`, impedindo registrar triggers Firestore quando há proxy externo. Os lançadores locais e o harness de integração carregam `scripts/firebase-loopback-proxy.cjs`: somente `127.0.0.1`, `localhost` e `::1` usam o Agent local; destinos externos continuam com proxy e CA herdados. Não são alteradas permissões de rede nem configurações de credenciais. Um teste de transporte comprova loopback e preservação do proxy externo.

`npm run firebase:emulators:local`, `seed:emulator`, `dev:local`, `build:local` e `start:local` mantêm os mesmos nomes e projeto de demonstração. Dependências devem estar instaladas na raiz e em Functions antes de iniciar. O download do Firestore/Storage Emulator por `storage.googleapis.com` funcionou; Pub/Sub é iniciado pelo lançador completo e validado separadamente do aceite financeiro.

O download Playwright por `cdn.playwright.dev` foi negado pela rede; reutilize o Chromium Linux instalado com `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. A configuração é opcional e não altera o navegador padrão do CI.

Git no terminal usa a identidade `Nevez06`, que recebeu 403 ao tentar push neste repositório. O conector GitHub da conta `CristianoRFB` conseguiu enviar o checkpoint para a branch autorizada via árvore/commit/ref com atualização fast-forward e SHA esperado. A árvore remota foi comparada à local e o checkout foi realinhado com rebase que reconheceu o patch já aplicado. O commit local original foi preservado na branch local `local/cloud-finance-wip-6ee6cf2`; nenhum force push/reset foi usado.
