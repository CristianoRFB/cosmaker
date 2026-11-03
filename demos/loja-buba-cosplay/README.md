# Demonstração conceitual — Buba Cosplay

Worker independente no Cloudflare, com três perspectivas: vitrine do cliente, atendimento e gestão. A demo é pública, efêmera no navegador e usa somente itens inventados. Não representa site oficial, parceria ou agenda real e não utiliza logotipos da marca.

**Deploy manual Cloudflare:** script Worker de sintaxe service-worker, arquivo `worker.js`, identificador `77-buba-cosplay-conceito`. URLs: `/?view=cliente`, `/?view=atendimento`, `/?view=gestao`.

O projeto principal Next.js/Firebase Cosmaker OS foi mantido intocado; este protótipo pode orientar um tenant white-label futuro após homologação. Para produção, integrar o catálogo, pedidos e permissões no backend isolado por atelierId. Dados localStorage não servem como segurança/persistência multiusuário.
