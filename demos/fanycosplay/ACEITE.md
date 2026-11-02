# ACEITE — Demonstração Fany Cosplay
Data: 2026-11-02
Ambiente: worker independente, sem ligação com Firebase e produção.
Tipo: DEMO_INTERATIVA_PERSISTENCIA_LOCAL (localStorage por navegador; não backend).

## Fluxos previstos
- Portfólio responsivo com aviso de agenda fechada e visões navegáveis.
- Cliente alterna projetos, acompanha etapas, registra aprovação/ajuste apenas localmente.
- Gestão inclui novo projeto, avança etapa e altera disponibilidade visual.
- Alterações refletidas nas demais visões do mesmo navegador, após navegação/refresh.
- Reset elimina estado local da demo; sem env, senha ou serviços reais.

## Segurança e limites
- Não incluir imagens/cópias do Instagram sem autorização.
- Nenhum pedido ou mensagem é enviado a fanycosplay; nenhuma transação/cobrança.
- Painel público é exclusivamente simulação. Produção requer autenticação, isolamento tenant, Rules e autorização.
- Layout visa 320/360/390/430/768/1024/1440; QA real deve ser registrado após publicação.
