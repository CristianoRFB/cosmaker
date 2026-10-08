# Status v0.2.0 — Global Standard v01

Atualizado em 08/10/2026. Evidências de código e validação local no Firebase Emulator; nenhum resultado implica publicação no Firebase real. **Documentação em preparação:** E2E final, novas capturas, renders e docs:check aguardam registro de execução pelo agente principal.

## Implementação e políticas

- Catálogo local com Essencial/Pro/Premium, ranks 1/2/3, valores mensais/anuais aprovados, Pro recomendado, setup separado e trial Premium de 14 dias.
- Estado comercial em subdocumento protegido, validação estrita, atribuição pendente para legado e compatibilidade do CORE existente.
- `canUse`, `getLimit`, resolução unknown/not_configured/configured, status/prazo, overrides e disponibilidade que combina implementação + entitlement + config.
- Callables administrativos reais com autorização global server-side, motivo, confirmação na UI e auditoria atômica antes/depois. Trial calculado uma única vez no servidor; nenhum trial automático para todos os tenants.
- Demo criada com novo tenant/branding/config/conta/dados sintéticos. Intake público desabilitado, efeitos financeiros/upload sensível restringidos, encerramento preserva dados e estado operacional.
- FeatureGating reutilizável na UI, contexto comercial real e operação sintética com enforcement no backend e consumo transacional por tenant.
- Downgrade, upgrade, cancelamento e suspensão comercial preservam dados; `ateliers.active` mantém a responsabilidade de suspensão operacional independente.
- Migração dry-run por padrão, apply confirmado e idempotência validados apenas no Emulator, sem logs de PII.

Não existem limites numéricos ou distribuição comercial feature-a-feature aprovados. O catálogo de produção mantém `features: []`, `limits: {}`. Diferenciação e contagens sintéticas pertencem exclusivamente às fixtures `TEST_ONLY` do Emulator. CORE não recebeu bloqueios comerciais inventados. Features planejadas não foram declaradas entregues ou vendáveis.

## Validações observadas

| Comando | Resultado real recebido | Estado |
| --- | --- | --- |
| `npm test` | 39 testes unitários aprovados | PASS |
| `npm run test:rules` | 11 testes Firestore/Storage aprovados em execução isolada | PASS |
| `npm run test:commercial` | 6 cenários de integração aprovados, incluindo migração dry-run/idempotência | PASS |
| `npm run test:e2e` | Execução final completa ainda pendente | PENDING |
| `npm run lint` | Aprovado | PASS |
| `npx tsc --noEmit` | Aprovado | PASS |
| `npm run functions:build` | Aprovado | PASS |
| `npm run build` | Build padrão e build configurado para Emulator aprovados | PASS |
| `npm run docs:diagrams` | Fontes adicionadas; render da versão final ainda pendente | PENDING |
| `npm run docs:check` | Aguarda capturas/renders e apontamento final de CURRENT | PENDING |

As contagens acima correspondem às execuções confirmadas pelo agente principal antes desta redação. Alterações posteriores que afetem contratos/segurança exigem nova evidência antes do aceite. Não há alegação de PASS para comandos pendentes.

## Evidência de comportamento

Os unitários exercitam preços em centavos/anual, herança, seis estados, fronteira de trial, overrides, feature/config e semântica de limites. A integração exercita Platform Owner versus tenant_owner/staff/customer, tampering de payload, auditoria, A × B, consumo concorrente, políticas zero/positivo/null/ausente, expiração e demo. Rules impedem escrita direta de estado comercial/contagem e mantêm isolamento de domínio/Storage. A validação no browser será registrada após a execução final, incluindo regressões públicas/orçamento/aprovação.

Os seis diagramas do core e as oito capturas reais da v0.1.0 foram copiados e suas fontes históricas preservadas. Três fontes novas descrevem atribuição manual, entitlement e UI/Functions/Rules. Três imagens ImageGen foram copiadas e registradas como CONCEITUAIS/IDEALIZADAS em [GENERATED_VISUALS](GENERATED_VISUALS.md). Os seis novos screenshots comerciais ainda são caminhos esperados em [SCREENS](SCREENS.md), não evidência concluída.

## Produção, histórico e pendências

`PRODUCTION_MIGRATION=NOT_RUN` · `PRODUCTION_DEPLOY=NOT_RUN` · `BILLING=DEFERRED`

Nenhum dado real, preço aprovado ou tenant original foi convertido em fixture/demo/lead. Aurora/Luna e os demais tenants semeados são fictícios e locais. Nenhum lead confirmado foi inventado. Nenhum checkout, gateway, webhook, renovação, dunning, cobrança, marketplace ou serviço pago foi ativado.

Antes de concluir a versão: registrar E2E final e checks após ajustes de segurança, capturar/inspecionar as seis telas reais, renderizar as três fontes novas, executar docs:check e atualizar CURRENT somente com evidência completa. Decisão futura de matriz comercial e cotas não bloqueia a conclusão da mecânica; permanece necessária antes de restringir/vender novas diferenças em produção. O rollout Firebase real exige operação separada e não faz parte deste goal.
