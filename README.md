# Cosmaker OS

O Cosmaker OS é um sistema empresarial para gestão de cosmakers e ateliês de cosplay. A aplicação compartilhada mantém dados privados separados por atelierId; o fluxo público resolve cada ateliê pelo slug da rota.

## Núcleo multi-tenant público

- Landing, solicitação de orçamento e confirmação usam /{tenantSlug}, /{tenantSlug}/orcamento e /{tenantSlug}/orcamento/sucesso.
- O resolver central valida slug, publicação e status do ateliê. Devolve somente nome, tagline, cor de marca e flags públicas necessárias.
- O intake e os caminhos de upload são criados no backend dentro do tenant resolvido. atelierId enviado pelo browser não escolhe o destino.
- /orcamento e /orcamento/sucesso antigos mostram orientação de compatibilidade; não selecionam um ateliê global.
- O seed local oferece os tenants fictícios aurora-cosplay e luna-cosplay. A migração de slug existente está documentada em [docs/versions/v0.1.0/README.md](docs/versions/v0.1.0/README.md#migração-de-slug).

## Aplicação e testes locais

Requisitos: Node.js 22+, npm e Java 11+ para Firebase Emulator Suite. Instale dependências com npm install. Copie .env.example para .env.local e preencha a configuração Firebase Web. O fluxo público não requer ID de ateliê global.

Para integração local, abra terminais separados:

1. npm run firebase:emulators:local
2. npm run seed:emulator
3. npm run dev:local

Abra http://localhost:3000/aurora-cosplay e http://localhost:3000/luna-cosplay. O seed usa somente contas e registros fictícios no projeto local demo-cosmaker.

As suítes, scripts de documentação e limites desta versão estão em [docs/versions/v0.1.0/README.md](docs/versions/v0.1.0/README.md). O estado técnico vigente fica em [docs/CURRENT.md](docs/CURRENT.md). Material anterior permanece preservado em docs/initial/ e docs/screenshots/.

## Produto além do core

Autenticação, propostas, aprovação, criação de pedido, snapshots de medidas, produção, fotos, aprovação do cliente e painel de plataforma já fazem parte da base existente. CRM completo, integrações de cobrança, automação comercial e módulos ainda estruturais continuam fora do escopo entregue neste marco.

O GLOBAL STANDARD v01 de planos/entitlements/gating comercial não foi implementado; é a próxima etapa após este core passar pelo readiness gate.
