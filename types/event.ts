export type AtelierEventType = 'cosplay' | 'convention' | 'deadline' | 'prop_deadline' | 'other';

export interface AtelierEvent {
  id: string;
  atelierId: string;
  title: string;
  type: AtelierEventType;
  startDate: string;
  endDate: string;
  orderId: string | null;
  notes: string;
  status: 'active' | 'cancelled';
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}
