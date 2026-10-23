# Revisão direcionada de dependências — 2026-10-22

Escopo: lockfiles existentes da aplicação e de Functions, sem `npm audit fix --force`, downgrade do Firebase ou mudança de major dos SDKs. Auditoria é evidência pontual do registro npm, não garantia de ausência de vulnerabilidades.

## Aplicação de produção

A auditoria inicial `npm audit --omit=dev --package-lock-only --json` encontrou quatro alertas altos agregados sobre a mesma cadeia Firebase → Firestore Node → gRPC 1.9.16. As advisories são GHSA-m9gg-hp2v-232j (certificados em `getAuthContext`, alta) e GHSA-f596-whhp-79r4 (mensagens de erro, baixa). O Firebase fixa `~1.9.0`, então atualização normal dentro desse intervalo não alcança a correção 1.13.6.

Aplicado override **somente em `@firebase/firestore`** para `@grpc/grpc-js: 1.13.6`, mantendo Firebase 12.19.0, Next 15 e os demais SDKs. A API gRPC continua na mesma major; Node 22 satisfaz engines. A instalação alterou um pacote adicionado e um removido. A recomendação automática do audit para Firebase 9.14.0 foi recusada por ser downgrade incompatível com a stack aprovada.

A auditoria de produção após atualização retornou **0 vulnerabilidades**. `npm ls` confirmou gRPC 1.13.6 no Firestore. As Rules completas, unitários e build após atualização devem constar como PASS no checkpoint antes de aceitar a regressão; a existência deste documento não substitui esses resultados.

## Functions

Auditoria de produção retornou **9 pacotes com alertas moderados**, derivados de **uma advisory de uuid**: GHSA-w5hq-g745-h8pq, ausência de validação de buffer fornecido pelo chamador em v3/v5/v6. Os consumidores instalados examinados (`gaxios`, `google-gax`, `teeny-request`) usam `uuid.v4()` sem buffer; os domínios de Functions não importam uuid diretamente. Não foi identificado caminho dos inputs de domínio até as APIs vulneráveis de buffer.

A correção sugerida inclui majors de firebase-admin/functions. Não foi imposto uuid 11 sobre contratos que exigem uuid 9 nem promovido SDK de major sem regressão apropriada. A pendência é atualizar a cadeia oficialmente suportada e validar Functions/Auth/Firestore/Storage, agendados e integrações antes de homologação real. Esta análise restringe o risco observado; não declara os alertas resolvidos nem a segurança global aceita.

## Ferramentas de desenvolvimento e limites

A auditoria integral inclui Firebase CLI e ferramentas locais que não entram no bundle de produção. Seu resultado é registrado separadamente no checkpoint; não deve ser confundido com o resultado `--omit=dev`. Testes só usam configs e fixtures versionadas/sintéticas e downloads dos fornecedores, sem credenciais reais. A revisão dos alertas de ferramentas e do legado de URLs privadas continua parte de F5/F6. Não houve deploy, alteração remota de IAM nem tráfego de dados de usuários reais.

Auditoria integral da raiz após correção de produção: **21 pacotes alertados**, sendo 2 críticos, 13 altos e 6 moderados. Críticos: tinypool (prototype pollution em opções de worker) e agregação de vitest; a correção automática aponta major do runner. Os testes atuais usam arquivos/configs versionados em modo `run`, sem servidor de mocks/API exposto, mas esses alertas continuam pendentes. Altos incluem Firebase CLI/MCP/proxy/FTP/glob e Vite; o CLI não é executado como servidor MCP e este ensaio não usa FTP ou padrões externos. Atualização dirigida das ferramentas e suas regressões ainda precisa ser concluída; não registrar F5/F6 como PASS global.

## Reauditoria em 2026-10-23 e patch Next 15

O registro atualizado passou a apontar Next 15.5.27 por [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) (crítica, biblioteca nativa da otimização de imagens/SVG em Linux glibc) e [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) (alta, DoS de Server Actions). A página oficial da primeira advisory identifica **15.5.28** como patch da linha 15 e **sharp >=0.35.5**; registro npm confirmou engines compatíveis com Node 22/React 19. Não foi demonstrada exploração na configuração específica do aplicativo.

Atualizados Next e eslint-config-next para **15.5.28**, mantendo a major aprovada. Lockfile mudou seis pacotes, sem downgrade de Firebase, novo major, `audit fix --force`, override adicional ou deploy. `npm ls` confirma Next/eslint-config-next 15.5.28 e sharp 0.35.5; processamento nativo de PNG fictício 2×2 passou. O override gRPC anterior permanece.

Auditoria de produção da raiz voltou a **0 vulnerabilidades** (`/tmp/cosmaker-next-audit-fixed.json`). Nova auditoria integral aponta **22 pacotes: 2 críticos, 13 altos, 7 moderados**, nas ferramentas/cadeias dev; continuam pendentes. Auditoria Functions permanece **9 moderados, nenhum alto/crítico**. Resultados zero de ontem são históricos, não evidência permanente do registro npm.

Gates desta atualização, incluindo build, unitários, smoke e CI remoto, constam no checkpoint canônico. Não confundir patch de dependências com aceite global de Storage, segurança ou homologação comercial.
