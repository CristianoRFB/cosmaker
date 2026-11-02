# DESIGN — NandaRin Ateliê · V2 UX sem código

## Evidências (captura enviada em 02/11/2026)
Perfil: “NandaRin • Cosmaker”; designer de moda, cosplays e figurinos sob medida, envio nacional anunciado. Imagens mostram trabalhos em manequins, tecidos rosa, lavanda, amarelo, laços e acabamentos; números de seguidores/posts representam apenas a captura. **Não** foram confirmados preços, localização, disponibilidade, catálogo oficial, processos internos, uso de sistemas, ou autorização de marca/portfólio.

## Objetivo da V2
O visitante entende **o que ganha** com um acompanhamento visual sem ter que digitar códigos ou entender termos técnicos. A sequência agora é:
1. Portfólio com imagens ilustrativas e CTA "Simular esta peça".
2. Acompanhamento abre automaticamente com um exemplo visível, etapa atual e linha do tempo.
3. Com um clique, avançar etapa; ou abrir a gestão e atualizar a etapa/nota, voltando ao acompanhamento na mesma janela.
4. Gerar nova solicitação de exemplo em um clique se desejar; sem formulário obrigatório, login, código de pesquisa ou cópia/colagem.

## Direção visual
Artístico, delicado, editorial. Paleta proposta, **não oficial**: marfim #fffaf6, superfície #fff, plum #43283d, rosa #b24f79, rosa claro #f6d6db, linhas #ead9d9. Títulos Georgia, UI system font. Responsivo; foco visível; botões grandes; reduced motion; conteúdo direto. Artes de manequins são SVGs originais e peças fictícias, não fotos do Instagram.

## Modelo de demo
Somente HTML/CSS/JS. Prefixo isolado localStorage: 77-demo:nandarin-atelie:v2. ID interno técnico não é exibido na UI. Nenhum pedido real, coleta de dados, autenticação, cobrança, status sincronizado, webhook, e-mail ou contato externo. Aviso "prévia não oficial" sempre visível. Gestão liberada só porque é uma simulação desconectada.

## Qualidade e risco residual
Fluxos: botão do portfólio gera exemplo; acompanhamento já populado; avançar etapa; nova solicitação em um clique; gestão altera nota e etapa; reset confirma. Revisão de sintaxe JS e estrutura realizada. Pendências antes de declarar homologado: capturas/testes em 320/360/390/430/768/1024/1440, teclado e navegação E2E por navegador.

## Integração futura
Não migrar demonstração para produção nem criar tenant real sem contratação e autorização. Produto canônico Cosmaker OS: resolver atelierId no backend, role-based permissions, isolamento de pedidos/medidas, autenticação e LGPD.
