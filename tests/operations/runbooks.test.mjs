import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';

test('Windows runbooks contain valid PowerShell7 syntax and existing local links', () => {
  const directory = 'docs/operations/pre-homologation';
  let blocks = 0;
  for (const name of readdirSync(directory).filter(name => name.endsWith('.md'))) {
    const file = resolve(directory, name); const source = readFileSync(file, 'utf8');
    for (const [, body] of source.matchAll(/```powershell\r?\n([\s\S]*?)```/g)) {
      const encoded = Buffer.from(body).toString('base64');
      const command = `$tokens=$null; $errors=$null; $null=[System.Management.Automation.Language.Parser]::ParseInput([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')),[ref]$tokens,[ref]$errors); if($errors.Count){$errors | ForEach-Object {$_.ErrorId}; exit 1}`;
      const result = spawnSync(process.env.COSMAKER_PWSH || 'pwsh', ['-NoLogo', '-NoProfile', '-Command', command], { encoding: 'utf8', timeout: 30_000 });
      assert.ifError(result.error); assert.equal(result.status, 0, `${name}: ${result.stdout} ${result.stderr}`); blocks++;
    }
    for (const [, link] of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      if (/^(?:https?:|mailto:|#)/.test(link)) continue;
      assert.doesNotThrow(() => readFileSync(resolve(dirname(file), link.split('#')[0])), `${name}: link ausente ${link}`);
    }
  }
  assert(blocks >= 8, 'Validar os comandos, não um diretório vazio.');
});
