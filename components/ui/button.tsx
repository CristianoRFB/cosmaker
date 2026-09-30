import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ className, variant = 'primary', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const variants: Record<Variant, string> = {
    primary: 'bg-violet-700 text-white shadow-sm hover:bg-violet-800 focus-visible:ring-violet-500',
    secondary: 'border border-violet-200 bg-white text-violet-800 hover:bg-violet-50 focus-visible:ring-violet-500',
    ghost: 'text-slate-700 hover:bg-violet-50 focus-visible:ring-violet-500',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500',
  };
  return <button className={cn('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', variants[variant], className)} type={type} {...props} />;
}
