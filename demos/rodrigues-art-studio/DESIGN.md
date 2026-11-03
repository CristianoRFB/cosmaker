# DESIGN — Rodrigues Art Studio · DEMO não oficial

## Evidências e limites
Referência: print de Instagram enviado em 02/11/2026, perfil @rodrigues.3d, nome Rodrigues Art Studio, RJ, miniaturas, figures, estátuas, games, animes, filmes e pintura. O link beacons.ai/guixts foi visto no print, mas não foi possível confirmar o conteúdo. Nomes semelhantes em buscas públicas NÃO foram tratados como o mesmo negócio. Preços, prazos, materiais e contatos externos são desconhecidos.

## Objetivo
Apresentar em até 90 segundos a possibilidade de uma vitrine digital com encomendas personalizadas e painel simples de gestão.

## Direção de arte
Personalidade: cinematográfico, artesanal, editorial. Referência atmosférica: exposições de arte e colecionáveis, fundo carvão, cobre e papel creme. NÃO é uma identidade oficial.
- Cores: night #151613; night2 #22231f; canvas #f3f0e8; paper #fbf8f1; cobre #c67757; copper dark #a45337; line #dad9cf; success #2a785a.
- Tipografia: Playfair Display (títulos), DM Sans (texto) e Manrope (interface), com fallback local.
- Espaçamento: escala de 8 a 64px; largura máxima 1440px; padding horizontal responsivo; botões acessíveis a toque; bordas discretas de 3–6px.

## Jornada principal
1. Visitante abre a vitrine e explora galeria com filtro e detalhes de peças conceituais.
2. Cria solicitação simulada (categoria, tamanho, acabamento, ideia, apelido opcional).
3. Recebe código local e abre o acompanhamento.
4. Gestor abre #gestao, visualiza fila, filtra e altera etapa.
5. Visitante consulta status atualizado no mesmo navegador.

## Direitos e simulação
Três ilustrações vetoriais criadas para esta demo; não são fotos ou trabalhos reais. Não houve coleta de imagens do Instagram. Nenhum preço real, compra, mensagem, pagamento ou contato foi realizado. Sem upload, conta, backend, CRM real, persistência compartilhada ou autorização de uso de marca oficial. Dados ficam no localStorage do navegador; fallback em memória quando indisponível.

## QA e acessibilidade
Implementar e conferir layout em 320/360/390/430/768/1024/1440px. Navegação acessível a teclado, foco visível, filtros aria-pressed, modal nativo fechável pelo Escape, formulário com validação e mensagens aria-live, reduced motion. Testar hash routes #inicio, #portfolio, #processo, #encomenda, #acompanhar e #gestao. Recurso demonstrativo sem login porque NÃO há dados reais.

## Produção e white-label
GLOBAL: componentes de formulário, estado, modal e feedback.
VERTICAL: catálogos de peças, orçamento por referência, fila de encomendas, etapas de fabricação e pintura.
LOCAL: nome/identidade/portfólio/estilos do artista.
Antes de implantar: obter consentimento do artista, imagens licenciadas, backend multi-tenant seguro, regras de acesso, autenticação admin, logs, armazenamento e política de privacidade.