# Conclusão funcional local — Cosmaker OS

Base de código: 6b4ac11f1412d33c0f7ffea8b678ed26d5ac2d9c. Revisão: 2026-10-24.

**182/184 unidades = 98.91%**. São 47 operações congeladas antes do cálculo, com quatro critérios de peso1: implementação compilada, persistência/integração, interface exercitada e negativos de autorização/integridade. 4 critérios não aplicáveis têm justificativa no JSON e ficam fora do denominador. Cada critério comprovado conserva seu crédito mesmo quando outro está bloqueado. Não mede esforço, cobertura exaustiva ou prontidão para clientes reais.

Critérios restantes: 2 bloqueados externamente, 0 pendentes de evidência local, 0 não implementados. Evidências específicas, fontes e limites estão em [FUNCTIONAL_INVENTORY.json](FUNCTIONAL_INVENTORY.json) e [EVIDENCE_LEDGER.json](security/EVIDENCE_LEDGER.json). Registros sintéticos são resumidos; não são publicados traces, capabilities, OOBs ou dados pessoais.

O denominador inclui apenas o escopo funcional atual. Gateway/canais pagos e novas diferenças comerciais não aprovadas estão fora do escopo. Firebase real, inventário/revogação real, OAuth, recuperação operacional e formalização jurídica são gates de homologação separados; não desaparecem por este índice local.

## Por domínio

| Domínio | Operações | Unidades comprovadas/aplicáveis |
| --- | ---: | ---: |
| Conta | 2 | 7/8 |
| CRM | 2 | 8/8 |
| Equipe | 3 | 12/12 |
| Público | 2 | 8/8 |
| Orçamentos | 5 | 18/19 |
| Pedidos | 4 | 16/16 |
| Medidas | 2 | 8/8 |
| Produção | 3 | 12/12 |
| Agenda | 2 | 8/8 |
| Estoque | 2 | 8/8 |
| Financeiro | 3 | 12/12 |
| Serviços e portfólio | 2 | 8/8 |
| Comunicação | 2 | 8/8 |
| Relatórios | 1 | 4/4 |
| Configurações | 1 | 4/4 |
| Entrega | 1 | 4/4 |
| Plataforma | 2 | 8/8 |
| Comercial | 2 | 8/8 |
| Portal | 3 | 12/12 |
| Operação local | 2 | 6/6 |
| Arquivos | 1 | 3/3 |

## Operações

I = implementação; P = persistência/integração; U = interface; N = negativos. PASS significa TESTADO_LOCALMENTE no critério indicado. As operações bloqueadas mantêm os demais critérios aprovados.

| Domínio | Operação | I | P | U | N | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| Conta | Cadastro, login, verificação e saída | PASS | PASS | BLOCKED_EXTERNAMENTE | PASS | BLOCKED_EXTERNAMENTE |
| Conta | Recuperação de senha | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| CRM | Busca paginada, cadastro e edição de clientes | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| CRM | Contexto de pedidos e histórico de interações | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Equipe | Membros, permissões e revogação | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Equipe | Convites, aceite, expiração e revogação | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Equipe | Transferência de titularidade | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Público | Resolver por slug e identidade white-label | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Orçamentos | Solicitação pública e dados do projeto | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Orçamentos | Referências por capability, bytes e leitura privada | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Orçamentos | Rascunho, publicação e revisão versionada | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Orçamentos | Consulta, aprovação, recusa e pedido de ajuste pelo cliente | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Pedidos | Conversão aprovada com itens e snapshots preservados | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Orçamentos | Expiração automática por prazo UTC | PASS | BLOCKED_EXTERNAMENTE | NA | PASS | BLOCKED_EXTERNAMENTE |
| Medidas | Fichas staff/cliente com vínculo CRM e arquivo | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Medidas | Edição validada de valores e snapshots imutáveis | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Pedidos | Histórico paginado e detalhe autorizado do cliente | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Produção | Etapas, responsáveis, pesos e prazos próprios | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Produção | Andamento, bloqueios e aprovação/revisão de etapas | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Produção | Fotos, bytes protegidos e evidências de aprovação | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Pedidos | Mudanças de acordo aprovadas e aplicadas com histórico | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Pedidos | Anexos, compartilhamento, versões e revogação | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Agenda | Capacidade, bloqueios, alocação, cancelamento e risco | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Agenda | Eventos e acompanhamento de prazos | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Estoque | Materiais, fornecedores, SKU e arquivo | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Estoque | Movimentos, BOM, reserva, consumo e liberação | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Financeiro | Custos planejados/reais, mão de obra, despesas, receitas e margens | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Financeiro | Recebimentos declarados, saldo e compensações idempotentes | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Financeiro | Conciliação de recebimento legado sem alterar saldo | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Serviços e portfólio | Manutenção de serviços e projetos publicados | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Serviços e portfólio | Fotos, organização visual e permissões de publicação | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Comunicação | Conversa de pedido, anexos, leitura e histórico | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Comunicação | Notificações internas por UID e deduplicação | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Relatórios | Indicadores reais de pedidos, produção, orçamento, prazos e financeiro com filtros | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Configurações | Preferências operacionais e identidade pública | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Entrega | Entrega, conclusão, gates operacionais e histórico | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Plataforma | Métricas, diretório de ateliês, suspensão e auditoria global | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Plataforma | Diretório paginado de perfis e situação Auth | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Comercial | Catálogo, entitlements, planos manuais, estados e downgrade preservando histórico | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Comercial | Trial manual, demonstração isolada e encerramento | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Portal | Resumo real, próximos passos e navegação por contexto | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Portal | Perfil próprio com identidade e autoridade preservadas | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Portal | Consulta autorizada de recebimentos e saldo em centavos | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Público | Rotas globais por slug, menu, informações e recuperação de navegação | PASS | PASS | PASS | PASS | IMPLEMENTADA_E_TESTADA |
| Operação local | Instalação, build, inicialização e encerramento reutilizáveis | PASS | PASS | NA | PASS | IMPLEMENTADA_E_TESTADA |
| Operação local | Exportação e restauração sintéticas de Auth/Firestore/Storage com ACL | PASS | PASS | NA | PASS | IMPLEMENTADA_E_TESTADA |
| Arquivos | Leitura legada protegida e inventário sintético de tokens | PASS | PASS | NA | PASS | IMPLEMENTADA_E_TESTADA |

## Indicadores separados

Aceite formal: **10/16 = 62.5%**, conforme [matriz dos 16 marcos](FORMAL_ACCEPTANCE.md). Não há aceite fracionário de fase.

Prontidão comercial: **NAO_HOMOLOGADO**. Nenhum resultado Emulator equivale a homologação ou autorização de produção.

Reproduzir/verificar: `bash scripts/cloud-run.sh node scripts/functional-inventory.mjs`. Após revisão das evidências, regenerar com `--write`. O verificador não executa testes nem converte pendências em PASS.
