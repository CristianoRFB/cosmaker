# Aleff Silva — demos de pré-vendas

Proposta independente, não oficial. Prospecção baseada exclusivamente em print de Instagram do usuário, de 2026-11-02.

**Vistas:** `/` vitrine e formulário; `/acompanhar` portal com código; `/atelier` quadro de produção; `/gestao` gerenciador de categorias.

**Demonstração inicial:** código `AS-DEMO`. O formulário gera códigos `AS-XXXXX` e os status avançados na oficina aparecem no portal quando a mesma pessoa usa o mesmo navegador.

**Persistência:** `localStorage`, isolada. Sem banco, auth, contato com Aleff, dados de pessoas, WhatsApp, pagamento ou uso de fotos da rede social.

**Visuais:** apenas SVGs conceituais e estilos CSS. Não representam obras originais do profissional nem trabalhos licenciados.

**Deploy:** Worker independente `77-aleff-silva-conceito` sob `on7.workers.dev`, quando habilitado. Atualizações neste GitHub não promovem automaticamente ao Worker.

**Segurança:** não mergir a gestão fictícia para produção e não confundir prospect com tenant contratado. Integrar futuramente ao produto canônico só com autorização.