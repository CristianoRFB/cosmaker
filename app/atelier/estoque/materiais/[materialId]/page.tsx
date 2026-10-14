'use client';

import { useParams } from 'next/navigation';
import { InventoryWorkspace } from '@/components/inventory/inventory-workspace';

export default function Material() {
  const params = useParams<{ materialId: string }>();
  return <InventoryWorkspace view="materials" selectedMaterialId={params.materialId} />;
}
