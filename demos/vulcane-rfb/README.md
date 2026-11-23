# Vulcane Cosmaker — demo independente, RFB Method

**Lead:** @vulcanecosmaker_ (print enviado em 22/11/2026). **Status:** PROSPECT / não oficial / sem parceria ou autorização de uso de marca. **Não é tenant real.**

## Evidência do lead

- **REAL_CONFIRMADO pelo print:** perfil Vulcane, loja de artesanato, cosplay/cosmaker/prop-maker; publicação sobre agenda de encomendas aberta; entrega em todo o Brasil; divulgação via Instagram e msha.ke/vulcane. O feed exibe máscaras, espadas e props cenográficos.
- **REAL_NAO_CONFIRMADO:** cidade, volume de pedidos, valores, tempos de produção, capacidade, fluxo interno, qualidade de atendimento, tecnologia já usada além dos canais visíveis.
- **HIPÓTESE:** um briefing estruturado pode ajudar a especificar personagem, prop, porte e data desejada, e uma área de gestão pode facilitar revisão de catálogo e etapas.
- **DEMO_FICTICIO:** 4 peças iniciais, descrições, fotos Unsplash ilustrativas, referências de pedidos, status e prazos de demonstração.
- **NÃO_IMPLEMENTADO:** envio de pedidos, sincronização entre usuários, autenticação, WhatsApp automático, pagamento, backend ou controle de produção real.

**Referências públicas da vertical:** experiências de portfólio, solicitação de orçamento e organização de cosmakers; inspiração funcional, sem reprodução de layout ou dados comerciais.

## Quadro de adequação

| Papel | Tarefa central | Prova na demo |
|---|---|---|
| Visitante/cosplayer | Entender o tipo de prop possível e descrever personagem / referência / prazo | Filtrar catálogo, escolher peça, criar briefing, receber código de demonstração |
| Responsável pelo ateliê | Atualizar peças apresentadas e acompanhar pedidos | Criar, editar, pausar, excluir uma peça; alterar etapa do briefing |
| Decisor (prospect) | Comprovar ganho funcional sem compromisso | Home mostra valor para ambos os lados, dois CTAs, duas tabelas, limitações reais e preço do desenvolvedor |

**One Core Promise:** uma pessoa estrutura o briefing de um prop em poucos passos, e o ateliê altera portfólio/status no painel, refletindo a alteração na experiência cliente *do mesmo navegador*.

## Design Brief

- **Personalidade:** artesanal, dramática, editorial.
- **Conceitos considerados:** (A) ficha técnica de oficina, com timeline e notas; (B) vitrine editorial de props com contraste rubro e fotografia; (C) arquivo museológico de acessórios com navegação por categorias. **Escolhido B**, com organização e elementos de A: o lead publica objetos cenográficos visuais, então uma vitrine fotográfica acompanhada de processo de briefing facilita compreensão.
- **Paleta:** canvas escuro #100e11; superfícies #19161a; primário rubro #ed5b63; texto #f1eae3; apoio #bbb0ae. Relação temática com materiais e arte de props — **identidade conceitual, não marca oficial**.
- **Tipografia:** Space Grotesk em chamadas, DM Sans em texto. Carregamento via Google Fonts, fallbacks sistêmicos.
- **Layout:** hero editorial com slogan obrigatório destacado, 2 CTAs, fotos ilustrativas; galeria de objetos, mostra viva da interface, jornada em etapas, 2 matrizes, investimento, FAQ.
- **Imagens:** fotografias ilustrativas de endpoints da Unsplash, sem afirmar que são peças do ateliê. Não reutilizar imagens do Instagram sem autorização.
- **Acessibilidade:** foco visível, landmarks, labels, feedback textual, botões com área de toque, reduced motion e tabela com rolagem lateral no celular.
- **Custo recorrente buscado:** R$ 0 para preview de baixo tráfego no Worker/Free, sujeito aos limites/termos da conta; sem banco, R2 ou serviços pagos ativados.

## Rotas e persistência

- `/` landing do desenvolvedor para o lead, não site real do estabelecimento. Frase exata, 2 botões, 2 tabelas e preço inicial com ressalvas.
- `/cliente` catálogo e simulação de briefing, consulta por código local.
- `/gestao` CRUD de peças e etapas de pedidos.
- **Persistência:** `localStorage` do dispositivo/navegador. Dados locais, fictícios, sem comunicação de pedidos. Painel sem login apenas porque é demo sem dados reais. Nunca usar como gestão de produção.

## Engenharia e publicação

- Repositório canônico da vertical: `CristianoRFB/cosmaker`. A demo é um subprojeto independente em `demos/vulcane-rfb/`, não integra a base multi-tenant e **não altera produção**.
- Branch: `demo/vulcane-rfb-20261123`. Worker Cloudflare isolado: `77-vulcane-cosmaker-v7-preview`.
- O Worker inclui o HTML completo compilado; `index.html` é a fonte editável. Para publicar alterações, atualizar ambos explicitamente ou gerar Worker a partir do HTML.
- Teste automatizado opt-in: abrir `/?rfbqa=1` em navegador isolado para executar fluxo e imprimir `RFB_QA_JSON`. Limpa storage do navegador de teste; não usar como página comercial.

## Handoff eventual

Somente após aprovação/contratação: conferir autorização do catálogo/fotos, consentimento, marca, preço real, domínio, regras de orçamento, usuário gestor, armazenamento, privacidade e segurança de acesso; depois planejar migração segura para Cosmaker OS sem tratar este prospect como tenant.
