# Status do produto

Atualizado em 07/10/2026. O estado técnico detalhado e a evidência estão em [docs/versions/v0.1.0/STATUS.md](versions/v0.1.0/STATUS.md).

## Implementado e validado

- Resolver público central por slug com estados para endereço inválido/inexistente, página não publicada e ateliê suspenso.
- Rotas públicas por tenant para landing, solicitação e confirmação com identidade básica própria.
- Solicitação e upload criados pelo backend no tenant resolvido, com validação de conteúdo e caminhos de Storage isolados.
- Migração idempotente de slug que preserva atelierId e impede colisões.
- Fixtures fictícias Tenant A (aurora-cosplay) e Tenant B (luna-cosplay), sem alterar dados reais.
- Rules, Functions e testes que rejeitam gravação direta e adulteração de tenant no fluxo público.
- Membership/RBAC e rotinas administrativas existentes mantidos.
- Documentação canônica, diagramas editáveis/renderizados, screenshots reais A/B e uma capa conceitual explicitamente marcada.

## Evidência

| Verificação | Resultado |
| --- | --- |
| npm test | 30 testes unitários aprovados |
| npm run test:rules | 10 testes Firestore/Storage Rules aprovados no Emulator |
| npm run test:e2e | 5 testes Playwright aprovados; inclui resolução, intake/upload A × B e tampering |
| npm run lint | aprovado |
| npx tsc --noEmit | aprovado |
| npm run functions:build | aprovado |
| npm run build | aprovado; inclui três rotas dinâmicas por slug |
| npm run docs:diagrams | renderiza fontes Mermaid para SVG |
| npm run docs:check | valida documentos, links e manifests |

## Limites e próxima etapa

- Nenhuma migração ou deploy foi executado em Firebase real. Associar slugs reais exige escolher o slug e confirmar o ID do projeto.
- Capturas deste marco foram executadas com fixtures fictícias no Emulator. Capturas em docs/screenshots/ são de marcos anteriores.
- App Check, controles contra abuso do intake, alertas e observabilidade operacional continuam pendentes.
- O GLOBAL STANDARD v01 comercial não foi implementado.

Consulte [STATUS v0.1.0](versions/v0.1.0/STATUS.md) para instruções reproduzíveis e escopo completo.
