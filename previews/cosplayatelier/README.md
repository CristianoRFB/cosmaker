# @cosplayatelier — Demo independente

Vitrine, intake de encomendas e quadro de produção apresentados como conceito **não oficial**, sem logotipos ou fotos do prospect. Documento de escopo em `DESIGN.md`.

A demo salva e consulta pedidos simulados apenas no `localStorage` do próprio navegador. Acompanhar um protocolo gerado depende do mesmo navegador/perfil. Não existe integração com serviço real.

## Ambientes
- `/#cliente`: vitrine e formulário de orçamento
- `/#atendimento`: quadro de status do ateliê
- `/#gestao`: disponibilidade e visão geral

O arquivo `index.html` é um artefato isolado para preview, **não** foi integrado à arquitetura Firebase multi-tenant do produto canônico. Antes da absorção: autenticação, contrato de tenant, regras de segurança, validação de API e consentimento.

Arquivos publicados na branch `demo/cosplayatelier-conceito-20261103`, sem alterar main.
