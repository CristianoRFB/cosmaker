# Sakurai — portfólio editorial (DEMO independente)

Proposta de portfólio artístico **não oficial** para a cosplayer e cosmaker @sakurai_cosmaker, desenvolvida para o projeto 77.

## Escopo
- Página pública de projeto artístico com galeria filtrável, 12 registros, detalhes em diálogo e links de Instagram, Linktree e e-mail.
- **Não** há recebimento de encomendas, orçamento, área de pagamento, login ou banco de dados.
- Base estática HTML/CSS/JS, sem dependências de runtime e sem tocar no Cosmaker OS real.
- A agenda de encomendas está fechada; a artista informou intenção de encerrá-las definitivamente.

## Imagens
Os recortes `images/*.webp` foram extraídos **dos prints enviados pelo usuário** na conversa, não baixados de redes sociais nem apresentados como arquivos originais. Precisam ser substituídos por fotografias em alta resolução fornecidas/autorizadas pela artista antes de se declarar portfólio oficial ou produto final. A imagem `caitlyn-arte.webp` é apenas referência visual repostada e **não é atribuída** como arte da Sakurai. Nenhuma biografia ou feito não verificado foi inventado.

## Execução e testes
Abra `index.html` ou sirva a pasta com `python -m http.server 8080`.
Teste navegação por âncoras, filtros, abertura/fechamento de diálogo (Esc, backdrop), links externos, 320/360/390/430/768/1024/1440 px e foco por teclado.

## Arquitetura / RFB
Arte editorial em preto, pêssego queimado e off-white; hierarquia intencional, experiência mobile-first, objetivo único de **apresentar os trabalhos**. Deploy isolado em Worker estático recomendado, e mudanças na vertical somente por PR. Landing comercial do desenvolvedor não deve confundir-se com oferta da artista.
