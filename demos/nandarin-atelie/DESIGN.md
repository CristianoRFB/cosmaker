# DESIGN — NandaRin Ateliê (prévia conceitual, não oficial)
Data: 2026-11-02 · Vertical: Cosmaker OS · Estabelecimento: @nandarin.atelie

## Evidência e limites
Perfil fornecido pelo usuário: “NandaRin • Cosmaker”, 45 posts, 840 seguidores, “Cosmaker e Designer de Moda”, “Cosplays e figurinos sob medida”, “Envio para todo o Brasil”. Fotografia visível de figurinos em manequins, com predominância de tecidos rosa, lavanda, amarelo e ornamentos. Contagens são um instantâneo da captura, não métricas atualizadas. Sem confirmação independente de cidade, agenda, preço, materiais, processo interno, vagas, ferramenta de gestão, autorização de uso de imagens ou parceria. Comparação pública setorial: vários ateliês solicitam referências, personagem e datas antes de orçar, mas isso não confirma o processo da NandaRin.

## Objetivo e públicos
Visitante: explorar uma vitrine que valorize o acabamento e entender como seria enviar referência para orçamento. Comprador: visualizar o andamento de uma encomenda fictícia sem precisar perguntar pelo Direct. Gestor: visualizar pedidos e atualizar etapas em sandbox. Tarefa principal: simular pedido e consultar código, em 90 segundos.

## Direção de arte
Personalidade: artesanal, delicada, editorial. Não é identidade oficial.
Papel → cores: canvas #fffaf6; surface #ffffff; tint #fff2e9; ink #43283d; primary #b24f79; muted #775c6d; stroke #ead9d9; success #38654c; warning #fff8e9. Tipografia local Georgia para títulos (editorial) e system-ui para leitura e formulários. Ritmo 4/8/12/16/24/32/48/80px. Layout de 4 colunas mobile e 12 desktop, cartões 2 colunas mobile 390px e 3 desktop. Cantos menores para enquadrar imagem, CTA em pílula para calor humano. Sem fontes importadas.

## Componentes e imagens
Header sticky + navegação por três visões; hero em duas colunas; card visual com ilustração SVG artesanal; filtros por categoria; formulário; código do pedido; timeline; fila operacional; editor de estágio e nota; aviso DEMO. Arte original vetorial gerada em código com temas cromáticos; nomes e trajes inventados. Não replica fotos, logos ou obras protegidas do Instagram. O estilo conversa com a foto enviada, mas não reivindica fidelidade oficial.

## Microinterações e estados
Troca de visões/filtragem, seleção de card pré-preenche referência, confirmação com código, consulta de etapa, edição administrativa atualiza rastreio no mesmo navegador. Estados: sem código, código inexistente, formulário inválido, pedido criado, lista de pedidos, reset com confirmação. Touch targets tipicamente >=44px. Foco visível; rótulos em todos os campos; ARIA live para resultados; reduced motion suportado.

## Segurança e implementação
O arquivo demos/nandarin-atelie/index.html é HTML/CSS/JS standalone, sem SDK ou backend. Tenant demo isolado por prefixo localStorage 77-demo:nandarin-atelie:v1; dados fictícios. Sem autorização de atendimento real, sem WhatsApp, e-mail, pagamento, login, upload, coleta de contatos, API nem contas reais. O acesso ao painel é público exclusivamente porque não há backend/segredos. Não afirmar sincronização entre dispositivos ou processamento real.

## Adoção futura na vertical
GLOBAL: layout acessível, estados, UX. VERTICAL: portfólio, solicitação de orçamento, medição, acompanhamento da produção. LOCAL: cores, marca textual, perfil, portfólio (após autorização), regras e disponibilidade. Antes de conectar ao Cosmaker OS, migrar para componentes Next.js, usar atelierId resolvido no backend e autenticação/permissões por papel; rever Firestore/Storage Rules, upload, antifraude, consentimento e LGPD.

## Checklist de aceite / ainda não homologado
- Filtros e detalhes; formulário/validação/código; acompanhamento; gestão e reset.
- Conferir visual e overflow em 320, 360, 390, 430, 768, 1024, 1440px.
- Auditar teclado/leitor de tela, servidor, rota e preview quando publicado.
- Sem preço de venda, avaliações, prazos ou garantias fictícios apresentados como fatos.
