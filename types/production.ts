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
  semanticKey?: ProductionSemanticKey;
  version?: number;
  plannedStartDate?: string | null;
  deadline?: string | null;
  blockedReason?: string | null;
  blockedAt?: unknown;
  blockResolvedAt?: unknown;
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
  uploadedAt?: unknown;
  storageGeneration?: string | null;
  downloadUrl?: string | null;
}

export interface ProductionApproval {
  id: string;
  atelierId: string;
  orderId: string;
  stageId: string;
  stageName: string;
  clientId: string | null;
  status: 'pending' | 'approved' | 'changes_requested' | 'cancelled';
  requestedAt: unknown;
  respondedAt?: unknown;
  responseComment?: string;
  respondedBy?: string;
  photoEvidence?: Array<{ photoId: string; storagePath: string; storageGeneration: string | null }>;
  evidencePolicyVersion?: number;
  legacyEvidenceCapturedAt?: unknown;
}

export type ProductionStageAction = 'start' | 'progress' | 'complete' | 'block' | 'cancel_approval';

export type ProductionSemanticKey = 'confirmed' | 'modeling' | 'in_production' | 'fitting' | 'finishing' | 'shipping';

export interface ProductionConfigurationStage {
  id: string;
  name: string;
  progressWeight: number;
  requiresClientApproval: boolean;
  semanticKey: ProductionSemanticKey;
  assignedTo: string | null;
  plannedStartDate: string | null;
  deadline: string | null;
  expectedUpdatedAt: string | null;
  status?: ProductionStageStatus;
  version?: number;
}

export interface OrderProductionConfiguration {
  version: number;
  stages: ProductionConfigurationStage[];
  members: Array<{ id: string; name: string; role: string }>;
}
