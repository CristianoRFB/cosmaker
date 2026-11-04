# Demo de figurinos — lead Leon Martins

Este diretório implementa uma **prévia independente e não oficial** para testar a proposta de valor de um estúdio de figurinos: briefing, orçamentos, acompanhamento, produção e gestão.

## Ambiente público
- [Vitrine](https://77-leon-martins-figurinos-conceito.on7.workers.dev/?view=cliente)
- [Solicitar orçamento (simulação)](https://77-leon-martins-figurinos-conceito.on7.workers.dev/?view=orcamento)
- [Acompanhamento](https://77-leon-martins-figurinos-conceito.on7.workers.dev/?view=acompanhamento)
- [Produção](https://77-leon-martins-figurinos-conceito.on7.workers.dev/?view=producao)
- [Gestão](https://77-leon-martins-figurinos-conceito.on7.workers.dev/?view=gestao)
- [Health](https://77-leon-martins-figurinos-conceito.on7.workers.dev/health)

## Teste manual recomendado
1. Na vitrine, usar “Solicitar orçamento”.
2. Criar pedido de exemplo (sem dados pessoais); conferir código `FIG-XXXX`.
3. No acompanhamento, consultar o código.
4. No quadro de produção, avançar etapa de pedido.
5. Consultar novamente no mesmo navegador; o status muda.
6. Em gestão, desativar um serviço; observar que a opção fica indisponível no formulário.
7. Usar “Restaurar exemplos” para limpar a demo.

**Limite**: os dados são fictícios, guardados somente em localStorage, sem compartilhamento entre aparelhos; não existe backend, login nem ação no negócio. Páginas de equipe/gestão são demonstrativas e acessíveis publicamente, sem qualquer dado real.

Visão de produto: integrar depois ao repositório Cosmaker OS, reaproveitando tenantSlug, Firestore e permissões documentadas na base. Não reescrever produção para realizar apenas uma demonstração.

## Lead
- Instagram: https://www.instagram.com/leonmarttins/
- Estágio: pesquisado, DEMO_APRESENTAVEL_COM_LIMITACOES, sem contato realizado/contrato.
- Localização, fluxo operacional, disponibilidade, preços e sistemas em uso: não confirmados.

Consulte [DESIGN.md](DESIGN.md) para evidências, premissas e escopo.
