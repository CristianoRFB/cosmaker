# DESIGN — Darth Dog Props (prévia não oficial)

Data: 2026-11-03. Estado: DEMO_INTERATIVA_EFEMERA (localStorage; persistência limitada ao navegador, sem backend).

## Evidência e proposta
Perfil @darthdogprops mostra uma loja de Brasília/DF com foco recente em máscaras e cosplays. Imagens, logo, preços e produtos oficiais **não** foram utilizados. Os seis modelos presentes são fictícios, ilustrados por SVG próprio, sem vínculo com personagens licenciados.

## Direção
Personalidade: artesanal, imersiva, objetiva. Público: pessoas que buscam máscaras/acessórios cosplay; equipe de atendimento; gestor. Tarefa: descobrir modelo, criar pedido de orçamento ilustrativo, avançar a produção e administrar o catálogo. Referência editorial dark workshop, não é reprodução de identidade da loja.

Cores: canvas #11100f; surface #1b1917; border #3b3731; ink #f4eee3; muted #b9b0a2; primary #f5c398; accent #de9a61; success #a7c6a2. Fontes: Inter/sans fallback Segoe UI e Georgia em detalhes. Espaçamento base 4/8/12/16/24/32/48/64. Grid: 3→2→1 cards; foco 320–430 px. Sem fonte/imagem/licença externa.

## Ambientes
- cliente: catálogo, busca/categorias, formulário de orçamento, código para acompanhamento;
- operação: fila de pedidos sintéticos, avanço de etapas;
- admin: visibilidade de itens, números reais **apenas da sessão de demonstração**, restauração dos dados.

Sem CPF, telefone, email, pagamento, integração de WhatsApp, backoffice real, estoque ou comunicação efetiva. Admin é **simulação pública**, sem permissão real. Os dados são salvos em localStorage somente na máquina de quem usa. IDs de solicitação e produtos de exemplo são sintéticos. Esquemas de multi-tenant/roles e sincronização com backend pertencem ao Cosmaker OS e exigem integração separada.

## Aceite
Abrir as 3 rotas Cloudflare; testar fluxo de pedido cliente→atendimento→status→cliente no mesmo navegador; alternar produto visível no admin; teclado e viewport mobile; reduced motion; sem logos ou imagem proprietária; identificar demo em todas as telas.
