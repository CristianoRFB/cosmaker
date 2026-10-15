export interface OrderAgreementSnapshot {
  version: number;
  sourceQuoteId: string;
  scope: string;
  materials: string;
  expectedDeliveryDate: string;
  totalCents: number;
  depositAmountCents: number;
}

export interface OrderChangeTerms {
  scope?: string;
  materials?: string;
  expectedDeliveryDate?: string;
  valueDeltaCents?: number;
}

export type OrderChangeStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'cancelled' | 'applied';

export interface OrderChangeRequest {
  id: string;
  atelierId: string;
  orderId: string;
  version: number;
  status: OrderChangeStatus;
  reason: string;
  changes: OrderChangeTerms;
  baseAgreementVersion: number;
  baseAgreementFingerprint: string;
  proposalFingerprint: string;
  baseAgreementSnapshot: OrderAgreementSnapshot;
  proposedAgreementSnapshot: OrderAgreementSnapshot;
  requestedBy: string;
  supersedesId: string | null;
  supersededBy: string | null;
  responseComment?: string;
  cancelReason?: string;
  approval: {
    clientUserId: string;
    emailVerified: true;
    changeVersion: number;
    proposalFingerprint: string;
    agreementSnapshot: OrderAgreementSnapshot;
    approvedAt: string;
  } | null;
  createdAt: string;
  respondedAt?: string | null;
  appliedAt?: string | null;
  appliedAgreementVersion?: number;
}

export interface OrderChangeRequestPage {
  requests: OrderChangeRequest[];
  currentAgreement: OrderAgreementSnapshot;
  currentAgreementFingerprint: string;
  viewer: 'staff' | 'client';
  nextCursor: string | null;
}
