# Bibliotecas e ferramentas avaliadas —25/10/2026

| Projeto | Evidência de manutenção/licença | Decisão / limites |
| --- | --- | --- |
| [panva/jose](https://github.com/panva/jose) | MIT; GitHub pushed_at21/10/2026; npm6.2.13 | Única dependência runtime direta da prova; WebCrypto/RS256. Testes sintéticos de assinatura/claims/expiração. Não é autoridade para saldo/RBAC. JWKS/rotação remotos não testados. |
| [ljoukov/firebase-admin-cloudflare](https://github.com/ljoukov/firebase-admin-cloudflare) | MIT, não arquivado; pushed_at05/02/2026; package.json usa @ljoukov/firebase-admin-cloudflare0.0.2, WebChannel wrapper1.x eZod4 | Nome SEM escopo firebase-admin-cloudflare está unpublished desde13/02/2025; o pacote COM escopo existe. Avaliação de metadados/manifesto/README, não auditoria integral do código. Não adotado. Prova usa REST oficial e política financeira canônica, sem portar cegamente Admin SDK. |
| [OpenNext Cloudflare](https://github.com/opennextjs/opennextjs-cloudflare) | MIT, não arquivado; pushed_at21/10/2026;1.20.13 permite Next>=15.5.28<16 | Instalado isoladamente,15.5.28 preservado. Só build/preview local, nenhum migrate/provision/deploy. Cache dummy/semR2, nodejs_compat. Não prova CPUFree/produção. |
| Wrangler4.152.0 / Miniflare5.20261019.2-beta | Ferramentas oficiais Workers SDK; versão Miniflare exata é a mesma dependência do CLI atual | Runtime local workerd, conversor oficial V4, sem patch de comportamento. Beta acrescenta risco de compatibilidade; CI Linux/Windows é obrigatório. |

Dependências isoladas em infrastructure/spark e infrastructure/hosting; lockfiles com integridade em Git, sem alteração de versões do produto/planos. Instalação inicial realizada com --ignore-scripts; binários opcionais oficiais workerd/esbuild estavam disponíveis e builds reais foram executados. Não copiar fontes comunitárias para código financeiro.

Auditoria inicial dos novos subprojetos encontrou undici7.29.1 vulnerável (parser/SRI/encoding DoS), adm-zip antigo, glob10.4.5 e postcss transitivo. Patches explícitos: undici7.30.1 (mesma major), postcss8.5.31, glob10.5.0 (mesma major), adm-zip0.6.1 (release upstream de correções; API de ferramenta exige regressão de build). Overrides limitados aos subprojetos, sem npm audit fix --force, downgrade de framework ou alteração do Node22.

Após instalação: **npm audit0 alertas em ambos**, incluindo dependências de desenvolvimento. Build OpenNext completo posterior aos patches e testes locais documentados no handoff/evidências; CI Windows corrigiu URL.pathname em vez de fileURLToPath. Zero alertas conhecidos no registry não é auditoria de segurança completa nem garante supply chain. Alertas moderados da candidata anterior não foram ocultados por este resultado separado.

Reproduzir somente leitura:

```bash
bash scripts/cloud-run.sh npm audit --prefix infrastructure/spark
bash scripts/cloud-run.sh npm audit --prefix infrastructure/hosting
```
