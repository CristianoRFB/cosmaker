# Runtime local para jornadas e capturas

O lançador `scripts/dev-local.mjs` fixa o projeto `demo-cosmaker`, o host `127.0.0.1` e a conexão aos emuladores de Auth, Firestore, Storage e Functions. Não contém credenciais reais. As portas padrão são 19099, 18080, 19199 e 15001; as variáveis `NEXT_PUBLIC_FIREBASE_*_EMULATOR_PORT` permitem portas locais alternativas.

## Desenvolvimento

Com os emuladores em execução, use `npm run dev:local`. As rotas são compiladas sob demanda. Nas jornadas longas, cada rota fria e troca de área pode exigir uma nova compilação.

## Interface compilada para E2E

Encerre o `dev:local` deste checkout antes de compilar, pois ambos usam `.next`. Execute `npm run build:local` e depois `npm run start:local`. O servidor continua local e a interface usa os mesmos emuladores, com a indicação de ambiente local. Os testes e capturas apontam para `http://127.0.0.1:3000`.

Depois de alterar a interface, encerre o servidor local, repita `build:local` e inicie `start:local` novamente. Dados persistidos continuam pertencendo aos emuladores; compilar não faz seed, migração ou deploy.

Este bundle é específico do Emulator. Para um build de outro ambiente, use `npm run build` com a configuração daquele ambiente em um checkout/runtime apropriado. Os comandos locais não publicam arquivos nem alteram Firebase real.

## Validação e evidências

O lançador recusa modos diferentes de `dev`, `build` e `start`. O histórico de execução e os resultados de build/E2E estão em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md). A compilação e o smoke do runtime compilado estão em validação neste checkpoint; não são prova de staging ou produção.
