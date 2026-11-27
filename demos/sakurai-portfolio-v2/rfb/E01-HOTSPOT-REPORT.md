# EVOLVE 01 — Defeito de hotspot comprovado
- Ambiente Cloudflare Browser Run Playwright 390×844, /projetos/caitlyn V14.
- Antes: locator.click() em .ck-hotspot[data-piece="peruca"] timeout; bounding rect x≈0.64, centro sob SECTION#look-interativo, não sob botão. Os cinco botões usam estilos inline bloqueados pelo CSP 'style-src self'.
- Correção: remover os cinco atributos inline; posicionamento CSS externo permitido pelo CSP, versão ?v=14-e01.
- Critério: testar todos cinco botões no PC e mobile, coordenadas e interação. V13 preservada.
