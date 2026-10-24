import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const inventoryPath = resolve(root, 'docs/implementation/FUNCTIONAL_INVENTORY.json');
const reportPath = resolve(root, 'docs/implementation/FUNCTIONAL_COMPLETION.md');
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
const ledger = JSON.parse(await readFile(resolve(root, 'docs/implementation/security/EVIDENCE_LEDGER.json'), 'utf8'));
assert.equal(inventory.assessment, 'EVIDENCE_REVIEWED_LOCAL');
assert.equal(inventory.unitWeight, 1);
assert.equal(inventory.operations.length, 47, 'Preservar o conjunto congelado antes da medição.');
assert.equal(new Set(inventory.operations.map(({ id }) => id)).size, 47);
const frozenSet = inventory.operations.map(({ id, domain, operation }) => ({ id, domain, operation }));
assert.equal(createHash('sha256').update(JSON.stringify(frozenSet)).digest('hex'), inventory.frozenOperationSetSha256, 'O conjunto de operações mudou após o congelamento.');
assert.deepEqual(inventory.criteria, ['implementation', 'persistence', 'interface', 'negative']);
for (const [path, expected] of Object.entries(inventory.evidenceContext)) {
  const actual = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
  assert.equal(actual, expected, `Código/configuração relevante mudou; revisar evidência antes de reutilizar PASS: ${path}`);
}
const totals = { passed: 0, applicable: 0, blocked: 0, pending: 0, notImplemented: 0, notApplicable: 0 };
const domains = new Map();
for (const operation of inventory.operations) {
  assert.deepEqual(Object.keys(operation.checks).sort(), [...inventory.criteria].sort(), operation.id);
  for (const source of operation.sources) await access(resolve(root, source));
  const domain = domains.get(operation.domain) || { passed: 0, applicable: 0, operations: 0 };
  domain.operations++;
  for (const check of Object.values(operation.checks)) {
    assert(['PASS', 'PENDING', 'BLOCKED_EXTERNAMENTE', 'NAO_IMPLEMENTADO', 'NA'].includes(check.state), operation.id);
    if (check.state === 'NA') { assert(check.reason?.trim(), operation.id); totals.notApplicable++; continue; }
    totals.applicable++; domain.applicable++;
    assert(check.evidence?.length && check.evidence.every(value => typeof value === 'string' && value.trim()), `Evidência/pendência explícita: ${operation.id}`);
    for (const evidence of check.evidence) {
      if (!evidence.startsWith('EVIDENCE_LEDGER.json#')) continue;
      const record = ledger.records[evidence.split('#')[1]];
      assert(record, `Evidência inexistente: ${evidence}`);
      if (check.state === 'PASS') assert(!record.outcome.startsWith('BLOCKED'), `Bloqueio não pode aprovar critério: ${operation.id}`);
      for (const source of record.sources || []) await access(resolve(root, source));
    }
    if (check.state === 'PASS') { totals.passed++; domain.passed++; }
    if (check.state === 'BLOCKED_EXTERNAMENTE') { assert(check.reason?.trim(), operation.id); totals.blocked++; }
    if (check.state === 'PENDING') totals.pending++;
    if (check.state === 'NAO_IMPLEMENTADO') totals.notImplemented++;
  }
  const states = Object.values(operation.checks).map(({ state }) => state).filter(state => state !== 'NA');
  const expected = states.every(state => state === 'PASS') ? 'IMPLEMENTADA_E_TESTADA'
    : states.includes('BLOCKED_EXTERNAMENTE') ? 'BLOCKED_EXTERNAMENTE'
      : operation.checks.implementation.state === 'NAO_IMPLEMENTADO' ? 'NAO_IMPLEMENTADA' : 'IMPLEMENTADA_PARCIALMENTE';
  assert.equal(operation.status, expected, operation.id);
  domains.set(operation.domain, domain);
}
const percent = Number((100 * totals.passed / totals.applicable).toFixed(2));
const rows = inventory.operations.map(operation => {
  const states = inventory.criteria.map(key => operation.checks[key].state === 'PASS' ? 'PASS' : operation.checks[key].state);
  return `| ${operation.domain} | ${operation.operation} | ${states.join(' | ')} | ${operation.status} |`;
});
const report = `# Conclusão funcional local — Cosmaker OS\n\nBase de código: ${inventory.codeCheckpoint}. Revisão: ${inventory.reviewedAt}.\n\n**${totals.passed}/${totals.applicable} unidades = ${percent}%**. São 47 operações congeladas antes do cálculo, com quatro critérios de peso1: implementação compilada, persistência/integração, interface exercitada e negativos de autorização/integridade. ${totals.notApplicable} critérios não aplicáveis têm justificativa no JSON e ficam fora do denominador. Cada critério comprovado conserva seu crédito mesmo quando outro está bloqueado. Não mede esforço, cobertura exaustiva ou prontidão para clientes reais.\n\nCritérios restantes: ${totals.blocked} bloqueados externamente, ${totals.pending} pendentes de evidência local, ${totals.notImplemented} não implementados. Evidências específicas, fontes e limites estão em [FUNCTIONAL_INVENTORY.json](FUNCTIONAL_INVENTORY.json) e [EVIDENCE_LEDGER.json](security/EVIDENCE_LEDGER.json). Registros sintéticos são resumidos; não são publicados traces, capabilities, OOBs ou dados pessoais.\n\nO denominador inclui apenas o escopo funcional atual. Gateway/canais pagos e novas diferenças comerciais não aprovadas estão fora do escopo. Firebase real, inventário/revogação real, OAuth, recuperação operacional e formalização jurídica são gates de homologação separados; não desaparecem por este índice local.\n\n## Por domínio\n\n| Domínio | Operações | Unidades comprovadas/aplicáveis |\n| --- | ---: | ---: |\n${[...domains].map(([name, value]) => `| ${name} | ${value.operations} | ${value.passed}/${value.applicable} |`).join('\n')}\n\n## Operações\n\nI = implementação; P = persistência/integração; U = interface; N = negativos. PASS significa TESTADO_LOCALMENTE no critério indicado. As operações bloqueadas mantêm os demais critérios aprovados.\n\n| Domínio | Operação | I | P | U | N | Estado |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n## Indicadores separados\n\nAceite formal: **${inventory.formalMilestones.passed}/${inventory.formalMilestones.total} = ${inventory.formalMilestones.percent}%**, conforme [matriz dos 16 marcos](FORMAL_ACCEPTANCE.md). Não há aceite fracionário de fase.\n\nProntidão comercial: **${inventory.commercialReadiness}**. Nenhum resultado Emulator equivale a homologação ou autorização de produção.\n\nReproduzir/verificar: \`bash scripts/cloud-run.sh node scripts/functional-inventory.mjs\`. Após revisão das evidências, regenerar com \`--write\`. O verificador não executa testes nem converte pendências em PASS.\n`;
if (process.argv.includes('--write')) {
  inventory.functionalPercent = percent;
  inventory.units = totals;
  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  await writeFile(reportPath, report);
} else {
  assert.equal(inventory.functionalPercent, percent, 'Regenerar o relatório após revisar evidências.');
  assert.deepEqual(inventory.units, totals);
  assert.equal(await readFile(reportPath, 'utf8'), report, 'Relatório divergente do inventário.');
}
console.log(`Inventário local: ${totals.passed}/${totals.applicable} (${percent}%), ${totals.blocked} bloqueados, ${totals.pending} pendentes; comercial ${inventory.commercialReadiness}.`);
