# Serviços, portfólio e apresentação pública — F1.7

Contrato implementado em 2026-10-22. Resultados reais e aceite ficam em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md); este documento não promove gates pendentes a PASS.

## Dados e autorização

- `ateliers/{id}/services` armazena título, descrição comercial, categoria, ordem, publicação, arquivo, nota interna e versão.
- `ateliers/{id}/portfolio` acrescenta personagem, franquia, destaque e galeria. Fotos novas ficam em `ateliers/{id}/portfolio/{projectId}/images/{imageId}`; o documento guarda somente referências e metadados de integridade, sem URL de download permanente.
- Cadastro/edição passam por `saveAtelierService` ou `saveAtelierPortfolioProject`. Serviços usam `services:read`/`services:write`; portfólio usa `portfolio:manage`. O tenant vem do perfil ativo, com e-mail verificado, membership ativo e ateliê ativo. Transações revalidam perfil, tenant e permissão. Owner/admin conservam suas permissões existentes.
- Schema estrito rejeita tenant/ator/campos extras no payload. Ordem e versões são inteiras; texto tem limites explícitos. Edição usa comparação de versão; concorrência não sobrescreve silenciosamente outra mudança. Retry usa requestId por UID com fingerprint do conteúdo em `showcaseOperations`; dados diferentes na mesma chave falham.
- Arquivar mantém o documento e exige publicação desativada. Projeto novo começa privado e não pode ser publicado sem foto. Retirar sua última foto despublica o projeto automaticamente. Auditoria registra ator, tenant, ação, versão e alteração na mesma transação.

## Projeção pública e white-label

`listPublicShowcase` reutiliza `lookupTenant`, o mesmo resolver central de `resolvePublicTenant` e do intake. Slug não autentica nem escolhe namespaces privados. Antes de devolver dados, o catálogo revalida publicação, atividade e mapeamento do slug.

A allowlist pública contém somente título, descrição, categoria, ordem e, para projetos, personagem/franquia/destaque e id/legenda das imagens. Notas internas, IDs de clientes/pedidos, contatos privados, autores, caminhos Storage, hashes e URLs legadas não fazem parte da resposta. Documentos brutos públicos/privados de portfólio e serviços, incluindo cópias antigas em `publicAteliers/{id}/portfolio`, são inacessíveis ao browser nas Rules.

Nome público, apresentação curta, cor, publicação da página e recebimento de solicitações são mantidos por `saveAtelierPublicProfile`, com `atelier:settings`, versão, retry e auditoria. Slug/mapeamento não podem ser alterados por esse formulário. Configuração ausente exige configuração prévia do endereço; não é inventado tenant global. Demo comercial não pode habilitar intake público. Nenhum preço/plano/entitlement foi alterado.

## Imagens e revogação

`uploadShowcaseImage` recebe bytes com Bearer Firebase; valida identidade, projeto do próprio tenant, versão, MIME/assinatura, tamanho e hash. Storage grava com precondição de criação, impedindo substituir bytes de outro envio. A associação à galeria ocorre em transação após revalidar a permissão. Retry do mesmo id/conteúdo não duplica a imagem; outro conteúdo no mesmo id falha. Upload de demo continua bloqueado.

`downloadShowcaseImage` tem duas fronteiras: preview autenticado pela conta do próprio ateliê, ou leitura pública pelo slug publicado. Em ambos os casos verifica imagem pertencente ao projeto, hash e estado antes e depois da transferência do Storage. O preview também confirma que o vínculo do ator não mudou de tenant. Despublicação, suspensão, retirada da imagem ou troca do slug impedem uma nova leitura. Respostas usam `private, no-store` e `nosniff`; a UI recebe Blob URL temporário e revoga-o ao desmontar.

Rules negam todos os acessos diretos a bytes novos, inclusive owner. Caminhos antigos de portfólio perderam leitura anônima via Rules e escrita direta; leitura legada da equipe permanece sob `portfolio:manage`. Uma cópia já baixada não pode ser retirada do dispositivo do visitante. Tokens permanentes legados já distribuídos exigem inventário/revogação global em F2/F6, sem migração ou mutação real nesta execução. Nenhuma URL antiga é devolvida pelo novo catálogo.

O teto técnico desta implementação é 500 registros por seção e oito fotos por projeto, até 10 MB por foto. Excesso de catálogo falha explicitamente, sem truncar conteúdo como se estivesse completo. Não são cotas ou direitos comerciais de planos. Paginação analítica/editorial e ciclo físico de limpeza de objetos órfãos ficam no refinamento F3/F6. Retirar uma imagem remove sua referência e acesso; não destrói bytes históricos fora de uma política de retenção aprovada.

## Catálogo → solicitação de orçamento

As CTAs apontam ao formulário do mesmo slug com `serviceId`/`projectId`. A UI resolve o contexto exclusivamente no catálogo público atual. O backend do intake valida a referência novamente dentro da transação, junto com publicação, atividade, slug e permissão de receber solicitações. Conteúdo privado/arquivado, outro tenant e path adulterado são negados.

A solicitação guarda `showcaseContext` com id/título público daquele momento. Alterar ou despublicar o conteúdo depois não reescreve o histórico da solicitação. A equipe vê esse snapshot na ficha da solicitação; não recebe vínculo a pedido/cliente privado do portfólio. Solicitações sem contexto continuam seguindo o contrato anterior de formulário e referências.

## Gates

- Projeção/versão: allowlist sem notas, contato privado, caminhos, hashes e URLs; tratamento de legado malformado e versões inválidas.
- Functions: CRUD/retry/fingerprint/concorrência, upload/bytes/retry, publicação/revogação, A/B, payload adulterado, MIME inválido, perfil inativo, tenant suspenso, demo e snapshot de origem comercial.
- Rules: leitura/lista pública bruta negada; create/update/delete de catálogo/ops negados inclusive para owner; bytes novos não acessíveis diretamente; imagens legadas sem leitura anônima.
- E2E desktop/mobile: cadastro, foto Blob decodificada, publicação, identidade, catálogo/filtro, solicitação com contexto, ficha da equipe, despublicação, imagem 404 e isolamento do segundo slug. Build e lint completam o gate local.

Resultados observados e pendências são registrados separadamente no checkpoint. Nenhum deploy, uso de Firebase real, gateway ou envio externo faz parte deste módulo.

Aceite local em 2026-10-22: integração final 5/5, Rules 23/23, unitários direcionados 7/7, build 81 páginas, TypeScript/lint/docs:check, E2E desktop 1/1 e mobile 1/1; CI 39709281488 verde. Segurança global de links legados e preparação real permanecem nas fases transversais.
