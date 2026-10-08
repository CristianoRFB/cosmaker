# Segurança e isolamento

## Princípios

- A interface não é enforcement. Callable Functions, Firestore Rules e Storage Rules continuam protegendo operações.
- Slug apenas resolve a configuração pública; não autoriza a área privada.
- O backend rejeita `atelierId` enviado pelo browser e deriva o destino do slug canônico consultado no servidor.
- Membership, `active`, role e permissões continuam controlando acesso autenticado por `atelierId`.

## Intake e uploads

Firestore nega criação pública direta de solicitação e escrita direta de registros de referência. Cloud Functions validam campos e descritores, criam solicitação e referências pendentes sob o tenant resolvido e devolvem somente os paths esperados. O intake exige ateliê publicado e `quoteRequestsEnabled`; Storage verifica essas flags, ateliê ativo, solicitação nova, registro pendente, path, MIME e tamanho. A Function final valida assinatura do arquivo e marca `ready`; metadados prontos só podem ser lidos por membro ou pelo dono autenticado com e-mail verificado conforme regras atuais.

Se o tenant estiver suspenso, intake e upload deixam de ser aceitos. Slug desconhecido ou não publicado não sofre fallback.

## Dados de slug

`publicAtelierSlugs` e `publicAteliers` não têm leitura pública direta. O callable usa Admin SDK para responder apenas nome, tagline, cor da marca e flags necessárias. Slugs não devem ser tratados como segredo.

## Evidência de isolamento

Os testes Rules cobrem leituras/escritas negadas entre tenants e o fluxo público. E2E confirma registros e paths de Storage A em `atelier-aurora` e B em `atelier-luna`, inexistência no tenant cruzado e rejeição de payload forjado com `atelierId`. Testes também cobrem slug ausente/inválido, suspensão e publicação.

## Limitações fora do marco

App Check, rate limiting/anti-abuso, alertas e monitoramento operacional de intake permanecem pendentes. A migração real e publicação de Rules/Functions não ocorreram nesta execução.
