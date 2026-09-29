# Cosmaker OS — documentação inicial

Esta pasta concentra a referência inicial do produto antes da implementação.

## Estrutura

```text
docs/initial/
├── README.md
├── estruturas/
│   ├── firebase.txt
│   └── sistema.txt
├── diagramas/
│   ├── 01_diagramas_arquitetura_geral.png
│   └── 02_diagramas_uml_fluxos_dados.png
└── telas/
    ├── 01_landing_page.png
    ├── 02_dashboard_cosmaker.png
    ├── 03_solicitar_orcamento.png
    ├── 04_dashboard_cliente.png
    ├── 05_detalhe_pedido_cliente.png
    ├── 06_ficha_medidas.png
    ├── 07_solicitacoes_orcamentos.png
    ├── 08_kanban_producao.png
    ├── 09_agenda_capacidade.png
    └── 10_referencia_visual_dashboard.png
```

## Ordem recomendada para desenvolvimento

1. Ler `estruturas/sistema.txt`.
2. Ler `estruturas/firebase.txt`.
3. Conferir `diagramas/` para entender domínio, relações e arquitetura.
4. Usar `telas/` como referência visual para componentes e fluxos.
5. Implementar primeiro autenticação + tenant/atelier + clientes.
6. Depois solicitações → orçamentos → pedidos.
7. Depois produção + agenda/capacidade + medidas.
8. Depois pagamentos/financeiro.
9. Finalizar com estoque, relatórios, integrações e administração SaaS.

## Regra

As telas são referência visual. O modelo de dados e as regras descritas nos arquivos de estrutura têm prioridade quando houver alguma inconsistência entre imagem e implementação.


## Estrutura completa
Além deste diretório, o ZIP inclui a árvore inteira do projeto (`app`, `components`, `features`, `services`, `repositories`, `functions`, `tests`, configs etc.). Consulte `docs/initial/estruturas/arvore_completa.txt`.
