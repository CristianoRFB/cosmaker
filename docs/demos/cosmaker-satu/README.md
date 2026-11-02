# Demonstração comercial: Cosmaker Satu

Status: DEMO_INTERATIVA_EFEMERA — independente, não oficial. Código original de exemplo.
Data da criação: 2026-11-02.

## Links públicos
- Cliente: https://77-cosmaker-satu-conceito.on7.workers.dev/?view=cliente
- Produção: https://77-cosmaker-satu-conceito.on7.workers.dev/?view=producao
- Gestão: https://77-cosmaker-satu-conceito.on7.workers.dev/?view=gestao

## Como experimentar
1. Abrir a vitrine, filtrar categorias e clicar em "Começar meu projeto".
2. Informar apenas dados fictícios e gerar solicitação de teste. **Nada é enviado**.
3. Abrir Produção na mesma guia; localizar o pedido e clicar "Avançar etapa".
4. Voltar à vitrine, pesquisar pelo código exibido; o exemplo inicial é SATU-DEMO-024.
5. Abrir Gestão; pausar figurinos e verificar que essa categoria deixa de aparecer na seleção do modal (durante a sessão); restaurar os dados pelo botão de reset.

## Arquitetura da demo
- Arquivo HTML único em `public/demos/satu/index.html`: CSS e JS nativos, ilustrações vetoriais próprias.
- Cloudflare Worker isolado `77-cosmaker-satu-conceito` (conta Nexus7), publicado somente para demonstração e entregue como string HTML. Não toca o deploy principal ou a base Firebase.
- Alterações GitHub não disparam um redeploy automático da prévia do Worker. Replicar arquivo após alterações; comparar conteúdo antes de entregar novo link.
- Este arquivo é servido no projeto Next por `/demos/satu/index.html` caso uma versão autorizada o inclua; a publicação atual usa o Worker autônomo.
- Os estados não persistem entre recargas ou navegadores. Não existe login administrativo, contato efetivo ou coleta por API.

## Proveniência
Fonte única identificadora: captura de tela pública fornecida pelo usuário do perfil Instagram @cosmaker.satu em 2026-11-02. A pesquisa textual aberta não confirmou outro site da mesma pessoa.
Todas as métricas são contagem derivada de encomendas fictícias.
Todos os serviços, textos de portfólio, ilustrações e histórias são ilustrativos, não obras atribuídas ao prospect.

## Segurança e white-label
- API/Firestore/Auth da vertical não são usados aqui.
- Não há credenciais, pagamento, conexão WhatsApp ou chamadas externas da demo (o link do Instagram só abre ao clique).
- Próximo passo na vertical: transformar fluxo visual em componentes parametrizáveis por branding + flags, mantendo o resolver tenant e a validação de permissões existentes.
- NÃO registrar a Satu como cliente, tenant real, parceria, depoimento ou portfólio sem aceite.

## QA e revisão
- Upload do arquivo no GitHub: sucesso.
- Cloudflare Workers: PUT de script e ativação do subdomínio concluídos.
- Fetch do endereço público por serviço externo: HTML e conteúdo inicial entregues corretamente em / e /?view=gestao.
- Em aberto: executar Playwright em 320/360/390/430/768/1024/1440 px, formulário completo, mudança de etapa e regras de foco/contraste. Sem essa etapa, status = APRESENTAVEL COM LIMITACOES EXPLICITAS.
- Nenhum deploy em produção do Cosmaker OS, Rules ou banco real foi feito.
