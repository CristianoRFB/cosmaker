# EVOLVE 01 — Baseline e regressão de fallback
- [x] CI do baseline PR #37 commit `f5e9a48b885e`: workflow CI completed / success, via GitHub Actions.
- [x] Defeito RFB-E01-IMG-001 confirmado por inventário Git: fallback em `app.js` e `project.js` consulta commit antigo `82dc149f4695099f62a0ec44673eafa9428c5d7e`; nele **não existem** `franco-personagem.webp` e `caitlyn-personagem.webp`, embora sejam referenciados nas páginas do portfólio. Falha condicional: caso o servidor principal dessas imagens falhe, o fallback antigo também falha.
- [x] Correção: apontar ambos para versão congelada V13 `b81653482c26fb0ea81817940cbc7c06db9ff1f6`, cujo Git tree contém os dois assets.
- [ ] Teste adversarial com falha de imagem simulada no browser e fallback verificado: pendente, não inferir PASS apenas de SHA.
- [ ] Triple Verification, regressão PC/mobile, VSC em dois ciclos e aceite: pendentes até execução em navegador.
- [ ] Worker V14 deve ser atualizado para novo HEAD desta correção e smoke público executado; **não** alterar V13.
- Rollback: commit de entrada `f5e9a48b885ed9ce350f8c812d6e92b53a3e9649`.