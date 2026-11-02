import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';

const markup = readFileSync(new URL('../../public/demos/satu/index.html', import.meta.url), 'utf8');
const script = markup.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';

describe('Cosmaker Satu preview sandbox', () => {
  it('provides exactly the three advertised audience views', () => {
    expect(markup.match(/data-view="(cliente|producao|gestao)"/g)).toHaveLength(3);
    for (const name of ['cliente', 'producao', 'gestao']) {
      expect(markup).toContain('data-view="' + name + '"');
      expect(markup).toContain('data-goto="' + name + '"');
    }
  });

  it('ships an executable browser script and forms for quote and tracking', () => {
    expect(script.length).toBeGreaterThan(1500);
    expect(() => new Script(script)).not.toThrow();
    for (const id of ['quoteForm', 'quoteType', 'trackingForm', 'trackingCode', 'trackingResult', 'board', 'services']) {
      expect(markup).toContain('id="' + id + '"');
    }
  });

  it('never dispatches a prospect request and labels the prototype unambiguously', () => {
    expect(script).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage/);
    expect(markup).toContain('Não é o site oficial da Satu');
    expect(markup).toContain('Nenhuma mensagem foi enviada');
    expect(markup).toContain('não representam encomendas reais');
    expect(markup).not.toMatch(/<script\s+src=/);
  });

  it('offers native validation, keyboard support and reduced motion', () => {
    expect(markup).toContain('aria-labelledby="modalTitle"');
    expect(markup).toContain('prefers-reduced-motion:reduce');
    expect(markup).toContain(':focus-visible');
    expect(markup).toContain('reportValidity()');
    expect(markup).toContain('aria-live="polite"');
  });
});
