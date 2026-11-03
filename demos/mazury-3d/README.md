# Mazury 3D — Demonstração Comercial

Experiência independente e **não oficial** criada a partir de uma captura pública do Instagram @mazuryimpressao3d (02/11/2026).

## Como abrir
Abra `index.html` em qualquer navegador moderno. Sem compilação, credenciais ou backend. São três visões na mesma aplicação:

- `index.html#cliente` — catálogo, categorias, orçamento demonstrativo e rastreamento por código;
- `index.html#operacao` — fila de pedidos e fluxo entre etapas;
- `index.html#gestao` — visibilidade de peças e solicitações.

O seletor no cabeçalho alterna as visões. Para demonstrar: escolha um item, crie um pedido fictício, copie seu código, avance o status em Produção e volte à consulta. Em Gestão, oculte uma peça e volte ao catálogo. **Restaurar exemplo** reinicia os dados sintéticos.

## Limites
Não representa um site operado nem autorizado pela Mazury. Não é cadastro de cliente, e-commerce, CRM, autenticação, orçamento real nem precificação. Não envia nada ao Instagram, WhatsApp, e-mail ou a servidores. Imagens e pedidos são ilustrativos. `localStorage` persiste somente neste navegador; não use informações reais de clientes.

## Fotos e marca
A proposta usa marca textual e **ilustrações SVG autorais**, não faz cópia de fotos ou da logo do perfil. Caso vire projeto real, substituir as ilustrações por fotos e dados fornecidos com autorização, levantar catálogo e operação e implementar segurança e política de dados.

## Integração SaaS futura
- GLOBAL: tenant slug, branding, autenticação, papéis, isolamento, armazenamento e logs;
- VERTICAL: orçamento de peça personalizada, fila de produção, catálogo e etapas;
- LOCAL: peças e acabamento, referências, temas, material e comunicação de marca.

Nenhum módulo do Cosmaker OS ou de outro cliente foi alterado.

## QA
Aplicação testada com Playwright usando `page.set_content` (fontes externas omitidas no teste por restrição de rede do ambiente). Viewports: 360, 390, 768 e 1280px. Sem overflow nem exceções de JS; formulário, consulta, avanço e catálogo visível/oculto executados. Evidências locais em `qa/` (não necessárias para uso da demo).