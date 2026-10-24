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

## Entradas reutilizáveis do ambiente `cosmaker`

A retomada confirmou que arquivos temporários e processos não sobrevivem à recriação do runtime. O setup agora seleciona Node 22 automaticamente; quando a imagem traz outra versão, baixa Node **22.23.4** de `nodejs.org`, verifica SHA-256 do arquivo oficial e guarda o runtime no cache do usuário. Java 21 já integra a imagem validada; o script verifica sua compatibilidade e falha com uma mensagem concreta se a imagem deixar de fornecê-lo. Proxy e certificados herdados são preservados.

Configuração concreta para **publicação no editor do ambiente Cloud** (a API disponível nesta sessão permite consultar o ambiente, mas não publicar sua configuração):

| Campo | Valor |
| --- | --- |
| Nome | `cosmaker` |
| Diretório | `/workspace/cosmaker` |
| Instalação | `bash scripts/cloud-setup.sh` |
| Inicialização | `bash scripts/cloud-start.sh` |
| Alternativa com bundle compilado | `bash scripts/cloud-start.sh start` |
| Imagem | Linux, Bash, curl, tar/xz, SHA-256 e Java 21 (`openjdk-21-jre-headless`) |
| Rede | preset de gerenciadores de pacotes + `storage.googleapis.com`; Node usa `nodejs.org` do preset |
| Segredos/credenciais Firebase | nenhum |

O setup executa `npm ci` na raiz e em Functions com cache dedicado, compila Functions, prepara Firestore/Storage/PubSub e executa `build:local`. Auth e Functions não precisam de artefatos Java próprios. Não executa testes extensos, seed, migração nem deploy.

A inicialização usa `firebase:emulators:local`, aguarda a prontidão de todos os emuladores, executa `seed:emulator` com endpoints loopback e inicia `dev:local` (ou `start:local`). Recusa portas já ocupadas para preservar outra sessão; encerra os grupos de processos ao receber sinal ou falha. O log fica em `.firebase/cloud-emulators.log` (ignorado pelo Git). Cada inicialização cria dados de demonstração; não é um mecanismo de backup. O seed existente usa somente identidades e dados fictícios.

Para comandos avulsos, sem repetir a seleção manual de Node:

```bash
bash scripts/cloud-run.sh npm run build:local
bash scripts/cloud-run.sh npm run test:reports
```

Portas: app 3000; Auth 19099; Firestore 18080; Storage 19199; Functions 15001; Pub/Sub 8085; hub 14403; logs 14404. Projeto fixo `demo-cosmaker`. O servidor web continua limitado ao loopback, conforme `dev-local.mjs`.

Validação da retomada em 2026-10-22: `cloud-setup.sh` **exit 0**, Node 22.23.4 com SHA-256 verificado, Java 21, instalação raiz/Functions, três artefatos de emuladores preparados e build local de 81 páginas. `cloud-start.sh start` iniciou os cinco serviços, seed e servidor; HTTP 200 e resolução pública no navegador comprovados. Segunda inicialização recusou porta 19099 ocupada sem parar a primeira. Encerramento liberou as portas e uma nova inicialização reutilizou o runtime/cache. `METADATA_SERVER_DETECTION=none` evita descoberta de identidade GCE no lançador exclusivamente demo; não altera proxy/CA. O smoke inicial usou um nome de heading exato que omitia o subtítulo e expirou; o seletor canônico por conteúdo confirmou o tenant na jornada posterior. Não houve mudança de credenciais, deploy ou acesso a projeto real.


### Encerramento Linux e lotes de regressão (24/10/2026)

`cloud-start.mjs` acompanha somente sua árvore em `/proc`, validando PID e instante de criação antes de cada sinal. Descendentes destacados (Pub/Sub) continuam rastreados após o pai sair e recebem TERM e, após5s, KILL quando ainda vivos; não há encerramento por nome ou porta. SIGINT/SIGTERM são o fluxo normal. Unitário cria descendente destacado resistente a TERM e processo independente; runtime completo validou as nove portas liberadas, incluindo8085/9150.

No Cloud de10GiB, não combinar todos os domínios de Functions com Playwright: workers por endpoint acumulam memória. Executar `node scripts/test-commercial-emulator.mjs <domínio>` sequencialmente com runtime completo parado; não serializar artificialmente as operações concorrentes sob teste. Antes de Rules ou recuperação, encerrar o runtime: mesmo projectId/hub pode interferir e Rules limpa o Firestore sintético. Não rodar build/dev/start simultaneamente no mesmo `.next`.
