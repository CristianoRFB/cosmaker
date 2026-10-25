export class Fault extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
export const fail = (code, message, status) => { throw new Fault(code, message, status); };
export const id = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(v);
export const sha256 = async (v) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', typeof v === 'string' ? new TextEncoder().encode(v) : v))].map(b => b.toString(16).padStart(2, '0')).join('');
export function localConfig(env) {
  if (env.MODE !== 'emulator' || env.PROJECT_ID !== 'demo-cosmaker') fail('failed-precondition', 'Adaptação experimental habilitada somente em demo-cosmaker local.', 503);
  const result = {};
  for (const name of ['AUTH_ORIGIN', 'FIRESTORE_ORIGIN', 'DATABASE_ORIGIN']) {
    let u; try { u = new URL(env[name]); } catch { fail('failed-precondition', 'Emulador local ausente.', 503); }
    if (u.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) || !u.port || u.username || u.password || u.pathname !== '/' || u.search || u.hash) fail('failed-precondition', 'Destino não local recusado.', 503);
    result[name] = u.origin;
  }
  return { ...result, project: env.PROJECT_ID };
}
// Enforced application budget, including retries. Waiting on I/O is not CPU time.
export class Budget {
  count = 0;
  async fetch(url, init) {
    if (++this.count > 46) fail('resource-exhausted', 'Orçamento de subrequests esgotado.', 429);
    return fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10_000) });
  }
}
export function only(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !fields.includes(k))) fail('invalid-argument', 'Campos inválidos.');
  return value;
}
export function date(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
}
