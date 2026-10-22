import { describe, expect, it } from 'vitest';
import { nextShowcaseVersion, showcaseId, showcasePublicProjection, showcaseVersion } from '../../functions/src/showcase/policy';
describe('Showcase public contract', () => {
  it('projeta apenas conteúdo comercial e nunca notas, contatos, vínculos ou metadados do Storage', () => {
    const value = { title: 'Armadura', description: 'Projeto público', category: 'armor', sortOrder: 2, public: true,
      internalNotes: 'PRIVATE', clientId: 'PRIVATE', email: 'PRIVATE', orderId: 'PRIVATE', createdBy: 'PRIVATE',
      images: [{ id: 'image-a', caption: 'Foto da armadura', sha256: 'PRIVATE', storagePath: 'PRIVATE', downloadUrl: 'PRIVATE' }], featured: true };
    const projection = showcasePublicProjection('project', value, 'portfolio');
    expect(JSON.stringify(projection)).not.toContain('PRIVATE');
    expect(projection).toMatchObject({ title: 'Armadura', images: [{ id: 'image-a', caption: 'Foto da armadura' }] });
    expect(showcasePublicProjection('service', value, 'services')).not.toHaveProperty('images');
  });
  it('falha fechado em identificadores e versões inválidos e trata conteúdo legado malformado', () => {
    expect(showcaseId('../tenant')).toBe(false); expect(showcaseId('')).toBe(false);
    expect(showcaseVersion(undefined)).toBe(0);
    for (const version of [-1, 1.5, '1', Infinity]) expect(() => showcaseVersion({ version })).toThrow();
    expect(() => nextShowcaseVersion(Number.MAX_SAFE_INTEGER)).toThrow();
    expect(showcasePublicProjection('project', { images: [null, { id: '../path' }, { id: 'valid' }] }, 'portfolio')).toMatchObject({ title: '', images: [{ id: 'valid', caption: '' }] });
  });
});
