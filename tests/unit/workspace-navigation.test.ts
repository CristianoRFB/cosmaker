import { describe, expect, it } from 'vitest';
import { accountHome, loginDestination, navigationFor, currentSection, searchNavigation } from '@/lib/navigation/workspace';

describe('orientação e navegação por conta', () => {
  it('oferece destinos próprios para cliente, equipe e administrador', () => {
    expect(accountHome('client')).toBe('/cliente');
    expect(accountHome('atelier_member')).toBe('/atelier');
    expect(accountHome('platform_admin')).toBe('/admin');
  });
  it('mantém seção ativa em detalhes sem confundir prefixos', () => {
    const items = navigationFor('atelier', () => true);
    expect(currentSection(items, '/atelier/pedidos/pedido-1/arquivos')?.href).toBe('/atelier/pedidos');
    expect(currentSection(items, '/atelier/pedidos-outro')).toBeUndefined();
    expect(currentSection(items, '/atelier')?.label).toBe('Visão geral');
  });
  it('não oferece atalhos nem resultados de busca proibidos a equipe restrita', () => {
    const items = navigationFor('atelier', (permission) => permission === 'quotes:read');
    expect(items.map((item) => item.href)).toContain('/atelier/orcamentos');
    expect(items.map((item) => item.href)).not.toContain('/atelier/financeiro');
    expect(items.map((item) => item.href)).not.toContain('/atelier/configuracoes');
    expect(searchNavigation(items, 'financeiro')).toEqual([]);
  });
  it('busca rótulos e descrições sem acentos ou diferenças de caixa', () => {
    const items = navigationFor('client');
    expect(searchNavigation(items, '  ORCAMENTO  ').map((item) => item.href)).toContain('/cliente/orcamentos');
    expect(searchNavigation(items, 'conversas').map((item) => item.href)).toContain('/cliente/mensagens');
    expect(searchNavigation(items, '')).toEqual(items);
    expect(searchNavigation(items, 'nada-deste-tipo')).toEqual([]);
  });
  it('preserva redirecionamento interno e rejeita URLs externas ou malformadas', () => {
    expect(loginDestination(null, 'atelier_member')).toBe('/atelier');
    expect(loginDestination(null, 'platform_admin')).toBe('/admin');
    expect(loginDestination('/cliente/pedidos?id=1', 'client')).toBe('/cliente/pedidos?id=1');
    for (const path of ['https://example.com', '//example.com', '/\\example.com', '/\n/evil', '/%2F%2Fevil', '/%5cevil']) {
      expect(loginDestination(path, 'platform_admin')).toBe('/admin');
    }
  });
});
