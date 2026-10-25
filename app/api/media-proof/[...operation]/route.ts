import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
function local(value: string | undefined) {
  const u = new URL(value || '');
  if (u.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) || !u.port || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw Error('Local only');
  return u;
}
async function proxy(request: Request, context: { params: Promise<{ operation: string[] }> }) {
  if (process.env.COSMAKER_MEDIA_PROOF !== 'true' || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'demo-cosmaker' || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true') return new Response(null, { status: 404 });
  const path = (await context.params).operation.join('/');
  if (!['session', 'assets', 'governance'].includes(path) && !/^assets\/[A-Za-z0-9_-]{1,150}\/[a-f0-9]{64}\/(view|part|complete|download|protect|revoke)$/.test(path)) return new Response(null, { status: 404 });
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = request.body?.getReader();
    if (reader) while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 512 * 1024) { await reader.cancel(); return new Response(null, { status: 413 }); } chunks.push(value); }
    const body = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    const headers = new Headers();
    for (const key of ['authorization', 'content-type', 'x-media-fence', 'x-media-part']) { const v = request.headers.get(key); if (v) headers.set(key, v); }
    let url: URL;
    if (path === 'session') {
      if (request.method !== 'POST' || size > 4096) return new Response(null, { status: 400 });
      const v = JSON.parse(new TextDecoder().decode(body));
      if (typeof v.email !== 'string' || !v.email.endsWith('@cosmaker.test') || typeof v.password !== 'string' || Object.keys(v).some(k => !['email', 'password'].includes(k))) return new Response(null, { status: 400 });
      const upstream = await fetch(new URL('/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key', local(process.env.COSMAKER_MEDIA_AUTH_ORIGIN)), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...v, returnSecureToken: true }), redirect: 'manual', signal: AbortSignal.timeout(10000) });
      const j = await upstream.json();
      return NextResponse.json(upstream.ok ? { data: { token: j.idToken } } : { error: { message: 'Login sintético recusado.' } }, { status: upstream.ok ? 200 : 401, headers: { 'Cache-Control': 'private, no-store' } });
    } else url = new URL('/' + path, local(process.env.COSMAKER_MEDIA_ORIGIN));
    const r = await fetch(url, { method: request.method, headers, body: request.method === 'POST' ? body : undefined, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(60000) });
    if (r.status >= 300 && r.status < 400) return new Response(null, { status: 502 });
    const outgoing = new Headers({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    for (const key of ['content-type', 'content-disposition', 'x-content-sha256']) { const v = r.headers.get(key); if (v) outgoing.set(key, v); }
    return new Response(r.body, { status: r.status, headers: outgoing });
  } catch { return NextResponse.json({ error: { message: 'Prova local indisponível.' } }, { status: 503 }); }
}
export const POST = proxy;
export const GET = proxy;
