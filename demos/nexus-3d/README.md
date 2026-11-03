# Nexus 3D Brasil — proposta interativa de vitrine e encomendas

**Demonstração não oficial para prospecção comercial.** Não é o site da empresa, não integra o Instagram dela e não envia qualquer solicitação ao negócio.

## Links

- Vitrine: https://77-nexus3d-conceito.on7.workers.dev/
- Visão de gestão: https://77-nexus3d-conceito.on7.workers.dev/#gestao
- Código de consulta para teste: `NX-1001`

## O que foi desenvolvido

1. **Vitrine / visão do consumidor:** identidade escura, laranja e cobre inspirada nas cores do perfil, peças ilustrativas em SVG originais, filtros por Geek/Decoração/Personalizados, explicação do processo e CTA para orçamento.
2. **Intake / pedido demonstrativo:** formulário acessível para escolher tipo de peça, cor, quantidade, nome, descrição e URL de referência. Gera código NX-1004 ou superior, salvo exclusivamente no `localStorage` do dispositivo.
3. **Acompanhamento / visão do cliente:** busca por código, exibe etapas Novo → Em avaliação → Em produção → Pronto → Entregue.
4. **Gestão / visão do ateliê:** indicadores derivados, filtro por etapa, avanço de encomendas, ligar/desligar itens do catálogo, restaurar cenário.

## Origem do briefing e limites de verificação

- **Observado na captura de tela enviada em 02/11/2026:** @nexus_3dbrasil; Nexus 3D; foco em impressão 3D, geek, decoração, personalizados, encomendas; São Paulo/SP; orçamentos no Direct; visual preto/laranja; exemplos de bustos, miniaturas e decoração temática.
- **Inferência comercial, a validar:** uma vitrine própria com captação estruturada e acompanhamento de pedido pode reduzir dúvidas repetitivas e organizar demandas, sem prometer resultado.
- **100% ilustrativo:** modelos e imagens SVG autorais, nomes dos seis produtos, três clientes e pedidos iniciais, métricas, status e códigos de rastreio. Nenhum preço/estoque/prazo/volume real foi confirmado.
- **Não implementado:** contato automatizado, atendimento real, login/senha, banco de dados, pagamentos, arquivos enviados, impressão física, backend, autenticação, integrações com Direct/WhatsApp, SEO real.

## Como testar

Abra a vitrine e teste os filtros. Clique em **Quero criar uma peça**, preencha dados fictícios, envie, copie o código gerado e consulte pelo formulário de acompanhamento. Depois abra **Painel de gestão**, localize o código e clique em **Avançar para ...**. Volte à vitrine e consulte novamente. Para reiniciar, clique em **Restaurar cenário** no painel.

A demo não possui senha propositalmente porque **não há dados reais nem acesso a nenhum sistema**; isto não é um padrão de segurança apropriado para produção. Uma versão comercial exigiria autenticação, autorização por organização, privacidade, banco com escopo por tenant, logs e proteção contra abuso.

## Tecnologias e organização

Frontend estático: `index.html`, `styles.css`, `app.js`. Sem dependências de build, estilo responsivo, botões com foco acessível, navegação por teclado e opção de movimento reduzido. Fontes públicas carregadas via Google Fonts. A publicação usa Cloudflare Workers para servir os três arquivos em uma rota isolada. Código mantido na branch `demo/nexus-3d-brasil-v1`, dentro do monorepo `cosmaker`, sem alterar aplicações existentes.

Para executar localmente, sirva esta pasta com um servidor estático, por exemplo:

```bash
cd demos/nexus-3d
python3 -m http.server 8000
```

Acesse http://localhost:8000/.

## Validações realizadas

- Sintaxe JS: verificação de parsing via `new Function(appJs)`, aprovada.
- IDs do documento: nenhuma duplicidade verificada.
- Link público: resposta pública disponível e conteúdo textual acessível.
- Renderização JS mobile via Cloudflare Browser Rendering em 390 × 844: **seis cards renderizados**, incluindo Busto Guardião.
- Teste automatizado completo das interações: **não executado**. O serviço de automação TinyFish estava sem saldo; uma segunda checagem com navegador Cloudflare foi limitada por rate limit 429. Não alegar cobertura E2E ou aprovação final sem os testes restantes.

## Próximos passos para proposta real

Confirmar com a loja: catálogo fotográfico real e direitos de uso, volume de pedidos, canais de atendimento, processo de orçamento, necessidade de acompanhamento, capacidade de produção, agenda e regras de privacidade/consentimento. Priorizar MVP de vitrine com formulário e dashboard somente se houver demanda. Usar URL e domínio aprovados pela loja antes de qualquer divulgação oficial.
