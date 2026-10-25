/** Explicit experimental transport. No implicit fallback to paid Functions. */
export async function sparkProofCall<T>(operation: 'getTenantWorkspace' | 'recordFinanceEntry', token: string, data: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/spark-proof/${operation}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ data }),
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error?.message || 'Não foi possível acessar a prova local.');
  return result.data as T;
}
