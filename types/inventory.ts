export type InventoryUnit = 'un' | 'g' | 'kg' | 'ml' | 'l' | 'cm' | 'm' | 'm2' | 'folha' | 'rolo';
export type InventoryMovementKind = 'receive' | 'issue' | 'reserve' | 'release';

export interface InventoryMaterial {
  id: string;
  name: string;
  sku: string;
  description: string;
  unit: InventoryUnit;
  unitCostCents: number;
  supplierId: string | null;
  supplierName: string | null;
  reorderPoint: number;
  onHand: number;
  reserved: number;
  available: number;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface InventorySupplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface InventoryReservation {
  id: string;
  materialId: string;
  materialName: string;
  unit: InventoryUnit;
  orderId: string;
  quantity: number;
  remaining: number;
  createdAt: string | null;
}

export interface InventoryMovement {
  id: string;
  materialId: string;
  materialName: string;
  unit: InventoryUnit;
  kind: InventoryMovementKind;
  quantity: number;
  orderId: string | null;
  reservationId: string | null;
  unitCostCents: number;
  before: { onHand: number; reserved: number; available: number };
  after: { onHand: number; reserved: number; available: number };
  createdAt: string | null;
}

export interface InventoryWorkspace {
  materials: InventoryMaterial[];
  suppliers: InventorySupplier[];
  reservations: InventoryReservation[];
  lowStock: InventoryMaterial[];
}
