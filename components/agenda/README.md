# Agenda, capacidade e eventos

Este módulo implementa a agenda operacional do ateliê nas rotas `/atelier/agenda`, `/atelier/agenda/capacidade`, `/atelier/agenda/bloqueios`, `/atelier/eventos` e `/atelier/producao/cronograma`.

## Fluxos

- Configurar horas disponíveis por dia da semana, janela diária e fuso horário do membro.
- Alocar uma etapa de pedido em um intervalo de trabalho, respeitando capacidade, bloqueios, conflitos, prazo e estado da etapa.
- Criar e cancelar pausas, férias e bloqueios de dia inteiro.
- Criar, editar, consultar e cancelar eventos do ateliê.
- Consultar a agenda da equipe, a linha do tempo por etapa e os sinais de risco de atraso.

## Persistência e autorização

As mutações passam por Firebase Functions autenticadas: `saveMemberScheduleCapacity`, `allocateProductionTime`, `cancelProductionSlot`, `createScheduleBlock`, `cancelScheduleBlock`, `listScheduleWorkspace`, `listAtelierEvents`, `createAtelierEvent`, `updateAtelierEvent` e `cancelAtelierEvent`. As coleções operacionais incluem `teamCapacity`, `productionSlots`, `scheduleDays`, `scheduleBlocks` e `events`; os índices compostos necessários ficam em `firestore.indexes.json`.

As Functions resolvem o tenant a partir da identidade autenticada e verificam associação ativa e permissões antes de ler ou gravar. Alocações e bloqueios usam transações e travas diárias para impedir sobreposição e excesso de capacidade sob concorrência. A UI usa os repositórios `schedule.repository.ts` e `events.repository.ts`, que chamam as Functions; Rules bloqueiam mutações diretas do navegador nas coleções operacionais. E-mail da equipe e nome de cliente só são retornados quando as permissões de leitura correspondentes permitem.

## Risco de atraso

O indicador é categórico (`clear`, `planning`, `medium`, `high` ou `unknown`) e não inventa percentuais. Considera capacidade configurada, horas alocadas, intervalos bloqueados, etapas pendentes, slots realmente persistidos, prazos e datas de eventos associados ao pedido. Evento cancelado deixa de influenciar o cálculo. O horizonte consultável é limitado a 31 dias; risco desconhecido é apresentado como tal quando faltam dados de planejamento.

## Validação local

- `npm test -- --reporter=dot`: políticas puras de datas, fuso, intervalos, carga e risco.
- `npm run test:rules`: negação de escritas diretas às coleções operacionais.
- `npm run test:scheduling`: Functions no Firebase Emulator, incluindo isolamento de tenant, permissões, idempotência, concorrência, bloqueios, eventos e risco.
- `npx playwright test tests/e2e/scheduling-workflow.spec.ts`: configuração de capacidade, alocação/cancelamento, bloqueio e evento na UI com confirmação de persistência no Emulator.

Esses comandos usam somente dados sintéticos e Firebase Emulator. Não enviam notificações externas nem executam operações de staging ou produção.
