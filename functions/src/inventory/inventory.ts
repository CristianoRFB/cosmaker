import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireInventoryWorkspace, readActiveInventoryActor, validInventoryId } from './access';

const SUPPORTED_UNITS = new Set(['un', 'g', 'kg', 'ml', 'l', 'cm', 'm', 'm2', 'folha', 'rolo']);
const QUANTITY_SCALE = 1000;
const MAX_QUANTITY_MILLI = 1_000_000_000_000;

type MovementKind = 'receive' | 'issue' | 'reserve' | 'release';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function onlyKeys(data: Record<string, unknown>, keys: string[]) {
  if (Object.keys(data).some((key) => !keys.includes(key))) {
    throw new HttpsError('invalid-argument', 'A solicitação contém campos não aceitos.');
  }
}

function requestId(value: unknown) {
  return validInventoryId(value) && /^[A-Za-z0-9_-]{8,100}$/.test(value);
}

function text(value: unknown, label: string, min: number, max: number, required = true) {
  const result = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (required && result.length < min) throw new HttpsError('invalid-argument', `${label} é obrigatório.`);
  if (result.length > max || (!required && value !== undefined && value !== null && typeof value !== 'string')) {
    throw new HttpsError('invalid-argument', `${label} é inválido.`);
  }
  return result;
}

function quantityMilli(value: unknown, allowZero = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_QUANTITY_MILLI / QUANTITY_SCALE) {
    throw new HttpsError('invalid-argument', 'Informe uma quantidade válida.');
  }
  const scaled = value * QUANTITY_SCALE;
  if (Math.abs(scaled - Math.round(scaled)) > 0.000001 || (!allowZero && scaled < 1)) {
    throw new HttpsError('invalid-argument', 'A quantidade deve ser positiva e ter até três casas decimais.');
  }
  return Math.round(scaled);
}

function quantityFromMilli(value: unknown) {
  return Number.isInteger(value) ? Number(value) / QUANTITY_SCALE : 0;
}

function costCents(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 99_999_999) {
    throw new HttpsError('invalid-argument', 'Informe o custo unitário em centavos.');
  }
  return Number(value);
}

function storedBalance(value: Record<string, unknown>) {
  const onHandMilli = value.onHandMilli;
  const reservedMilli = value.reservedMilli;
  if (!Number.isSafeInteger(onHandMilli) || !Number.isSafeInteger(reservedMilli)
    || Number(onHandMilli) < 0 || Number(reservedMilli) < 0
    || Number(reservedMilli) > Number(onHandMilli) || Number(onHandMilli) > MAX_QUANTITY_MILLI) {
    throw new HttpsError('failed-precondition', 'Um material tem saldo ausente ou inconsistente e precisa de revisão antes de ser usado.');
  }
  return { onHandMilli: Number(onHandMilli), reservedMilli: Number(reservedMilli) };
}

function materialView(id: string, value: Record<string, unknown>) {
  const { onHandMilli, reservedMilli } = storedBalance(value);
  const reorderPointMilli = Number.isInteger(value.reorderPointMilli) ? Number(value.reorderPointMilli) : 0;
  return {
    id,
    name: typeof value.name === 'string' ? value.name : 'Material sem nome',
    sku: typeof value.sku === 'string' ? value.sku : '',
    description: typeof value.description === 'string' ? value.description : '',
    unit: typeof value.unit === 'string' ? value.unit : 'un',
    unitCostCents: Number.isInteger(value.unitCostCents) ? Number(value.unitCostCents) : 0,
    supplierId: typeof value.supplierId === 'string' ? value.supplierId : null,
    supplierName: typeof value.supplierName === 'string' ? value.supplierName : null,
    reorderPoint: quantityFromMilli(reorderPointMilli),
    onHand: quantityFromMilli(onHandMilli),
    reserved: quantityFromMilli(reservedMilli),
    available: quantityFromMilli(Math.max(0, onHandMilli - reservedMilli)),
    active: value.active === true,
    createdAt: isoDate(value.createdAt),
    updatedAt: isoDate(value.updatedAt),
  };
}

function supplierView(id: string, value: Record<string, unknown>) {
  return {
    id,
    name: typeof value.name === 'string' ? value.name : 'Fornecedor sem nome',
    email: typeof value.email === 'string' ? value.email : '',
    phone: typeof value.phone === 'string' ? value.phone : '',
    website: typeof value.website === 'string' ? value.website : '',
    notes: typeof value.notes === 'string' ? value.notes : '',
    active: value.active === true,
    createdAt: isoDate(value.createdAt),
    updatedAt: isoDate(value.updatedAt),
  };
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return (value.toDate() as Date).toISOString();
  }
  return typeof value === 'string' ? value : null;
}

function movementView(id: string, value: Record<string, unknown>) {
  return {
    id,
    materialId: typeof value.materialId === 'string' ? value.materialId : '',
    materialName: typeof value.materialName === 'string' ? value.materialName : 'Material',
    unit: typeof value.unit === 'string' ? value.unit : 'un',
    kind: value.kind,
    quantity: quantityFromMilli(value.quantityMilli),
    orderId: typeof value.orderId === 'string' ? value.orderId : null,
    reservationId: typeof value.reservationId === 'string' ? value.reservationId : null,
    unitCostCents: Number.isInteger(value.unitCostCents) ? Number(value.unitCostCents) : 0,
    before: {
      onHand: quantityFromMilli(record(value.before).onHandMilli),
      reserved: quantityFromMilli(record(value.before).reservedMilli),
      available: quantityFromMilli(record(value.before).availableMilli),
    },
    after: {
      onHand: quantityFromMilli(record(value.after).onHandMilli),
      reserved: quantityFromMilli(record(value.after).reservedMilli),
      available: quantityFromMilli(record(value.after).availableMilli),
    },
    createdAt: isoDate(value.createdAt),
  };
}

export const listInventoryWorkspace = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para consultar o estoque.');
  const identity = await requireInventoryWorkspace(call.auth.uid, call.auth.token, 'inventory:read');
  onlyKeys(record(call.data), []);
  const atelierPath = `ateliers/${identity.atelierId}`;
  const [materialsSnapshot, suppliersSnapshot, reservationsSnapshot] = await Promise.all([
    adminDb.collection(`${atelierPath}/materials`).orderBy('nameKey').limit(501).get(),
    adminDb.collection(`${atelierPath}/suppliers`).orderBy('nameKey').limit(501).get(),
    adminDb.collection(`${atelierPath}/inventoryReservations`).where('status', '==', 'active').orderBy('updatedAt', 'desc').limit(501).get(),
  ]);
  if (materialsSnapshot.size > 500 || suppliersSnapshot.size > 500 || reservationsSnapshot.size > 500) {
    throw new HttpsError('resource-exhausted', 'Este ateliê excedeu o limite da lista de estoque. Use os filtros de arquivo ou solicite paginação.');
  }
  const materials = materialsSnapshot.docs.map((snapshot) => materialView(snapshot.id, snapshot.data()));
  const suppliers = suppliersSnapshot.docs.map((snapshot) => supplierView(snapshot.id, snapshot.data()));
  const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const withSupplier = materials.map((material) => ({
    ...material,
    supplierName: material.supplierId ? supplierNames.get(material.supplierId) ?? null : null,
  }));
  const reservations = reservationsSnapshot.docs
    .filter((snapshot) => Number(snapshot.data().remainingMilli) > 0)
    .map((snapshot) => {
      const value = snapshot.data();
      return {
        id: snapshot.id,
        materialId: typeof value.materialId === 'string' ? value.materialId : '',
        materialName: typeof value.materialName === 'string' ? value.materialName : 'Material',
        unit: typeof value.unit === 'string' ? value.unit : 'un',
        orderId: typeof value.orderId === 'string' ? value.orderId : '',
        quantity: quantityFromMilli(value.quantityMilli),
        remaining: quantityFromMilli(value.remainingMilli),
        createdAt: isoDate(value.createdAt),
      };
    });
  const lowStock = withSupplier.filter((material) => material.active && material.available <= material.reorderPoint);
  return { materials: withSupplier, suppliers, reservations, lowStock };
});

export const listInventoryMovements = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para consultar movimentações.');
  const identity = await requireInventoryWorkspace(call.auth.uid, call.auth.token, 'inventory:read');
  const data = record(call.data);
  onlyKeys(data, ['materialId', 'orderId', 'cursor']);
  const materialId = data.materialId === undefined || data.materialId === null || data.materialId === '' ? null : data.materialId;
  const orderId = data.orderId === undefined || data.orderId === null || data.orderId === '' ? null : data.orderId;
  const cursor = data.cursor === undefined || data.cursor === null || data.cursor === '' ? null : data.cursor;
  if (materialId !== null && !validInventoryId(materialId)) throw new HttpsError('invalid-argument', 'O filtro de material é inválido.');
  if (orderId !== null && !validInventoryId(orderId)) throw new HttpsError('invalid-argument', 'O filtro de pedido é inválido.');
  if (cursor !== null && !validInventoryId(cursor)) throw new HttpsError('invalid-argument', 'O cursor da lista é inválido.');
  if (materialId && orderId) throw new HttpsError('invalid-argument', 'Filtre por material ou por pedido, não pelos dois ao mesmo tempo.');
  const collection = adminDb.collection(`ateliers/${identity.atelierId}/inventoryMovements`);
  let query = materialId
    ? collection.where('materialId', '==', materialId).orderBy('createdAt', 'desc')
    : orderId
      ? collection.where('orderId', '==', orderId).orderBy('createdAt', 'desc')
      : collection.orderBy('createdAt', 'desc');
  if (cursor) {
    const cursorSnapshot = await collection.doc(cursor).get();
    if (!cursorSnapshot.exists) throw new HttpsError('invalid-argument', 'A página expirou. Atualize as movimentações.');
    query = query.startAfter(cursorSnapshot);
  }
  const result = await query.limit(51).get();
  const page = result.docs.slice(0, 50);
  return {
    movements: page.map((snapshot) => movementView(snapshot.id, snapshot.data())),
    nextCursor: result.size > 50 ? page[49]?.id ?? null : null,
  };
});

export const saveInventoryMaterial = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para salvar o material.');
  const identity = await requireInventoryWorkspace(call.auth.uid, call.auth.token, 'inventory:write');
  const data = record(call.data);
  onlyKeys(data, ['requestId', 'materialId', 'name', 'sku', 'description', 'unit', 'unitCostCents', 'supplierId', 'reorderPoint', 'active']);
  if (!requestId(data.requestId)) throw new HttpsError('invalid-argument', 'O identificador da solicitação é inválido.');
  const materialId = data.materialId === undefined || data.materialId === null || data.materialId === '' ? null : data.materialId;
  if (materialId !== null && !validInventoryId(materialId)) throw new HttpsError('invalid-argument', 'O identificador do material é inválido.');
  const name = text(data.name, 'O nome do material', 2, 120);
  const sku = text(data.sku, 'O código do material', 0, 40, false).toUpperCase();
  if (sku && !/^[A-Z0-9][A-Z0-9._-]{0,39}$/.test(sku)) throw new HttpsError('invalid-argument', 'Use somente letras, números, ponto, hífen ou sublinhado no código.');
  const description = text(data.description, 'A descrição', 0, 500, false);
  const unit = typeof data.unit === 'string' ? data.unit : '';
  if (!SUPPORTED_UNITS.has(unit)) throw new HttpsError('invalid-argument', 'Escolha uma unidade de estoque válida.');
  const unitCostCents = costCents(data.unitCostCents);
  const reorderPoint = quantityMilli(data.reorderPoint, true);
  const supplierId = data.supplierId === undefined || data.supplierId === null || data.supplierId === '' ? null : data.supplierId;
  if (supplierId !== null && !validInventoryId(supplierId)) throw new HttpsError('invalid-argument', 'O fornecedor escolhido é inválido.');
  if (typeof data.active !== 'boolean') throw new HttpsError('invalid-argument', 'Informe se o material está ativo.');

  const atelierPath = `ateliers/${identity.atelierId}`;
  const materialRef = adminDb.doc(`${atelierPath}/materials/${materialId ?? data.requestId}`);
  const skuKey = sku ? sku.toLowerCase() : '';
  const skuIndexRef = skuKey ? adminDb.doc(`${atelierPath}/inventorySkuIndex/${skuKey}`) : null;
  const supplierRef = supplierId ? adminDb.doc(`${atelierPath}/suppliers/${supplierId}`) : null;
  const auditRef = adminDb.collection('auditLogs').doc();
  const result = await adminDb.runTransaction(async (transaction) => {
    await readActiveInventoryActor(transaction, identity.atelierId, call.auth!.uid, 'inventory:write');
    const currentSnapshot = await transaction.get(materialRef);
    const current = currentSnapshot.data() ?? {};
    if (materialId && !currentSnapshot.exists) throw new HttpsError('not-found', 'O material não foi encontrado neste ateliê.');
    if (!materialId && currentSnapshot.exists) {
      const sameRequest = current.createRequestId === data.requestId
        && current.createdBy === call.auth!.uid
        && current.name === name && current.sku === sku && current.description === description && current.unit === unit
        && current.unitCostCents === unitCostCents && current.supplierId === supplierId
        && current.reorderPointMilli === reorderPoint && current.active === data.active;
      if (sameRequest) return { materialId: materialRef.id, alreadyApplied: true };
      throw new HttpsError('already-exists', 'Este identificador já foi usado por outro material.');
    }
    const oldSkuKey = typeof current.skuKey === 'string' ? current.skuKey : '';
    const oldSkuIndexRef = oldSkuKey ? adminDb.doc(`${atelierPath}/inventorySkuIndex/${oldSkuKey}`) : null;
    const [supplierSnapshot, skuSnapshot, oldSkuSnapshot] = await Promise.all([
      supplierRef ? transaction.get(supplierRef) : Promise.resolve(null),
      skuIndexRef ? transaction.get(skuIndexRef) : Promise.resolve(null),
      oldSkuIndexRef && oldSkuKey !== skuKey ? transaction.get(oldSkuIndexRef) : Promise.resolve(null),
    ]);
    if (supplierRef && (!supplierSnapshot?.exists || (supplierSnapshot.data()?.active !== true && current.supplierId !== supplierId))) {
      throw new HttpsError('failed-precondition', 'Escolha um fornecedor ativo deste ateliê.');
    }
    if (skuSnapshot?.exists && skuSnapshot.data()?.materialId !== materialRef.id) {
      throw new HttpsError('already-exists', 'Já existe um material com este código neste ateliê.');
    }
    if (oldSkuSnapshot?.exists && oldSkuSnapshot.data()?.materialId === materialRef.id) transaction.delete(oldSkuIndexRef!);
    const { onHandMilli, reservedMilli } = currentSnapshot.exists
      ? storedBalance(current)
      : { onHandMilli: 0, reservedMilli: 0 };
    if (currentSnapshot.exists && current.unit !== unit && (onHandMilli !== 0 || reservedMilli !== 0)) {
      throw new HttpsError('failed-precondition', 'Zere o saldo e as reservas antes de alterar a unidade deste material.');
    }
    if (data.active === false && (onHandMilli !== 0 || reservedMilli !== 0)) {
      throw new HttpsError('failed-precondition', 'Zere o saldo e libere as reservas antes de arquivar o material.');
    }
    const now = FieldValue.serverTimestamp();
    const payload = {
      id: materialRef.id, name, nameKey: name.toLocaleLowerCase('pt-BR'), sku, skuKey,
      description, unit, unitCostCents, supplierId,
      supplierName: supplierId ? supplierSnapshot?.data()?.name ?? current.supplierName ?? null : null,
      reorderPointMilli: reorderPoint, onHandMilli, reservedMilli, active: data.active,
      createdAt: current.createdAt ?? now, updatedAt: now,
      createdBy: current.createdBy ?? call.auth!.uid, updatedBy: call.auth!.uid,
      ...(!materialId ? { createRequestId: data.requestId } : {}),
    };
    transaction.set(materialRef, payload);
    if (skuIndexRef) transaction.set(skuIndexRef, { materialId: materialRef.id, updatedAt: now });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId,
      action: materialId ? 'inventory.material_updated' : 'inventory.material_created',
      entity: 'inventory_material', entityId: materialRef.id,
      before: materialId ? { name: current.name, sku: current.sku, unitCostCents: current.unitCostCents, active: current.active } : null,
      after: { name, sku, unit, unitCostCents, supplierId, reorderPointMilli: reorderPoint, active: data.active },
      timestamp: now,
    });
    return { materialId: materialRef.id, alreadyApplied: false };
  });
  return result;
});

export const saveInventorySupplier = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para salvar o fornecedor.');
  const identity = await requireInventoryWorkspace(call.auth.uid, call.auth.token, 'inventory:write');
  const data = record(call.data);
  onlyKeys(data, ['requestId', 'supplierId', 'name', 'email', 'phone', 'website', 'notes', 'active']);
  if (!requestId(data.requestId)) throw new HttpsError('invalid-argument', 'O identificador da solicitação é inválido.');
  const supplierId = data.supplierId === undefined || data.supplierId === null || data.supplierId === '' ? null : data.supplierId;
  if (supplierId !== null && !validInventoryId(supplierId)) throw new HttpsError('invalid-argument', 'O identificador do fornecedor é inválido.');
  const name = text(data.name, 'O nome do fornecedor', 2, 120);
  const email = text(data.email, 'O e-mail', 0, 254, false).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Informe um e-mail válido.');
  const phone = text(data.phone, 'O telefone', 0, 32, false);
  if (phone && !/^\+?[0-9.() -]{7,32}$/.test(phone)) throw new HttpsError('invalid-argument', 'Informe um telefone válido.');
  const website = text(data.website, 'O site', 0, 256, false);
  if (website) {
    try {
      const parsed = new URL(website);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('invalid');
    } catch { throw new HttpsError('invalid-argument', 'Informe um endereço de site http ou https válido.'); }
  }
  const notes = text(data.notes, 'As observações', 0, 500, false);
  if (typeof data.active !== 'boolean') throw new HttpsError('invalid-argument', 'Informe se o fornecedor está ativo.');
  const supplierRef = adminDb.doc(`ateliers/${identity.atelierId}/suppliers/${supplierId ?? data.requestId}`);
  const auditRef = adminDb.collection('auditLogs').doc();
  const result = await adminDb.runTransaction(async (transaction) => {
    await readActiveInventoryActor(transaction, identity.atelierId, call.auth!.uid, 'inventory:write');
    const currentSnapshot = await transaction.get(supplierRef);
    const current = currentSnapshot.data() ?? {};
    if (supplierId && !currentSnapshot.exists) throw new HttpsError('not-found', 'O fornecedor não foi encontrado neste ateliê.');
    if (!supplierId && currentSnapshot.exists) {
      const sameRequest = current.createRequestId === data.requestId && current.createdBy === call.auth!.uid
        && current.name === name && current.email === email && current.phone === phone
        && current.website === website && current.notes === notes && current.active === data.active;
      if (sameRequest) return { supplierId: supplierRef.id, alreadyApplied: true };
      throw new HttpsError('already-exists', 'Este identificador já foi usado por outro fornecedor.');
    }
    const now = FieldValue.serverTimestamp();
    transaction.set(supplierRef, {
      id: supplierRef.id, name, nameKey: name.toLocaleLowerCase('pt-BR'), email, phone, website, notes,
      active: data.active, createdAt: current.createdAt ?? now, updatedAt: now,
      createdBy: current.createdBy ?? call.auth!.uid, updatedBy: call.auth!.uid,
      ...(!supplierId ? { createRequestId: data.requestId } : {}),
    });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId,
      action: supplierId ? 'inventory.supplier_updated' : 'inventory.supplier_created',
      entity: 'inventory_supplier', entityId: supplierRef.id,
      before: supplierId ? { name: current.name, active: current.active } : null,
      after: { name, active: data.active }, timestamp: now,
    });
    return { supplierId: supplierRef.id, alreadyApplied: false };
  });
  return result;
});

export const applyInventoryMovement = onCall(async (call) => {
  if (!call.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para registrar uma movimentação.');
  const identity = await requireInventoryWorkspace(call.auth.uid, call.auth.token, 'inventory:write');
  const data = record(call.data);
  onlyKeys(data, ['requestId', 'materialId', 'kind', 'quantity', 'orderId', 'reservationId', 'plannedQuantity']);
  if (!requestId(data.requestId) || !validInventoryId(data.materialId)) {
    throw new HttpsError('invalid-argument', 'Material e identificador único da movimentação são obrigatórios.');
  }
  const kind = data.kind as MovementKind;
  if (!['receive', 'issue', 'reserve', 'release'].includes(kind)) throw new HttpsError('invalid-argument', 'Escolha uma movimentação válida.');
  const quantity = quantityMilli(data.quantity);
  const orderId = data.orderId === undefined || data.orderId === null || data.orderId === '' ? null : data.orderId;
  const reservationId = data.reservationId === undefined || data.reservationId === null || data.reservationId === '' ? null : data.reservationId;
  if (orderId !== null && !validInventoryId(orderId)) throw new HttpsError('invalid-argument', 'O pedido associado é inválido.');
  if (reservationId !== null && !validInventoryId(reservationId)) throw new HttpsError('invalid-argument', 'A reserva escolhida é inválida.');
  if (kind === 'reserve' && (!orderId || reservationId)) throw new HttpsError('invalid-argument', 'Informe um pedido para reservar material.');
  if (kind === 'release' && !reservationId) throw new HttpsError('invalid-argument', 'Escolha a reserva que deseja liberar.');
  if (kind === 'receive' && (orderId || reservationId || (data.plannedQuantity != null && data.plannedQuantity !== ''))) throw new HttpsError('invalid-argument', 'Uma entrada de material não pode usar reserva ou pedido.');
  if (reservationId && !['issue', 'release'].includes(kind)) throw new HttpsError('invalid-argument', 'A reserva só pode ser consumida ou liberada.');
  if (kind === 'release' && orderId) throw new HttpsError('invalid-argument', 'O pedido da liberação será obtido pela reserva.');
  const planned = data.plannedQuantity === undefined || data.plannedQuantity === null || data.plannedQuantity === ''
    ? null : quantityMilli(data.plannedQuantity);
  if (planned !== null && kind !== 'reserve') throw new HttpsError('invalid-argument', 'A quantidade planejada só vale ao reservar para um pedido.');
  if (planned !== null && planned < quantity) throw new HttpsError('invalid-argument', 'O total planejado não pode ser menor que a quantidade reservada agora.');

  const atelierPath = `ateliers/${identity.atelierId}`;
  const movementRef = adminDb.doc(`${atelierPath}/inventoryMovements/${data.requestId}`);
  const materialRef = adminDb.doc(`${atelierPath}/materials/${data.materialId}`);
  const reservationRef = adminDb.doc(`${atelierPath}/inventoryReservations/${kind === 'reserve' ? data.requestId : reservationId ?? 'unused'}`);
  const auditRef = adminDb.collection('auditLogs').doc();
  const fingerprint = JSON.stringify({ kind, materialId: data.materialId, quantity, orderId, reservationId, planned });

  const result = await adminDb.runTransaction(async (transaction) => {
    await readActiveInventoryActor(transaction, identity.atelierId, call.auth!.uid, 'inventory:write');
    const [movementSnapshot, materialSnapshot] = await Promise.all([
      transaction.get(movementRef), transaction.get(materialRef),
    ]);
    if (movementSnapshot.exists) {
      if (movementSnapshot.data()?.requestFingerprint !== fingerprint) {
        throw new HttpsError('already-exists', 'Este identificador já foi usado em outra movimentação.');
      }
      return { movementId: movementRef.id, reservationId: kind === 'reserve' ? reservationRef.id : reservationId, alreadyApplied: true };
    }
    if (!materialSnapshot.exists) throw new HttpsError('not-found', 'O material não foi encontrado neste ateliê.');
    const material = materialSnapshot.data()!;
    if (material.active !== true) throw new HttpsError('failed-precondition', 'Este material está arquivado. Reative-o antes de movimentar o saldo.');
    const { onHandMilli: currentOnHand, reservedMilli: currentReserved } = storedBalance(material);

    const reservationSnapshot = kind === 'reserve' || reservationId
      ? await transaction.get(reservationRef)
      : null;
    if (kind === 'reserve' && reservationSnapshot?.exists) throw new HttpsError('already-exists', 'A reserva já existe sem uma movimentação correspondente.');
    if (reservationId && !reservationSnapshot?.exists) throw new HttpsError('not-found', 'A reserva não foi encontrada neste ateliê.');
    const reservation = reservationSnapshot?.data() ?? null;
    if (reservationId && (reservation?.materialId !== materialSnapshot.id || reservation?.status !== 'active')) {
      throw new HttpsError('failed-precondition', 'A reserva não está ativa para este material.');
    }
    const resolvedOrderId = reservationId ? String(reservation?.orderId ?? '') : orderId;
    if (reservationId && orderId && reservation?.orderId !== orderId) {
      throw new HttpsError('failed-precondition', 'A reserva pertence a outro pedido.');
    }
    if ((kind === 'reserve' || (kind === 'issue' && resolvedOrderId)) && !resolvedOrderId) {
      throw new HttpsError('invalid-argument', 'Informe um pedido ativo para vincular o material.');
    }
    const orderRef = resolvedOrderId ? adminDb.doc(`${atelierPath}/orders/${resolvedOrderId}`) : null;
    const requirementRef = resolvedOrderId
      ? adminDb.doc(`${atelierPath}/orders/${resolvedOrderId}/materialRequirements/${materialSnapshot.id}`)
      : null;
    const [orderSnapshot, requirementSnapshot] = await Promise.all([
      orderRef ? transaction.get(orderRef) : Promise.resolve(null),
      requirementRef ? transaction.get(requirementRef) : Promise.resolve(null),
    ]);
    if (orderRef && !orderSnapshot?.exists) throw new HttpsError('not-found', 'O pedido associado não foi encontrado neste ateliê.');
    const orderStatus = orderSnapshot?.data()?.status;
    if (orderRef && kind !== 'release' && ['cancelled', 'refunded', 'completed', 'delivered'].includes(String(orderStatus))) {
      throw new HttpsError('failed-precondition', 'O pedido está encerrado e não aceita novos materiais.');
    }
    const requirement = requirementSnapshot?.data() ?? null;
    if ((kind === 'release' || (kind === 'issue' && (reservationId || resolvedOrderId))) && !requirement) {
      throw new HttpsError('failed-precondition', 'O pedido não tem uma lista de materiais para este item. Registre a reserva primeiro.');
    }

    let nextOnHand = currentOnHand;
    let nextReserved = currentReserved;
    let nextReservationRemaining = reservation ? Number(reservation.remainingMilli) : 0;
    let nextRequirement: Record<string, unknown> | null = null;
    if (kind === 'receive') {
      nextOnHand += quantity;
    } else if (kind === 'issue' && reservationId) {
      if (quantity > nextReservationRemaining || quantity > currentReserved || quantity > currentOnHand) {
        throw new HttpsError('failed-precondition', 'A quantidade supera o saldo da reserva.');
      }
      nextOnHand -= quantity;
      nextReserved -= quantity;
      nextReservationRemaining -= quantity;
      nextRequirement = {
        ...requirement,
        reservedMilli: Math.max(0, Number(requirement!.reservedMilli) - quantity),
        consumedMilli: Number(requirement!.consumedMilli ?? 0) + quantity,
      };
    } else if (kind === 'issue') {
      if (quantity > currentOnHand - currentReserved) throw new HttpsError('failed-precondition', 'A saída supera o saldo disponível; libere ou ajuste as reservas primeiro.');
      nextOnHand -= quantity;
      if (requirement) {
        const plannedMilli = Number(requirement.plannedMilli ?? 0);
        const reservedMilli = Number(requirement.reservedMilli ?? 0);
        const consumedMilli = Number(requirement.consumedMilli ?? 0);
        if (plannedMilli - reservedMilli - consumedMilli < quantity) throw new HttpsError('failed-precondition', 'A saída supera a quantidade planejada para este pedido.');
        nextRequirement = { ...requirement, consumedMilli: consumedMilli + quantity };
      } else if (resolvedOrderId) {
        throw new HttpsError('failed-precondition', 'Registre primeiro a reserva planejada deste material para o pedido.');
      }
    } else if (kind === 'reserve') {
      if (quantity > currentOnHand - currentReserved) throw new HttpsError('failed-precondition', 'A reserva supera o saldo disponível.');
      nextReserved += quantity;
      const plannedMilli = planned ?? (requirement ? Number(requirement.plannedMilli) : quantity);
      const previouslyReserved = Number(requirement?.reservedMilli ?? 0);
      const previouslyConsumed = Number(requirement?.consumedMilli ?? 0);
      if (plannedMilli < previouslyReserved + previouslyConsumed + quantity) {
        throw new HttpsError('failed-precondition', 'O total planejado não pode ser menor que as quantidades já reservadas ou consumidas.');
      }
      nextRequirement = {
        ...(requirement ?? {}), plannedMilli, reservedMilli: previouslyReserved + quantity,
        consumedMilli: previouslyConsumed, materialId: materialSnapshot.id,
        materialName: material.name, unit: material.unit, unitCostCents: material.unitCostCents,
        updatedAt: FieldValue.serverTimestamp(),
        ...(!requirement ? { createdAt: FieldValue.serverTimestamp() } : {}),
      };
    } else if (kind === 'release') {
      if (quantity > nextReservationRemaining || quantity > currentReserved) throw new HttpsError('failed-precondition', 'A quantidade supera o saldo reservado.');
      nextReserved -= quantity;
      nextReservationRemaining -= quantity;
      nextRequirement = {
        ...requirement,
        reservedMilli: Math.max(0, Number(requirement!.reservedMilli) - quantity),
      };
    }
    if (nextOnHand < 0 || nextReserved < 0 || nextReserved > nextOnHand || nextOnHand > MAX_QUANTITY_MILLI) {
      throw new HttpsError('failed-precondition', 'A movimentação deixaria o saldo disponível inconsistente.');
    }

    const now = FieldValue.serverTimestamp();
    const before = { onHandMilli: currentOnHand, reservedMilli: currentReserved, availableMilli: currentOnHand - currentReserved };
    const after = { onHandMilli: nextOnHand, reservedMilli: nextReserved, availableMilli: nextOnHand - nextReserved };
    transaction.update(materialRef, { onHandMilli: nextOnHand, reservedMilli: nextReserved, updatedAt: now });
    if (kind === 'reserve') {
      transaction.create(reservationRef, {
        id: reservationRef.id, materialId: materialSnapshot.id, materialName: material.name,
        unit: material.unit, orderId: resolvedOrderId, quantityMilli: quantity,
        remainingMilli: quantity, status: 'active', createdAt: now, updatedAt: now,
      });
    } else if (reservationId) {
      transaction.update(reservationRef, {
        remainingMilli: nextReservationRemaining,
        status: nextReservationRemaining === 0 ? (kind === 'issue' ? 'consumed' : 'released') : 'active',
        updatedAt: now,
      });
    }
    if (requirementRef && nextRequirement) transaction.set(requirementRef, { ...nextRequirement, updatedAt: now });
    transaction.create(movementRef, {
      id: movementRef.id, atelierId: identity.atelierId, materialId: materialSnapshot.id,
      materialName: material.name, unit: material.unit, unitCostCents: material.unitCostCents,
      kind, quantityMilli: quantity, orderId: resolvedOrderId || null,
      reservationId: kind === 'reserve' ? reservationRef.id : reservationId,
      requestFingerprint: fingerprint, before, after, actorId: call.auth!.uid, createdAt: now,
    });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: identity.atelierId,
      action: `inventory.${kind}`, entity: 'inventory_movement', entityId: movementRef.id,
      before, after: { materialId: materialSnapshot.id, kind, quantityMilli: quantity, orderId: resolvedOrderId || null }, timestamp: now,
    });
    return { movementId: movementRef.id, reservationId: kind === 'reserve' ? reservationRef.id : reservationId, alreadyApplied: false };
  });
  return result;
});
