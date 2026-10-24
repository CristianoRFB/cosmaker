# Recuperação ensaiada somente com emuladores

GOAL V: harness também sela inventário/checksums Auth/Firestore/Storage antes do import e verifica contagem/conjunto de UIDs por hash após restore. Manifesto exclusivo recusa corrupção/ausências/extras/symlinks/UIDs duplicados. Teste completo aprovado emrecovery-b16e1619, incluindo admin/slug sintéticos pelos novos guards --apply; cliente normal continua sujeito à ACL. Roteiro real e limites de gerações GCS/tokens/RPO/RTO/falha parcial em [BACKUP_RESTORE](../operations/pre-homologation/BACKUP_RESTORE.md). Não reutilizar harness para dados reais.

Com o runtime interativo encerrado, execute:

```bash
bash scripts/cloud-run.sh npm run test:recovery
```

O ensaio cria duas instâncias sequenciais, sempre com projeto `demo-cosmaker` e endpoints `127.0.0.1`, portas livres e configuração derivada das Rules/índices do repositório. A primeira cria exclusivamente fixtures de Auth, Firestore e Storage e exporta pelo Firebase CLI existente. A segunda inicia do zero com `--import` dessa exportação. Artefatos ficam em `.firebase/recovery-<nonce>/`, ignorados pelo Git; nunca são enviados ao repositório.

Verificações: login com senha fictícia, e-mail verificado e claims; centavos inteiros, timestamps e histórico; dois namespaces de ateliê distintos; bytes e SHA-256 do arquivo; leitura autorizada do histórico do próprio pedido e negações para root raw do próprio pedido, pedido B, ledger financeiro e bytes Storage raw após restauração (o detalhe usa projeção de Functions no runtime da aplicação). As contas usam somente `@cosmaker.test`, sem dados pessoais. Falha encerra o processo com código diferente de zero. O script não aceita destino/projeto/arquivo de importação fornecido pelo usuário: restaura apenas o snapshot sintético gerado pelo próprio ensaio.

Este ensaio não é backup comercial. Não estabelece retenção, RPO/RTO, cópia externa ou recuperação de Firebase real. Functions, regras, índices e aplicação continuam versionados no Git; não são dados restaurados pelo snapshot. Functions e schedulers ficam desligados no ensaio para evitar efeitos de replay. Homologação futura precisa validar restauração real autorizada, permissões do operador, integridade e replay de triggers, rotação/revogação de links legados, monitoramento e uma janela de manutenção. Nenhuma dessas operações reais está autorizada nesta missão.

Resultados efetivos e limitações em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md); não tratar apenas a existência do script como PASS.

Repetição24/10/2026 com CLI15.34.1/Admin14.5/Functions7.4 PASS: write/export e novo runtime/import, incluindo ACL atual e Storage raw negado. Artefatos sintéticos recovery-97a2222e ignorados pelo Git; resultados em MASTER_FINALIZATION_PROGRESS.md.
