# Referências privadas antes do pedido — F2/F5

O painel de solicitações não usa mais `getDownloadURL`. `downloadQuoteReferenceBytes` exige ID token válido/verificado e deriva tenant do perfil; perfil, membership e tenant devem estar ativos e o papel deve permitir `quotes:read/write` ou gestão do ateliê. Apenas IDs da solicitação/referência entram no payload. Client, visitante, equipe de outro tenant e permissões de pedidos sem acesso a orçamentos não recebem bytes por esse endpoint.

O backend confere vínculo exato do caminho, estado pronto/legado, arquivo não arquivado, tipo JPEG/PNG/WebP, tamanho até 10MB, assinatura e, quando disponíveis, geração e SHA-256. Relê a autorização e o registro após o I/O. O retorno usa `private, no-store`, `nosniff` e download sem URL permanente. O painel informa loading/erro e baixa um Blob local. Referências já copiadas para pedidos continuam no endpoint protegido F1.5, com suas permissões/UID do cliente.

Storage Rules negam leitura direta dos bytes, inclusive ao owner e ao e-mail declarado no intake; envio público só cria o objeto pendente previsto pelo contrato anterior. A validação do upload revoga os tokens antes de marcar ready, persiste geração/hash e relê publicação, slug, tenant, solicitação e metadados em transação. Downloads legados autorizados também revogam tokens do objeto acessado.

Essa correção não revoga automaticamente todos os links distribuídos no passado. O inventário e a conciliação global continuam pendentes; nenhuma mutação de Firebase real foi executada. Dados já baixados pelo destinatário não são revogáveis. Ownership de texto/propostas legado por e-mail e auditoria dos demais caminhos privados continuam gates transversais; não inferir aceite F5 global dessa operação.

Gates efetivos em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md).
