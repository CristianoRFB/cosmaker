# RS3DMaker — demonstração de prospecção (não oficial)

**Vitrine:** https://77-rs3dmaker-conceito.on7.workers.dev/

**Personalizar:** https://77-rs3dmaker-conceito.on7.workers.dev/?view=personalizar

**Gestão demonstrativa:** https://77-rs3dmaker-conceito.on7.workers.dev/?view=gestao

Data: 2026-11-02. Lead contatado e respondeu "boa noite, tudo bem?". A demonstração foi criada sem afirmar parceria ou aceite comercial.

## O que funciona
- Vitrine responsiva com quatro ideias de categorias inspiradas no print do @rs3d.maker.
- Formulário para tipo, descrição, quantidade, prazo; validação e resumo copiável para levar ao Instagram.
- Painel kanban com pedidos fictícios, contadores, detalhes, avanço de etapas e restauração.
- Pedidos simulados são guardados exclusivamente em localStorage deste navegador.
- index.html é autônomo; worker.js entrega o mesmo HTML via Cloudflare Workers.

## Limites importantes
- Não é domínio oficial nem foi autorizado como site oficial.
- Não há preços, checkout, WhatsApp de destino, estoque, fotos próprias da marca, backend, autenticação, notificações ou tratamento de pedidos reais.
- O link "Abrir Instagram" abre @rs3d.maker; não envia a mensagem automaticamente.
- Quatro pedidos iniciais são fictícios; nenhum KPI reflete operação real.
- Não integrar este front-end diretamente a um tenant produtivo sem refazer validações e autenticação.
- A direção visual é inspirada no universo geek, não uma cópia do branding oficial.

## Evidências de validação desta rodada
- GitHub: arquivos enviados à branch dedicada, sem alterar main.
- Cloudflare API: upload de Worker aprovado; subdomínio workers.dev habilitado; deployment registrado.
- Consulta HTTP independente via fetch público: dois endereços acessíveis com título e HTML corretos.
- Smoke test de script em runtime isolado com mocks de DOM: sintaxe válida e marcações principais geradas nas três vistas (vitrine, personalizar, gestão, 4 cartões).
- Não foi possível fazer teste E2E real no navegador remoto devido ao saldo insuficiente do executor conectado. Logo, não declarar E2E/browser nem mobile visual aprovado.

## Próximo passo após conversa comercial
Confirmar quais itens podem integrar catálogo, obter fotos próprias e cores oficiais com autorização, perguntar como controlam encomendas e aprovar o encaminhamento por WhatsApp/Direct. A integração com o Cosmaker OS e o tenant real exige escopo separado.

Ver também DESIGN.md.