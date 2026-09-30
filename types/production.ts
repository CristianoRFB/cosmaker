export type ProductionStageStatus = 'pending' | 'in_progress' | 'waiting_approval' | 'approved' | 'completed' | 'blocked';

export interface ProductionStage {
  id: string;
  atelierId: string;
  orderId: string;
  name: string;
  order: number;
  status: ProductionStageStatus;
  progress: number;
  progressWeight: number;
  requiresClientApproval: boolean;
  notes?: string;
  assignedTo?: string | null;
  deadline?: string | null;
  pendingApprovalId?: string | null;
  updatedAt?: unknown;
}

export interface ProductionPhoto {
  id: string;
  atelierId: string;
  orderId: string;
  stageId: string;
  storagePath: string;
  caption: string;
  originalName: string;
  contentType: string;
  size: number;
  visibleToClient: boolean;
  uploadStatus: 'pending' | 'ready' | 'rejected';
  uploadedBy: string;
  createdAt: unknown;
  downloadUrl?: string | null;
}

export interface ProductionApproval {
  id: string;
  atelierId: string;
  orderId: string;
  stageId: string;
  stageName: string;
  clientId: string | null;
  status: 'pending' | 'approved' | 'changes_requested';
  requestedAt: unknown;
  respondedAt?: unknown;
  responseComment?: string;
  respondedBy?: string;
}

export type ProductionStageAction = 'start' | 'progress' | 'complete' | 'block';
