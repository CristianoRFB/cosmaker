# Custo e dependências — 24/10/2026

**R$0 com billing proibido permite desenvolvimento/Emulator, mas impede publicar o produto Firebase completo.** Cota gratuita em Blaze não equivale a Spark ou a garantia de despesa zero. Nenhum billing/serviço foi ativado.

| Componente | Requisito e consequência |
| --- | --- |
| Auth/Firestore Standard | Têm cotas gratuitas; apenas esse subconjunto não executa os contratos do servidor/arquivos. Não habilitar SMS/Identity Platform adicional implicitamente. |
| Functions v2 | Fora do Spark. Cotação por execução/CPU/memória/tráfego com franquias no plano pago. Callables, bytes e trigger de pedido exigem Blaze. |
| Storage for Firebase | Blaze exigido inclusive para manter acesso ao bucket legado desde03/02/2026. Não presumir appspot.com gratuito. Bucket novo pode usar firebasestorage.app. |
| Scheduler | Referência oficial US$0,10/job/mês; franquia de3jobs por conta Google. Conferir franquia compartilhada; execução da função continua sujeita a cobrança. |
| Eventarc/PubSub | Dependências do trigger Firestore v2, com cotas/cobrança Cloud. Scheduler v2 real usa HTTP/OIDC; PubSub do teste local não é sua homologação. |
| Build/Registry/logs | Quotas/excedentes e retenção próprios; imagens acumuladas/builds também custam. Não ativar exclusão automática sem aprovar janela de rollback. |
| Host Next15 | Hosting estático tem franquia, mas não atende sozinho às rotas dinâmicas atuais. App Hosting exige Blaze. Nenhuma oferta gratuita comercial foi presumida. |
| Backup real | Export/import gerenciado Firestore requer billing; leituras, Storage e cópias têm custos. Não é operação gratuita garantida. |

Fontes oficiais: [Firebase Pricing](https://firebase.google.com/pricing), [mudanças Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [Scheduler](https://firebase.google.com/docs/functions/schedule-functions), [Cloud Scheduler pricing](https://cloud.google.com/scheduler/pricing), [App Hosting costs](https://firebase.google.com/docs/app-hosting/costs), [Next/Hosting](https://firebase.google.com/docs/hosting/frameworks/nextjs), [Firestore export/import](https://firebase.google.com/docs/firestore/manage-data/export-import). Consulta24/10/2026; valores emUSD, sem câmbio/impostos estimados. Região, volume, retenção e franquias compartilhadas alteram o custo. Novo ingresso no experimento Hosting frameworks está encerrado na documentação consultada.

## Alternativas e decisão externa

- Manter ZERO_BILLING: demonstração e testes com Emulator em máquina existente; não oferecer Emulator como backend de produção.
- Futuramente autorizar consumo: responsável deve revisar estimativa/região/quotas/alertas e registrar autorização. Preflight só consulta billing. Alertas não garantem teto global de gasto.
- Host gratuito só para frontend não elimina os três componentes obrigatórios. Outro backend exigiria reimplementar contratos; não é alternativa equivalente dentro deste mandato. Não reduzir segurança para economizar.

**Pendente:** responsável escolher entre preservar a restrição atual ou autorizar infraestrutura por consumo em sessão futura. Nenhum upgrade é recomendado/executado automaticamente. Preços/planos Global Standard v01 permanecem intactos.

## Upstream

CLI instalado/latest consultado15.34.1; dispatcher PubSub só aceita event/cloudevent e rejeita http. Nenhuma correção oficial compatível identificada; transporte continua bloqueado, sem reensaio idêntico. Storage8.4.0/teeny-request11.1.1 continuam latest consultados, sem patch para o aviso conhecido. Auditoria final GOAL V somente leitura confirmou prod raiz/Functions0 e root completo5moderados de ferramentas/0altos/críticos; não foi feito audit fix. [Triagem](../../implementation/DEPENDENCY_SECURITY_REVIEW.md).

Google: política efetiva segue sem apis.google.com; [evidência](../../implementation/security/GOOGLE_EMULATOR_RETRY_2026-10-24.json). Não repetir antes da aplicação da permissão.
