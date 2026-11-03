# Direção visual e fluxos — Nexus 3D

## Posicionamento

Uma experiência que pareça uma pequena marca criativa de impressão 3D e não um painel corporativo genérico. **Elegância futurista, objetos em destaque, laranja elétrico sobre superfícies escuras**, editorial e com linguagem humana.

## Fundamentos

| Token | Valor |
|---|---|
| Fundo | `#0b0e11` |
| Superfície | `#14191d` |
| Destaque | `#ff862f` |
| Destaque claro | `#ffc37a` |
| Texto | `#f3f0eb` |
| Texto auxiliar | `#a5aaa9` |
| Contorno | `#2b3135` |
| Headings | Space Grotesk |
| Corpo | DM Sans |
| Largura de conteúdo | 1240px |
| Controles | raio 8–10px, alvos adequados ao toque |

## Hierarquia

1. Promessa: “Sua ideia merece ganhar forma” e CTA para orçamento
2. Vitrine de inspirações, sem preço inventado
3. Possibilidade de encomenda própria
4. Processo de compra, com consulta por código
5. FAQ e CTA final
6. Gestão demonstrativa independente via `#gestao`

## Fluxo do cliente

Vitrine → Categoria → Selecionar item ou ideia nova → Informar parâmetros → Confirmar cenário local → Receber código → Consultar andamento.

## Fluxo da gestão

`#gestao` → indicadores → filtrar pedidos → avançar status → inspecionar pedido → ligar/desligar catálogo → restaurar cenário.

## Estados

- Sem produtos visíveis após filtros: estado vazio e orientação.
- Código de rastreio inválido: feedback objetivo.
- Formulário incompleto: validação HTML e mensagens curtas.
- Pedido novo: confirmação com código de consulta e aviso de demonstração.
- Pedido finalizado: etapa Entregue, sem botão para avançar.
- Restauração: confirmação antes de eliminar dados locais.

## Acessibilidade

Semântica HTML, `label` em campos, foco visível, `aria-pressed` em filtros, `aria-live` em vitrine e mensagens, Escape para fechar diálogos, contenção de Tab, `prefers-reduced-motion`, contraste legível e largura fluida para 320px+. Há testes de acessibilidade manuais e automáticos pendentes antes de comercializar.

## Cuidados éticos

- Não reproduzir imagens de produtos de franquias sem autorização.
- Não inventar depoimentos, disponibilidade, prazo de entrega, preço ou aprovação da empresa.
- CTA para Instagram verdadeiro apenas como **visitar perfil**, não como canal automatizado da demo.
- Aviso “Demonstração não oficial” sempre visível.
- Dados de formulários não saem do navegador.
