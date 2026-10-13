'use client';

import { atelierPermissionCatalog } from '@/lib/permissions/roles';
import { teamPermissionLabel } from '@/lib/team/presentation';

export function PermissionPicker({
  value, onChange, allowed,
}: {
  value: string[];
  onChange: (permissions: string[]) => void;
  allowed: string[] | null;
}) {
  return <fieldset className="grid gap-3">
    <legend className="text-sm font-semibold text-slate-800">Permissões específicas</legend>
    <p className="text-xs leading-5 text-slate-500">Selecione somente os acessos necessários para o trabalho desta pessoa.</p>
    <div className="grid gap-2 sm:grid-cols-2">
      {atelierPermissionCatalog.map((permission) => {
        const permitted = allowed === null || allowed.includes(permission);
        return <label className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${permitted ? 'border-slate-200 text-slate-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`} key={permission}>
          <input
            checked={value.includes(permission)}
            className="mt-1 accent-violet-700"
            disabled={!permitted}
            onChange={(event) => onChange(event.target.checked
              ? [...value, permission]
              : value.filter((entry) => entry !== permission))}
            type="checkbox"
          />
          <span><span className="block font-medium">{teamPermissionLabel[permission]}</span><span className="block text-xs">{permission}</span></span>
        </label>;
      })}
    </div>
  </fieldset>;
}
