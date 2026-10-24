# GOAL MASTER IV — handoff de interrupção

**INCOMPLETO / WIP. Encerramento solicitado pelo usuário em 2026-10-24.**

Repositório CristianoRFB/cosmaker; branch exclusiva codex/cosmaker-master-finalizacao. Este documento acompanha o checkpoint final da interrupção. O último remoto anterior é f9f23376f8eba3c4ed3e4b3890faa4ec559ad5a0. Nenhum deploy, Firebase real, credencial, billing, IAM, merge ou force push foi usado.

## Preservado nesta execução

- Upload público de referências por servidor: slug canônico, capability aleatória/hash persistido, expiração, MIME/assinatura/tamanho/SHA-256, lease, retry imutável e proteção contra sobrescrita. Complete/discard antigos não contornam o fluxo nem apagam arquivos. Storage raw integralmente bloqueado, zero consultas cross-service. Leitura legada autenticada mantém objetos; inventário somente sintético e sem tokens/URLs exportados. Snapshot do pedido não copia pendentes/capabilities. Transporte anterior de produção preservado.
- Home/Perfil/Pagamentos do cliente conectados: dados reais, perfil restrito, recibos manuais por projeção autorizada e centavos validados, lista/detalhe/paginação, estados de erro/ausência e isolamento. Sem gateway.
- Histórico de pedidos ganhou cursor, registros sem data e vínculos CRM após troca de e-mail. Ownership de pedidos/propostas compartilha a política conservadora por UID/CRM. Hooks descartam respostas de contextos anteriores.
- Medidas deixaram de presumir clientId=UID: listagem e criação idempotente por vínculo CRM, auditoria e validação servidor. Editor existente compartilhado com a rota staff, manutenção de fichas e decimais. Revisão de orçamento reutiliza o formulário preenchido e preserva versões anteriores; aprovado encaminha ao pedido.
- Dependências atualizadas: Vitest4.1.12, CLI15.34.1, Admin14.5/Functions7.4, patches compatíveis. Next15.5.28/React19/Firebase12.19 e preços/contratos v01 preservados. npm10 edgesOut resolvido gerando lock com npm11.13, sem forçar peers; npm ci limpo funcionou. Root produção0, Functions produção0; auditoria completa5moderados/0altos/0críticos na última medição, cadeias upstream CLI/OpenTelemetry/uuid ainda documentadas.
- WIP final: listPlatformUsers e UI global somente leitura, com perfil/RBAC/sessão, consulta real de situação Auth e paginação; assinatura lendo contexto comercial e catálogo aprovado; integrações informam canais desabilitados; rota de endereços encaminha aos fluxos reais. Novo teste global escrito, ainda não executado.

## Evidências reais e seus limites

- Upload/legado antes das últimas dependências: backend6/6 (inclui jornada contínua), Rules32/32, E2E público2/2 em320/375/768/1440.
- Portal antes da paginação posterior: backend pagamentos3/3, Rules33/33, E2E1/1 em quatro larguras com persistência, erro/retry, ausência, acesso negado e e-mail reutilizado; capturas320/1440 inspecionadas.
- Paginação/ownership: teste vermelho confirmou ausência de cursor; depois9/9 integrações passaram. Com os novos SDKs e medidas CRM, o subconjunto atual passou10/10,46,44s. Não inclui o diretório global final nem a regressão ampla de uploads/legado após os novos SDKs.
- Vitest4:120/120 unitários. Functions e TypeScript passaram nos checkpoints anteriores às oito alterações finais desta interrupção. Lint anterior tinha três avisos de cleanup que foram corrigidos; não inferir aprovação estática final sem conferir os processos/logs.
- Último CI remoto confirmado nesta sessão: ee7b195, execução40046515677 PASS. CI dos checkpoints posteriores precisa consulta; não foi declarado PASS automaticamente.
- Logs/capturas /tmp são temporários; o histórico versionado em MASTER_FINALIZATION_PROGRESS.md registra comandos, contagens, falhas anteriores e limites. Não transformar resultados históricos em aprovação do WIP novo.

## Pendências concretas, em ordem de retomada

1. Fetch/confirmar HEAD, preservar WIP e consultar CI do commit final. Reutilizar Node22/Java21, cloud-setup/cloud-start; somente demo-cosmaker. Verificar logs /tmp/cosmaker-secondary-functions-build.log e /tmp/cosmaker-secondary-lint.log; rodar TypeScript/build finais e corrigir falhas reais.
2. Executar o teste novo de listPlatformUsers em commercial-functions.test.ts: autenticação/RBAC/revogação, projeção sem campos privados, situação Auth e paginação. Validar UI global e assinatura/integrações/entrega em quatro larguras. Nenhuma destas telas finais está aceita.
3. Completar E2E da paginação de52pedidos já acrescentado em client-portal.spec.ts. Escrever/executar E2E de medidas staff↔cliente com CRM ID diferente do UID, criação/edição/arquivo/decimais e isolamento; testar revisão de orçamento preenchida/versão preservada. Esses gates ainda não foram executados.
4. Regressão proporcional ampla após as majors dos SDKs: integrações dos domínios, Rules, jornada e transportes de bytes. Refinamento final do leitor legado aceita Unicode e exige measurements:read para imagens de medidas; teste ampliado está escrito, regressão pendente. Não relaxar autorização nem introduzir quotas comerciais.
5. Encerrar páginas públicas globais ainda estruturais e not-found sem inventar tenant padrão, catálogo global ou dados demo como reais. Serviços/portfólio publicados são os do slug legítimo, na Home do tenant (#servicos/#portfolio). Contato/agenda devem encaminhar ao fluxo aprovado, preservando agenda privada. Políticas jurídicas dependem de definição/homologação externa, sem inventar identidade ou condições comerciais.
6. F6: repetir backup/restauração sintéticos com SDKs novos e avaliar sessões/revogação/retries. Investigar uma vez o transporte scheduler com CLI15.34.1/SDK7.4; a limitação conhecida era Unsupported trigger signature:http no CLI15.32. O wrapper HTTP antigo comprovou lógica, não agendamento real. Não declarar o transporte novo aprovado ou definitivamente bloqueado sem ensaio.
7. Fechar inventário funcional conforme FUNCTIONAL_INVENTORY_METHOD.md, com critérios/evidências por domínio, e calcular indicador reproduzível separado dos16marcos. Atualizar matriz/handoff e CI final. Não inventar percentuais.

## Estado formal e comercial

F1.1–F1.9 e F4 possuem aceites locais históricos; a stack/contratos alterados exigem as regressões citadas. F2/F3/F5/F6 **PARCIAIS / WIP**. F7/F8 pendentes. Formal10/16=62,5%; conclusão funcional **não calculada**, método definido e inventário incompleto. Produto **não homologado para clientes reais/produção**.

Há pendências locais executáveis além das externas. Externas: homologação Firebase/GCS/IAM/índices/agendamento reais, inventário/revogação de tokens legados reais com autorização futura, validação operacional/recuperação real e requisitos jurídicos/release. Nenhuma dessas operações foi autorizada/executada aqui.

## Transporte GitHub

Terminal usa uma identidade sem permissão de push; utilizar o conector CristianoRFB (link_6ad2df3229d48191bd0ef1a65deeb821), árvore/commit/ref com expected_sha e force:false. Comparar árvore remota/local; preservar commit local em branch local/cloud-checkpoint-* e realinhar por fetch/rebase que reconhece o patch. Não usar reset/force. Checkpoints desta execução:3a31370,9acde8c,18f4102,dd0ca74,ee7b195,f9f2337 e o commit que contém este handoff.
