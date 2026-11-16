# DESIGN — Aleff Silva / Oficina de Ideias

Data: 2026-11-02. Status: proposta conceitual não oficial. Sem contratação, autorização de marca ou uso das imagens do perfil.

## Fontes e premissas

Print de Instagram @aleff_silva_cosmaker fornecido pelo usuário: profissional de cosmaker, especialista em armaduras e props em EVA, mais de dez anos no mercado, encomendas e mentorias. Não extrapolar para portfólio real, região, preço ou agendamento confirmado.

## Objetivo

Fluxo vitrine ilustrativa → pedido de teste → consulta com código → avanço de produção → ajustes de visibilidade no painel.

## Direção de arte

Industrial, artesanal e editorial. Fundo #11181a, aço #263032, cobre #e6aa76, pergaminho #f9f2e7, acento #edcfac. Fontes system-ui e Georgia local. Espaçamentos 8-64 px e cantos discretos. Ilustrações SVG originais abstratas, não imagens do Instagram ou produtos reais.

## Visões

Vitrine de 3 categorias conceituais; acompanhamento por código AS-DEMO; quadro de produção com estágios; gestão das categorias. Todas as mudanças são feitas só no navegador atual via localStorage.

## Limitações

Sem API, backend, autenticação, preço, pagamento, emissão de pedido verdadeiro ou sincronização entre dispositivos. Nenhum envio ao ateliê. Admin aberto apenas porque contém dados fictícios. Copiar para produção não é seguro.

## Readiness

GLOBAL: reutilizar os contratos de tenant e roles do Cosmaker OS. VERTICAL: mapa orçamentos→pedidos→etapas. LOCAL: catálogo e identidade validados por Aleff. A integração real requer autorização, hospedagem/conta, fotos, fluxos e política de privacidade.

## QA

Testar URL, formulário, código, status, visibilidade, reset, 320–1440px, teclado, reduced-motion, CSP e noindex. CI da branch é referencial; HTML independente requer validação adicional.

## Design brief — Revisão após feedback do prospect

**Problema observado:** pessoas confundem trabalhos já publicados com a lista completa de personagens possíveis; repetem perguntas sobre orçamentos e personagens, mesmo existindo uma página. **Fonte:** transcrição enviada pelo usuário do áudio do Aleff Silva no Instagram (02/11/2026). **Limite:** sem contrato, sem comprovação de prazo/preços/capacidade ilimitada, e o lead sinalizou que investimento não é prioridade.

**Promessa de interface:** "O portfólio mostra técnicas, não um catálogo fechado de personagens". A possibilidade real de fabricação é sempre avaliada. **Ação principal:** "Enviar uma ideia de personagem"; nunca "comprar" ou "enviar orçamento" como se houvesse backend.

**Personas:** interessado que nunca viu seu personagem no portfólio; Aleff que responde muitas dúvidas; cliente com encomenda hipotética. **Arquitetura:** hero / possibilidade / galeria ilustrativa / etapas / FAQ / solicitação por personagem e foto de prévia / acompanhamento / quadro de oficina / gestão de categorias e resposta pronta.

**Layout:** 360–430px prioritário e desktop em duas colunas, hierarquia tipográfica expressiva, cobre+grafite já definidos, detalhes em HTML nativo sem JS complexo no FAQ. Alvos de toque >=44px, foco visível, labels persistentes, erros legíveis, modos sem motion. **Foto:** input local JPG/PNG/WEBP até 5 MB, prévia com URL blob; URL revogada na remoção, conclusão e pagehide; não armazenar nem enviar, inclusive via código do pedido.

**Condições de aceite:** personagem não presente no catálogo, upload opcional, aviso do caráter local, código e stage sincrônicos no mesmo navegador, FAQ nativo expansível, resposta de Direct copiável; não há envio real. Não apresentar o upload como funcionalidade de produção.
