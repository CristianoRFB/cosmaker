# DESIGN — Sakurai / V3 · RFB

## Diagnóstico confirmado
A artista disse que irá encerrar encomendas. Tem os cosplays **Caitlyn / Arcane** e **Franco / Hexatombe** concluídos (Franco tem mais material), planeja **Coco / Witch Hat Atelier** e **Gwayne / A Vigília**, quer diários de processo, pequenos tutoriais, referências citadas, moldes, photocards, pôster autografado e buildbooks. Também deseja transmitir paleta/uso de marca ao desenvolvedor. Nada aqui implica venda de mercadorias ou serviços.

## Jornada prioritária
Visitante: reconhecer a identidade da artista → ver Franco e Caitlyn → abrir fotos → explorar processo → conhecer referências e criações futuras → seguir/collab por canal oficial.

Artista (simulação local): clicar Paleta → ajustar RGB, HEX ou seletor → visualizar atualização em toda a UI → alternar modo claro/escuro → restaurar rosa ou copiar cores → usar e-mail com anexos para mandar manual da marca.

## Decisões visuais
- Direção editorial dark, preto ameixa, rosa-base `#E86A9F`, tom autoral sem logomarca copiada. Modo claro alterna superfícies sem eliminar cor da artista.
- Tipografia Space Grotesk/DM Sans com fallbacks, ritmo de layouts alternando imagens grandes, grade e seções textuais.
- Paleta semântica `--brand`, `--brand-deep`, `--brand-soft`, `--brand-faint`, `--brand-lift`, `--on-brand`. Derivação por mistura em RGB e cálculo de contraste entre texto preto/branco no botão principal.
- 320–1440 px; controles touch ≥44 px, skip link, Escape para modal, `aria-pressed`, `aria-live`, labels RGB, respeita `prefers-reduced-motion`.
- Não confundir exemplos de tutorial com tutorial real, conceitos futuros com realizados, arte de referência com criação original, ou merch com loja.

## Estados e testes
- Filtros Todos, Cosplay, Bastidores, Detalhes & referências; modal galeria com anterior/próximo, texto específico e fechamento.
- Tutorial modal com conteúdo ilustrativo explicitamente marcado.
- Paleta + RGB + HEX validação de entrada; reset e modo independentes; persistência local. Erro de HEX mostra mensagem e mantém cor válida.
- Imagens 660×660 WebP tratadas conservadoramente; versões originais devem substituir antes de produção.
- Rotas estáticas sem login; QA local de 7 larguras, interações, integridade WebP e revisão visual em claro/escuro.

## V4 — mídia real e créditos
- Novo retrato fornecido (865×1536 de origem) exibido no hero e no arquivo; cartão usa miniatura WebP 550×976 e modal serve WebP 865×1536. Não se aplica upscale artificial.
- Vídeo fornecido (52,82 segundos, 1276×720 H.264/AAC) em seção de processo, transcodificado para 960×542 H.264/AAC, faststart, 3,3 MB; autoplay silencioso, controles para áudio, pausa e reprodução explícita. No modo de movimento reduzido não inicia automaticamente.
- Autoria separada: cosplay e criação atribuídos a @sakurai_cosmaker; foto, gravação e edição permanecem com créditos a confirmar. A demo não atribui propriedade de fotografia a quem não foi identificado.
- Mídia fica na demo isolada, sem enviar a terceiros ou alterar o produto canônico; não coletar dados.

## V6 — Interface por personagem
- Jornada solicitada: moldura com foto e nome → clique/toque/Enter no cartão → página do projeto → fotos e processo → voltar ou ir para outro personagem.
- Franco/Caitlyn são concluídos; projetos futuros sem imagens originais permanecem como ideias.
- Cartão link com foco visível, alvo amplo, contraste e comportamento reduzido conforme mídia de acessibilidade.
- Imagens já fornecidas e créditos em estado pendente por autor quando necessário. Não se atribui autoria de fotografia nem de arte de referência sem confirmação.

## V9 — Caitlyn, buildbook de exemplo

**Jornada:** cartão Caitlyn → ficha com referência rotulada → explorar materiais pelo visual → inventário pesquisável → prop 100% cenográfico → capítulos narrativos de processo → impressora → voltar ao portfólio.

**Direção:** editorial de produção com tons azul-noite/dourado aplicados à ilustração de referência, preservando a paleta global configurável. Layout 2 colunas no desktop e 1 coluna no mobile; controles touch de ao menos 34 px nos hotspots e 44 px nos filtros; animação secundária respeita movimento reduzido. Sem números, datas ou métodos apresentados como evidência real. Sem arma funcional, sem técnicas de construção de arma real.

**Critérios de aceite:** 14 cartões coerentes, busca e filtro sem resultados, modal por peça, hotspot ativo, teclado nas etapas, navegação interna, sem scroll horizontal em 320/390/768/1440; teste em tema escuro/claro, sem erros JS. Diferenciar visualmente exemplo de acervo real.
