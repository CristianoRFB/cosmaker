export type CapacityStatus = 'open' | 'almost_full' | 'full' | 'blocked';

export interface CapacitySummary {
  capacityHours: number;
  usedHours: number;
  reservedHours: number;
  allocatedHours: number;
  availableHours: number;
  occupancyPercent: number;
  status: CapacityStatus;
}

export function calculateCapacity(input: { capacityHours: number; usedHours: number; reservedHours?: number; blocked?: boolean }): CapacitySummary {
  const capacityHours = finiteNonNegative(input.capacityHours, 'capacityHours');
  const usedHours = finiteNonNegative(input.usedHours, 'usedHours');
  const reservedHours = finiteNonNegative(input.reservedHours ?? 0, 'reservedHours');
  const allocatedHours = usedHours + reservedHours;
  const availableHours = Math.max(0, capacityHours - allocatedHours);
  const occupancyPercent = capacityHours === 0
    ? allocatedHours === 0 ? 0 : 100
    : Math.round((allocatedHours / capacityHours) * 100);
  const status: CapacityStatus = input.blocked
    ? 'blocked'
    : occupancyPercent >= 100
      ? 'full'
      : occupancyPercent >= 80
        ? 'almost_full'
        : 'open';

  return { capacityHours, usedHours, reservedHours, allocatedHours, availableHours, occupancyPercent, status };
}

function finiteNonNegative(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${field} precisa ser um número finito e não negativo.`);
  return value;
}
