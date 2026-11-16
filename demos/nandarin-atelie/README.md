# NandaRin Ateliê — prévia interativa de encomendas

## Escopo
Demonstração comercial **não oficial** e isolada de @nandarin.atelie. Não é serviço contratado, não transmite pedidos e não usa fotos ou logotipo do perfil.

## Como testar — zero digitação
1. **Portfólio:** explore 6 ilustrações originais de peças fictícias, filtre estilos e selecione **Simular esta peça**. A própria demonstração cria uma encomenda de exemplo e abre seu acompanhamento.
2. **Acompanhamento:** a tela já abre com um pedido de exemplo e as etapas visíveis. Toque em **Avançar uma etapa** para visualizar o progresso ou **Criar encomenda de exemplo** para gerar outra simulação com um toque.
3. **Gestão demo:** selecione uma encomenda, altere a etapa e toque em **Salvar atualização de exemplo**; na mesma janela do navegador, volte à tela Acompanhamento para ver a mudança. **Recomeçar a demonstração** restaura o estado inicial.

Não há códigos para buscar, copiar ou digitar, cadastro ou campos obrigatórios. Os exemplos têm IDs internos que não aparecem para o visitante.

## Limites e segurança
Tudo é simulado e fica exclusivamente em localStorage com prefixo 77-demo:nandarin-atelie:v2, sem servidor, sincronização entre aparelhos, autenticação, pagamento, nome completo, medidas reais, contato ou mensagens. A visão Gestão demo só é aberta porque não tem acesso a dados reais.

## Engenharia
Arquivo: demos/nandarin-atelie/index.html. Projeto isolado, sem tocar na aplicação Next.js multi-tenant canônica. Para transformar em produto, exigir autorização e adaptar tenant, permissões e isolamento de dados. Ver DESIGN.md.

## Aceite
Checagem de sintaxe JS passou. Preview Cloudflare é autônomo; publicação verificada por rota e título. Teste visual por viewport e teste end-to-end de interações continuam sujeitos a checagem no navegador; não afirmar homologação plena sem estes checks.
