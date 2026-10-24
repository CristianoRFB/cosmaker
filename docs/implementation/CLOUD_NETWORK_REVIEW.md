# Revisão mínima de rede do ambiente cosmaker

## Retomada após publicação informada — 24/10/2026, 14:22UTC

O usuário informou que publicou a liberação de apis.google.com. A máquina desta retomada está **running/connected**, com observações atuais; o bloqueio anterior de provisionamento starting não se repetiu. Contudo, tanto o manifesto local quanto o conector de runtime (política enforced, revisões34/35) continuam sem apis.google.com, com somente storage.googleapis.com nos hosts customizados e o preset package_managers.

O acesso pelo proxy a https://apis.google.com/js/api.js recebeu CONNECT403 (curl56). Após iniciar exclusivamente demo-cosmaker pelos lançadores existentes, foi executado somente `bash scripts/cloud-run.sh npx playwright test tests/e2e/google-emulator.spec.ts`: **1skipped/0PASS**, pela condição exata ERR_TUNNEL_CONNECTION_FAILED desse recurso. Exit0 do Playwright não significa aprovação. Não abriu popup, não usou conta Google/Firebase real e não ampliou a lista de domínios. Runtime encerrado ao final.

Evidência sanitizada em [GOOGLE_EMULATOR_RETRY_2026-10-24.json](security/GOOGLE_EMULATOR_RETRY_2026-10-24.json). A publicação informada não está refletida na política efetiva observada desta máquina; o conector somente leitura não permite determinar/corrigir o vínculo com a configuração publicada. **Próxima ação: reconciliar a revisão publicada com a instância vinculada a esta execução e confirmar o host na política aplicada; então repetir somente o mesmo teste.** Nenhum novo domínio foi identificado como necessário. Conclusão funcional permanece182/184=98,91%; Google continua BLOCKED_EXTERNAMENTE.

## Histórico da proposta anterior

Proposta para publicação pelo responsável do ambiente; **não publicada nesta execução**. O conector disponível nesta sessão consulta runtime/diagnósticos, sem ferramenta de edição/publicação de configuração. Não foram alterados o proxy, os certificados ou /etc/codex/network-policy.json.

## Evidência e alteração necessária

O login Google pelo SDK Firebase usa `https://apis.google.com/js/api.js` antes de abrir até mesmo o popup fictício do Auth Emulator. O trace local registrou `net::ERR_TUNNEL_CONNECTION_FAILED` nesse único recurso; uma consulta limitada pelo proxy confirmou CONNECT403. O popup não abriu, nenhum usuário Google real foi usado e não há PASS desse fluxo.

A política publicada preserva o preset package_managers e o host customizado storage.googleapis.com, mas não permite apis.google.com. Acrescentar **somente apis.google.com** aos hosts HTTP/HTTPS permitidos do ambiente cosmaker e publicar a revisão. Preservar as demais configurações, proxy/CA, Node22, Java21, orçamento zero e scripts cloud-setup/cloud-start existentes. Não adicionar wildcard Google, credenciais, Firebase real, IAM ou serviços pagos.

O recurso é biblioteca estática do SDK. A aplicação de demonstração continua com projeto fixo demo-cosmaker e Auth/Firestore/Storage/Functions/PubSub no loopback. Permitir o host não equivale a homologar OAuth Google real ou autorizar Firebase de produção.

## Aceite após publicação

Executar somente `bash scripts/cloud-run.sh npx playwright test tests/e2e/google-emulator.spec.ts`. O teste usa conta fictícia @cosmaker.test e exige que o popup esteja no Auth Emulator local antes de preencher dados. Deve criar somente perfil client, sem tenant, permissões ou Platform Admin, e encerrar sessão. Se outra dependência de rede for recusada, registrar o host exato antes de propor mudança adicional.

O caso é marcado BLOCKED_EXTERNAMENTE/skipped apenas quando observa a falha de túnel desse script estático. Outros erros continuam falhando. Esse skip não conta como PASS ou aprovação funcional do popup; e-mail/senha, recuperação e RBAC têm evidências independentes.
