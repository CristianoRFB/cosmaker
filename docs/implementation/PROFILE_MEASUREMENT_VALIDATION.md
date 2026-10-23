# Perfis, medidas e continuidade da sessão

As alterações desta revisão corrigem dois achados do relatório parcial F5 e uma falha de cadastro comprovada no navegador. A autoridade permanece nos mesmos documentos e claims; não há papel novo, concessão comercial, migração ou Firebase real.

## Perfil próprio

Novos perfis pelo cliente aceitam somente apresentação, timestamps e a autoridade mínima fixa: `accountType: client`, `role: client`, `permissions: []`, `active: true`, UID próprio quando informado. Não aceitam tenant, campos extras nem criação de outro usuário. O cadastro precisa poder criar esse perfil antes da verificação de e-mail; acesso aos domínios continua exigindo verificação.

`name` tem de 1 a 256 caracteres (cadastro existente continua limitado a 100 pelo formulário); e-mail, até 254, deve ser o endereço do Auth. Telefone é string de até 32; photoURL é string vazia ou HTTPS de até 2048. Timestamps novos usam `request.time`. Updates próprios validam os campos de apresentação alterados e preservam autoridade, UID, criação e demais campos. Dados legados de apresentação não alterados podem permanecer até correção; isso não lhes concede autoridade. Não há leitura de perfis de outros usuários.

## Fichas e medidas

Equipe e cliente agora passam pelos mesmos schemas de medidas/fichas. Tipos, números, strings, campos extras e comprimentos são validados em create e update. Nova ficha exige cliente existente no mesmo tenant; seu `clientId` é imutável. Medida nova exige ficha existente. Timestamps de criação são imutáveis e novos timestamps precisam ser de servidor. Limites já existentes: valor 0–100000, tipo 80, label/nome 100, unidade 20 e notas 500. Nada altera snapshots dos pedidos aprovados.

Não houve reatribuição em lote ou correção de dados legados. Um registro já corrompido exige correção explícita pelo domínio; não se apresenta valor financeiro/medida falso para ocultar erro.

## Cadastro e confirmação

O Auth emite a sessão antes de a gravação de `users/{uid}` terminar. O provider podia concluir uma leitura anterior com “perfil ausente”; o cadastro salvava o documento, mas não atualizava esse estado, bloqueando o portal depois da verificação. O formulário agora chama `refreshUser` após criar o perfil. A confirmação renova o ID token, para atualizar o claim `email_verified`, e relê o perfil antes de navegar. A revisão usa somente cadastros fictícios no Auth Emulator.

## Interface de propostas

Investimento e ações ficam antes do histórico de respostas no DOM e no mobile; um histórico de 50 respostas não empurra a aprovação para o fim da tela. A grade desktop mantém os blocos de conteúdo e ações e apresenta histórico abaixo. Não altera valores, decisões, contratos ou persistência.

Resultados efetivos e falhas anteriores estão em [MASTER_FINALIZATION_PROGRESS.md](MASTER_FINALIZATION_PROGRESS.md). A auditoria global continua parcial pelos achados de Storage; estes reforços não significam homologação comercial ou produção.
