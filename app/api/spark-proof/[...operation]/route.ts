import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
async function proxy(request: Request, context: { params: Promise<{ operation: string[] }> }) {
  if (process.env.COSMAKER_SPARK_PROOF !== 'true' || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'demo-cosmaker'
    || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true') return new Response(null, { status: 404 });
  const { operation } = await context.params;
  const path = operation.join('/');
  if (!['getTenantWorkspace', 'recordFinanceEntry', 'health'].includes(path)
    && !/^files\/[A-Za-z0-9_-]{1,150}\/[A-Za-z0-9_-]{1,150}(?:\/[A-Za-z0-9_-]{1,150})?$/.test(path)) return new Response(null, { status: 404 });
  let origin: URL;
  try { origin = new URL(process.env.COSMAKER_SPARK_ORIGIN || ''); } catch { return new Response(null, { status: 503 }); }
  if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) || !origin.port
    || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return new Response(null, { status: 503 });
  const headers = new Headers();
  for (const key of ['authorization', 'content-type', 'x-request-id', 'x-content-sha256']) { const value = request.headers.get(key); if (value) headers.set(key, value); }
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = request.body?.getReader();
    if (reader) while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 6 * 1024 * 1024) { await reader.cancel(); return new Response(null, { status: 413 }); }
      chunks.push(value);
    }
    const body = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    const upstream = await fetch(new URL('/' + path, origin), { method: request.method, headers, body: request.method === 'POST' ? body : undefined,
      redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (upstream.status >= 300 && upstream.status < 400) return new Response(null, { status: 502 });
    const outgoing = new Headers({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    for (const key of ['content-type', 'content-disposition', 'x-content-sha256']) { const value = upstream.headers.get(key); if (value) outgoing.set(key, value); }
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch { return NextResponse.json({ error: { message: 'Runtime local indisponível.' } }, { status: 503 }); }
}
export const POST = proxy;
export const GET = proxy;
