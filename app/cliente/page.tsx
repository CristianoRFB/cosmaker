'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { listClientOrders } from '@/repositories/orders.repository';
import { listClientQuotes } from '@/repositories/quotes.repository';
import { listInternalNotifications } from '@/repositories/notifications.repository';
import { listMessageInbox } from '@/repositories/conversations.repository';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatOrderDate, orderStatusLabel } from '@/features/orders/order-format';
import type { Order } from '@/types/order';
import type { Quote } from '@/types/quote';
import type { Notification } from '@/types/notification';
import type { ConversationSummary } from '@/types/conversation';

type Home = { uid: string; orders: Order[]; quotes: Quote[]; notifications: Notification[]; conversations: ConversationSummary[]; errors: string[]; loading: boolean };
const empty = (uid: string): Home => ({ uid, orders: [], quotes: [], notifications: [], conversations: [], errors: [], loading: true });
const linkClass = 'inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-violet-700 underline underline-offset-4';

export default function DashboardDoCliente() {
  const { user, firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || '';
  const [home, setHome] = useState<Home>(() => empty(''));
  const [revision, setRevision] = useState(0);
  const verified = firebaseUser?.emailVerified === true;
  useEffect(() => {
    let active = true;
    setHome(empty(uid));
    if (!uid || !verified || !user?.active || user.accountType !== 'client') return () => { active = false; };
    void Promise.allSettled([listClientOrders(user.email), listClientQuotes(), listInternalNotifications(), listMessageInbox()]).then(([orders, quotes, notifications, messages]) => {
      if (!active) return;
      const results = [orders, quotes, notifications, messages];
      const names = ['pedidos', 'propostas', 'notificações', 'mensagens'];
      setHome({ uid, loading: false,
        orders: orders.status === 'fulfilled' ? orders.value : [],
        quotes: quotes.status === 'fulfilled' ? quotes.value.quotes : [],
        notifications: notifications.status === 'fulfilled' ? notifications.value.notifications : [],
        conversations: messages.status === 'fulfilled' ? messages.value.conversations : [],
        errors: results.flatMap((result, index) => result.status === 'rejected' ? [`Não foi possível consultar ${names[index]}. Verifique sua conexão e seu acesso.`] : []),
      });
    });
    return () => { active = false; };
  }, [uid, verified, user?.active, user?.accountType, user?.email, revision]);
  if (!user || !user.active || user.accountType !== 'client') return <p role="alert">Sua conta não tem acesso ao portal do cliente.</p>;
  if (!verified) return <Card className="p-5"><h1 className="text-2xl font-semibold">Minha área</h1><p className="mt-3">Confirme seu e-mail para consultar pedidos, propostas e mensagens.</p><Link className={linkClass} href="/verificar-email">Verificar e-mail</Link></Card>;
  const data = home.uid === uid ? home : empty(uid);
  const pending = data.quotes.filter(quote => quote.status === 'sent');
  return <section className="grid gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="break-words text-2xl font-semibold">Olá, {user.name}</h1><p className="mt-1 text-sm text-slate-600">Acompanhe seus projetos e próximos passos.</p></div><Button variant="secondary" disabled={data.loading} onClick={() => setRevision(value => value + 1)}>Atualizar</Button></div>
    {data.errors.length ? <Card role="alert" className="border-rose-200 p-4 text-sm text-rose-800">{data.errors.map(message => <p key={message}>{message}</p>)}</Card> : null}
    {data.loading ? <p role="status">Carregando sua conta…</p> : <>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="min-w-0 p-5"><h2 className="text-lg font-semibold">Pedidos recentes</h2>
          {!data.orders.length ? <p className="mt-3 text-sm text-slate-600">{data.errors.some(error => error.includes('pedidos')) ? 'Pedidos indisponíveis no momento.' : 'Seus pedidos aparecerão após a aprovação de uma proposta.'}</p> : <ul className="mt-3 divide-y divide-slate-100">{data.orders.slice(0, 5).map(order => <li className="py-3" key={`${order.atelierId}/${order.id}`}>
            <Link className={`${linkClass} break-words`} href={`/cliente/pedidos/${encodeURIComponent(order.id)}?atelierId=${encodeURIComponent(order.atelierId)}`}>{order.character || 'Projeto de cosplay'}</Link>
            <p className="text-sm text-slate-600">{orderStatusLabel[order.status] || order.status} · {Number.isFinite(order.progress) ? `${order.progress}% de produção` : 'Progresso a confirmar'}</p>
            <p className="mt-1 text-sm text-slate-600">Entrega prevista: {formatOrderDate(order.expectedDeliveryDate)}</p>
            {order.status === 'waiting_deposit' || order.status === 'waiting_final_payment' ? <p className="mt-2 text-sm">Próximo passo: confira os registros de pagamento e combine o recebimento com o ateliê.</p> : order.planningNeedsReview ? <p className="mt-2 text-sm">O ateliê está revisando o planejamento deste projeto.</p> : null}
          </li>)}</ul>}
          <Link className={linkClass} href="/cliente/pedidos">Ver pedidos</Link><Link className={linkClass} href="/cliente/pagamentos">Ver pagamentos</Link>
        </Card>
        <Card className="min-w-0 p-5"><h2 className="text-lg font-semibold">Propostas para analisar</h2>
          {pending.length ? <ul className="mt-3 grid gap-2">{pending.slice(0, 5).map(quote => <li key={`${quote.atelierId}/${quote.id}`}><Link className={`${linkClass} break-all`} href={`/cliente/orcamentos/${encodeURIComponent(quote.id)}?atelierId=${encodeURIComponent(quote.atelierId!)}`}>Analisar proposta {quote.id}</Link><p className="text-sm text-slate-600">Validade: {formatOrderDate(quote.validUntil)}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-600">{data.errors.some(error => error.includes('propostas')) ? 'Propostas indisponíveis no momento.' : 'Nenhuma proposta aguardando resposta nesta página recente.'}</p>}
          <Link className={linkClass} href="/cliente/orcamentos">Ver todas as propostas</Link>
        </Card>
        <Card className="min-w-0 p-5"><h2 className="text-lg font-semibold">Mensagens dos projetos</h2>
          {data.conversations.length ? <ul className="mt-3 grid gap-3">{data.conversations.slice(0, 3).map(conversation => <li key={`${conversation.atelierId}/${conversation.id}`}><p className="break-words text-sm font-medium">{conversation.character} {conversation.unread > 0 ? `· ${conversation.unread} não lidas` : ''}</p><p className="mt-1 break-words text-sm text-slate-600">{conversation.preview}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-600">{data.errors.some(error => error.includes('mensagens')) ? 'Mensagens indisponíveis no momento.' : 'Suas conversas com os ateliês aparecerão aqui.'}</p>}
          <Link className={linkClass} href="/cliente/mensagens">Abrir mensagens</Link>
        </Card>
        <Card className="min-w-0 p-5"><h2 className="text-lg font-semibold">Notificações recentes</h2>
          {data.notifications.length ? <ul className="mt-3 grid gap-3">{data.notifications.slice(0, 3).map(notification => <li key={`${notification.atelierId}/${notification.id}`}><p className="break-words text-sm font-medium">{notification.title}{notification.read ? '' : ' · Nova'}</p><p className="mt-1 break-words text-sm text-slate-600">{notification.message}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-600">{data.errors.some(error => error.includes('notificações')) ? 'Notificações indisponíveis no momento.' : 'Nenhuma notificação registrada.'}</p>}
          <Link className={linkClass} href="/cliente/notificacoes">Ver notificações</Link>
        </Card>
      </div>
      <Card className="min-w-0 p-5"><h2 className="text-lg font-semibold">Minha conta</h2><p className="mt-2 break-all text-sm text-slate-600">{firebaseUser?.email} · E-mail verificado</p><Link className={linkClass} href="/cliente/perfil">Editar meu perfil</Link></Card>
    </>}
  </section>;
}
