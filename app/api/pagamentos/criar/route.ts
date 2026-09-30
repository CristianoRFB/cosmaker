import { integrationUnavailable } from '@/lib/errors/api';
export async function POST() { return integrationUnavailable('pagamentos'); }
