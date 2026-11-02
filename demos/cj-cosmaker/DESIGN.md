# DESIGN — CJ Cosmaker (prévia conceitual, não oficial)

## Evidências e hipóteses
Fonte visual: prints de @cj_cosmaker fornecidos pelo usuário em 02/11/2026. Bio visível: cosmaker no RS, armas, armaduras, acessórios e impressão 3D; peças como máscara felina iluminada, lâminas, armamentos cenográficos e peças em EVA/3D. Não foram verificados preços, disponibilidade, entregas, logística, sistemas já existentes ou autorização de uso de marca/fotos. Ilustrações vetoriais são originais e fictícias; não são cópias de posts.

## Objetivo
Em 90 segundos, mostrar como o cliente explora peças, solicita orçamento e consulta progresso; como o cosmaker registra etapa e nota sem depender de mensagens soltas.

## Direção visual
Personalidade: artesanal, fantástica, tecnológica. Fundo graphite (#0e1015), superfícies #181a22, tinta #f7f3ef, rosa-íris #e09cce, acento de progresso #d5f2b1. Paleta proposta, não identidade oficial. Tipografia: sistema sem serifa e Georgia para títulos editoriais, sem fontes externas. Grid até 1220px; touch targets >= 44px. Ritmo 4/8/12/16/24/32px. Motion leve e desativado com prefers-reduced-motion. Layout testável em 320/390/430/768/1440.

## Três visões
- Vitrine / portfólio: filtro, galeria ilustrativa, detalhes, CTA de orçamento.
- Orçamento + acompanhamento: formulário de teste sem dados pessoais e código para consultar status.
- Gestão demo: pipeline, mudança de etapa e diário de atualização refletidos em acompanhamento no MESMO navegador.

## Tecnologia e isolamento
HTML/CSS/JavaScript standalone em demos/cj-cosmaker/index.html. Sem dependências, backend, autenticação, cobrança ou acesso a produção. Persistência localStorage, sem sincronização entre dispositivos. Não armazenar dados reais. Dados de demonstração explicitamente identificados. Tenant real não provisionado. Estratégia de absorção: converter componentes para React e mapear marca/portfólio/intake/status ao resolver atelierId/slug e permissões do core Cosmaker OS; não integrar aos dados do tenant sem handoff e autorização.

## Testes / aceite
Validar filtros, modal, formulário, código, avanço de etapa, update, reset e teclado. Verificar 320,360,390,430,768,1024,1440px. Não chamar de cliente homologado; é PREVIEW NÃO OFICIAL.
