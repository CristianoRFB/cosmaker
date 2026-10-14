import { z } from 'zod';

export const inventoryUnits = ['un', 'g', 'kg', 'ml', 'l', 'cm', 'm', 'm2', 'folha', 'rolo'] as const;
const decimalQuantity = z.string().trim().regex(/^\d{1,9}(?:\.\d{1,3})?$/, 'Use no máximo três casas decimais.')
  .transform((value) => Number(value));
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || undefined);

export const materialInputSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do material.').max(120),
  sku: z.string().trim().max(40).transform((value) => value.toUpperCase()),
  description: z.string().trim().max(500),
  unit: z.enum(inventoryUnits),
  unitCost: z.string().trim().regex(/^\d{1,6}(?:\.\d{1,2})?$/, 'Informe o custo com até duas casas decimais.')
    .transform((value) => Math.round(Number(value) * 100)),
  supplierId: optionalText(150),
  reorderPoint: decimalQuantity,
  active: z.boolean(),
}).transform((value) => ({
  name: value.name,
  sku: value.sku,
  description: value.description,
  unit: value.unit,
  unitCostCents: value.unitCost,
  supplierId: value.supplierId ?? null,
  reorderPoint: value.reorderPoint,
  active: value.active,
}));

export const supplierInputSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do fornecedor.').max(120),
  email: z.string().trim().max(254),
  phone: z.string().trim().max(32),
  website: z.string().trim().max(256),
  notes: z.string().trim().max(500),
  active: z.boolean(),
});

const quantityInput = decimalQuantity.refine((value) => value > 0, 'A quantidade precisa ser maior que zero.');
const optionalQuantity = z.union([z.literal(''), decimalQuantity]).transform((value) => value === '' ? undefined : value);

export const inventoryMovementInputSchema = z.object({
  materialId: z.string().trim().min(1, 'Escolha um material.').max(150),
  kind: z.enum(['receive', 'issue', 'reserve', 'release']),
  quantity: quantityInput,
  orderId: optionalText(150),
  reservationId: optionalText(150),
  plannedQuantity: optionalQuantity,
}).superRefine((value, context) => {
  if (value.kind === 'reserve' && !value.orderId) {
    context.addIssue({ code: 'custom', message: 'Informe o pedido para reservar material.', path: ['orderId'] });
  }
  if (value.kind === 'release' && !value.reservationId) {
    context.addIssue({ code: 'custom', message: 'Escolha uma reserva para liberar.', path: ['reservationId'] });
  }
  if (value.kind === 'receive' && (value.orderId || value.reservationId || value.plannedQuantity !== undefined)) {
    context.addIssue({ code: 'custom', message: 'Entradas não aceitam pedido ou reserva.', path: ['kind'] });
  }
  if (value.reservationId && !['issue', 'release'].includes(value.kind)) {
    context.addIssue({ code: 'custom', message: 'A reserva só pode ser consumida ou liberada.', path: ['reservationId'] });
  }
  if (value.plannedQuantity !== undefined && value.kind !== 'reserve') {
    context.addIssue({ code: 'custom', message: 'Quantidade planejada só é aceita em reservas.', path: ['plannedQuantity'] });
  }
  if (value.plannedQuantity !== undefined && value.plannedQuantity < value.quantity) {
    context.addIssue({ code: 'custom', message: 'O total planejado não pode ser menor que a reserva.', path: ['plannedQuantity'] });
  }
});

export type MaterialInput = z.infer<typeof materialInputSchema>;
export type SupplierInput = z.infer<typeof supplierInputSchema>;
export type InventoryMovementInput = z.infer<typeof inventoryMovementInputSchema>;
