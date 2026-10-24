# GOAL MASTER IV — consolidação local

Atualizado24/10/2026. **Escopo funcional local consolidado; GOAL global INCOMPLETO. Produto NÃO HOMOLOGADO para clientes reais.**

Repositório CristianoRFB/cosmaker; branch exclusiva codex/cosmaker-master-finalizacao. Código validado/publicado em **6b4ac11f1412d33c0f7ffea8b678ed26d5ac2d9c**, após baseline5fe1f495b91b2bb1e4e2925236725f8df40c0f43. O checkpoint documental posterior contém este handoff, inventário e verificador; recuperar seu HEAD via fetch, sem reset. CI do código [40098118834](https://github.com/CristianoRFB/cosmaker/actions/runs/40098118834) SUCCESS, inclusive124unitários/25arquivos. Conferir CI do HEAD recuperado antes de reutilizar evidências.

Somente demo-cosmaker, Node22.23.4/Java21 e dados sintéticos. Nenhum Firebase real, deploy, IAM, billing, merge, force push, segredo ou alteração da política de rede foi executado. Runtime encerrado na consolidação.

## Implementado e testado localmente

Referências públicas por slug/capabilities/hash/expiração/MIME/assinatura/limites/SHA-256, lease/retry/concorrência e bytes por servidor. Storage raw inteiramente negado, zero cross-service. Leitores legados autorizados preservam referências; snapshots sem capabilities/URLs permanentes. Transporte de produção anterior preservado.

Portal Home/Perfil/Pagamentos usa dados autorizados e persiste campos permitidos. Histórico paginado52pedidos UI/55integração, propostas e medidas CRM≠UID. Detalhe/lista por allowlist não expõe custos/notas/atores; root raw staff-only, snapshot integral interno. Ownership durável/CRM consistente em pagamentos, mensagens, arquivos, fotos, revisões e aprovações. E-mail reutilizado não autoriza histórico; legado sem vínculo fica para reconciliação deliberada staff, sem backfill/exclusão automática.

Cadastro/perfil limitado e recuperação de senha com recibo condicional/erros de rede preservados; OOB único, replay inválido, senha anterior recusada, UID/autoridade preservados. Transferência mantém um owner e toast global sobrevive ao refresh; revogação de membership não desativa conta global. Rotas públicas por resolver, diretório global/Auth, assinatura/configurações e revisão de proposta usam contratos reais; sem telas estruturais identificadas nas rotas essenciais auditadas. Textos jurídicos explicitamente preliminares.

**Correções desta retomada:** agenda interpreta e exibe horários no fuso do responsável/slot, preserva formulário recusado, rejeita datas/DST inválidos ou ambíguos e mostra UTC explícito em slots legados sem fuso válido. Instantes anteriores preservados. Métricas globais deixaram de transbordar em320px sem ocultar conteúdo ou redesign. Lançadores anteriores mantêm PID+startTime/limpeza de PubSub, proxy/CA e guardas demo.

## Evidências reais

Registro sanitizado em [EVIDENCE_LEDGER.json](security/EVIDENCE_LEDGER.json); logs/traces/OOB/capabilities brutos não publicados.

- **124/124unitários/25arquivos no CI do código.** Novos3unitários de fuso também PASS local406ms: SãoPaulo/offset45min/UTC, DST/calendário inválido e exibição.
- **104cenários SDK distintos** na stack atual. Agenda final3/3 PASS43,49s substitui os mesmos3casos deorders33, sem aumentar para107. Positivos/negativos A×B/permissões, concorrência, retries, finanças e jornada registrados.
- Rules: lote34PASS/1FAIL por fixture com ID reservado; corrigida e repetida1PASS/34skipped sobre as mesmas Rules.35casos cobertos complementarmente, **não lote35/35 único**. Rules não mudaram nesta retomada.
- Novo lote browser12PASS/4FAIL5,2min: duas falhas de prontidão web e dois defeitos reais (métricas/fuso). Repetição5casos4PASS/1FAIL2,4min; falha do teste negativo2h/intervalo1h, ajustado para fora do expediente. Agenda passou1/1 e, após refinamento de exibição, **1/1 final31,3s**.16cenários distintos cobertos por execuções complementares, sem reescrever lote inicial. Métricas/configurações/agenda320/375/768/1440; capturas métricas320/1440 inspecionadas.
- Evidências pertinentes anteriores: portal/detalhe/anexos2/2; público2/2; mensagens/navegação quatro papéis5PASS em lote misto; revisão/produção1/1 com financeiro atual; jornada foto/aprovação/CRM1/1; medidas/revisão1/1; diretório/configurações reais; equipe1/1; recuperação de senha1PASS em lote misto. Google **SKIPPED/BLOCKED**, nunca PASS.
- Export/import Auth/Firestore/Storage em instâncias novas PASS, bytes/hash/centavos/histórico e ACL após restore. Functions desligadas: não prova replay/timer/RPO real. Inventário sintético de tokens PASS: delta1, metadata/bytes/gerações preservados, saída sanitizada e guardas negativas. Inventário/revogação reais NOT_RUN.
- Functions/Next81, lint integral, TypeScript, docs:check/diff:check PASS. Verificador funcional PASS; CI passa a executá-lo sem emuladores. Não repetir104integrações/Rules/recuperação/UI aprovadas sem alteração relevante.

## Medição e F1–F8

[Inventário funcional](FUNCTIONAL_COMPLETION.md): **182/184critérios locais=98,91%**,47operações congeladas antes do cálculo, quatro critérios de peso1, quatroNA justificados.45operações implementadas/testadas e2com critério obrigatório bloqueado; demais critérios dessas operações conservam crédito. Não mede esforço, cobertura exaustiva ou homologação real. Futuro/fora do escopo excluído explicitamente.

[Matriz formal](FORMAL_ACCEPTANCE.md): **10/16=62,5%**, sem crédito fracionário. F1.1–F1.9/F4 PASS LOCAL; F2/F3/F5/F6 PARCIAIS/TESTADO_LOCALMENTE, gates externos não aceitos; F7 BLOCKED/NÃO EXECUTADO; F8 NÃO ACEITO. v0.2.0 canônica, sem release fictícia. Prontidão funcional local avançada/consolidada; prontidão comercial **NÃO HOMOLOGADA**.

O verificador checa conjunto congelado, cálculo/relatório, referências de evidência e hashes de código/configuração/testes relevantes. Mudanças exigem rever critérios afetados antes de reaproveitar PASS. Não executa testes nem aprova código automaticamente.

## Bloqueios e próxima ação

1. **Google local:** publicar somente apis.google.com conforme [CLOUD_NETWORK_REVIEW.md](CLOUD_NETWORK_REVIEW.md). Política atual permite package_managers/storage.googleapis.com; biblioteca apis.google.com/js/api.js falha CONNECT403/ERR_TUNNEL_CONNECTION_FAILED antes do popup. Conector somente leitura não publicou configuração. Após publicação, iniciar runtime e executar somente google-emulator.spec.ts com identidade fictícia. Sem conta Google real/bypass/credenciais.
2. **Scheduler v2:** CLI15.34.1 entrega/ack PubSub mas rejeita Unsupported trigger signature:http. Wrapper HTTP comprova lógica, não transporte. Requer correção oficial do Emulator ou homologação real futura autorizada de trigger/IAM/relógio/replay. Ver SCHEDULER_EMULATOR.md; não repetir tentativa inalterada ou alterar node_modules para forjar aceite.
3. **Upstream:** últimas auditorias prod raiz/Functions0; root completo5moderados CLI,0altos/críticos. Warning Storage8.4.0/teeny-request11.1.1 sem patch oficial naquela consulta, sem supressão/prova de vazamento. DEPENDENCY_SECURITY_REVIEW.md registra limites.
4. **Homologação comercial futura:** Firebase/GCS/Auth/OAuth/IAM/índices/AppCheck/abuso/observabilidade reais, limites/preconditions de arquivos, inventário/revogação autorizados de tokens legados, e-mails/templates/domínios/enumeração/sessões reais, backup/restore/RPO/RTO/rollback, jurídico e release. Operações reais seguem não autorizadas. Empacotamento documental final da release vem após esses gates.

Não há pendência de implementação local identificada nas47operações além dos dois gates bloqueados. Isso não elimina homologação externa ou garante ausência de bugs. Retomar pela liberação mínima de rede Google e transporte do scheduler, sem reimplementar módulos aceitos ou inventar recursos.

## Retomada e publicação

Fetch/confirmar origin/HEAD/árvore/CI; preservar WIP e fast-forward quando aplicável. cloud-setup somente quando dependências/cache faltarem; cloud-start.sh start para runtime; cloud-run.sh para comandos. npm run docs:functional verifica a medição; node scripts/functional-inventory.mjs --write apenas regenera após revisão explícita dos dados.

Terminal tem identidade sem push. Usar conector CristianoRFB link_6ad2df3229d48191bd0ef1a65deeb821, árvore idêntica/commit/ref com SHA esperado e force:false. Commit local preservado em local/cloud-checkpoint-*; fetch/rebase reconhece patch remoto e preserva WIP. Nunca reset destrutivo/main/force. Histórico completo em MASTER_FINALIZATION_PROGRESS.md.
