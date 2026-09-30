export type QuoteRequestStatus = 'new' | 'under_review' | 'quoted' | 'adjustment_requested' | 'approved' | 'rejected' | 'expired';
export type QuoteRequestUrgency = 'normal' | 'urgent';

export interface QuoteRequest {
  id: string;
  clientId: string | null;
  name: string;
  email: string;
  phone?: string;
  character: string;
  franchise: string;
  category: string;
  description: string;
  eventDate?: string;
  desiredDeliveryDate: string;
  budgetMin?: number;
  budgetMax?: number;
  urgency: QuoteRequestUrgency;
  observations?: string;
  status: QuoteRequestStatus;
  createdAt: unknown;
}

export interface QuoteRequestReference {
  id: string;
  storagePath: string;
  originalName: string;
  contentType: string;
  size: number;
  createdAt: unknown;
}
