# Design e escopo — Sath Cosmaker (proposta conceitual)

- **Origem:** captura pública @sath_cosmaker enviada pelo usuário em 03/11/2026, com formulário de orçamento Google Forms, acessórios cosplay e envios Brasil.
- **Nome demonstrativo:** Ateliê de ideias. Nenhum logo ou identidade oficial do prospect utilizado.
- **Direção:** editorial, artesanal e delicada; papel #f8f4ef, ameixa #292432, rosa #ec8c91, lavanda #c7b9f0; tipografia Playfair Display + DM Sans; arte vetorial geométrica original e genérica.
- **Vistas:** `?view=cliente` (vitrine), `?view=orcamento` (intake 3 passos), `?view=operacao` (produção e etapa), `?view=gestao` (fila, proposta, agenda).
- **UX:** CTA primário no primeiro bloco, categorias exploráveis, ajuda contextual, validações, feedback, botão reverter etapa, responsividade e redução de movimento.
- **Persistência:** somente localStorage no dispositivo; seed de três pedidos **inteiramente fictícios**. Não há backend, upload, login, envio, cobrança nem integração real com formulário.
- **Risco:** sem autenticação verdadeira, não pode ser reutilizado em produção. Integrar depois ao Cosmaker OS multi-tenant em branch controlada com regras, papéis, dados do tenant e consentimento.
- **Teste:** navegar pelas quatro rotas, enviar pedido demo, alterar etapa, registrar valor ilustrativo e verificar reflexo; testar 320/360/390/430/768/1024/1440 e teclado em browser se disponível.
