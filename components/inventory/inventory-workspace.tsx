'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Package, Plus, RefreshCw, Truck, X } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  applyInventoryMovement,
  listInventoryMovements,
  listInventoryWorkspace,
  saveInventoryMaterial,
  saveInventorySupplier,
} from '@/repositories/inventory.repository';
import {
  inventoryMovementInputSchema,
  inventoryUnits,
  materialInputSchema,
  supplierInputSchema,
  type InventoryMovementInput,
  type MaterialInput,
  type SupplierInput,
} from '@/schemas/material.schema';
import { useTenant } from '@/providers/tenant-provider';
import type { InventoryMaterial, InventoryMovement, InventoryMovementKind, InventoryReservation, InventorySupplier, InventoryWorkspace } from '@/types/inventory';

type View = 'overview' | 'materials' | 'suppliers' | 'movements';
type Dialog = 'material' | 'supplier' | 'movement' | null;
type RequestKeyKind = 'material' | 'supplier' | 'movement';
type RequestKey = { id: string; fingerprint: string };
type RequestKeys = Record<RequestKeyKind, RequestKey>;
type MaterialForm = { name: string; sku: string; description: string; unit: InventoryMaterial['unit']; unitCost: string; supplierId: string; reorderPoint: string; active: boolean };

const unitLabels: Record<(typeof inventoryUnits)[number], string> = {
  un: 'unidade', g: 'g', kg: 'kg', ml: 'ml', l: 'l', cm: 'cm', m: 'm', m2: 'm²', folha: 'folha', rolo: 'rolo',
};
const movementLabels: Record<InventoryMovementKind, string> = {
  receive: 'Entrada', issue: 'Saída', reserve: 'Reserva para pedido', release: 'Liberação de reserva',
};
const emptyMaterial: MaterialForm = { name: '', sku: '', description: '', unit: 'un', unitCost: '0.00', supplierId: '', reorderPoint: '0', active: true };
const emptySupplier = { name: '', email: '', phone: '', website: '', notes: '', active: true };
const emptyMovement = { materialId: '', kind: 'receive' as InventoryMovementKind, quantity: '', orderId: '', reservationId: '', plannedQuantity: '' };

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function quantity(value: number, unit: string) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value)} ${unit}`;
}

function dateLabel(value: string | null) {
  if (!value) return 'Agora';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function firstError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) return error.message;
  return fallback;
}

export function InventoryWorkspace({ view, selectedMaterialId }: { view: View; selectedMaterialId?: string }) {
  const { atelierId, loading: tenantLoading, membershipValid, hasPermission } = useTenant();
  const canRead = hasPermission('inventory:read') || hasPermission('inventory:write');
  const canWrite = hasPermission('inventory:write');
  const [workspace, setWorkspace] = useState<InventoryWorkspace | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [nextMovementCursor, setNextMovementCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [movementFilter, setMovementFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editingMaterial, setEditingMaterial] = useState<InventoryMaterial | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null);
  const [materialForm, setMaterialForm] = useState({ ...emptyMaterial });
  const [supplierForm, setSupplierForm] = useState({ ...emptySupplier });
  const [movementForm, setMovementForm] = useState({ ...emptyMovement });
  const [search, setSearch] = useState('');
  const requestKeys = useRef<RequestKeys>({
    material: { id: crypto.randomUUID(), fingerprint: '' },
    supplier: { id: crypto.randomUUID(), fingerprint: '' },
    movement: { id: crypto.randomUUID(), fingerprint: '' },
  });

  const load = useCallback(async () => {
    setError('');
    try {
      const [nextWorkspace, nextHistory] = await Promise.all([
        listInventoryWorkspace(),
        view === 'movements' ? listInventoryMovements({ ...(movementFilter ? { materialId: movementFilter } : {}) }) : Promise.resolve({ movements: [], nextCursor: null }),
      ]);
      setWorkspace(nextWorkspace);
      setMovements(nextHistory.movements);
      setNextMovementCursor(nextHistory.nextCursor);
    } catch (loadError) {
      setError(firstError(loadError, 'Não foi possível carregar o estoque. Tente novamente.'));
      setWorkspace(null);
      setMovements([]);
      setNextMovementCursor(null);
    } finally {
      setLoading(false);
    }
  }, [movementFilter, view]);

  async function loadMoreMovements() {
    if (!nextMovementCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const nextPage = await listInventoryMovements({
        ...(movementFilter ? { materialId: movementFilter } : {}),
        cursor: nextMovementCursor,
      });
      setMovements((current) => [...current, ...nextPage.movements]);
      setNextMovementCursor(nextPage.nextCursor);
    } catch (pageError) {
      setError(firstError(pageError, 'Não foi possível carregar mais movimentações.'));
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (tenantLoading) return;
    if (!atelierId || !membershipValid || !canRead) {
      setLoading(false);
      setWorkspace(null);
      return;
    }
    setLoading(true);
    void load();
  }, [atelierId, canRead, load, membershipValid, tenantLoading]);

  useEffect(() => {
    if (!selectedMaterialId || !workspace || editingMaterial?.id === selectedMaterialId || !canWrite) return;
    const material = workspace.materials.find((item) => item.id === selectedMaterialId);
    if (material) beginEditMaterial(material);
    // The material detail route opens its existing record once the workspace loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canWrite, editingMaterial?.id, selectedMaterialId, workspace]);

  const visibleMaterials = useMemo(() => (workspace?.materials ?? []).filter((material) => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return !term || material.name.toLocaleLowerCase('pt-BR').includes(term) || material.sku.toLocaleLowerCase('pt-BR').includes(term);
  }), [search, workspace?.materials]);

  function makeRequestId(kind: RequestKeyKind, fingerprint: string) {
    const key = requestKeys.current[kind];
    if (key.fingerprint && key.fingerprint !== fingerprint) key.id = crypto.randomUUID();
    key.fingerprint = fingerprint;
    return key.id;
  }

  function resetRequestId(kind: RequestKeyKind) {
    requestKeys.current[kind] = { id: crypto.randomUUID(), fingerprint: '' };
  }

  function beginCreateMaterial() {
    setEditingMaterial(null);
    setMaterialForm({ ...emptyMaterial });
    setError(''); setNotice(''); setDialog('material'); resetRequestId('material');
  }

  function beginEditMaterial(material: InventoryMaterial) {
    setEditingMaterial(material);
    setMaterialForm({
      name: material.name, sku: material.sku, description: material.description, unit: material.unit,
      unitCost: (material.unitCostCents / 100).toFixed(2), supplierId: material.supplierId ?? '',
      reorderPoint: String(material.reorderPoint), active: material.active,
    });
    setError(''); setNotice(''); setDialog('material'); resetRequestId('material');
  }

  function beginCreateSupplier() {
    setEditingSupplier(null);
    setSupplierForm({ ...emptySupplier });
    setError(''); setNotice(''); setDialog('supplier'); resetRequestId('supplier');
  }

  function beginEditSupplier(supplier: InventorySupplier) {
    setEditingSupplier(supplier);
    setSupplierForm({ name: supplier.name, email: supplier.email, phone: supplier.phone, website: supplier.website, notes: supplier.notes, active: supplier.active });
    setError(''); setNotice(''); setDialog('supplier'); resetRequestId('supplier');
  }

  function beginMovement(kind: InventoryMovementKind = 'receive', reservation?: InventoryReservation) {
    setError(''); setNotice(''); resetRequestId('movement');
    setMovementForm({
      ...emptyMovement,
      kind,
      materialId: reservation?.materialId ?? selectedMaterialId ?? '',
      quantity: reservation ? String(reservation.remaining) : '',
      reservationId: reservation && kind !== 'reserve' ? reservation.id : '',
      orderId: kind === 'reserve' ? reservation?.orderId ?? '' : '',
    });
    setDialog('movement');
  }

  async function submitMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    const parsed = materialInputSchema.safeParse(materialForm);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise os dados do material.'); return; }
    setSaving(true);
    try {
      const requestId = makeRequestId('material', JSON.stringify([editingMaterial?.id, parsed.data]));
      await saveInventoryMaterial(parsed.data as MaterialInput, editingMaterial?.id, requestId);
      setDialog(null); setNotice(editingMaterial ? 'Material atualizado.' : 'Material cadastrado.');
      resetRequestId('material'); await load();
    } catch (saveError) { setError(firstError(saveError, 'Não foi possível salvar o material.')); }
    finally { setSaving(false); }
  }

  async function submitSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    const parsed = supplierInputSchema.safeParse(supplierForm);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise os dados do fornecedor.'); return; }
    setSaving(true);
    try {
      const requestId = makeRequestId('supplier', JSON.stringify([editingSupplier?.id, parsed.data]));
      await saveInventorySupplier(parsed.data as SupplierInput, editingSupplier?.id, requestId);
      setDialog(null); setNotice(editingSupplier ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.');
      resetRequestId('supplier'); await load();
    } catch (saveError) { setError(firstError(saveError, 'Não foi possível salvar o fornecedor.')); }
    finally { setSaving(false); }
  }

  async function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    const parsed = inventoryMovementInputSchema.safeParse(movementForm);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise os dados da movimentação.'); return; }
    setSaving(true);
    try {
      const requestId = makeRequestId('movement', JSON.stringify(parsed.data));
      await applyInventoryMovement(parsed.data as InventoryMovementInput, requestId);
      setDialog(null); setNotice('Movimentação registrada e saldo atualizado.');
      resetRequestId('movement'); await load();
    } catch (moveError) { setError(firstError(moveError, 'Não foi possível registrar a movimentação.')); }
    finally { setSaving(false); }
  }

  if (tenantLoading || loading) return <div aria-label="Carregando estoque" className="grid gap-4"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>;
  if (!atelierId || !membershipValid) return <EmptyState title="Ateliê indisponível" description="Entre com uma conta vinculada a um ateliê ativo para consultar o estoque." icon={<Package size={20} />} />;
  if (!canRead) return <EmptyState title="Acesso restrito" description="Seu perfil não tem permissão para consultar o estoque deste ateliê." icon={<Package size={20} />} />;
  if (!workspace) return <ErrorPanel error={error} retry={() => { setLoading(true); void load(); }} />;

  return <section className="grid gap-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Operação do ateliê</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{view === 'overview' ? 'Estoque' : view === 'materials' ? 'Materiais' : view === 'suppliers' ? 'Fornecedores' : 'Movimentações'}</h1><p className="mt-1 text-sm text-slate-600">Saldos atualizados por movimentações registradas e reservas vinculadas a pedidos.</p></div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => { setLoading(true); void load(); }} variant="secondary"><RefreshCw size={16} />Atualizar</Button>{canWrite && view === 'materials' ? <Button onClick={beginCreateMaterial}><Plus size={16} />Novo material</Button> : null}{canWrite && view === 'suppliers' ? <Button onClick={beginCreateSupplier}><Plus size={16} />Novo fornecedor</Button> : null}{canWrite && view === 'movements' ? <Button onClick={() => beginMovement()}><Plus size={16} />Nova movimentação</Button> : null}</div>
    </div>

    {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{notice}</p> : null}
    {error ? <ErrorPanel error={error} retry={() => { setLoading(true); void load(); }} compact /> : null}

    <nav aria-label="Seções do estoque" className="flex flex-wrap gap-2">
      <NavLink href="/atelier/estoque" active={view === 'overview'}>Visão geral</NavLink>
      <NavLink href="/atelier/estoque/materiais" active={view === 'materials'}>Materiais</NavLink>
      <NavLink href="/atelier/estoque/fornecedores" active={view === 'suppliers'}>Fornecedores</NavLink>
      <NavLink href="/atelier/estoque/movimentacoes" active={view === 'movements'}>Movimentações</NavLink>
    </nav>

    {view === 'overview' ? <Overview workspace={workspace} /> : null}
    {view === 'materials' ? <MaterialsView materials={visibleMaterials} suppliers={workspace.suppliers} search={search} setSearch={setSearch} canWrite={canWrite} onEdit={beginEditMaterial} onMove={(material) => beginMovement('receive', { id: '', materialId: material.id, materialName: material.name, unit: material.unit, orderId: '', quantity: 0, remaining: 0, createdAt: null })} /> : null}
    {view === 'suppliers' ? <SuppliersView suppliers={workspace.suppliers} canWrite={canWrite} onEdit={beginEditSupplier} /> : null}
    {view === 'movements' ? <MovementsView
      materials={workspace.materials} reservations={workspace.reservations} movements={movements} filter={movementFilter}
      setFilter={setMovementFilter} canWrite={canWrite} onMove={beginMovement}
      nextCursor={nextMovementCursor} loadingMore={loadingMore} onLoadMore={() => void loadMoreMovements()}
    /> : null}

    {dialog ? <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-slate-950/40 p-0 sm:place-items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDialog(null); }}>
      <section aria-labelledby="inventory-dialog-title" aria-modal="true" className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7" role="dialog">
        <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950" id="inventory-dialog-title">{dialog === 'material' ? editingMaterial ? 'Editar material' : 'Novo material' : dialog === 'supplier' ? editingSupplier ? 'Editar fornecedor' : 'Novo fornecedor' : 'Registrar movimentação'}</h2><p className="mt-1 text-sm text-slate-600">{dialog === 'movement' ? 'Cada ação gera um registro permanente de auditoria.' : 'Os dados ficam restritos ao ateliê atual.'}</p></div><button aria-label="Fechar formulário" className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" disabled={saving} onClick={() => setDialog(null)} type="button"><X size={18} /></button></div>
        {error ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
        {dialog === 'material' ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submitMaterial(event)}>
          <Field label="Nome"><Input autoComplete="off" maxLength={120} onChange={(event) => setMaterialForm({ ...materialForm, name: event.target.value })} required value={materialForm.name} /></Field>
          <Field label="Código / SKU"><Input autoComplete="off" maxLength={40} onChange={(event) => setMaterialForm({ ...materialForm, sku: event.target.value })} value={materialForm.sku} /></Field>
          <Field label="Unidade"><select aria-label="Unidade" className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" onChange={(event) => setMaterialForm({ ...materialForm, unit: event.target.value as typeof materialForm.unit })} value={materialForm.unit}>{inventoryUnits.map((unit) => <option key={unit} value={unit}>{unitLabels[unit]}</option>)}</select></Field>
          <Field label="Custo por unidade (R$)"><Input inputMode="decimal" onChange={(event) => setMaterialForm({ ...materialForm, unitCost: event.target.value })} required value={materialForm.unitCost} /></Field>
          <Field label="Fornecedor"><select aria-label="Fornecedor" className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" onChange={(event) => setMaterialForm({ ...materialForm, supplierId: event.target.value })} value={materialForm.supplierId}><option value="">Sem fornecedor vinculado</option>{workspace.suppliers.map((supplier) => <option disabled={!supplier.active} key={supplier.id} value={supplier.id}>{supplier.name}{supplier.active ? '' : ' (arquivado)'}</option>)}</select></Field>
          <Field label="Avisar em saldo disponível"><Input inputMode="decimal" onChange={(event) => setMaterialForm({ ...materialForm, reorderPoint: event.target.value })} required value={materialForm.reorderPoint} /></Field>
          <Field className="sm:col-span-2" label="Descrição"><textarea className="min-h-20 rounded-xl border border-slate-300 p-3 text-sm" maxLength={500} onChange={(event) => setMaterialForm({ ...materialForm, description: event.target.value })} value={materialForm.description} /></Field>
          {editingMaterial && (editingMaterial.onHand > 0 || editingMaterial.reserved > 0) ? <p className="sm:col-span-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Para arquivar, primeiro zere o saldo e libere todas as reservas.</p> : null}
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2"><input checked={materialForm.active} onChange={(event) => setMaterialForm({ ...materialForm, active: event.target.checked })} type="checkbox" />Material ativo</label>
          <FormActions saving={saving} submitLabel={editingMaterial ? 'Salvar alterações' : 'Cadastrar material'} onCancel={() => setDialog(null)} />
        </form> : null}
        {dialog === 'supplier' ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submitSupplier(event)}>
          <Field className="sm:col-span-2" label="Nome do fornecedor"><Input maxLength={120} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} required value={supplierForm.name} /></Field>
          <Field label="E-mail"><Input autoComplete="email" maxLength={254} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} type="email" value={supplierForm.email} /></Field>
          <Field label="Telefone"><Input autoComplete="tel" maxLength={32} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} value={supplierForm.phone} /></Field>
          <Field className="sm:col-span-2" label="Site"><Input maxLength={256} onChange={(event) => setSupplierForm({ ...supplierForm, website: event.target.value })} placeholder="https://" type="url" value={supplierForm.website} /></Field>
          <Field className="sm:col-span-2" label="Observações"><textarea className="min-h-20 rounded-xl border border-slate-300 p-3 text-sm" maxLength={500} onChange={(event) => setSupplierForm({ ...supplierForm, notes: event.target.value })} value={supplierForm.notes} /></Field>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2"><input checked={supplierForm.active} onChange={(event) => setSupplierForm({ ...supplierForm, active: event.target.checked })} type="checkbox" />Fornecedor ativo</label>
          <FormActions saving={saving} submitLabel={editingSupplier ? 'Salvar alterações' : 'Cadastrar fornecedor'} onCancel={() => setDialog(null)} />
        </form> : null}
        {dialog === 'movement' ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submitMovement(event)}>
          <Field className="sm:col-span-2" label="Material"><select aria-label="Material" className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" onChange={(event) => setMovementForm({ ...movementForm, materialId: event.target.value, reservationId: '' })} required value={movementForm.materialId}><option value="">Escolha um material</option>{workspace.materials.filter((material) => material.active).map((material) => <option key={material.id} value={material.id}>{material.name} · disponível {quantity(material.available, material.unit)}</option>)}</select></Field>
          <Field label="Ação"><select aria-label="Ação" className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" onChange={(event) => setMovementForm({ ...movementForm, kind: event.target.value as InventoryMovementKind, reservationId: '', plannedQuantity: '' })} value={movementForm.kind}><option value="receive">Entrada</option><option value="issue">Saída / consumo</option><option value="reserve">Reservar para pedido</option><option value="release">Liberar reserva</option></select></Field>
          {movementForm.kind === 'release' || (movementForm.kind === 'issue' && workspace.reservations.some((reservation) => reservation.materialId === movementForm.materialId)) ? <Field label={movementForm.kind === 'release' ? 'Reserva para liberar' : 'Reserva (opcional)'}><select className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" onChange={(event) => {
            const selected = workspace.reservations.find((reservation) => reservation.id === event.target.value);
            setMovementForm({ ...movementForm, reservationId: selected?.id ?? '', materialId: selected?.materialId ?? movementForm.materialId, quantity: selected ? String(selected.remaining) : movementForm.quantity });
          }} required={movementForm.kind === 'release'} value={movementForm.reservationId}><option value="">{movementForm.kind === 'release' ? 'Escolha uma reserva' : 'Saída do saldo disponível'}</option>{workspace.reservations.filter((reservation) => reservation.materialId === movementForm.materialId).map((reservation) => <option key={reservation.id} value={reservation.id}>Pedido {reservation.orderId.slice(0, 12)} · restante {quantity(reservation.remaining, reservation.unit)}</option>)}</select></Field> : null}
          <Field label="Quantidade"><Input inputMode="decimal" max="1000000000" min="0.001" onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} required step="0.001" value={movementForm.quantity} /></Field>
          {movementForm.kind === 'reserve' ? <>
            <Field label="ID do pedido"><Input autoComplete="off" maxLength={150} onChange={(event) => setMovementForm({ ...movementForm, orderId: event.target.value })} required value={movementForm.orderId} /></Field>
            <Field label="Total planejado para este material"><Input inputMode="decimal" min={movementForm.quantity || '0.001'} onChange={(event) => setMovementForm({ ...movementForm, plannedQuantity: event.target.value })} placeholder="Opcional; igual à reserva se vazio" step="0.001" value={movementForm.plannedQuantity} /></Field>
            <p className="sm:col-span-2 rounded-xl bg-violet-50 p-3 text-sm text-violet-900">A reserva cria ou atualiza a lista de materiais deste pedido. O saldo físico só baixa quando o material é consumido.</p>
          </> : null}
          {movementForm.kind === 'issue' && !movementForm.reservationId ? <Field className="sm:col-span-2" label="ID do pedido (opcional)"><Input autoComplete="off" maxLength={150} onChange={(event) => setMovementForm({ ...movementForm, orderId: event.target.value })} value={movementForm.orderId} /></Field> : null}
          {movementForm.kind === 'release' ? <p className="sm:col-span-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">A liberação devolve a quantidade ao saldo disponível; ela não altera o saldo físico.</p> : null}
          <FormActions saving={saving} submitLabel="Registrar movimentação" onCancel={() => setDialog(null)} />
        </form> : null}
      </section>
    </div> : null}
  </section>;
}

function Overview({ workspace }: { workspace: InventoryWorkspace }) {
  const active = workspace.materials.filter((material) => material.active);
  return <div className="grid gap-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric icon={<Package size={18} />} label="Materiais ativos" value={String(active.length)} />
      <Metric icon={<Boxes size={18} />} label="Reservas em aberto" value={String(workspace.reservations.length)} />
      <Metric icon={<AlertTriangle size={18} />} label="Itens para repor" value={String(workspace.lowStock.length)} alert={workspace.lowStock.length > 0} />
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-600" size={19} />Alertas de reposição</CardTitle></CardHeader><CardContent>
      {workspace.lowStock.length === 0 ? <p className="text-sm text-slate-600">Nenhum material está no ponto de reposição configurado.</p> : <div className="divide-y divide-slate-100">{workspace.lowStock.map((material) => <article className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={material.id}><div><h2 className="font-semibold text-slate-950">{material.name}</h2><p className="text-sm text-slate-600">Disponível {quantity(material.available, material.unit)} · ponto de reposição {quantity(material.reorderPoint, material.unit)}</p></div><Badge tone="amber">Repor</Badge></article>)}</div>}
    </CardContent></Card>
  </div>;
}

function MaterialsView({ materials, suppliers, search, setSearch, canWrite, onEdit, onMove }: {
  materials: InventoryMaterial[]; suppliers: InventorySupplier[]; search: string; setSearch(value: string): void;
  canWrite: boolean; onEdit(material: InventoryMaterial): void; onMove(material: InventoryMaterial): void;
}) {
  const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Package className="text-violet-700" size={19} />Materiais cadastrados</CardTitle></CardHeader><CardContent>
    <Input aria-label="Buscar materiais" className="mb-4" maxLength={64} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou código" value={search} />
    {materials.length === 0 ? <EmptyState title={search ? 'Nenhum material encontrado' : 'Estoque sem materiais'} description={search ? 'Tente outro nome ou código.' : 'Cadastre um material para começar a controlar saldos e reservas.'} icon={<Package size={21} />} /> : <div className="divide-y divide-slate-100">{materials.map((material) => <article className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-center" key={material.id}>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-950">{material.name}</h2><Badge tone={material.active ? 'green' : 'neutral'}>{material.active ? 'Ativo' : 'Arquivado'}</Badge>{material.available <= material.reorderPoint && material.active ? <Badge tone="amber">Repor</Badge> : null}</div><p className="mt-1 text-sm text-slate-600">{material.sku ? `${material.sku} · ` : ''}{supplierNames.get(material.supplierId ?? '') ?? 'Sem fornecedor'} · {money(material.unitCostCents)} / {unitLabels[material.unit]}</p><p className="mt-1 text-sm text-slate-700">Físico {quantity(material.onHand, material.unit)} · reservado {quantity(material.reserved, material.unit)} · disponível {quantity(material.available, material.unit)}</p>{material.description ? <p className="mt-1 line-clamp-2 text-sm text-slate-500">{material.description}</p> : null}</div>
      <div className="flex gap-2">{canWrite ? <><Button disabled={!material.active} onClick={() => onMove(material)} variant="secondary">Entrada / saída</Button><Button onClick={() => onEdit(material)} variant="secondary">Editar</Button></> : null}</div>
    </article>)}</div>}
  </CardContent></Card>;
}

function SuppliersView({ suppliers, canWrite, onEdit }: { suppliers: InventorySupplier[]; canWrite: boolean; onEdit(supplier: InventorySupplier): void }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Truck className="text-violet-700" size={19} />Fornecedores</CardTitle></CardHeader><CardContent>
    {suppliers.length === 0 ? <EmptyState title="Nenhum fornecedor cadastrado" description="Guarde contatos de referência para associá-los aos materiais. Nenhuma compra ou mensagem será enviada por aqui." icon={<Truck size={21} />} /> : <div className="divide-y divide-slate-100">{suppliers.map((supplier) => <article className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={supplier.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-950">{supplier.name}</h2><Badge tone={supplier.active ? 'green' : 'neutral'}>{supplier.active ? 'Ativo' : 'Arquivado'}</Badge></div><p className="mt-1 truncate text-sm text-slate-600">{[supplier.email, supplier.phone, supplier.website].filter(Boolean).join(' · ') || 'Sem contato registrado'}</p>{supplier.notes ? <p className="mt-1 text-sm text-slate-500">{supplier.notes}</p> : null}</div>{canWrite ? <Button onClick={() => onEdit(supplier)} variant="secondary">Editar</Button> : null}</article>)}</div>}
  </CardContent></Card>;
}

function MovementsView({ materials, reservations, movements, filter, setFilter, canWrite, onMove, nextCursor, loadingMore, onLoadMore }: {
  materials: InventoryMaterial[]; reservations: InventoryReservation[]; movements: InventoryMovement[]; filter: string;
  setFilter(value: string): void; canWrite: boolean; onMove(kind: InventoryMovementKind, reservation?: InventoryReservation): void;
  nextCursor: string | null; loadingMore: boolean; onLoadMore(): void;
}) {
  const selected = materials.find((material) => material.id === filter);
  return <div className="grid gap-5">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="text-violet-700" size={19} />Reservas de pedidos</CardTitle></CardHeader><CardContent>
      {reservations.length === 0 ? <p className="text-sm text-slate-600">Nenhuma reserva em aberto.</p> : <div className="divide-y divide-slate-100">{reservations.map((reservation) => <article className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={reservation.id}><div><h2 className="font-semibold text-slate-950">{reservation.materialName}</h2><p className="text-sm text-slate-600">Pedido {reservation.orderId} · restante {quantity(reservation.remaining, reservation.unit)}</p></div>{canWrite ? <div className="flex gap-2"><Button onClick={() => onMove('issue', reservation)} variant="secondary"><ArrowDownToLine size={15} />Consumir</Button><Button onClick={() => onMove('release', reservation)} variant="secondary"><ArrowUpFromLine size={15} />Liberar</Button></div> : null}</article>)}</div>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Histórico imutável</CardTitle></CardHeader><CardContent>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row"><select aria-label="Filtrar histórico por material" className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm" onChange={(event) => setFilter(event.target.value)} value={filter}><option value="">Todos os materiais</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select>{selected ? <p className="self-center text-sm text-slate-500">Saldo disponível: {quantity(selected.available, selected.unit)}</p> : null}</div>
      {movements.length === 0 ? <p className="text-sm text-slate-600">Nenhuma movimentação registrada neste período de consulta.</p> : <div className="divide-y divide-slate-100">{movements.map((movement) => <article className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-center" key={movement.id}><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-950">{movement.materialName}</h2><Badge tone={movement.kind === 'receive' ? 'green' : movement.kind === 'issue' ? 'red' : 'violet'}>{movementLabels[movement.kind]}</Badge></div><p className="mt-1 text-sm text-slate-600">{quantity(movement.quantity, movement.unit)}{movement.orderId ? ` · Pedido ${movement.orderId}` : ''}{movement.reservationId ? ` · Reserva ${movement.reservationId.slice(0, 12)}` : ''}</p></div><div className="text-sm text-slate-600">{dateLabel(movement.createdAt)}<p>Disponível: {quantity(movement.before.available, movement.unit)} → {quantity(movement.after.available, movement.unit)}</p></div></article>)}</div>}
      {nextCursor ? <div className="mt-5 flex justify-center"><Button disabled={loadingMore} onClick={onLoadMore} variant="secondary">{loadingMore ? 'Carregando…' : 'Carregar mais movimentações'}</Button></div> : null}
    </CardContent></Card>
  </div>;
}

function Metric({ icon, label, value, alert = false }: { icon: React.ReactNode; label: string; value: string; alert?: boolean }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><span className={`grid size-10 place-items-center rounded-xl ${alert ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>{icon}</span><div><p className="text-sm text-slate-600">{label}</p><p className="text-xl font-bold text-slate-950">{value}</p></div></CardContent></Card>;
}

function Field({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${className}`}>{label}{children}</label>;
}

function FormActions({ saving, submitLabel, onCancel }: { saving: boolean; submitLabel: string; onCancel(): void }) {
  return <div className="flex flex-col-reverse justify-end gap-2 pt-1 sm:col-span-2 sm:flex-row"><Button disabled={saving} onClick={onCancel} type="button" variant="secondary">Cancelar</Button><Button disabled={saving} type="submit">{saving ? 'Salvando…' : submitLabel}</Button></div>;
}

function ErrorPanel({ error, retry, compact = false }: { error: string; retry(): void; compact?: boolean }) {
  return <div className={`rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-800 ${compact ? 'p-3' : 'p-4'}`} role="alert"><p>{error || 'O estoque não pôde ser carregado.'}</p><Button className="mt-3" onClick={retry} variant="secondary">Tentar novamente</Button></div>;
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <a aria-current={active ? 'page' : undefined} className={`inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-semibold ${active ? 'bg-violet-700 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`} href={href}>{children}</a>;
}
