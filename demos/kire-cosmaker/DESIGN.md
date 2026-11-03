# Design brief — Kire Cosmaker (conceito não oficial)

- Lead observado: @kirecosmaker, Farroupilha, RS, cosplay sob medida, props, sublimação e impressão 3D; perfil informa agenda fechada em 03/11/2026. Sem uso de logotipo e sem fotos de terceiros.
- Público: visitantes que exploram obras; clientes interessados em briefing; equipe que acompanha a produção; gestor que organiza a demanda.
- Experiências: `?view=cliente` (vitrine + solicitação ilustrativa), `?view=atendimento` (quadro de produção e fila), `?view=admin` (resumo e preferências do ambiente demo).
- Direção: editorial artesanal, escuro profundo + marfim + verde floresta + latão; ilustrar peças por CSS original, não copiar obras/personagens.
- Tokens: canvas #f5f1e9; paper #fffdf8; ink #1a201f; primary #304e41; gold #c8a76f; line #ded8cc. Georgia + system-ui. Espaçamento 4/8/12/16/24/32/48/64.
- UX: foco no mobile, botões grandes, validação HTML, campos com rótulos, feedback, `prefers-reduced-motion`, filtro de dados restrito à demo.
- Estado: `DEMO_INTERATIVA_PERSISTIDA_LOCAL` (localStorage), sem backend, envio ou autorização comercial. Todos os dados de exemplo são fictícios. O formulário não solicita dados pessoais.
- Segurança: admin demonstrativo sem autenticação e sem qualquer conexão a dados de produção; não publicar como painel real.
- A migração futura para Cosmaker OS requer integração ao tenant resolver, auth, RBAC, regras do Firebase e revisão de segurança.
