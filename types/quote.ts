export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'superseded';
export type QuoteItemCategory = 'material' | 'labor' | 'other';

export interface QuoteItem {
  id: string;
  description: string;
  category: QuoteItemCategory;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteResponse {
  id: string;
  decision: 'approved' | 'rejected' | 'request_changes';
  comment: string;
  actorId: string;
  email: string;
  createdAt: unknown;
}

export interface Quote {
  id: string;
  atelierId: string;
  requestId: string;
  clientId: string | null;
  email: string;
  status: QuoteStatus;
  materialsCost: number;
  laborCost: number;
  otherCost: number;
  urgencyFee: number;
  shipping: number;
  discount: number;
  subtotal: number;
  total: number;
  depositPercentage: number;
  depositAmount: number;
  validUntil: string;
  expectedStartDate?: string;
  expectedCompletionDate?: string;
  createdAt: unknown;
  updatedAt: unknown;
}
