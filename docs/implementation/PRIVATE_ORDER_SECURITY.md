# Pedido privado — consolidação de autorização (24/10/2026)

Situação: **correções testadas localmente; não é aceite global F5**. O último checkpoint anterior é6c4586a259bf018532975f0f14d968af99fab5b7.

Teste vermelho reproduziu consulta direta de recebimento em pedido legado sem UID por conta com o mesmo e-mail, apesar de o CRM associar o endereço a outro UID. A listagem já recusava esse caso; o endpoint direto ainda aceitava. Outro teste vermelho confirmou o mesmo fallback no Firestore raw. Fixtures são exclusivamente sintéticas, demo-cosmaker.

Pedidos existentes agora exigem vínculo durável por clientUserId ou clientId→CRM.userId. UID vazio/malformado, CRM ausente/contraditório e tenant divergente falham fechados. Uma conta não ganha um pedido porque reutilizou seu endereço de contato. O helper servidor é compartilhado por mensagens, pagamentos, listagem de anexos, bytes de anexos/fotos, revisões e respostas de produção. As Rules usam os mesmos requisitos de UID para subdocumentos autorizados. Propostas ainda sem aprovação mantêm o contrato separado de convite; não são pedidos históricos.

Pedidos legados sem vínculo continuam guardados e acessíveis à equipe com permissão; o cliente depende de revisão deliberada do vínculo pelo ateliê. Não há backfill automático por e-mail, exclusão, migração de dados reais ou reatribuição silenciosa de histórico. UID confiável e CRM com ID diferente do UID continuam suportados mesmo após mudança de e-mail.

**Achado do snapshot interno:** teste vermelho confirmou o acesso raw ao root com custos do próprio pedido. Implementados getClientOrder com projeção allowlisted, migração do repositório e root raw somente para staff. Lista/detalhe compartilham allowlist; snapshot integral fica no banco. Backend7/7 PASS, incluindo campos internos ausentes e sessão revogada. UI portal/anexos2/2 PASS, incluindo detalhe320/375/768/1440, payload sem custos e capturas inspecionadas; regressões adicionais em andamento.

Evidências atuais e contagens completas em MASTER_FINALIZATION_PROGRESS.md. A auditoria JSON preserva os achados em resolved_findings com evidências; dependências, tokens reais e homologação continuam sem aceite global.
