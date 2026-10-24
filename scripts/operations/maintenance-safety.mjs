/** Guard legacy maintenance entrypoints before initializing Admin or connecting. */
export function maintenanceIntent({ operation, projectId, services, args = process.argv.slice(2), env = process.env }) {
  const apply = args.includes('--apply');
  if (!apply) return { mode: 'DRY_RUN', operation, targetConfigured: Boolean(projectId), remoteContacted: false, writesExecuted: false };
  if (!projectId) throw new Error('Escrita exige projeto explícito.');
  const endpoints = services.map(service => env[service]);
  if (projectId === 'demo-cosmaker' && endpoints.every(endpoint => /^(127\.0\.0\.1|localhost):\d{1,5}$/.test(endpoint || '') && Number(endpoint.split(':').at(-1)) <= 65535)) {
    return { mode: 'EMULATOR_APPLY', operation };
  }
  if (projectId.startsWith('demo-') || endpoints.some(Boolean)) throw new Error('Projeto/endpoints de Emulator inconsistentes; escrita recusada.');
  if (!args.includes(`--confirm-project=${projectId}`) || env.COSMAKER_CONFIRM_REAL_PROJECT !== projectId
    || !/^\S{12,}$/.test(env.COSMAKER_REAL_OPERATION_AUTHORIZATION || '')) {
    throw new Error('Escrita real bloqueada: exige --apply, projeto confirmado na CLI e no ambiente, autorização específica e preflight/backup revisados no roteiro operacional.');
  }
  return { mode: 'EXPLICIT_REAL_APPLY', operation };
}
