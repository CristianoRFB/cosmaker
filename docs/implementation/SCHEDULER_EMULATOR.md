# Scheduler de expiração no ambiente local

Com o runtime completo de `cloud-start.sh` ativo e Functions compiladas:

```bash
bash scripts/cloud-run.sh npm run test:scheduler
```

O script gera fixtures inteiramente fictícias, invoca o handler HTTP do scheduler v2 no Functions Emulator, confere resultados e remove somente os dados do ensaio. Valida expiração após o dia UTC, hoje/futuro preservados, isolamento dos namespaces A/B, datas inválidas e coleção externa preservadas, solicitação com versão mais nova e repetição sem auditoria duplicada. As variáveis de Firestore/PubSub devem apontar a `127.0.0.1`, e o projeto é fixo `demo-cosmaker`.

O Firebase CLI 15.32 registra essa função de schedule v2 internamente como `expireQuotes-0`. Essa rota é exclusiva do Emulator; não é uma API pública adicionada ao produto. O teste envia os headers do Cloud Scheduler ao wrapper HTTP existente. Em Firebase real, o disparo exige Cloud Scheduler/IAM devidamente homologados e autorizados, ausentes neste escopo.

## Limitação comprovada de Pub/Sub

Publicar no tópico local `firebase-schedule-expireQuotes` foi aceito pelo Pub/Sub Emulator, mas o Firebase CLI registrou `Unsupported trigger signature: http` e confirmou a mensagem sem executar o handler. `pubsubEmulator.js` só trata assinaturas `event` e `cloudevent`, enquanto o scheduler v2 usa `http`. Portanto **PUBSUB_TRANSPORT=BLOCKED**, não PASS. O ensaio opcional sem `--http` mantém essa evidência reproduzível, mas não deve ser repetido indefinidamente. Não há monkey patch de SDK/CLI para disfarçar a limitação.

O primeiro endereço HTTP sem sufixo retornou 404; a lista de triggers e o código do CLI indicaram a rota local `-0`. A invocação HTTP nessa rota executou o backend e revelou que uma data inválida era expirada. A correção valida datas e restringe documentos a `ateliers/{id}/quotes/{id}`, com requestId válido e total consistente. O ensaio HTTP posterior passou. Esse PASS é de lógica/integração HTTP local; não prova transporte Pub/Sub, relógio agendado nem configuração de produção.
