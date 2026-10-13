export interface Client {
  id: string;
  hasLinkedAccount: boolean;
  name: string;
  email: string;
  phone: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ClientInput {
  name: string;
  email: string;
  phone?: string;
}

export interface ClientPage {
  clients: Client[];
  nextCursor: string | null;
}

export interface ClientHistoryRecord {
  id: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface ClientInteraction extends ClientHistoryRecord {
  type: 'note';
  note: string;
}

export interface ClientHistory {
  requests: ClientHistoryRecord[];
  quotes: ClientHistoryRecord[];
  orders: ClientHistoryRecord[];
  payments: ClientHistoryRecord[];
  measurements: Array<{ id: string; name?: string; active?: boolean; createdAt?: string | null; updatedAt?: string | null }>;
  interactions: ClientInteraction[];
  access: {
    quotes: boolean;
    orders: boolean;
    finance: boolean;
    measurements: boolean;
  };
}

export interface ClientDetail {
  client: Client;
  history: ClientHistory;
}
