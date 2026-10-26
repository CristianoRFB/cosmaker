# GOAL VIII — orçamento Workers Free e prova local

**STRICT PATH BLOCKED. DIAGNOSTIC ONLY. NÃO É HOMOLOGAÇÃO HOSTED.**

Fontes de26/10/2026: [limites](https://developers.cloudflare.com/workers/platform/limits/), [boas práticas](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), tipos oficiais `@cloudflare/workers-types@5.20261026.1` consultados sem alterar dependências da aplicação. Runtime local existente Miniflare5.20261019.2-beta/workerd, Node22; sem deploy, conta ou billing. A cópia do schema oficial no Wrangler existente também foi inspecionada.

## Orçamento e o que é realmente imposto

| Recurso | Limite Free documentado | Implementação da prova | Aceite |
| --- | --- | --- | --- |
| CPU HTTP e Cron |10ms por invocação |Config nativaV5 com cpuMs10; API local process.cpuUsage indisponível/não confiável por invocação. Modo estrito recusa antes dos bytes comCPU_ENFORCER_UNAVAILABLE |BLOCKED; não simular enforcement por cronômetro |
| Subrequests |50 por invocação, contando retries/redirects |InvocationBudget compartilhado por Auth+Firestore+blob+revalidação;51ºé recusado antes da rede, redirects não seguidos |PASS_LOCAL de contagem |
| Conexões |6 simultâneas |Reserva mantida até consumir/cancelar body, não apenas até headers |PASS_LOCAL |
| Memória |128MiB por isolate, inclusive nativa e concorrência |Reserva lógica com32MiBde margem hipotética; verify21MiB/download41MiB. Download mantém reserva até EOF/cancel. Não mede todo heap/native |PARTIAL_LOCAL;128MiB reais não comprovados |
| Requisições |100000/dia por conta |LedgerUTC sintético compartilhado no processo;100001ºnegado. Não é contador distribuído de todos os Workers da conta |PARTIAL_LOCAL, não pronto para produção |

Não existe redução de SHA, tamanho, autenticação ou revalidação para fazer o orçamento passar. O modo diagnóstico só é aceito emMODEemulator, demo-cosmaker e origins loopback. Não existe configuração que habilite Firebase real. CPU não pode ser comprovada por header, UID, query ou valor enviado pelo cliente. O modo padrão falha fechado; nenhuma operação marcaREADY, grava lançamento financeiro, elimina arquivo ou publica migração.

## Caminho de dados e evidências

Novo caminho **experimental de leitura/verificação**, não novo adaptador de provedor: fonteHTTPprivada sintética somente emloopback → workerd executa Auth Emulator, Firestore REST e RBAC canônico reutilizado → lê20MiB binários em uma requisição → SHA256incremental comDigestStream → confere tamanho/hash canônicos e revalida token, membership, estado e revisão. Referência/tenant vêm do Firestore servidor, não de UID/tenant no navegador. ArquivoPENDING não é publicado. Nenhum segredo de fonte vai para cliente.

| Operação exercitada | Bytes | Subrequests observados | CPU |
| --- | ---: | ---: | --- |
| Verificação incremental emworkerd |20971520|16|Não aceita como CPU faturável |
| Download cliente, validado antes de devolver |20971520|14|Não aceita; buffer total tem reserva explícita |
| Guard estrito HTTP |0|0|CPU indisponível→503antes dos bytes |
| Guard estrito scheduled |0|0|Evento real workerd terminaexceptionesperada; não executa retenção sem garantia |
| Auth/RBAC/revisão negativos |Não devolve blob|Contagem dentro de50; erros antes/depois da leitura conforme cenário|Sem promoção de produção |

Isto reduz a pressão de subrequests comparado ao caminho anterior de41reads de blob, sem tratar hash de cliente como prova. A fonte é um fixtureHTTProtulado, **não** Backblaze/Supabase hospedados, RLS do provedor, assinaturaS3ou transporte homologado. Não houve nova conta nem adaptadorB2/Tigris/ImageKit. Upload/retomada e restore doGOALVII não foram refeitos; continuam anteriores/locais, e as pendências da faseD ficam condicionadas à viabilidade.

Download verifica bytes antes de expô-los; não faz streaming irreversível de conteúdo ainda não verificado. Essa decisão exige buffer e CPU e, portanto, não recebe equivalênciaFree. Um futuro caminho realmente streaming precisaria de objeto imutável, hash de origem comprovado, identidade/versão e política de revogação confiáveis; não basta ETag, SHA declarado pelo usuário ou signedURL permanente. Transferir toda a verificação para um brokerNode sem hospedagem gratuita comprovada também não resolve o mandato.

## Medição sem confundir relógios

DevTools Profiler público do próprioworkerd, sampling100µs, coleta janela não ociosa e heap antes/depois. Somente resumos numéricos são registrados; não snapshots de memória, tokens ou perfis com conteúdo. Esses números incluem frames desconhecidos/runtime, perturbação do profiler e não cobrem perfeitamente crypto nativa ou todo uso do isolate. **Não são CPU exata por invocação, RAM de pico total ou cobrança hosted.** Wall time incluiesperaI/Oe é separado. performance.now pode não avançar durante CPU síncrona no Worker; não serve como limitadorCPU.

Os limites foram colocados no configV5 depois de convertV4MiniflareOptions: a pontelegada não preserva toda configuração moderna. Mesmo configurado10ms, a calibração síncrona limitada completou localmente200; não tratamos a aceitação do config como prova de limite. A API process.cpuUsage local foi consultada e o resultado é marcado não confiável/indisponível. Por isso o caminho estrito não libera tráfego. Não houve monkey patch do engine nem modificação de certificados/proxy.

Resultados, amostras e versões estão noEVIDENCE.json próprio. Oito integrações novas passaram, incluindo negativos de token expirado/falso, tenantB, privado, hash/tamanho, revogaçãoAuth/member durante leitura, revisão e cron fechado. Houve falhas iniciais reais do harness: protocoloWStratado comoHTTP, binding incorreto do fetch e tentativa de porta fixa do inspector. Correções compatíveis foram testadas; tentativas não são contadas comoPASS.

Reproduzir somente comEmulatorsAuth/Firestore:

```bash
bash scripts/cloud-run.sh npm --prefix infrastructure/feasibility test
bash scripts/cloud-run.sh node infrastructure/feasibility/run-runtime.mjs
```

Nenhum teste deCPUhosted foi executado. Para aceitarCPU/RAM/quotas reais, é necessária autorização separada de uma sessão de homologação Free sem billing, com métricas oficiais da conta e prova de todos os caminhos de dados. Até lá: flagsOFF, NOT_READY e nenhum porte adicional deFunctions.
