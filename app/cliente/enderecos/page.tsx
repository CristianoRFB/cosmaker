import Link from 'next/link';
import { Card } from '@/components/ui/card';
export default function Endereços() {
  return <section className="grid gap-5"><h1 className="text-2xl font-semibold">Dados de entrega</h1><Card className="grid gap-3 p-5"><p className="text-sm leading-6 text-slate-600">Combine a retirada ou o envio com o ateliê na conversa do pedido. O histórico de entrega fica registrado no projeto.</p><Link className="inline-flex min-h-11 items-center font-semibold text-violet-700 underline" href="/cliente/pedidos">Abrir meus pedidos</Link><Link className="inline-flex min-h-11 items-center font-semibold text-violet-700 underline" href="/cliente/mensagens">Combinar entrega com o ateliê</Link><Link className="inline-flex min-h-11 items-center font-semibold text-violet-700 underline" href="/cliente/perfil">Atualizar meu contato</Link></Card></section>;
}
