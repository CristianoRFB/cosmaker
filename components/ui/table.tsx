import type { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) { return <div className="w-full overflow-x-auto"><table className={cn('w-full border-collapse text-left text-sm', className)} {...props} /></div>; }
export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <thead className={cn('border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500', className)} {...props} />; }
export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <tbody className={className} {...props} />; }
export function TableHeader({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) { return <th className={cn('px-4 py-3 font-semibold', className)} {...props} />; }
export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) { return <td className={cn('border-b border-slate-100 px-4 py-3 align-middle', className)} {...props} />; }
