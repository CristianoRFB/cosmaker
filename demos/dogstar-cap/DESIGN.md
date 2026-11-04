# DOGSTAR.CAP — DIREÇÃO DE ARTE V2
Data: 2026-11-02 | status: demonstração conceitual não oficial.

## Pesquisa e proveniência
Fonte principal: print do Instagram @dogstar.cap fornecido pelo usuário, com avatar amarelo/preto, lema "O Estilo que não late, Morde!", categorias Skins Épicas, Skins Lendárias, Monster Cap e destaque Encomenda.
A paleta, os modelos e a solução de gestão são **propostas**, não identidade ou sistemas oficiais. Sem vínculo ou autorização do estabelecimento. Sem fotos extraídas do Instagram.

## Alterações V1 → V2
V1: hero com desenho genérico, três cards repetidos, painel de métricas e kanban com visual de template.
V2: sistema editorial de streetwear com hero manifesto assimétrico, tipografia condensada grande, produto ilustrado em destaque com costuras/patch originais, seriais e grid 1+2 irregular. Sem cards do mesmo tamanho ou raio padrão. Estúdio de customização com estilos/cor/briefing, operação com filas legíveis, gestão com contagens apenas de exemplos locais e controles com efeito no cliente.

## Personalidade e trabalho do usuário
Três atributos: **expressivo, artesanal, urbano**.
Público: fãs de cultura pop e customização de bonés.
Objetivo principal: criar um briefing ilustrativo em menos de 90 segundos.
Cliente: vitrine e estúdio sem login. Operação: avançar etapa com ação por cartão. Gestor: compreender fila e controlar o que aparece na demo.

## Design system
| Papel | Cor |
|---|---|
| Canvas | #eae9e1 |
| Paper | #f6f5ef |
| Ink | #171815 |
| Deep | #141513 |
| Primary | #fbd332 |
| Editorial accent | #d84732 |
| Muted | #54574f |
| Hairline | #c8c7be |

Fontes: Barlow Condensed display 900, DM Sans regular 400/700/800 por Google Fonts, fallback Arial Narrow/Impact e system-ui. Raios ~2px, bordas finas, sombras curtas e duras; evitar "SaaS genérico". Escala base 4/8/12/16/24/32/48/64px. Grid max-width 1320px, hero de duas colunas em desktop e uma no mobile, card "feature" + dois "support" e thumb de toque >=44px.

## Microinterações / estados
- CTA primário: abrir o estúdio; troca de inspiração, com estado pressed e prévia sincronizada; troca de cor no SVG; preencher briefing opcional e gerar ficha DEMO.
- Kanban operacional avança estágio de uma ficha local. Gestão alterna catálogo/customização/rastreamento em estado local.
- Hover de 160ms, foco visível, preferência reduced-motion desativa animações.
- Sem botão fictício de checkout, pagamento, WhatsApp, foto de produto ou preço inventado.
- Mobile 320/360/390/430; tablet 768; desktop 1024/1440.

## Referências reais estudadas
- New Era by You — https://www.clevermethod.com/work/new-era-by-you/ (personalização visual em mobile/desktop).
- Pukka Hat Customizer — https://www.pukkainc.com/hatcustomizer/ (controle direto sobre objeto e prévia).
- SIDEWALK streetwear — https://www.behance.net/gallery/224896495/SIDEWALK-Website-Design-Brand-assets (tipografia e composição editorial).
- Ink — https://www.ink.app.br/ (mostrar percurso e benefício, não slogans vagos).
Referências de método, nunca autorização para copiar conteúdo.

## Limites de demo e white-label
Arte SVG original e pedidos seed fictícios. Nenhum backend, pagamentos, contas reais, integração com Dogstar ou envio de dados. Alterações em localStorage do navegador atual. Painel de gestão é **simulação pública**, nunca admin com autenticação de verdade.
Codificado em demos/dogstar-cap/index.html isolado na branch demo/dogstar-cap-conceito. Deploy separado no Cloudflare Worker 77-dogstar-cap-conceito, subdomínio on7.
Antes de produto: validar preços, fotos e autorização; integrar vertical custom-made multi-tenant com autenticação, regras, armazenamento e testes A×B.

## Testes pendentes
Screenshot real nos viewports indicados, revisão de contraste AA para texto miúdo, checagem de overflow/teclado/touch, e CI para o SHA final. Browser Rendering Cloudflare falhou com HTTP 429 e não deve ser reportado como captura aprovada.

## Adaptação a esboço fornecido — 04/11/2026

A foto de um desenho manual, fornecida na conversa, detalha três propostas de skins para bonés com lema "Estilo não late. Morde":

- **Épica** — vermelho, bordas diagonais e emblema triangular;
- **Lendária** — roxo, losangos encadeados e emblema em forma de diamante;
- **Ultimate** — rosa, manchas orgânicas e pequeno emblema.

A demo V3 converteu essa composição em ilustrações SVG vetoriais e ornamentos originais. Não foram usadas fotos oficiais do cliente nem a imagem bruta no repositório. A categoria de exibição "Monster Cap" passou a "Ultimate" como **proposta derivada do esboço**, pendente da confirmação do catálogo definitivo. Internamente o id legacy `monster` foi preservado para não descartar pedidos fictícios persistidos em localStorage; deve ser migrado com cuidado se o produto real for implementado.

### Testes da V3
- Três ilustrações de fundo distintas renderizadas na vitrine (mock DOM).
- Produção e gestão mantidas.
- Briefing Ultimate selecionável e pedido fictício gravado no navegador.
- JavaScript validado sintaticamente no runtime V8.
- Deploy Cloudflare Worker confirmado; **ainda sem screenshot e revisão visual real multi-viewport**.

A existência do esboço não implica autorização para vender produtos, usar preços reais, anunciar parceria ou substituir a aprovação da Dogstar.
