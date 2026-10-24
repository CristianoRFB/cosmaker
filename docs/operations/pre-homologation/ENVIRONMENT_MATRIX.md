# Configuração esperada, evidência e retorno

Todas as linhas estão PREPARADAS / TESTE REAL NOT_RUN nesta execução. Preencher evidência, data, operador e resultado na cópia privada; defaults e Emulator não comprovam configuração real.

| Camada | Configuração esperada | Teste / ferramenta | Parada / rollback |
| --- | --- | --- | --- |
| Identidade/destino | ID+número explícitos; CLI/gcloud/ADC/runtime diferenciados; projeto só de homologação | preflight.ps1, Console/IAM, projects describe | Divergência: parar, sem trocar alias/IAM por tentativa. |
| Custo | Decisão explícita de Blaze/consumo e retenção/franquias | Billing Console e preflight somente leitura | ZERO_BILLING bloqueia implantação completa; alerta não é teto global. |
| Auth/provedores | E-mail/senha; Google se aprovado; sem SMS/canal pago implícito | Console Authentication > Sign-in method, cadastro/login/relogin | Reverter configuração anterior capturada, sem excluir contas. |
| Auth/domínios | Origins HTTPS e authDomain exatos, redirects e domínios autorizados; localhost só dev | Auth Settings, popup/redirect real | Remover apenas entrada nova aprovada; preservar anteriores. |
| Auth/e-mails | Verificação/reset entregues; templates/URLs/marca e enumeração revisados | Caixa controlada; código único/expirado/replay/senha anterior | Pausar fluxo, corrigir template; revogação sob autorização. |
| Auth/autoridade | UID durável, perfil/membership ativos; owner global só identidade existente verificada | Claims+Firestore, reuso de e-mail/revogação/A×B | Reverter concessão específica; preservar UID/histórico. |
| Firestore | Database(default), Native, região decidida; schemas atuais | Preflight describe; consultas reais | Localização/edição diferente exige decisão própria. |
| Firestore/Rules | firestore.rules exatas, raw privado e writes server-managed | SDK/REST A×B, sem sessão/perfil revogado | Reaplicar Rules anteriores seguras; nunca abrir acesso para passar. |
| Firestore/índices | firestore.indexes.json READY; quotes COLLECTION_GROUP(status,validUntil) incluído | gcloud firestore indexes composite list; consultas reais | Esperar READY; preservar índices antigos até fechar retorno. |
| Integridade | Centavos/timestamps, UID/CRM/tenant, transações e histórico/auditoria | Jornada/retry/concorrência e saldos persistidos | Congelar writes; conciliação/restore só com backup comprovado. |
| Storage/bucket | Nome e projeto proprietário corretos via FIREBASE_CONFIG do runtime | Preflight+objeto sintético+metadata; não presumir appspot.com | Parar se destino divergir, sem copiar dados por tentativa. |
| Storage/Rules/IAM | Deny-all raw; sem allUsers no bucket; bytes pelos handlers | Raw negado para anônimo/cliente/staff, servidor positivo | Rules seguras/bindings anteriores; tokens antigos têm operação própria. |
| Storage/bytes | MIME+assinatura/tamanho/SHA256, lease/retry/concorrência, generation e ifGenerationMatch=0 | Upload real sintético/hash errado/colisão; metadata GCS | Não sobrescrever evidência ou relaxar validação. |
| Storage/legado | Inventário privado e revogação autorizados de tokens antigos | URL antiga antes/depois, A×B/revogação | Não declarar revogação global por Rules verdes; preservar bytes. |
| Functions | Node22/us-central1 atual; memória/timeout/variáveis por endpoint | gcloud functions describe gen2 e chamadas reais | Fonte/lock/config anterior; npm deploy não publica automaticamente. |
| Runtime IAM | SA distinto do operador; Firestore operações necessárias, Auth lookup, bucket get/create/update conforme código | IAM efetivo+handlers; grupos/custom/deny policies considerados | Não conceder Owner/Editor por conveniência; binding específico revisado. |
| HTTP/segurança | Navegador alcança transporte; autorização Firebase é do handler; intake por slug/capability | Callables/bytes com sessão válida/expirada, CORS | ID token Firebase não substitui IAM/OIDC Cloud Run. Scheduler nunca público. |
| Segredos | ADC/FIREBASE_CONFIG no runtime; nenhum Admin key em NEXT_PUBLIC/repo; canais pagos desativados | Nomes/presença/identidade, sem imprimir valores | Rotação só autorizada; configuração privada anterior disponível. |
| App Check/abuso | Política decidida/monitorada, cliente e handlers preparados antes de enforcement | Console e tokens válidos/inválidos | Não ligar enforcement global sem implementação compatível. Enforcement global não está comprovado no código atual. |
| Eventarc | Aprovação Firestore→pedido, serviços/IAM/entrega reais | Uma ordem por aprovação/replay normal | Suspender writes se duplicar; não duplicar bindings durante retorno. |
| Scheduler v2 | Every60minutes UTC, HTTP/OIDC do job/SA correto | Describe job/IAM; disparo agendado/redelivery e ledger | Pausar job autorizado; registrar estado para resume; não excluir gerenciado. |
| Host | Next15/Node22 dinâmico; config pública real compilada; região alinhada | Manifesto/start/deep links/login/404 e assets/fontes | Release anterior do host; bundle Emulator nunca publicável. |
| Headers/cache | TLS/nosniff/frame/referrer; CSP avaliada com Firebase/OAuth; bytes privados no-store | DevTools/HTTP, quatro viewports, requests autenticados | Reverter proxy/host versionado; não cachear privado nem quebrar Auth com CSP cega. |
| Recuperação | Auth/FS/Storage/config completos, UIDs/claims/hash e vínculos de geração | Restore isolado; leituras protegidas positivas/A×B negativas | Falha parcial: permanecer fechado, preservar origem/legado, sem prosseguir deploy. |

Permissões de deploy/execução/backup/leitura são distintas. Política IAM legível não comprova menor privilégio; defaults das service accounts não são aceitos como prova. APIs ausentes não são habilitadas pelo diagnóstico. Complementos: [aceite](REAL_ACCEPTANCE.md), [backup](BACKUP_RESTORE.md), [publicação](PUBLICATION_ROLLBACK.md).
