# Usabilidade transversal — 2026-10-31

## Objetivo e decisões

Pedido atual: facilitar o uso para visitantes, clientes, equipe, proprietários e administradores; verificar e enviar diretamente à `main`. Essa autorização substitui a restrição anterior de não atualizar a main, exclusivamente para esta entrega. Base: `dca70565f378298443ff7f7ca0b6e17e735d7908`. As candidatas e provas GOAL VI–VIII permanecem nas próprias branches; não são promovidas junto.

O solicitante confirmou que “XY” significa UX/usabilidade. Trata-se de pesquisa documental e inspeção heurística, não de pesquisa com participantes nem de homologação comercial.

Alternativas: redesign completo teria grande risco e não é necessário; transportar toda a candidata mudaria arquitetura e funcionalidades. Escolha técnica: aperfeiçoar componentes compartilhados e corrigir obstáculos de acesso, mantendo identidade visual, contratos e permissões.

## Pesquisa aplicada

- [W3C WAI: estrutura de menus](https://www.w3.org/WAI/tutorials/menus/structure/): indicar a página atual e fornecer regiões de navegação identificadas.
- [W3C WAI: menus](https://www.w3.org/WAI/tutorials/menus/): navegação consistente, estados reconhecíveis e operação por teclado.
- [Nielsen Norman Group: heurísticas de usabilidade](https://www.nngroup.com/articles/ten-usability-heuristics/): linguagem familiar, orientação contextual, reconhecimento e erros recuperáveis.
- [W3C WCAG: tamanho mínimo dos alvos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): controles com espaço adequado; adotamos 44px para os novos controles principais.

Problemas observados: menu público oculto no celular; áreas protegidas com navegação apenas horizontal em telas pequenas; perfil de administradores aponta ao cliente; ausência de contexto e de indicação acessível consistente; login sem destino sempre envia ao cliente; erros de campos sem vínculo acessível; IDs de título de diálogo duplicáveis. CI anterior falha no npm ci por lock inconsistente.

## Plano verificável

1. Testar navegação por seção, papéis, permissões, busca sem acentos e destinos de login seguros. Implementar catálogo compartilhado de navegação com descrições, agrupamentos e caminhos existentes.
2. Implementar menu mobile e guia de áreas para todas as contas; títulos/contexto, retorno da seção, perfil correto, saída acessível e atalho ao conteúdo. Menu público mobile mantém links existentes.
3. Corrigir destino padrão após login a partir do perfil canônico carregado; vincular erros aos campos e focar primeiro erro. Diálogos com IDs únicos, fechamento por Escape e rolagem.
4. Validar com Auth/Firestore demo-cosmaker e Playwright nas larguras 320/375/768/1440, incluindo equipe restrita e teclado. Executar TypeScript, lint, unitários e build. Corrigir lock e CI sem incorporar provas experimentais. Revisar diff, atualizar evidências e enviar à main sem force push.

## Limites

Navegação filtrada não substitui Rules e autorização de backend. Não alterar papéis, memberships, planos, Firebase real, billing, deploy ou dados reais. Não apresentar páginas estruturais antigas como módulos concluídos. Não herdar os percentuais da candidata para esta main.

## Evidências

- Node 22.23.4 e Java 21; somente projeto `demo-cosmaker` nos ensaios.
- `npm ci --no-audit --no-fund`: instalação limpa executada. Após patches dirigidos, instalação incremental e `npm ci --dry-run --ignore-scripts --no-audit --no-fund` aprovados; CI fará novamente a instalação limpa da revisão publicada.
- `npm --prefix functions ci --ignore-scripts --no-audit --no-fund` e `npm run functions:build`: aprovados. Nenhuma Function foi publicada ou reimplementada.
- `npm run lint`, `npx tsc --noEmit`: aprovados; o build também executou lint e verificação de tipos.
- `npm test`: **87/87**, 14 arquivos, incluindo 8 novos casos de orientação, busca, RBAC, destino de login e mensagens legíveis.
- `npm run test:usability:preflight`: **3/3**, recusa de porta ocupada, reserva liberada e entrada inválida.
- `npm run build`: aprovado, Next.js 15.5.28; artefato local preservado fora do checkout antes de iniciar o servidor de desenvolvimento dos testes.
- `npm audit --omit=dev --json`: **0 vulnerabilidades reportadas** nas dependências de produção da raiz após patches. Isso não comprova ausência universal de falhas nem uma auditoria das dependências separadas de Functions.
- Primeiro conjunto completo de navegador: **7/7** em Auth/Firestore Emulator, incluindo visitante, cliente, proprietário, equipe somente `quotes:read`, administrador e cliente impedido de entrar no painel administrativo.
- Reteste após os patches e correção de espaçamento: **7/7**, com verificações de altura, largura, Escape, retorno de foco e ausência de acesso administrativo para o cliente. Após alinhar também os atalhos da home do ateliê às permissões, regressão proporcional de proprietário/equipe: **2/2** (reexecuções, não novos critérios).

### Correções encontradas durante a verificação

1. O CI da main anterior (`37980491176`, job `113989454563`) falhava antes do build por ausência de `@emnapi/core` e `@emnapi/runtime` no lock. Lock refeito e instalação limpa validada.
2. A inspeção independente reproduziu overflow de 330px em viewport de 320px no cabeçalho público. Menu compacto abaixo de 360px preserva alvo de 44px e nome acessível.
3. O lançador recusará porta 3100 já ocupada; antes de autenticar, o navegador exige metadados `emulator` e `demo-cosmaker`. Nenhum servidor de terceiros é reutilizado ou encerrado. Encerramento da própria árvore no Windows está preparado, mas não foi testado em Windows nesta sessão.
4. Escape no campo de busca era consumido pelo controle nativo sem fechar o modal. O ensaio reproduziu a falha; tratamento no diálogo agora fecha e restaura o foco, respeitando composição de texto.
5. Inspeção das capturas detectou altura exagerada do aviso local causada pela distribuição automática das linhas do grid. Restaurado `content-start`; reteste exige altura máxima de 64px em todas as larguras.
6. Diagnóstico administrativo `internal [0]` agora oferece uma orientação legível e uma região de alerta, preservando mensagens de negócio úteis.
7. Atalhos da home do ateliê agora usam a mesma filtragem por permissões do menu, evitando oferecer Clientes e Pedidos à equipe limitada a orçamentos.
8. Atualizações compatíveis: Next e eslint-config-next 15.5.28; Zod 4.6.7; fast-uri 3.1.9; re2js 2.9.1; override de `@grpc/grpc-js` 1.13.6 apenas sob `@firebase/firestore`. O `npm audit` sugeria downgrade de Firebase; ele foi rejeitado, sem `--force`, mantendo Firebase 12.

### Tentativas e limites reais

O primeiro ensaio encontrou erro de inicialização JavaScript com artefatos/dependências de outro checkout e foi interrompido; após instalação limpa e separação dos artefatos, o login funcionou. A causa exata daquele script inválido não foi atribuída ao produto sem evidência. Um segundo ensaio foi interrompido após reproduzir a falha de Escape. Nenhuma dessas tentativas recebe PASS.

Comando reproduzível: `npm run test:usability` (Node 22, Java 21 e Chromium do Playwright instalados). Para reexecutar apenas os perfis afetados: `COSMAKER_USABILITY_GREP='conta (owner|staff)' npm run test:usability` em Bash. O CI executa o conjunto completo.

O ensaio de UX inicia somente Auth e Firestore. Ausência de Functions produz estados de erro reais em indicadores administrativos, que continuam navegáveis; os testes não aprovam métricas, finanças ou outros domínios de backend. Não houve mock de autorização, persistência ou login. As contas, memberships, tenant e claims são sintéticos e removidos ao final; os emuladores são encerrados.

Capturas locais em `test-results/` (ignoradas no Git), incluindo 320/375/768/1440px, foram inspecionadas. CI preserva as evidências de navegador por sete dias. O teste não abre popup Google e não altera seus bloqueios anteriores.

### Revisão e publicação

Revisão independente do diff executada, com as correções acima para largura, porta e encerramento. A origem, a main e a identidade GitHub do proprietário foram conferidas. Somente arquivos desta entrega serão enviados; nenhuma candidata experimental será mesclada. O resultado do CI do commit exato publicado deve ser consultado no relatório final e em [Actions](https://github.com/CristianoRFB/cosmaker/actions/workflows/ci.yml?query=branch%3Amain).

A main continua com páginas e funcionalidades estruturais anteriores fora desta revisão. Esta entrega melhora componentes compartilhados e o acesso, não declara o sistema completo ou pronto para produção. A candidata funcional, as provas de arquitetura gratuita e seus inventários permanecem preservados nas branches anteriores.

Rollback de código: reverter o commit desta entrega em um novo commit, após conferir a main mais recente; não usar reset nem force push. Nenhuma migração de dados ou Rules é necessária.
