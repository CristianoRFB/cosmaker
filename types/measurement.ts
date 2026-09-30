export type MeasurementValueType = 'circumference' | 'length' | 'width' | 'weight' | 'custom';

export interface MeasurementProfile {
  id: string;
  atelierId: string;
  clientId: string;
  name: string;
  active: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Measurement {
  id: string;
  type: MeasurementValueType | string;
  label: string;
  value: number;
  unit: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  capturedAt?: unknown;
  sourceProfileId?: string;
  sourceMeasurementId?: string;
  profileName?: string | null;
}
