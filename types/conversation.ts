export interface ConversationSummary { id: string; atelierId: string; character: string; preview: string; lastMessageAt: string; unread: number }
export interface MessageAttachment { id: string; available: boolean; originalName?: string; contentType?: string; size?: number }
export interface InternalMessage { id: string; sequence: number; mine: boolean; sender: string; text: string; createdAt: string; attachments: MessageAttachment[] }
export interface OrderConversation { orderId: string; atelierId: string; character: string; canSend: boolean; lastSequence: number; readSequence: number; peerReadSequence: number; messages: InternalMessage[]; attachments: MessageAttachment[]; nextBeforeSequence: number | null }
