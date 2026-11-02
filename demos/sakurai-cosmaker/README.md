# Sakurai — portfólio, acompanhamento e ateliê (DEMO)

Demonstração *não oficial*, em HTML/CSS/JavaScript puro, isolada do sistema Cosmaker OS. Inspirada exclusivamente no perfil público compartilhado pelo usuário; sem reprodução de fotos da artista. **Nada aqui é uma encomenda real.**

## Abrir

Abra `index.html` no navegador (funciona também em `file://`) ou rode:

```bash
python3 -m http.server 8000
```

Em `http://localhost:8000/`:
- `index.html`: portfólio conceitual e contato oficial.
- `acompanhamento.html`: consulta do cliente com código `DEMO-042`.
- `atelie.html`: sandbox administrativo que permite editar estágios, notas, criar exemplos e resetar.

Para demonstrar o vínculo das visões, abra `atelie.html`, clique no projeto `DEMO-042`, altere para "Detalhes e acabamentos", escreva uma atualização e salve. Em seguida abra `acompanhamento.html?codigo=DEMO-042` no **mesmo navegador**; a etapa e o recado terão mudado.

## Limites e segurança

- **Sem backend, autenticação real ou dados verdadeiros**; o painel é intencionalmente aberto como demonstração local e não pode ser usado para gestão real.
- Alterações gravadas somente no `localStorage` do navegador; não sincronizam com outros dispositivos e podem ser apagadas pelo usuário.
- Sem formulário real para receber encomendas (agenda do perfil está fechada).
- Links externos vão para as páginas públicas informadas no Instagram; nenhum disparo automático de mensagem ou compra.
- Artes SVG desenhadas para esta demonstração. Não são obras atribuíveis a Sakurai.
- Nenhuma alteração no repositório oficial de produto ou tenants.

## Publicação estática

Publique esta pasta como diretório raiz em Cloudflare Pages / GitHub Pages / qualquer servidor de arquivos estáticos. Não requer build e não gera custo necessariamente. **O fato de haver uma publicação não significa que a artista autorizou o site ou adotou a solução.**

## Qualidade

- Fluxos e documentação: `DESIGN.md`.
- Testes automatizados de interação com Playwright: `tests/smoke.py` (requer `playwright` e Chromium).
