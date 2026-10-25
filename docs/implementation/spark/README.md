# GOAL MASTER VI — Spark / Workers Free (WIP)

**ADAPTAÇÃO INCOMPLETA. ARQUITETURA GRATUITA INTEGRAL NÃO HOMOLOGADA.**

Candidata anterior cca4e23281afd4bcfcc5eb0dc69c38e8b641eba2 preservada em codex/cosmaker-master-finalizacao. Código experimental em codex/cosmaker-spark-zero-billing. Não ocorreu deploy, migração, IAM, criação de projeto/conta/segredo, cobrança ou uso de Firebase real/R2.

- [Viabilidade, quotas e alternativas](FEASIBILITY.md)
- [Matriz das47operações](COMPATIBILITY.json):7 parcialmente exercitadas,40 não revalidadas/portadas,0 equivalências integrais aceitas; isso não significa software anterior0% funcional.
- [Mapa das101Functions](FUNCTIONS_MAP.json):recordFinanceEntry e expiração parcialmente adaptados; demais preservadas no transporte anterior.
- [Supply chain e patches](SUPPLY_CHAIN.md)
- [Handoff e evidências](HANDOFF.md)
- [Executar backend local](../../../infrastructure/spark/README.md)
- [Executar Next/OpenNext local](../../../infrastructure/hosting/README.md)

Os182/184critérios98,91% e10/16marcos62,5% continuam pertencendo à arquitetura anterior, conforme seu inventário congelado. O código opt-in de Next foi revisto e o default é preservado; nenhuma porcentagem foi herdada para o transporte Spark. O verificador separado exige mesmo conjunto47 e101exports e impede declarar equivalência de operação não testada integralmente.

A prova demonstra que REST/transações/ACL/bytes privados/scheduled e um frontend Next podem funcionar juntos LOCALMENTE. Não demonstra operação Free integral: transporte RTDB6MiB não preserva20MiB, faltam compressão segura, contabilidade real/restore integrado e autenticação de serviço/JWKS, CPU Free/SSR e equivalência dos outros domínios. Próxima ação deve atacar esses gates antes de trocar o transporte de qualquer painel aprovado.
