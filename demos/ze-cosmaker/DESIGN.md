# DESIGN — Zé Cosmaker | demonstração conceitual

## Premissas
Referências dos screenshots enviados em 02/11/2026. Página oficial não verificada independentemente. Identidade proposta não equivale a brandbook oficial.

## Personalidade
**Artesanal · fantástico · confiável.** Peças cenográficas sob medida pedem uma apresentação editorial, quase catálogo de arte, sem ecommerce falso.

## Direção visual
- Canvas: `#f7f2e9`; superfície: `#fffcf7`; ink: `#152424`.
- Primary: `#07645b`; acento: `#e7aa40`; artwork: `#cde5da`.
- Tipos: Georgia (editorial para titulares) + system UI para interfaces; sem arquivos de fonte redistribuídos.
- Grid: 1240px máximo, colunas assimétricas desktop, coluna única no telefone.
- Espaçamento: 4/8/12/16/24/32/48/64px. Targets acionáveis ≥44px. Foco de teclado visível.
- Imagens: vetores originais de armadura/espada/cajado; jamais apresentar como fotografias do negócio.
- Hero: objeto em destaque com selo `conceito`; copy específica de propmaker, não template SaaS.
- Motion: lift discreto e navegação com scroll; `prefers-reduced-motion` respeitado.

## Jornada principal
Cliente em 4 passos: explorar categoria → formulário com apelido fictício → gerar código demo → ver etapas. Produção altera estado do pedido fictício e cliente visualiza atualização. Gestão edita visibilidade de categorias e cliente vê alterações.

## Estados
- vazio na vitrine e por filtro da produção;
- pedido não localizado;
- requerimento de campos e tipos;
- pedido concluído (ação de avanço desabilitada);
- confirmação e restauração por mensagem;
- sincronização entre abas pela storage event e persistência limitada a localStorage.

## Acessibilidade e segurança
Landmarks, labels, aria-live feedback, foco visível, sem depender de hover. Nenhum login real, endpoint de negócio, token, cobrança ou foto real. Informação DEMO sempre presente.

## Separação por produto
- VERTICAL/COSMAKER: intake de briefing, status de produção, categorias.
- LOCAL/ZÉ: nome proposto, contexto e cores.
- GLOBAL: isolamento, privacidade, autenticação em ambiente real (fora da demo).
A implementação do HTML é sandbox conceitual; absorção em React/Next/Firebase com tenants e papéis exige PR futuro na base canônica.

## Aceite mínimo
Verificar todas as 3 URLs, script válido, conteúdos por visão, envio simulado, acompanhamento, mudança de status/categoria, responsive mobile e desktop; marcar qualquer limitação de QA real.
