# EVOLVE 01 — Execução de browser na CI
A CI do projeto já instala Chromium e Playwright na job `usability`. A partir da branch `develop/sakurai-portfolio-v14-rfb` executa `demos/sakurai-portfolio-v2/tests/qa-evolve01.mjs` **somente** nesta branch, reaproveitando o browser instalado, sem adicionar novo serviço pago.

Cenários: home 320/390/768/1440/1920; menu mobile, recursos, filtros, galeria, paleta com HEX inválido e reset, tema, Franco/Caitlyn, 5 hotspots e 14 peças; VSC comparação V13/V14; tentativa controlada de falha de imagem com fallback; repetição em contexto isolado. Browser Run Cloudflare foi limitado no pós-deploy; este CI é executor alternativo legítimo. Prints e JSON ficam no artifact `usability-browser-evidence`.
Resultados: **PENDING_CI** até GitHub Actions registrar conclusão. Não presumir PASS.
