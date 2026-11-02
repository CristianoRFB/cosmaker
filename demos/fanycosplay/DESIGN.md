# DESIGN — Fany Atelier (conceito não oficial)
Premissas: perfil confirma costura cosplay, Zona Sul São Paulo, agenda fechada e 13 anos de experiência informados na bio. Todo resto é proposta.
Objetivo: em 30s demonstrar portfólio elegante e acompanhamento da confecção, sem pressionar agenda fechada.
Direção: editorial, artesanal, teatral.
Paleta: fundo escuro #151112, vinho #6c2038, marfim #f8f5ee, ink #282021, dourado #b89b6c; surfaces #fffdf8; lines #e8e0d8.
Tipografia: Playfair Display (títulos), DM Sans/Manrope (texto/ações); fontes Google Fonts com fallback Georgia/Arial. Fontes carregadas por CSS remoto; se indisponíveis, fallback legível.
Grid: max 1240px; spacing 4/8/12/16/24/32/48/64; quebrar para mobile <=760px; touch 44px+.
Mídia: vetores SVG originais e arte CSS; nenhuma foto, logotipo ou personagem protegido extraído do Instagram.
UX: navegação entre Portfolio, Cliente e Gestão no cabeçalho; legenda permanente de demo não oficial; portal visualiza progresso, aprovação; gestão altera estágio, cadastra projeto e muda agenda localmente.
Estados: projeto vazio no quadro, ações desativadas, confirmação de reset, feedback toast, foco visível, reduced motion.
Tecnologia da demo: HTML/CSS/JS sem backend; localStorage por navegador compartilhado entre as visões; cross-device e multiusuário não sincronizam.
Não implementado: login, controle de acesso real, upload, notificações, integração com sistema Cosmaker OS ou Firebase. Endereços de Instagram referenciam o perfil real sem coletar dados.
