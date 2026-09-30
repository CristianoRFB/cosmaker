export type OrderStatus =
  | 'requested' | 'quoted' | 'waiting_deposit' | 'confirmed' | 'waiting_materials' | 'scheduled'
  | 'modeling' | 'in_production' | 'fitting' | 'adjustments' | 'finishing' | 'waiting_final_payment'
  | 'ready_to_ship' | 'shipped' | 'delivered' | 'completed' | 'paused' | 'cancelled' | 'refunded';

export interface Order {
  id: string;
  atelierId: string;
  quoteId: string;
  requestId: string;
  clientId: string | null;
  clientName: string;
  email: string;
  character: string;
  franchise: string;
  category: string;
  description: string;
  status: OrderStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  progress: number;
  expectedDeliveryDate: string;
  approvedQuoteSnapshot: {
    total: number;
    depositAmount: number;
    depositPercentage: number;
    expectedStartDate?: string | null;
    expectedCompletionDate?: string | null;
  };
  createdAt: unknown;
  updatedAt: unknown;
}

export interface OrderLineItem {
  id: string;
  description: string;
  category: 'material' | 'labor' | 'other';
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface OrderFile {
  id: string;
  storagePath: string;
  originalName: string;
  contentType: string;
  size: number;
  source: string;
  createdAt: unknown;
}

export interface OrderHistoryEntry {
  id: string;
  status: OrderStatus;
  actorId: string;
  source: string;
  createdAt: unknown;
}

export interface OrderRecord {
  order: Order;
  items: OrderLineItem[];
  files: OrderFile[];
  history: OrderHistoryEntry[];
  measurements: import('./measurement').Measurement[];
}
