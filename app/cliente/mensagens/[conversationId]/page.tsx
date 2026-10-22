'use client';
import { useParams } from 'next/navigation';
import { MessagesWorkspace } from '@/components/messages/messages-workspace';
export default function MessagePage() { const { conversationId } = useParams<{ conversationId: string }>(); return <MessagesWorkspace viewer="client" selectedOrderId={conversationId} />; }
