# DESIGN — RS3DMaker · Prospecção (não oficial)
Data: 2026-11-02 | Status: **DEMO** | Fonte direta: print do Instagram @rs3d.maker fornecido pelo usuário.
## Evidências
Perfil verificado no screenshot: RS3DMaker; descrição "Personalizados que dão vida às suas ideias"; foco universo geek, presentes exclusivos, orçamento no Direct; destaques Chaveiros/Colecionáveis/Nossa Loja. Publicações visíveis de chaveiros, peças impressas em 3D, brindes personalizados. Perfil cita WhatsApp, mas número não foi fornecido. Nenhum preço, localização exata, política comercial ou integração comprovada.
## Hipóteses comerciais (não apresentadas como fatos)
Encontrar ideias no Instagram pode exigir navegar muito; resumir solicitações reduz idas e vindas; enxergar estágios reduz perda de contexto da produção. Validar com a loja antes de vender qualquer melhoria.
## Direção
Três palavras: **geek, artesanal, elétrico**. Paleta "Oficina digital": canvas #08111f, surface #122135, ink #eff8ff, primary #65e5e9, muted #a8c0d2, orange-focus #ffb779. Tipografia Space Grotesk (títulos), DM Sans (corpo), ambas com fallback de sistema. Movimento discreto 180ms; redução de movimento respeitada.
## Jornadas
1. Vitrine -> escolha temática -> descrição/quantidade/prazo -> resumo copiável -> Instagram oficial.
2. Visão da gestão -> cartões demonstrativos por etapa -> detalhes -> avançar etapa.
3. Simulação local: formulário adiciona um pedido somente ao armazenamento deste navegador. Não é envio real e não há backend, autenticação, cobrança, login, contato coletado ou dados de cliente.
## Público e componentes
Cliente interessado em presentes geek, lembrancinhas, chaveiros e colecionáveis. Gestor/atendente apenas em modo demonstrativo. Botões min 44px, inputs com labels, foco visível, HTML semântico, cores de estado com legenda escrita. Breakpoints 390 / 680 / 900 px; grids adaptáveis. Imagens de produto são EMOJI ilustrativos e SVG original; sem uso das fotografias do Instagram sem autorização.
## QA esperado
Testar cliente/gestão; cards, radios, campos obrigatórios, copiar mensagem, navegação e back; 320, 360, 390, 430, 768, 1440px; sem precios/estoque/reviews inventados. Acesso ao painel é propositalmente público porque contém dados fictícios; **não reutilizar este painel para dados reais**.
## Integração futura
A concepção pode alimentar configuração white-label e um intake seguro do Cosmaker OS, após validação de escopo, direitos de imagem, RBAC, tenant e custos. Não conecta nem altera o Cosmaker OS atual.