# GOAL VIII — capacidade gratuita (checkpoint)

Base remota GOALVII06b9241 confirmada, CI40223757231SUCCESS. Ambiente operacional, Node22/Java21, sem credenciais ou contas reais. Branch isolada codex/cosmaker-goal-viii-capacidade-free; candidatas anteriores preservadas. Fonte do mandato em capacity-free/GOAL_VIII_MANDATE.txt; o contrato77externo continua ausente, aplicam-se apenas as regras materializadas do TXT/v01.

Implementado simulador puro em infrastructure/feasibility, sem dependências novas ou chamadas de provedor.125cenários determinísticos (5provedores×1/5/20tenants×0/1/2/5fotos/dia×20MiB/mistura, mais5stress). Bytes inteiros, duplicação de backup explícita, previews, versões ocultas, pendentes, órfãos, fixos/protegidos/holds, egress, crescimento e encerramento real do fluxo. A política canônica doGOALVII é reutilizada sem alteração; LOW não recebe vencimento e promessa MEDIUM não é encurtada apósHIGH. Admission e demanda são simulações independentes: recusas podem mudar o tier, portanto não se assume o mesmo TTL nos dois cenários.

8/8testes direcionados locais passaram. Duas expectativas iniciais foram corrigidas: a primeira geração pode ter promessaMEDIUM104dias, e queda paraLOW/NONE pode manter arquivos sem auto-delete. Não mudamos a política para fabricar liberação de espaço.

Rodar: `bash scripts/cloud-run.sh npm --prefix infrastructure/feasibility test` e `bash scripts/cloud-run.sh node infrastructure/feasibility/simulate.mjs`. SCENARIOS.json/CSV são projeções sintéticas, não telemetria real ou cotas comerciais. p95 usa percentil nearest-rank das ocupações diárias do horizonte declarado; não é probabilidade/confiança de produção.1000000000bytes noSupabase;10GBB2conservador;Tigris5×2^30explicitamente documentado. Não somar contas/provedores para contornar quotas.

Fontes oficiais e decisões financeiras preliminares em capacity-free/PROVIDERS.json, revisadas26/10/2026. B2 confirma10GB e cadastro sem cartão, mas caps são monetários, alterações levam até10min e classeDnãoélimitável; não aceitamos garantia de ausência de dívida/bloqueio apenas pelo marketing. Tigris confirma cadastro sem cartão, mas também metering após franquia; bloqueado como zero-billing estrito. Supabase eImageKit permanecem condicionais, sem conta real, quotas efetivas ou preservação de leitura homologadas.

Há envelopes matemáticos pequenos em10GB, não crescimento ilimitado. Ex.:1tenant×1foto20MiB/dia com fluxo14dias, backup1cópia, sem crescimento protegido pode caber no horizonte;20tenants×2/dia não cabe. Isso não aprova billing, tokens, cron ou autorização hosted. Nenhum novo adaptador de provedor, cutover, rotina destrutiva, plano comercial ou portabilidade das101Functions foi iniciado.

FaseC, orçamento workerd e decisão final ainda em implementação neste checkpoint. PhaseD permanece bloqueada até candidato consistente. ComercialNOT_READY;0/7gates completos de migração,6parciais/1bloqueado doGOALVII preservados.
