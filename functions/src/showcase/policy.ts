import { createHash } from 'node:crypto';
export const showcaseId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
export const showcaseHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const showcaseCategories = ['full_cosplay', 'wig', 'armor', 'prop', 'accessory', 'other'];
export function showcaseVersion(data: Record<string, unknown> | undefined) {
  const value = data?.version ?? 0;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('A versão deste conteúdo precisa ser revisada.');
  return value as number;
}
export function showcasePublicProjection(id: string, data: Record<string, unknown>, section: 'services' | 'portfolio') {
  const common = { id, title: typeof data.title === 'string' ? data.title.slice(0, 120) : '', description: typeof data.description === 'string' ? data.description.slice(0, 2000) : '',
    category: typeof data.category === 'string' && showcaseCategories.includes(data.category) ? data.category : 'other', sortOrder: typeof data.sortOrder === 'number' && Number.isSafeInteger(data.sortOrder) && data.sortOrder >= 0 ? data.sortOrder : 0 };
  if (section === 'services') return common;
  const images = Array.isArray(data.images) ? data.images.filter((value): value is Record<string, unknown> => !!value && typeof value === 'object' && showcaseId(value.id)).slice(0, 8) : [];
  return { ...common, character: typeof data.character === 'string' ? data.character.slice(0, 120) : '', franchise: typeof data.franchise === 'string' ? data.franchise.slice(0, 120) : '',
    featured: data.featured === true, images: images.map((image) => ({ id: String(image.id), caption: typeof image.caption === 'string' ? image.caption.slice(0, 180) : '' })) };
}
export function nextShowcaseVersion(current: number) {
  const next = current + 1;
  if (!Number.isSafeInteger(next)) throw new Error('A versão excedeu o intervalo seguro.');
  return next;
}
