export type ShowcaseSection = 'services' | 'portfolio';
export interface ShowcaseImage { id: string; caption: string }
export interface ShowcaseItem {
  id: string; title: string; description: string; category: string; sortOrder: number;
  character?: string; franchise?: string; featured?: boolean; images?: ShowcaseImage[];
}
export interface AtelierShowcaseItem extends ShowcaseItem { public: boolean; active: boolean; internalNotes: string; version: number }
export interface PublicShowcaseProfile { slug: string; name: string; tagline: string; brandColor: string; published: boolean; quoteRequestsEnabled: boolean; version: number }
export interface AtelierShowcase { items: AtelierShowcaseItem[]; profile: PublicShowcaseProfile | null }
export interface ShowcaseContentInput { title: string; description: string; category: string; public: boolean; active: boolean; sortOrder: number; internalNotes: string; version: number; character?: string; franchise?: string; featured?: boolean }
export interface PublicShowcase { status: string; services: ShowcaseItem[]; projects: ShowcaseItem[] }
