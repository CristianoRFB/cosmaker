# NandaRin — Demonstração de portfólio e encomendas

## Status
**Prévia conceitual não oficial e isolada.** Lead @nandarin.atelie, não cliente contratado. Esta implementação não acessa a aplicação principal nem armazena informações reais do ateliê.

## Como experimentar
Abra index.html em um navegador moderno (ou preview estático autorizado). 
1. Portfólio: explore os 6 trajes fictícios, filtre e clique em “Pedir algo parecido”.
2. Meu pedido: preencha somente dados fictícios, gere um código e acompanhe. Também há o exemplo DEMO-2401.
3. Gestão demo: selecione o pedido, altere a etapa, salve uma nota, retorne a “Meu pedido” e consulte o mesmo código.

## Estado dos dados e privacidade
Os pedidos são simulados e ficam apenas em localStorage do navegador (77-demo:nandarin-atelie:v1). Sem servidor, login, checkout, e-mail, WhatsApp, APIs ou integração com o ateliê; não funciona entre dispositivos. Reset limpa os pedidos locais fictícios. Não usar medidas, nomes completos ou dados reais na demo.

## Engenharia e incorporação
Feito em arquivo HTML standalone para preview comercial sem tocar produção. Produto canônico permanece no Next.js Cosmaker OS. Para incorporar após contratação: configurar marca e portfólio em tenant, referenciar atelierId no backend, permissões owner/customer, uploads protegidos, solicitação formal, auditoria de status e revisão de segurança.

## Validações
Revisar manualmente e via browser antes de declarar a URL pronta: viewport 320, 360, 390, 430, 768, 1024, 1440; foco/teclado; estado inválido/ausente; não há envio de encomenda. Link público de preview é pendência até deploy verificado. Documentação visual em DESIGN.md.
