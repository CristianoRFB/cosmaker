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
