# Dogstar Cap — Preparação para tenant real e demo

**Estado:** LEAD/CLIENTE EM PREPARAÇÃO, sem comprovação de conta real vinculada no Firebase, sem autorização de publicação ou migração de produção. Este documento não é anúncio de implantação concluída.

## Fatos do briefing fornecidos
- Nome comercial informado: Dogstar Cap.
- Instagram de referência: @dogstar.cap.
- Assinatura textual fornecida: “Estilo que não late, Morde!”.
- Segmento: bonés autorais. Monster Cap é um conceito de cartão/brinde associado a bonés, **não** checkout ou funcionalidade implementada no Cosmaker.
- Paleta de referência variada: amarelo canário, vermelho vivo, vinho, cinza escuro, verde escuro, ciano, laranja neon, caramelo, marrom, rosa, verde neon e areia. A cor `#7f1d1d` no seed é **direção de demonstração**, não aprovação formal da identidade.
- Demo comercial separada: https://77-dogstar-cap-conceito.on7.workers.dev/?view=loja. É um **conceito**, e não prova de operação Firebase nem sistema de pedidos reais.

Nenhum contato privado, nome de responsável, CNPJ ou endereço foi salvo neste repositório.

## Código preparado
- `businessType: 'caps'` no tenant público, com fallback preservando Cosmaker/Cosplay.
- Landing e formulário específico de boné para modelo, cor, artes da frente/verso, quantidade e prazo.
- Backend exige `category: 'custom_cap'` somente em tenant `caps`, valida e persiste `capCustomization` estruturado no namespace real `ateliers/{atelierId}/quoteRequests`.
- O fluxo existente de orçamento/proposta/pedido continua e mantém o `atelierId` interno; `slug` não é autorização.
- Preflight/onboarding manual aceita `--business-type=caps` e mantém `published=false` e `quoteRequestsEnabled=false` em novo tenant real.
- `npm run seed:dogstar-preview` cria apenas fixture **DEMONSTRAÇÃO** em projeto Firebase Emulator `demo-cosmaker`, sem importar dados reais. Define `COSMAKER_PREVIEW_PASSWORD` somente no ambiente local. O preview não suporta pagamentos reais e os uploads são desabilitados pelo front/Rules.

## Antes de ligar produção
1. Confirmar quem é o responsável legal, e-mail de login real e autorização de uso de marca, fotos, modelos e dados pessoais.
2. Ter Firebase Auth do responsável com e-mail verificado, UID e Platform Owner autenticado, sem credenciais no chat/Git.
3. Executar preflight `npm run tenant:onboard -- ... --business-type=caps`; usar apply somente após consentimento e confirmação do ambiente. **Não executar neste PR.**
4. Atribuir plano manual sem inventar cotas/limites; separar plano do Cosmaker de pagamento pela venda de bonés.
5. Homologar no staging com Auth/Rules/Functions/Storage e com dois tenants; testar uploads, antiabuso, App Check/rate limiting, LGPD e backup/restauração.
6. Obter aprovação separada de infraestrutura (Functions/Storage e custos), domínio, deploy, publicação e captação real.
7. Habilitar `published` e `quoteRequestsEnabled` só após checklist operacional, com log auditável e rollback.

## Escopo NÃO entregue
- Loja completa, estoque sincronizado, catálogo real da Dogstar, checkout, pagamentos, frete, rastreio, notas fiscais, integração WhatsApp ou Monster Cap interativo.
- Produto pronto para clientes reais, uptime monitorado, domínio oficial, proteção antiabuso completa ou migração de arquivos.
- Permissão para republicar imagens/branding sem confirmação.

## Validação exigida
`npm run test:onboarding`, `npm test`, `npm run test:rules`, `npm run test:commercial`, `npm run test:e2e`, `npm run lint`, `npx tsc --noEmit`, `npm run functions:build`, `npm run build`, `npm run docs:check`.

Provas: screenshots reais somente se o runtime local for executado; mockups/visual do outro Project permanecem CONCEITUAIS.
