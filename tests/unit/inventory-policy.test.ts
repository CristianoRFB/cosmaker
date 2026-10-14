import { describe, expect, it } from 'vitest';
import { inventoryMovementInputSchema, materialInputSchema, supplierInputSchema } from '@/schemas/material.schema';

describe('política e validação do estoque', () => {
  it('normaliza material, unidade, custo em centavos e ponto de reposição', () => {
    const parsed = materialInputSchema.parse({
      name: '  Lona violeta  ', sku: ' lona-01 ', description: 'Material', unit: 'm',
      unitCost: '27.50', supplierId: '', reorderPoint: '2.125', active: true,
    });
    expect(parsed).toMatchObject({ name: 'Lona violeta', sku: 'LONA-01', unitCostCents: 2750, supplierId: null, reorderPoint: 2.125 });
    expect(materialInputSchema.safeParse({
      name: 'Lona', sku: '', description: '', unit: 'invalid', unitCost: '1.00', supplierId: '', reorderPoint: '0', active: true,
    }).success).toBe(false);
  });

  it('recusa precisão de quantidade acima de milésimos e custo acima de centavos', () => {
    expect(materialInputSchema.safeParse({
      name: 'Fibra', sku: '', description: '', unit: 'kg', unitCost: '1.239', supplierId: '', reorderPoint: '0', active: true,
    }).success).toBe(false);
    expect(inventoryMovementInputSchema.safeParse({ materialId: 'material-a', kind: 'receive', quantity: '0.0001', orderId: '', reservationId: '', plannedQuantity: '' }).success).toBe(false);
  });

  it('exige pedido para reserva e reserva válida para liberação', () => {
    const base = { materialId: 'material-a', quantity: '1', orderId: '', reservationId: '', plannedQuantity: '' };
    expect(inventoryMovementInputSchema.safeParse({ ...base, kind: 'reserve' }).success).toBe(false);
    expect(inventoryMovementInputSchema.safeParse({ ...base, kind: 'release' }).success).toBe(false);
    expect(inventoryMovementInputSchema.safeParse({ ...base, kind: 'reserve', orderId: 'order-a', plannedQuantity: '4' }).success).toBe(true);
  });

  it('normaliza contatos do fornecedor e aceita cadastro manual sem integração externa', () => {
    const parsed = supplierInputSchema.parse({ name: 'Fornecedor', email: '', phone: '', website: '', notes: '', active: true });
    expect(parsed).toMatchObject({ name: 'Fornecedor', active: true });
  });
});
