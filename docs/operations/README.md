# Operação e pré-homologação

Começar pelo [guia Windows e checklist](pre-homologation/WINDOWS.md). Este pacote é candidata técnica, não publicação ou aprovação comercial. v0.2.0 continua canônica.

| Documento | Uso |
| --- | --- |
| [Custo](pre-homologation/COST_AND_DEPENDENCIES.md) | Ler primeiro: produto completo não opera no Spark sem billing. |
| [Windows](pre-homologation/WINDOWS.md) | Ferramentas, destino privado, preflight e checklist da sessão. |
| [Matriz](pre-homologation/ENVIRONMENT_MATRIX.md) | Configuração esperada, teste, ferramenta e retorno por camada. |
| [Aceite real](pre-homologation/REAL_ACCEPTANCE.md) | Ordem de testes, jornada, arquivos, concorrência e scheduler. |
| [Recuperação](pre-homologation/BACKUP_RESTORE.md) | UIDs, checksums, gerações, integridade e falha parcial. |
| [Publicação/rollback](pre-homologation/PUBLICATION_ROLLBACK.md) | Autorizações, versões anteriores, parada e pós-deploy. |
| [Candidata](pre-homologation/RELEASE_CANDIDATE.md) | Manifesto, hashes, resultados e riscos. |
| [Handoff V](pre-homologation/HANDOFF.md) | Categorias A/B/C, commits e próximo bloqueio. |

Preflight/preparador nunca disparam deploy. Testes demo-cosmaker são exclusivos de Emulator; não redirecioná-los ao Firebase real. Dados/evidências reais ficam em .local/ privada, ignorada pelo Git.
