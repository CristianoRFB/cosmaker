#!/usr/bin/env node
/** Read-only preflight. Never connects to Firebase or changes customer records. */
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { assessReadiness } from './lib/real-tenant-readiness.mjs';

function parseFlags(args){
  const values={};
  for(const arg of args){
    const position=arg.indexOf('=');
    if(!arg.startsWith('--')||position<3)throw new Error('Use --chave=valor.');
    const key=arg.slice(2,position);
    if(!['file','require'].includes(key)||Object.hasOwn(values,key))throw new Error('Parâmetro inesperado ou duplicado.');
    values[key]=arg.slice(position+1);
  }
  if(!values.file||!/^onboarding\/candidates\/[a-z0-9-]+\.json$/.test(values.file))
    throw new Error('Informe --file=onboarding/candidates/<slug>.json. Não use caminhos externos.');
  if(values.require&&!['provisioning','publication'].includes(values.require))
    throw new Error('Use --require=provisioning ou --require=publication.');
  return values;
}

async function main(){
  const args=parseFlags(process.argv.slice(2));
  const location=resolve(process.cwd(),args.file);
  const rel=relative(process.cwd(),location);
  if(rel.startsWith('..'+sep)||rel==='..')throw new Error('Arquivo fora do repositório.');
  if((await stat(location)).size>32768)throw new Error('Manifesto acima do limite.');
  const report=assessReadiness(JSON.parse(await readFile(location,'utf8')));
  console.log(JSON.stringify(report,null,2));
  if(args.require&&!report[args.require].ready)process.exitCode=2;
}
main().catch(error=>{
  console.error('Readiness bloqueado: '+(error instanceof Error?error.message:'erro desconhecido'));
  process.exitCode=1;
});
