# GOAL VI — viabilidade e limites, sem aceite de migração

Base cca4e23 preservada na branch candidata. Experimento isolado codex/cosmaker-spark-zero-billing. Nenhum recurso real criado, ativado, migrado ou publicado; nenhuma conta de cobrança, R2, Functions, Cloud Storage ou Scheduler remoto usado pela prova. O frontend principal continua com o transporte anterior. **Arquitetura gratuita integral ainda NÃO VALIDADA.**

## Serviços e requisitos oficiais

| Componente proposto | Gratuito sem billing obrigatório no uso limitado | Restrições / resultado desta revisão |
| --- | --- | --- |
| Firebase Auth | Spark: e-mail/senha e provedores sociais disponíveis; SMS não faz parte deste escopo | Contas fictícias somente; JWT RS256 sintético validado, consulta atual/revogação no Emulator. JWKS/identidade de serviço/IAM real não homologados. |
| Firestore Standard | Spark:1GiB,50mil reads/dia,20mil writes/dia,10GiB egress/mês | REST oficial com IAM de serviço ignora Rules; Worker deve impor toda autorização. Transação real no Emulator/auditoria/retry aprovados apenas nas operações da prova. |
| Realtime Database | Spark:1GB,10GB downloads/mês,100 conexões,1banco | Não é object storage. Strings até10MB; Base64 expande4/3.20MiB raw não cabem num único valor. Prova6MiB/PDF limitada e não equivalente ao produto. |
| Workers Free HTTP/Cron | Conta Free:100mil requests/dia,10ms CPU por HTTP e por Cron,128MB/isolate,50subrequests externos,6conexões simultâneas,5crons/conta | Handler real local passou; sem teste de recursos/relógio da borda. Restrições não são simuladas automaticamente pelo Miniflare. |
| Next15/OpenNext/Static Assets | Workers Free + assets, sem bindingR2; OpenNextMIT compatível com15.5.28 | Compila; preview/CPU/UI registrados no handoff final. SSR cabe no bundle atual, mas limite CPU ainda NÃO aceito. Sem ISR compartilhado: overrides dummy explícitos do adaptador, nenhum R2. |
| Backup | Ferramentas locais sobre dados sintéticos não exigem serviço pago | Round-trip RTDB não equivale a restore integrado/operacional nem backup externo durável. Gerenciado Firestore anterior não é solução Spark assumida. |

Fontes oficiais consultadas25/10/2026: [Firebase preços](https://firebase.google.com/pricing), [RTDB limites](https://firebase.google.com/docs/database/usage/limits), [Firestore REST](https://firebase.google.com/docs/firestore/use-rest-api), [RTDB REST Auth](https://firebase.google.com/docs/database/rest/auth), [Workers limites](https://developers.cloudflare.com/workers/platform/limits/), [Workers preços](https://developers.cloudflare.com/workers/platform/pricing/), [Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [OpenNext](https://opennext.js.org/cloudflare/get-started), [cache](https://opennext.js.org/cloudflare/caching). Quotas são por projeto/conta, não multiplicadas por ateliê. Revalidar termos/quota da conta antes de qualquer operação real autorizada. Defaults não comprovam configuração.

## Prova implementada

Worker sem Admin SDK Node. REST Firestore beginTransaction/batchGet/commit/rollback e retries ABORTED limitados; valores monetários usam a política canônica existente. FinanceOperations, financeEntries, payments, saldos reais/centavos e auditLogs preservam seus formatos na operação recordFinanceEntry. Não há compensação/listagem completa portada. Nenhum código comunitário decide saldo ou permissão financeira.

Modo de execução é fechado: MODE=disabled por default. MODE=emulator exige todos os endpoints loopback e demo-cosmaker. Token unsigned é exclusivo do Auth Emulator; não é autenticação de produção. JOSE verifica assinatura/algoritmo/issuer/audience/exp/iat/auth_time com chaves sintéticas em teste separado. Usuário atual desabilitado/revogado/e-mail não confirmado e vínculo/permissão canônicos negam acesso. Transporte OAuth/JWKS e lifecycle de secrets reais não implementados/homologados. Não fornecer credenciais reais ao experimento.

RESTgetDocument com transaction na query causou Unmapped JavaType:BYTE_STRING no Emulator. A implementação usa batchGet oficial com transaction no corpo e passa transação/retry reais. Worker não suporta redirect:error; usa manual e recusa3xx, sem seguir destinos arbitrários. O hook de corrida dos testes encaminha todos os bytes/requests reais via fetch do Miniflare, sem fabricar respostas Firebase.

## Arquivos: aprovação recusada por enquanto

| Contrato anterior | Situação RTDB experimental |
| --- | --- |
| Fotos produção/referência/showcase JPEG/PNG/WebP até10MiB | Não migradas. Sem decode/compressão/redimensionamento seguros no Free. Prefixo MIME/hash não comprovam decodificação segura. |
| Anexos de pedido PDF/imagens até20MiB | Prova de PDF até6MiB;20MiB Base64 em valor único recebeu400 no Emulator, sem objeto criado. Contrato20MiB NÃO preservado. |
| Documentos/contratos e arquivos legados | Não migrados. Hash/dados privados não dispensam formato/generation/ownership canônicos nem preservação histórica. |
| GCS generations / ifGenerationMatch | RTDB ETags/CAS protegem criação do candidato; não equivalem à generation já referenciada nos documentos antigos. |
| URLs/tokens legados | Nenhuma exclusão ou revogação real. Objetos e histórico antigos intactos. |

Objetos privados sob spark/objects e metadados experimentais sparkFiles; Rules RTDB raiz negam acesso direto. O Worker valida tenant, UID/CRM e RBAC, hash/MIME, lease, pedido e estado antes/depois de I/O. pending/ready, comparação de versão, ETag null_etag e fingerprint impedem publicação parcial/sobrescrita/retry divergente. Mudança do pedido depois do PUT real deixa pending e nega leitura; retomada legítima reconcilia sem apagar objeto. Limites conservadores/teste para espaço global, tenant e tráfego são infraestrutura, não entitlements comerciais novos. Não apaga histórico ao atingir limite.

O ledger RTDB central, restrito a400reservas nesta prova, não escala indefinidamente. Reservas órfãs não são liberadas automaticamente: reconciliação precisa confirmar ambos os bancos e manter auditoria. Não há atomicidade Firestore/RTDB. Contabilização de protocolo/TLS e leituras do próprio ledger NÃO está suficientemente validada para garantir quota mensal global real. Medidas locais confirmam que Base64/JSON/hash de6MiB exigem redesenho; não aprovar com base no simples PASS de upload pequeno.

Capacidade teórica, não comercial:1GB de JSON deixa menos de750MB raw antes de chaves/metadados/índices. Orçamento conservador experimental750MB JSON daria menos de562,5MB raw para TODOS os tenants.10GB egress corresponde a menos de7,5GB raw, ainda com overhead/leituras internas a subtrair. Espaço disponível real e demais usos do banco precisam ser inventariados antes de configurar limites. Nenhuma quota por plano aplicada.

Chunking não foi demonstrado como solução equivalente: precisa objeto imutável/manifesto/hash global, quotas/reservas, range/stream, proteção de chunks, backup/reconciliação e CPU/subrequests.50requests não autorizam eliminar verificação ou servir conteúdo antes da integridade exigida. Um limite do protótipo não prova impossibilidade de todo algoritmo futuro.

## Scheduler

Evento scheduled real no workerd, sem endpoint HTTP público de execução. Expiração UTC e revalidação transacional/auditoria única preservadas nos casos exercitados. Cursor persistido avança100legados inválidos; lease evita corrida de cursores e replay de eventos não duplica auditoria. Orçamento por invocação limita2candidatos elegíveis/16linhas, cron1minuto; capacidade nominal máxima120candidatos/h,960linhas/h, não garantia de SLA. Backlog/CPU e monitoramento ainda não aceitos. Em vazio, controle/query geram aproximadamente2880writes/dia e pelo menos4320reads/dia para cron por minuto, antes de expirações/retries; contam na quota Spark. A frequência é experimento, não substituição silenciosa do contrato horário aprovado. Não declarar cron remoto com base neste ensaio.

## Alternativas pesquisadas antes de mudar contratos

- [Supabase Free](https://supabase.com/pricing): object storage1GB e egress5GB uncached/5GB cached; [pausa por inatividade](https://supabase.com/docs/guides/platform/free-project-pausing) após7dias. Candidato genuinamente gratuito limitado para objetos privados via gateway, sujeito a confirmar cadastro sem cobrança e termos da conta. JWT Firebase não vira autoridade Supabase automaticamente: gateway teria de consultar Firestore e usar segredo apenas servidor, sem URL permanente. Não implementado/provisionado, não equivalente/homologado, não substitui banco canônico.
- [Appwrite Free](https://appwrite.io/pricing): alternativa com armazenamento limitado; pausa/capacidade/ACL e termos da conta exigem prova específica. Não selecionada nem provisionada.
- [Netlify Free](https://www.netlify.com/pricing/):300créditos/mês com limite rígido, candidato para NextSSR [adaptador](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/). Créditos compartilhados por tráfego/compute/deploy impedem capacidade ilimitada. Não implementado nem afirmado equivalente.
- [Vercel Hobby](https://vercel.com/docs/plans/hobby): uso pessoal/não comercial; não serve de base gratuita aprovada para este SaaS.
- Firebase Hosting estático Spark não executa SSR/rotas dinâmicas atuais por si só. Exportação estática integral exigiria alterar slug/SEO/rotas/servidor, não foi aplicada nem chamada de equivalente.

Nenhuma alternativa remove as quotas ou oferece garantia comercial ilimitada R$0. Nenhum upgrade/billing/R2 foi recomendado como solução ou ativado. A migração do produto fica parada antes da troca de transportes enquanto os gates de equivalência continuarem abertos.
