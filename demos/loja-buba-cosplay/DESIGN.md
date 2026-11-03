# DESIGN — Loja Buba Cosplay (conceito independente)

## Contexto
Perfil @lojabubacosplay no print de 03/11/2026: cosplay sob medida desde 2018, agenda fechada e bazar nos destaques. Nenhum preço, estoque ou pedido foi validado. Essa é uma prévia não oficial; não usa logotipo nem imagens da loja.

## Objetivo e públicos
**Cliente**: explorar categorias, filtrar, selecionar itens em uma consulta simulada. **Atendimento**: seguir solicitação fictícia por etapas. **Gestão**: controlar visibilidade de itens fictícios e visualizar fila. Não há cadastro, envio real, checkout ou integração com WhatsApp.

## Direção visual
Três palavras: **editorial, artesanal, acolhedora**. Canvas #f7f6f2, surface #ffffff, ink #17272c, primary #15262b, accent #f1cadf, sky #b5d7e1, muted #5e6a6e, hairline #dce3e2. Fontes Playfair Display + DM Sans via Google Fonts (fallback Georgia/system). Grid max 1220, cartões 3/2 colunas e 1 em áreas administrativas no mobile. Botões 47px de altura. Foco visível, motion reduzido e descrições acessíveis.

## Imagens
SVGs decorativos originais incluídos no código, peças **inventadas**. Nenhuma foto do Instagram e nenhum logotipo, mascote ou personagem protegido foi copiado.

## UX e estado demo
Links `?view=cliente`, `?view=atendimento`, `?view=gestao`. Catálogo, busca, filtros, seleção, modal, avanço de etapas e alternância de disponibilidade funcionam no browser via localStorage; não sincroniza entre dispositivos. Agenda de encomendas representada como FECHADA. Não aceitar pedidos novos, contato, transações ou cadastro reais.

## Limitações
Não são dados ou estoques reais; sem backend, autenticação, CRM de produção ou upload. Antes de implantar, aprovar marca, catálogo, preços, papéis, política LGPD e integrações com o negócio.

## Gates
Rotas devem responder HTTP 200; testar seletor de categorias, item de interesse, controle de estoque, avanço da fila, reset, viewport 320–1440, teclado e contraste. Ausência de efeitos reais no negócio é intencional.
