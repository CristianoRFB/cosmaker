# Sah Wayne — demonstração conceitual (não oficial)

Lead: [@sahwayne](https://www.instagram.com/sahwayne/) • segmento: cosmaker + cosplayer + criadora/embaixadora.
Direção: vitrine editorial, captação organizada de orçamentos e parcerias, acompanhamento de produção e gestão. Sem usar logotipos, fotos ou trabalhos oficiais.

- Vitrine: `?view=cliente`
- Ateliê/produção: `?view=operacao`
- Gestão DEMO: `?view=admin`
- Saúde do Worker: `/healthz`

## Executar
`index.html` roda diretamente no navegador sem backend. Os dados de teste são persistidos em `localStorage` somente neste dispositivo e não representam dados reais.
`worker.js` contém o mesmo HTML incorporado em um Cloudflare Worker de demonstração, preparado para upload de módulo. O deploy é independente de Firebase, não acessa o tenant real e não altera rotas de produção.

## Integração futura
A demo é um conceito comercial isolado. Para eventual produto, integrar os fluxos na base Cosmaker OS (tenant resolver, intake seguro, roles, storage e regras) somente após autorização e testes. A funcionalidade criador/embaixador poderia virar opção configurável por tenant (LOCAL/feature flag), em vez de alterar o core de todo cosmaker.
