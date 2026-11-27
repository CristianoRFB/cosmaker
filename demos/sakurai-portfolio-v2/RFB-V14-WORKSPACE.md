# Sakurai | V14 — Workspace independente
## Fontes e identidade
- RFB Method `main` commit `5f73ee2b48507234431706e4c6313773bae72a5a`. AGENTS.md e normas aplicáveis carregadas nesta sessão; gate CLI **NOT_RUN**.
- Repositório alvo: `CristianoRFB/cosmaker`; baseline V13: `b81653482c26fb0ea81817940cbc7c06db9ff1f6`.
- Branch arquivada **V13**: `archive/sakurai-portfolio-v13-20261127`.
- Branch de continuidade **V14**: `develop/sakurai-portfolio-v14-rfb`.
- Worker público preservado, sem mutação: `77-sakurai-portfolio-v2.on7.workers.dev`.
- Worker separado V14 para homologação: `77-sakurai-portfolio-v14-staging.on7.workers.dev` (verificar antes de declarar disponível).

## Foco desta fatia
A intenção explícita foi preservar a demo atual como versão específica e continuar em ambiente distinto. Nenhuma mudança visual ou funcional de produção foi solicitada neste turno. Não inventar melhorias de UI: aplicar isolamento e preparar continuidade RFB.

## Critérios de aceite
1. A V13 possui referência GitHub própria apontando para `b81653482c26fb0ea81817940cbc7c06db9ff1f6`.
2. O Worker atual permanece intacto, no SHA da V13.
3. V14 usa branch/Worker próprios; URL diferenciada; aviso de homologação, não-site-oficial.
4. QA da próxima fatia: desktop 1440x900 e mobile 390x844, menu, links, vídeo, fotos, CSS, JS, favicon, galeria, modal, editor de paleta; três rodadas TV.
5. Não promover candidata sem autorização para trocar o Worker público.

## FSC (13 áreas, 15 níveis)
Trata-se de DEMO/PROTOTYPE, não SaaS produtivo ou sistema cliente implementado. Inventário dos 13 domínios e 15 níveis no `rfb/STATE.json`. QA e maturidade além da separação **NOT_RUN**.

## Triple Verification e Visual Self-Correction
Baseline funcional/adversarial/regressão independente e duas inspeções comparativas de tela: **NOT_RUN**, dependem de executor real; verificações HTTP e assets isolados não os substituem.

## Risco e rollback
V13 nunca sofre edição nessa branch; para reverter V14, cessar uso do Worker V14 e voltar ao commit `b81653482c26fb0ea81817940cbc7c06db9ff1f6` na branch de homologação. Nunca fazer merge/fechar a PR #35 automaticamente.

## Próximo slice proposto
Auditar a demo da Sakurai em PC e mobile, corrigir problemas específicos observados e executar testes VSC/TV sem modificar a versão arquivada.
