# DEMO — Luna Cosmaker (conceitual, não oficial)

## Evidência do lead
Fonte: print público de @luna_cosmaker enviado pelo usuário (novembro/2026). Bio visível: figurinista, cosmaker, produção visual; grid com figurinos; destaques vendas, feedbacks, processos e produções. Nenhum vínculo, contratação, dor validada, preço, disponibilidade ou política operacional confirmados. O tenant fictício `luna-cosplay` do Cosmaker OS não representa essa profissional.

**Qualificação:** prioridade média. Oferta plausível: triagem estruturada de orçamento e acompanhamento, porque o trabalho é individualizado. Viabilidade técnica alta com infraestrutura de baixo custo; disposição de compra desconhecida. Não oferecer performance, economia ou aumento de faturamento como fatos.

## Direção de arte
- Personalidade: artesanal, editorial, acolhedora.
- Usuários: visitantes interessados em figurinos, clientes em acompanhamento, profissional/ateliê.
- Tarefa principal: simular pedido de orçamento e ver a informação na gestão.
- Cores: papel #fbf7f5, tinta #2e2630, vinho #9b375d, rosa #f2dce5, dourado #af7954, neutro #70616b.
- Tipografia: Georgia (títulos) e sans-serif do sistema (interface), sem fontes redistribuídas.
- Layout: 2 colunas para hero e conteúdo amplo; 1 coluna mobile; administração com duas colunas desktop e coluna única mobile; navegação horizontal acessível em telefones.
- Imagens: ilustrações SVG de figurinos criadas como parte do código desta demo; NÃO são trabalhos de Luna Cosmaker. Sem logos, fotos ou portfólio original copiados.
- Interações: orçamento local, timeline de etapas, fila/filtro e avanço/retrocesso de status no painel de gestão; respostas visíveis.
- Estados: botão desabilitado na primeira/última etapa, lista vazia ao filtrar, confirmação de registro, preenchimento obrigatório e foco de teclado.
- Acessibilidade: labels, indicadores além de cor, foco destacado, alvos de 48px e respeito a reduced-motion; verificar visualmente em dispositivos reais antes de alegar homologação.

## Rotas e isolamento
- / — portfólio editorial + explicação do processo;
- /orcamento — briefing guiado, com campos de teste fictícios e sem coleta real;
- /cliente — timeline ligada aos registros fictícios locais;
- /atelie — dashboard de demonstração, sem autenticação por não haver backend nem dados reais.

Worker: `77-luna-cosmaker-3visoes-demo`; URL `https://77-luna-cosmaker-3visoes-demo.on7.workers.dev/`.
Nível: **DEMO_INTERATIVA_EFEMERA / persistência local no navegador**; não há sincronização entre pessoas/dispositivos. Não conecta a Firebase, SMS, WhatsApp, email ou pagamentos; dados não saem do navegador.

## Evidências de QA em 2026-11-04
- Upload Worker e ativação do subdomínio: API Cloudflare confirmou sucesso.
- Quatro URLs retornaram conteúdo no serviço de leitura HTTP externo.
- Sintaxe Worker e JS de interface: compilação estática aprovada.
- Testes simulados isolados do DOM: 8 de 8 (home, orçamento, registro local, acompanhamento, admin, atualização de etapa e ausência de backend).
- Limite: automação E2E com navegador real foi bloqueada por saldo insuficiente da ferramenta de testes; breakpoints exatos 320–1440 e screenshot não foram homologados nesta execução.
- Status de entrega: **APRESENTÁVEL COM LIMITAÇÕES EXPLÍCITAS**, não é produto homologado.

## Contato recomendado após resposta à saudação
'E achei muito caprichados os figurinos e os detalhes das suas produções! Fiz uma demonstração de como um site poderia organizar o portfólio, receber pedidos de orçamento e mostrar as etapas de criação. Se fizer sentido pro seu ateliê, posso te mostrar esse exemplo, sem compromisso: https://77-luna-cosmaker-3visoes-demo.on7.workers.dev/'

Nunca enviar sem autorização do usuário.