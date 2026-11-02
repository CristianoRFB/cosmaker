# Aleff Silva — demos de pré-vendas

Proposta independente, não oficial. Prospecção baseada exclusivamente em print de Instagram do usuário, de 2026-11-02.

**Vistas:** `/` vitrine e formulário; `/acompanhar` portal com código; `/atelier` quadro de produção; `/gestao` gerenciador de categorias.

**Demonstração inicial:** código `AS-DEMO`. O formulário gera códigos `AS-XXXXX` e os status avançados na oficina aparecem no portal quando a mesma pessoa usa o mesmo navegador.

**Persistência:** `localStorage`, isolada. Sem banco, auth, contato com Aleff, dados de pessoas, WhatsApp, pagamento ou uso de fotos da rede social.

**Visuais:** apenas SVGs conceituais e estilos CSS. Não representam obras originais do profissional nem trabalhos licenciados.

**Deploy:** Worker independente `77-aleff-silva-conceito` sob `on7.workers.dev`, quando habilitado. Atualizações neste GitHub não promovem automaticamente ao Worker.

**Segurança:** não mergir a gestão fictícia para produção e não confundir prospect com tenant contratado. Integrar futuramente ao produto canônico só com autorização.

## Atualização baseada no retorno do Aleff — 02/11/2026

**Evidência:** mensagem de áudio do profissional, transcrita no print compartilhado pelo usuário. Aleff gostou da ideia, mas disse que investimento não é prioridade atualmente. Dor central: interessados veem uma armadura de determinado personagem e supõem que ele só fabrica o que já aparece no portfólio; o mesmo questionamento de orçamento e personagens chega repetidamente.

**Novo fluxo demonstrativo (2026-11-02):**
- Hero informa imediatamente que o portfólio não é catálogo fechado.
- Comparativo de peça já vista versus personagem desejado explica técnica e versatilidade, sem prometer fabricação de qualquer pedido.
- FAQ pré-orçamento responde perguntas repetitivas e distingue capacidades gerais de avaliação de viabilidade/preço/prazo.
- Formulário exige apenas nome do personagem ou ideia, oferece categoria/detalhes/acabamento/prazo como opcionais, e permite escolher JPG/PNG/WEBP até 5 MB para PRÉVIA LOCAL.
- A imagem não é enviada ou persistida no pedido; usa URL temporária blob apenas no navegador e é liberada ao limpar/enviar/sair. O pedido fictício guarda apenas texto, indicador de que houve uma prévia, e código no localStorage. A experiência explica expressamente esta limitação.
- Após criar um código, o botão de acompanhamento aponta para a consulta correspondente (mesmo navegador).
- Painel de oficina destaca personagem; painel de gestão tem resposta curta copiável para dúvidas de Direct, sem envios automáticos.

**Nota de segurança/UX:** proposta não oficial, sem cadastro de cliente, backend, upload, cobrança, WhatsApp, automação real ou garantia de encomenda. O portfólio usa SVGs ilustrativos próprios. O formulário só recebe dados hipotéticos na demo. Em futura contratação o upload exige endpoint autorizado, storage isolado por tenant, consentimento, política de retenção, limite, validação e proteção do acesso.

**Deploy:** branch demo isolada; Worker 77-aleff-silva-conceito publicado manualmente, não ligado ao CI do GitHub.
