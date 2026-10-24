# Referências públicas por bytes e capability

O formulário calcula SHA-256 e declara nome (até 180 caracteres), MIME e tamanho. `createPublicQuoteRequest` resolve exclusivamente o slug canônico, valida publicação/intake/tenant ativo e emite uma capability aleatória de 256 bits por imagem. Só o hash do segredo é persistido; o navegador recebe a capability e a expiração técnica de 15 minutos. Continuam JPEG/PNG/WebP, cinco referências e 10 MiB por arquivo; não há direito/cota comercial novo.

`uploadPublicQuoteReferenceBytes` aceita POST com slug, solicitação e uploadId, capability no header Authorization e bytes no corpo. Recusa tenant arbitrário, capability de outro arquivo/slug, expirada, metadata ou bytes divergentes, assinatura falsa, solicitação fora de new, demo e intake indisponível. Autoridade e estado são relidos em transações antes/depois de I/O. SHA-256 declarado e calculado precisam coincidir. Uma lease de cinco minutos serializa concorrência; expira após interrupções. Arquivo existente é comparado pelos bytes reais, sem sobrescrita, além da precondition GCS generation=0. Metadata que só alega o hash não basta.

A conclusão consome a capability e guarda geração/data. Retry com capability ainda válida e bytes idênticos somente reconhece o recibo imutável, sem regravar objeto ou metadata. Replay para conteúdo, solicitação, slug ou arquivo diferentes é recusado; expiração também se aplica ao recibo. Um retry durante outra lease recebe conflito. O navegador faz no máximo uma repetição; não remove objetos em erro. O transporte não autoriza leitura nem distribui URLs/tokens permanentes.

Os callables públicos antigos de complete/discard estão descontinuados: complete recusa mutação e discard devolve false sem apagar arquivos. Assim não contornam capability/hash/expiração e não apagam uma conclusão concorrente. Uploads antigos pendentes não recebem autorização retroativa; devem ser reenviados pelo contrato novo. Bytes existentes e referências prontas/legadas permanecem preservados, com leitura autenticada anterior. Nenhuma revogação global real foi executada.

A criação do pedido copia somente referências ready ou legadas sem uploadStatus. Não copia uploads pendentes ou campos internos de capability/lease. Preserva geração/hash e o snapshot histórico autorizado.

## Inventário dos caminhos

| Caminho | Decisão |
| --- | --- |
| quoteRequests/*/references/* | Migrado a servidor/capability; leitura autenticada e legado pronto preservados; raw bloqueado. |
| orders/*/production/* | Transporte autenticado já aprovado preservado; raw bloqueado. |
| orders/*/attachments/* | Transporte autenticado existente preservado; raw bloqueado. |
| portfolio/*/images/* | Catálogo por bytes existente preservado; raw bloqueado. |
| branding/*; portfolio/*/* legado; clients/*/measurements/*; contracts/*; invoices/*; orders/*/{shipping,documents,references,approvals}/* | Sem chamadas Storage SDK ativas nos fontes de app/components/repositories/services. Escrita raw descontinuada; objetos preservados. Leitura compatível por `downloadLegacyAtelierFileBytes`, tenant derivado do perfil, permissão de domínio e entidade existente, estado relido após I/O, tamanho/tipo/assinatura, cache privado e revogação somente do objeto lido. |
| Outros caminhos genéricos | Bloqueados, sem fallback público ou por e-mail. |

As Storage Rules negam todo acesso raw, com **zero** consultas cross-service; a autorização está nos endpoints de domínio. Arquivos legados não são apagados. Links antigos já distribuídos podem continuar válidos até revogação do objeto; Rules não revogam download tokens.

`scripts/inventory-emulator-storage-tokens.mjs` faz inventário somente leitura, recusando projeto diferente de demo-cosmaker ou endpoint diferente de loopback. Exporta contagens por família, sem tokens, paths, URLs ou metadata pessoal. A presença de metadata de token no Emulator não prova distribuição: ele pode criar token substituto internamente. O ensaio deve distinguir token antigo revogado de metadata de token presente. Inventário/revogação global de Firebase real permanece dependência futura autorizada, sem resultado inventado.

Gates atuais no checkpoint canônico. Este contrato não é homologação GCS real, dos limites do transporte HTTP nem de tokens já distribuídos em produção.
