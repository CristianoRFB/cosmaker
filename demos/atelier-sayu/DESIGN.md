# Em Cena — demo para avaliação comercial do ateliê @atelier_sayu
Data: 2026-11-03
Nível: DEMO_INTERATIVA_EFEMERA com dados locais persistidos SOMENTE no navegador (localStorage).
Identidade: fictícia e independente; sem marcas, logos, fotografias ou peças do lead.
## Evidência do print
Perfil Instagram @atelier_sayu; bio Fashion Design / Figurinista, Cosmaker/Cosplayer e “Agenda aberta para 2027”. Print exibe cerca de 3,2 mil seguidores e 108 posts (captura, não validação externa). Linktree existente; não presumir carência de site ou receita.
## Hipóteses / produto
Dores a VALIDAR: dispersão das referências por DM, dificuldade de acompanhar etapas e visibilidade de capacidade da agenda. Prioridade comercial MÉDIA: fit alto para orçamento e andamento, mas sem prova de volume de encomendas ou investimento.
Vitrine → solicitação (apelido e ideia inventados) → código FIG-... → acompanhamento; Produção → avançar/retroceder etapa; Gestão → fila e configuração da vitrine.
## Direção visual
Adjetivos: editorial, artesanal, acolhedor. Público: cosplayers e clientes de figurino autoral.
Canvas #f3eee6; superfícies #fffdf9; tinta #24332e; primária #29473b; ação #b65e43; borda #d9d5cc. Fontes Georgia + Trebuchet/Arial fallback. Layout mobile-first com breakpoints 370/650/900, grade adaptável e botões touch 45+ px.
Imagens: SVG autoral de figurino e manequins CSS ilustrativos, sem assets externos. Motion 200ms, reduzido via prefers-reduced-motion.
## Fronteiras
- Formulário NÃO envia dados para o lead nem Cloudflare, apenas ao localStorage do visitante. Não digitar dados pessoais reais.
- Três visões NÃO sincronizam entre diferentes computadores/navegadores, apenas mesma origem/perfil e abas via evento storage.
- Sem autenticação, pagamentos, cálculo de preço, calendário real, notificações ou backend. Gestão é simulação pública NÃO operativa.
- Modo demo sinalizado em todas as visões. Para produção, exigir RBAC, servidor, políticas de privacidade, persistência tenant-aware, envio protegido e permissões de uso da marca.
## Critérios de aceite
Navegar por ?view=cliente, ?view=atelie e ?view=gestao; criar pedido fictício, consultar código, mudar etapa, editar copy da vitrine, exportar CSV e reiniciar demo; verificar celular, desktop, contraste e teclado.