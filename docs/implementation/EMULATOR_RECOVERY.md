# Recuperação ensaiada somente com emuladores

Com o runtime interativo encerrado, execute:

```bash
bash scripts/cloud-run.sh npm run test:recovery
```

O ensaio cria duas instâncias sequenciais, sempre com projeto `demo-cosmaker` e endpoints `127.0.0.1`, portas livres e configuração derivada das Rules/índices do repositório. A primeira cria exclusivamente fixtures de Auth, Firestore e Storage e exporta pelo Firebase CLI existente. A segunda inicia do zero com `--import` dessa exportação. Artefatos ficam em `.firebase/recovery-<nonce>/`, ignorados pelo Git; nunca são enviados ao repositório.

Verificações: login com senha fictícia, e-mail verificado e claims; centavos inteiros, timestamps e histórico; dois namespaces de ateliê distintos; bytes e SHA-256 do arquivo; autorização de leitura do próprio pedido e negações para o pedido B e ledger financeiro após restauração. As contas usam somente `@cosmaker.test`, sem dados pessoais. Falha encerra o processo com código diferente de zero. O script não aceita destino/projeto/arquivo de importação fornecido pelo usuário: restaura apenas o snapshot sintético gerado pelo próprio ensaio.

Este ensaio não é backup comercial. Não estabelece retenção, RPO/RTO, cópia externa ou recuperação de Firebase real. Functions, regras, índices e aplicação continuam versionados no Git; não são dados restaurados pelo snapshot. Functions e schedulers ficam desligados no ensaio para evitar efeitos de replay. Homologação futura precisa validar restauração real autorizada, permissões do operador, integridade e replay de triggers, rotação/revogação de links legados, monitoramento e uma janela de manutenção. Nenhuma dessas operações reais está autorizada nesta missão.

Resultados efetivos e limitações em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md); não tratar apenas a existência do script como PASS.
