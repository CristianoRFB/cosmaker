# DESIGN — EwZ Cosmaking (demonstração independente)

Data: 2026-11-03.

## O que está comprovado
Captura de tela pública do Instagram `@ewz_cosmaking` fornecida pelo usuário: cosplayer/cosmaker, jurado de cosplay, serviços de júri, palestra/workshop, presença de props e agenda aberta para o segundo semestre de 2026. Não se verificaram preços, volume de vendas, prazos, propriedade de um site ou gargalos operacionais.

## Diagnóstico comercial
**Lead de prioridade média/alta, ainda não qualificado com responsável.** Boa demonstração de benefício de software na etapa orçamento → produção, sem substituir a conversa personalizada. Problemas de gestão são hipóteses; não foram relatados pelo ateliê. Link público na bio para CrossGuildProd é relacionado a eventos, não prova de um site próprio de venda.

## Direção visual
Personalidade: **autoral · técnico · imaginativo**. Não usar logo, cores oficiais, personagens conhecidos, fotografias do prospect ou depoimentos inventados. Produto identificado textualmente como `Ateliê de Props` e em todas as vistas como demo conceitual independente.

Paleta: canvas #f7f5f0, superfície #ffffff, ink #181924, hero #1c1a27, ação #c5ec63, arte #c6b6ff, divisa #dddcd8. Fontes livres: Space Grotesk + DM Sans; fallback sem-serif. Espaçamento baseado em 4/8/12/16/24/32/48/64 px. Ilustrações SVG e CSS originais de peça fictícia, máscara, armadura e arma cenográfica — não logos, artes e produtos reais.

## Quatro ambientes e jornada principal
1. **Cliente / Vitrine** `?view=cliente`: conceito editorial, categorias fictícias, informações sobre processo e briefing com validação. Clicar em "Solicitar algo assim" pré-seleciona a categoria e move o foco.
2. **Acompanhamento** `?view=acompanhamento`: protocolo demonstrativo e etapa visual; também é destino ao preencher o briefing. Link compartilhável é apenas uma conveniência neste navegador.
3. **Operação / Produção** `?view=producao`: quadro por etapas com avançar e voltar; feedback e refletido no acompanhamento do mesmo navegador.
4. **Gestão** `?view=gestao`: indicadores derivados exclusivamente dos dados locais, filtro e edição do estágio. Espaço para serviços de jurado, workshop e palestra, sem calendário real.

## Segurança e limites
Dados inteiramente fictícios ou digitados para demonstração, persistência apenas em `localStorage`; sem backend, autenticação, upload, disparos, coleta de contato real, notificações ou cobrança. Não usar com clientes reais. Todo acesso a operação/gestão é público por ser uma simulação isolada sem dados privados. Para produção, integrar ao Cosmaker OS com tenant, Auth, autorização, API, storage privado, media lifecycle e regras existentes.

## QA
Layouts previstos para 320/360/390/430/768/1024/1440; targets touch, foco e landmarks, validação nativa, feedback, `prefers-reduced-motion`. Servir HTML e JS sem dependência de build. O Cloudflare confirmou Worker enviado, subdomínio habilitado e deployment da versão 100%; verificações HTTP por clientes externos ficaram impedidas por timeout/rede do ambiente de QA.
