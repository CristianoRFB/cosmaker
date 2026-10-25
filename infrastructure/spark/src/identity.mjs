import { decodeJwt, decodeProtectedHeader, jwtVerify } from 'jose';
import { fail, id } from './core.mjs';

// Production cryptographic contract, exercised with synthetic RSA keys. No live credentials.
export async function verifySignedFirebaseToken(token, project, key, now = new Date()) {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['RS256'], issuer: `https://securetoken.google.com/${project}`, audience: project,
      requiredClaims: ['sub','iat','exp','auth_time'], currentDate: now, clockTolerance: 0 });
    validateClaims(payload, project, now);
    return payload;
  } catch { fail('unauthenticated', 'Sessão inválida.', 401); }
}
function validateClaims(p, project, now = new Date()) {
  const seconds = Math.floor(now.getTime()/1000);
  if (!id(p.sub) || p.iss !== `https://securetoken.google.com/${project}` || p.aud !== project || !Number.isInteger(p.exp) || p.exp <= seconds
    || !Number.isInteger(p.iat) || p.iat > seconds || !Number.isInteger(p.auth_time) || p.auth_time > seconds) fail('unauthenticated', 'Sessão inválida.', 401);
}
export function assertUserState(p, user) {
  if (!user || user.localId !== p.sub || user.disabled === true || Number(user.validSince || 0) > p.auth_time) fail('unauthenticated', 'Sessão revogada.', 401);
  if (p.email_verified !== true || user.emailVerified !== true) fail('failed-precondition', 'Confirme seu e-mail.', 403);
}
export async function identity(req, config, budget) {
  const token = req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token || token.length > 16_384) fail('unauthenticated', 'Entre na sua conta.', 401);
  let claims;
  try {
    // Auth Emulator issues unsigned tokens. This branch is unreachable outside guarded loopback demo mode.
    if (decodeProtectedHeader(token).alg !== 'none' || token.split('.')[2] !== '') fail('unauthenticated', 'Token local inválido.', 401);
    claims = decodeJwt(token); validateClaims(claims, config.project);
  } catch { fail('unauthenticated', 'Sessão inválida.', 401); }
  const r = await budget.fetch(`${config.AUTH_ORIGIN}/identitytoolkit.googleapis.com/v1/projects/${config.project}/accounts:lookup`, {
    method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: [claims.sub] }),
  });
  if (!r.ok) fail('unavailable', 'Não foi possível verificar a sessão.', 503);
  assertUserState(claims, (await r.json()).users?.[0]);
  return { uid: claims.sub, claims };
}
