# CJ Cosmaker — Demonstração isolada de pré-vendas

**Status:** DEMO conceitual independente, não oficial. Lead identificado por print de Instagram do usuário, sem contato/contrato confirmados. O modo de demonstração não representa o sistema oficial da CJ Cosmaker.

Abrir index.html em um servidor estático (comando: python -m http.server 8765 nesta pasta). Navegar usando #atelier, #encomenda, #acompanhar e #gestao. Exemplo de pedido: CJ-2401.

### Funcional
Vitrine com seis conceitos ilustrativos autorais; filtros, detalhes e CTA; simulação de solicitação de orçamento; código de pedido; consulta de estágio; painel com lista, atualização de etapa, inclusão de nota e reset. Persistência SOMENTE no armazenamento local do mesmo navegador. As visões não sincronizam entre navegadores e não criam pedidos reais.

### Fora do escopo
Envio de orçamento, acesso por terceiros, login real, contato WhatsApp automático, upload de referências, backend, integrações, dados financeiros, precificação, comunicação com ateliê, CRM e implantação para cliente. O formulário pede apenas informações fictícias e não contém nome/telefone/e-mail.

### Integração futura
Base canônica: Cosmaker OS Next.js/Firebase. Para integrar após contrato: adaptar conteúdo para branding e catálogo do tenant via slug, intake server-side existente, autenticação de gestor, regras Firestore/Storage, evidências de progress tracking e consentimento do ateliê. Não copiar fixtures nem desabilitar autorização do core.

### Origem
Perfil conforme captura entregue pelo usuário: https://www.instagram.com/cj_cosmaker/ (novembro 2026); sem imagem ou logo do perfil incorporados, nem testemunhos/valores inventados. Ver DESIGN.md.
