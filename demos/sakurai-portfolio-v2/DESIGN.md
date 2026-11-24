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
