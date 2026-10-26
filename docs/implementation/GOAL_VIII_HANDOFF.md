# GOAL VIII — handoff final de viabilidade Free

**PROVA LOCAL ENTREGUE. MIGRAÇÃO BLOCKED. COMERCIAL NOT_READY.**

RepoCristianoRFB/cosmaker, branch isolada`codex/cosmaker-goal-viii-capacidade-free`. Base remota confirmada`06b9241e987829ac96eb206998ba740fabdf8796`, CI40223757231SUCCESS. GOALVIIda branch histórica correspondente foi preservado, assim comoGOALVId659faa e candidata anteriorcca4e23281afd4bcfcc5eb0dc69c38e8b641eba2. AmbienteCloudoperacional, Node22.23.4, Java21.0.12.1, política de rede existente; sem alteração de rede/credenciais. NenhumWIPinicial encontrado.

Commits desta missão: `57c22e3` modelo de capacidade/eligibilidade e CI pequeno; `9d1c514` resource guards e prova20MiBworkerd. Ambos tiveramCIverde. O commit que inclui este handoff fecha cenários/decisões e deve ter seu próprioCIverificado peloSHA, disponível em [Actions da branch](https://github.com/CristianoRFB/cosmaker/actions?query=branch%3Acodex%2Fcosmaker-goal-viii-capacidade-free). Gitlog fornece oHEADfinal; não assumir CI por checkpoint anterior.

## Entregue e realmente exercitado

- Simulador determinístico em bytes inteiros, [127cenários/JSON](capacity-free/SCENARIOS.json) e [CSV](capacity-free/SCENARIOS.csv), demanda versus admissão independentes, p95/picos, backups, versões ocultas, órfãos, pendentes, egress, crescimento, LOW, holds e workflow aberto. Usa a política canônica doGOALVII sem modificá-la. Nenhuma conta/bytes reais consultados.
- [Comparação oficial e capacidade](CAPACITY_FEASIBILITY.md): Supabase, RTDBSpark, B2, Tigris eImageKit; fontes/datashashes emPROVIDERS/EVIDENCE. B2cardless10GBcom rota privadaCloudflare documentada é condicional, nãoPASSfinanceiro. Tigris cobra excedentes; ImageKit/ Supabase ainda têm garantias operacionais pendentes. R2expressamente excluído.
- [Resource budget](FREE_RUNTIME_BUDGET.md):50subrequests,6conexões até consumir body, reservas lógicas de memória, ledgerUTC100000/dia sintético. Os últimos dois não equivalem a heap nativo total ou quota distribuída da conta. Nenhuma CPU garantida foi inventada.
- Workerd real com Auth/Firestore Emulator e fonteHTTPprivada sintética:20MiB, SHAincremental noWorker,16subrequests na verificação e14no downloadcliente, corpo íntegro antes de entrega, canônico porUID/tenant/member/order. Falhas de hash/tamanho, expirado/falsoUID, tenantB, revogação durante leitura, revisionfence e PENDING negados. Fonte não é provedorcloud, nem novo adaptadorB2/Supabasehosted.
- Limites10ms/50retidos no config nativoV5; profilerDevTools e calibração registrados. CPU por invocação eRAM totalHosted não comprovados. O caminho estrito HTTP devolve503antesdosbytes; evento scheduled terminaexceptionesperada peloCPUguard. Diagnóstico explicitamente marcado, nenhumREADY/lançamento/deleção foi gravado por essa rota. Nenhum brokerNode remoto foi presumido grátis.

**20casos novos distintos**:12unitários/guards e8integrações. Repetir os12noWindows não soma casos.127projeções não são127testesPASS. Tentativas falhas/retestes preservados no[EVIDENCE](capacity-free/EVIDENCE.json), sem tokens, perfis completos ou traces publicados. CIproporcional Linux/Windows; não repetimos35GOALVII,104SDK,124unitários ou Playwright antigo. Não há alteração deUI/Functions/Rules/domínios que justifique essa repetição;37hashes de fontes antigas de upload preservados. Build novo é o bundle real esbuild/workerd; Next/Functions inalterados mantêm evidência anterior, sem fingir novo build dofrontend.

## Decisão e o que continua pendente

Há envelopes matemáticos pequenos:1tenant×1original20MiB/dia com backup e fechamento14dias requerp95de2181038080bytes em180dias e cabe em10GBporstorage. Isso não valida billing, operação, CPU ou eternidade.20tenants×2/dia exigemp95de87241523200bytes e a admissão10GBbloqueia jánoDay4. Fixos/LOW/protegidos/holds/versões podem crescer sem saída; qualquerCfinito esgota sob crescimento líquido positivo. Não diminuímos20MiB ou retenção para mudar o resultado.

[DECISIONS.json](capacity-free/DECISIONS.json):0/7gates completos,6parciais e1bloqueado;0/47operações inteiras homologadas na nova stack. Não significa0%de implementação.182/184funcionais e10/16formais da stack antiga, e35cenáriosGOALVII são **histórico separado**, sem crédito automático.

**FaseDadiada conforme itens14/15do mandato.** Não completar coletaPENDING, restoreSupabase, TUSbrowser e dual-reader/rollback20MiB→legado6MiB sópara elevar cobertura enquanto não há candidato consistente. Não portar outras101Functions. Essas pendências são implementação local condicional, não exclusivamente externas. Arquivo77globalexterno continua ausente; TXTmaterializado é a fonte autorizada, sem inventar conteúdo ou interromper para perguntar.

Dependências externas/decisórias: comprovar conta sem cartão/billing e hard caps/no-liability de excedentes; volume real e crescimento permanente tolerável;CPU/RAM/quotas globaisHosted; identidade mínima/secrets/versões/recuperação em provedor privado, sem cache público ou URL irrevogável. Um tutorial de proxy de bucket privado não implementaRBACdoCosmaker. Nenhuma aprovação para contas, billing, upgrade ou deploy foi solicitada ou inferida.

## Retomada e critérios de parada

Fetch/check da branch isolada antes de alterar. Reproduzir apenas a superfície alterada:

```bash
bash scripts/cloud-run.sh npm --prefix infrastructure/feasibility test
bash scripts/cloud-run.sh node infrastructure/feasibility/simulate.mjs
bash scripts/cloud-run.sh node infrastructure/feasibility/run-runtime.mjs
```

Pré-requisitos existentes: dependências raiz/Functions/Spark; pacote novo não acrescenta dependências. Node22/Java21. Runtime fixa demo-cosmaker, Auth19099/Firestore18080 e loopback; usa regras existentes, sem projeto real ouStorageexterno. Portas/serviços próprios encerrados após prova. A medição depende doinspectorlocal suportado; falha éBLOCKED/FAIL, nuncaPASSpor skip.

Próxima ação objetiva: revisar o envelope de uso esperado e verificar, com autorização separada, documentação/estado de conta sem cartão/billing e bloqueio rígido, antes de qualquer migração. Após candidato consistente e provaCPU/RAMreal, destravar faseDpor prioridades já registradas. Se volume/garantias excederemFree, registrar decisão de produto/infraestrutura; não aplicar planos/limites comerciais arbitrários nem recomendar upgrade automático como única solução.

Flags reais de migração/deleção continuamOFF, DRY_RUNporpadrão. Não houve cadastro externo, IAM, billing, alteração deFirebase/Supabase/B2real, deploy, dado pessoal, exclusão de legado, forcepush ou merge emmain. A missão local de prova está fechada no gate pedido; produto **NOT_READY**, homologaçãoHosted **NÃO EXECUTADA**.
