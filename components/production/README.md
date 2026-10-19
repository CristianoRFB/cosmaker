# Componentes de produção

`ProductionStageControls` apresenta andamento, bloqueios, prazos, ações autorizadas, aprovação e envio de fotos. `ProductionConfigurationEditor` carrega a configuração real do pedido e a equipe elegível, edita metadados e etapas próprias, preserva dados após erro e reutiliza a chave da operação em retry.

O editor oferece nomes, pesos proporcionais, aprovação, responsável, início/prazo, inclusão e movimentação de etapas próprias dentro de cada fase. Etapas executadas mostram a definição preservada. Bloqueios adicionais por alocação, histórico ou concorrência são validados no servidor e retornam uma mensagem na própria configuração. Todos os campos têm rótulos e os botões de reordenação/remoção têm nomes acessíveis.

`ClientProductionApprovals` conserva o fluxo explícito de aprovação/ajuste. `ProductionTimeline` e `ProductionKanban` utilizam as etapas persistidas e aceitam etapas adicionais; a semântica dos seis estados canônicos continua no backend.

`ProductionPhotoImage` solicita bytes autenticados, usa um Blob local e revoga a URL ao trocar identidade/evidência ou desmontar. O Storage direto está negado para fotos. O servidor verifica perfil, tenant, vínculo de cliente, visibilidade, caminho, geração, tamanho e assinatura; links antigos são revogados na conclusão do upload e em leitura autorizada. Isso não substitui a migração global, ainda não executada.

Gate F1.5 em 2026-10-19: integração 32/32, Rules 21/21, E2E desktop 3/3 e mobile 2/2. A aprovação do cliente confere a foto Blob decodificada e o snapshot de evidências preservado.
