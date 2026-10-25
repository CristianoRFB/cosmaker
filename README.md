> Branch experimental GOAL VI: adaptação Spark/Workers Free **incompleta**, sem substituição da candidata anterior. Estado, limites e comandos em [docs/implementation/spark/README.md](docs/implementation/spark/README.md). Os98,91% anteriores não aprovam a arquitetura nova.

# Cosmaker OS

SaaS multi-tenant para gestão de ateliês de cosplay. A aplicação compartilhada separa os dados privados por `atelierId`; páginas públicas resolvem o ateliê pelo slug da rota, sem fallback global.

O estado técnico mais recente, os commits e os gates reais ficam em [MASTER_FINALIZATION_PROGRESS.md](docs/implementation/MASTER_FINALIZATION_PROGRESS.md). A documentação canônica permanece em [docs/CURRENT.md](docs/CURRENT.md), atualmente v0.2.0; versões históricas foram preservadas.

O [inventário funcional local](docs/implementation/FUNCTIONAL_COMPLETION.md) registra47operações, evidências e cálculo reproduzível. A [matriz dos16marcos](docs/implementation/FORMAL_ACCEPTANCE.md) mede aceite formal separadamente. Nenhum desses indicadores homologa produção ou autoriza receber dados/clientes reais. Consulte o [handoff atual](docs/implementation/GOAL_MASTER_IV_HANDOFF.md) para continuar.

Próxima sessão no PC: [pacote GOAL V / Windows](docs/operations/README.md), com preflight somente leitura, custo, configuração, candidata, aceite real, backup e rollback. **Firebase completo é incompatível com ZERO_BILLING; nenhuma cobrança foi ativada.**

## Execução Linux somente local

No ambiente Cloud `cosmaker`, use `bash scripts/cloud-setup.sh` na instalação e `bash scripts/cloud-start.sh` na inicialização. As entradas selecionam Node 22 automaticamente, reaproveitam os lançadores abaixo e não usam credenciais reais. Consulte a configuração publicável em [LOCAL_EMULATOR_RUNTIME.md](docs/implementation/LOCAL_EMULATOR_RUNTIME.md).

Use Node.js 22, npm e Java 21 para a Firebase Emulator Suite atual. Instale dependências da raiz e de Functions:

```bash
npm ci
npm ci --prefix functions
```

Em terminais separados, execute:

```bash
npm run firebase:emulators:local
```

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:18080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:19099 npm run seed:emulator
npm run dev:local
```

Abra `http://127.0.0.1:3000/aurora-cosplay` e `/luna-cosplay`. Os lançadores locais fixam o projeto `demo-cosmaker`, os emuladores e a configuração sintética. Não exigem API keys ou credenciais Firebase reais. O seed recusa endpoints fora do loopback e usa somente identidades/arquivos fictícios.

Para testar a interface compilada, encerre o dev server deste checkout, execute `npm run build:local` e depois `npm run start:local`. Não use dev/build concorrentes sobre `.next`. Detalhes de portas, proxy Cloud, Node/Java, navegador e transporte GitHub: [LOCAL_EMULATOR_RUNTIME.md](docs/implementation/LOCAL_EMULATOR_RUNTIME.md).

## Domínios e fronteiras

- Fluxo público: `/{tenantSlug}`, `/{tenantSlug}/orcamento` e confirmação; resolver central e projeções explícitas sem conteúdo privado.
- Jornadas existentes: CRM, equipe/permissões, agenda/capacidade, estoque, orçamento/proposta/aprovação, pedido, produção, revisões, arquivos e evidências.
- Financeiro operacional: custos planejados/realizados, recebimentos declarados, margens e compensações auditadas em centavos, sem movimentação bancária.
- Serviços/portfólio: painel, publicação/branding, imagens por acesso controlado e solicitação de orçamento com origem preservada.
- Mensagens/notificações internas e fases seguintes: consultar o checkpoint para distinguir implementação, validação local, CI e aceite. Telas ou WIP não significam módulo aceito.
- Global Standard v01 mantém atribuição manual de planos, trial/demo e política central validada localmente. `features: []` e `limits: {}` preservam a ausência de matriz comercial detalhada aprovada. Billing/gateway, e-mail/WhatsApp externos e cobranças reais não estão ativados.

Os contratos operacionais recentes ficam em [docs/implementation/](docs/implementation/). Os scripts de testes por domínio estão em `package.json`; use gates direcionados durante implementação e regressão proporcional nos checkpoints. Nenhum comando local descrito aqui publica Functions, Rules, índices ou aplicação no Firebase real.
