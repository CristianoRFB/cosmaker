import { httpsCallable } from 'firebase/functions';
import { requireFirebase } from '@/services/firebase/firebase.client';
import type { AtelierShowcase, PublicShowcase, PublicShowcaseProfile, ShowcaseContentInput, ShowcaseSection } from '@/types/portfolio';
export async function listAtelierShowcase(section: ShowcaseSection) { return (await httpsCallable<{ section: ShowcaseSection }, AtelierShowcase>(requireFirebase().functions, 'listAtelierShowcase')({ section })).data; }
export async function listPublicShowcase(tenantSlug: string) { return (await httpsCallable<{ tenantSlug: string }, PublicShowcase>(requireFirebase().functions, 'listPublicShowcase')({ tenantSlug })).data; }
export async function saveShowcaseContent(section: ShowcaseSection, input: ShowcaseContentInput, id: string | undefined, requestId: string) {
  const name = section === 'services' ? 'saveAtelierService' : 'saveAtelierPortfolioProject';
  return (await httpsCallable<Record<string, unknown>, { id: string; version: number; alreadyApplied: boolean }>(requireFirebase().functions, name)({ ...input, ...(id ? { id } : {}), requestId })).data;
}
export async function saveAtelierPublicProfile(profile: PublicShowcaseProfile, requestId: string) {
  const { slug: _slug, ...input } = profile; void _slug;
  return (await httpsCallable(requireFirebase().functions, 'saveAtelierPublicProfile')({ ...input, requestId })).data;
}
function endpoint(name: string, query: Record<string, string>) {
  const { app } = requireFirebase();
  if (!app) throw new Error('O ambiente Firebase não está disponível.');
  const project = app.options.projectId;
  const base = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true'
    ? `http://${process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1'}:${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT || '5001'}/${project}/us-central1`
    : `https://us-central1-${project}.cloudfunctions.net`;
  return `${base}/${name}?${new URLSearchParams(query)}`;
}
async function imageRequest(name: string, query: Record<string, string>, init: RequestInit = {}, authenticated = true) {
  const user = requireFirebase().auth.currentUser;
  if (authenticated && !user) throw new Error('Entre na sua conta para acessar arquivos.');
  const response = await fetch(endpoint(name, query), { ...init, cache: 'no-store', signal: AbortSignal.timeout(120_000), headers: { ...init.headers, ...(authenticated ? { Authorization: `Bearer ${await user!.getIdToken()}` } : {}) } });
  if (!response.ok) { const payload = await response.json().catch(() => null); throw new Error(payload?.error?.message || 'Não foi possível acessar a imagem.'); }
  return response;
}
export async function uploadShowcaseImage(projectId: string, imageId: string, version: number, caption: string, file: File) {
  return (await imageRequest('uploadShowcaseImage', { projectId, imageId, version: String(version), caption }, { method: 'POST', body: file, headers: { 'Content-Type': file.type } })).json();
}
export async function readShowcaseImage(projectId: string, imageId: string, tenantSlug?: string) {
  const response = await imageRequest('downloadShowcaseImage', { projectId, imageId, ...(tenantSlug ? { tenantSlug } : {}) }, {}, !tenantSlug);
  return URL.createObjectURL(await response.blob());
}
export async function removeShowcaseImage(projectId: string, imageId: string, version: number, requestId: string) {
  return (await httpsCallable(requireFirebase().functions, 'removeShowcaseImage')({ projectId, imageId, version, requestId })).data;
}
