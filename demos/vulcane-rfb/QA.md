# Aceite e QA — Vulcane / RFB Method

## Ciclo A (antes do deploy)

- [x] Direção de arte e público específicos com dados fictícios identificados
- [x] Home com slogan exato, duas portas de exploração e headline contextual
- [x] Duas tabelas ✅/❌: matriz de benefícios 5 linhas; matriz de escopo 6 linhas com sob orçamento
- [x] Preço literal e ressalvas de contratação
- [x] Catálogo e gestão conectados via localStorage
- [x] Gestão com criar/editar/pausar/excluir, validação e estado vazio
- [x] Briefing com personagem, detalhes e prazo; código/status demonstrativos
- [x] Código do Worker e HTML versionados na branch isolada
- [ ] Browser Rendering Cloudflare: serviço de QA bloqueado por limite da conta (HTTP 429); usar evidência alternativa após deploy

## Ciclo B (depois do deploy)

A registrar depois de conferir a URL: HTTP home/cliente/gestão; funcionamento DOM via `?rfbqa=1`; duas portas, CRUD, briefing e status; imagens carregadas; mobile/desktop; sem overflow. Se QA não conseguir executar um item, registrar NÃO TESTADO em vez de inferir aprovação.

**Limites irredutíveis:** a demo não sincroniza entre dispositivos, não envia pedido ao lead, não exige login real e não garante que fotografias representem peças reais.


## Ciclo B — evidência da URL atualizada (23/11/2026)

**Publicação:** Cloudflare Workers isolado `77-vulcane-cosmaker-v7-preview`. URL real verificada: `https://77-vulcane-cosmaker-v7-preview.on7.workers.dev/`.

- [x] As três rotas `/`, `/cliente` e `/gestao` responderam publicamente, com conteúdo específico
- [x] Conteúdo home em renderização DOM: duas tabelas (5 e 6 linhas), slogan e preço literal
- [x] Navegação dos dois CTAs, entrada na gestão e formulário exibido
- [x] Criar peça e publicar, vendo seu nome na área cliente
- [x] Criar briefing: referência VX-... gerada
- [x] Etapa alterada na gestão para "Em análise" e consultada no cliente pelo código
- [x] Excluir a peça de teste e confirmar remoção do catálogo
- [x] Sem overflow horizontal na largura reportada pelo navegador de testes (1293 px)
- [x] Worker ativo, workers.dev habilitado, versão implantada `e145c36e-6dd0-4c90-a4a9-6a0538ff0529`

`RFB_QA_JSON` observado: `{"home":true,"slogan":true,"ctas":true,"tables":true,"rows":[5,6],"price":true,"manage":true,"create":true,"public":true,"request":true,"inbox":true,"tracking":true,"delete":true,"overflow":false,"width":1293}`.

### Limitações da cobertura

- **NÃO TESTADO nesta iteração:** screenshots e inspeção visual móvel em 320/360/390/430/768/1024/1440 px; Cloudflare Browser Rendering respondeu HTTP 429 por cota. O CSS responsivo foi revisado estaticamente, mas isso não substitui prova visual. A versão anterior havia passado em viewport 390px, antes das últimas mudanças.
- **NÃO TESTADO nesta iteração:** métricas de performance e carregamento de todas as imagens externas sob rede móvel. A versão anterior teve imagens principais carregadas em QA.
- **NÃO IMPLEMENTADO:** backend, contas reais, autorização do lead, sincronização entre aparelhos, solicitações enviadas.

**Classificação:** APRESENTÁVEL COM LIMITAÇÕES EXPLÍCITAS. A prova funcional P0 passou; não alegar QA visual completo em todos os tamanhos.
