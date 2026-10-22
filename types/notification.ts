export interface Notification { id: string; atelierId: string; orderId: string; type: 'order_message' | 'approval_required'; title: string; message: string; read: boolean; createdAt: string }
