# Autenticação local — evidência e limites

Somente demo-cosmaker, Auth/Firestore no loopback e identidades fictícias @cosmaker.test. Nenhuma credencial ou conta Google real é necessária ou autorizada.

E-mail/senha, cadastro/perfil limitado e verificação já têm testes de domínio/Rules e navegador. Recuperação agora tem ensaio próprio: emissão de OOB no Emulator, confirmação local de código, uso único, recusa de código inválido e senha anterior, login com senha nova e preservação de UID/perfil/papéis. Formulário funciona em320/375/768/1440.

Corrigido vazamento de existência de conta no recibo da recuperação: user-not-found recebe o mesmo texto condicional. Falhas de conexão e limite de tentativas continuam visíveis, com retry; não se apresenta sucesso de envio em falha de rede. Mensagens de login não distinguem usuário inexistente de senha incorreta. O teste bloqueia deliberadamente apenas a chamada local para provar erro/retry.

Isso é proteção de interface. Proteção contra enumeração na API pública do Firebase Auth, domínios autorizados, templates/links reais, Google OAuth real, políticas de sessões/revogação e entrega real de e-mails precisam de homologação externa autorizada. Nenhuma dessas configurações foi alterada aqui.

Popup Google pelo SDK precisa baixar biblioteca estática apis.google.com/js/api.js mesmo com Auth Emulator. A política atual do Cloud bloqueia esse recurso antes de abrir popup. Google local está BLOCKED_EXTERNAMENTE; ver CLOUD_NETWORK_REVIEW.md e teste google-emulator.spec.ts. Um skip comprovado de rede não é PASS nem homologação do provedor real.
