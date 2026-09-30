import { cn } from '@/lib/utils';

export function Avatar({ name, src, className }: { name: string; src?: string; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('pt-BR');
  return <span aria-label={name} className={cn('inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-200 to-pink-100 bg-cover bg-center text-sm font-bold text-violet-800', className)} style={src ? { backgroundImage: `url("${src.replaceAll('"', '%22')}")` } : undefined}>{src ? <span className="sr-only">{initials}</span> : initials || 'C'}</span>;
}
