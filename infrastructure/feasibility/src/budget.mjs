export const FREE_LIMITS = Object.freeze({ cpuMs: 10, subrequests: 50, isolateBytes: 128 * 1024 * 1024, requestsPerDay: 100000, connections: 6 });
export class BudgetFault extends Error {
  constructor(code, status = 429) { super(code); this.code = code; this.status = status; }
}
// Synthetic single-process ledger. It is NOT a distributed account-wide quota service.
export class DailyLedger {
  constructor() { this.days = new Map(); }
  charge(now = new Date()) {
    const key = now.toISOString().slice(0, 10), next = (this.days.get(key) || 0) + 1;
    if (next > FREE_LIMITS.requestsPerDay) throw new BudgetFault('DAILY_REQUEST_BUDGET');
    this.days.set(key, next);
    return next;
  }
}
// Reservation guard, not a measurement of total V8/native heap or other code in the isolate.
export class MemoryReservations {
  used = 0;
  peak = 0;
  constructor() { this.available = FREE_LIMITS.isolateBytes - 32 * 1024 * 1024; }
  reserve(bytes) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || this.used + bytes > this.available) throw new BudgetFault('MEMORY_RESERVATION_BUDGET');
    this.used += bytes; this.peak = Math.max(this.peak, this.used);
    let released = false;
    return () => { if (!released) { this.used -= bytes; released = true; } };
  }
}
export class InvocationBudget {
  count = 0;
  connections = 0;
  constructor(fetcher = (...args) => fetch(...args)) { this.fetcher = fetcher; }
  assertStrictCpu() {
    // No trusted per-invocation CPU enforcer/counter is available in this local runtime.
    // Neither client metadata nor wall-clock timers may manufacture this guarantee.
    throw new BudgetFault('CPU_ENFORCER_UNAVAILABLE', 503);
  }
  async fetch(url, init = {}) {
    if (this.count >= FREE_LIMITS.subrequests) throw new BudgetFault('SUBREQUEST_BUDGET');
    if (this.connections >= FREE_LIMITS.connections) throw new BudgetFault('CONNECTION_BUDGET');
    this.count++; this.connections++;
    let released = false;
    const release = () => { if (!released) { released = true; this.connections--; } };
    try {
      const response = await this.fetcher(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(15000) });
      if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); throw new BudgetFault('REDIRECT_REFUSED', 502); }
      if (!response.body) { release(); return response; }
      const reader = response.body.getReader();
      const body = new ReadableStream({
        async pull(controller) {
          try { const { done, value } = await reader.read(); if (done) { release(); controller.close(); } else controller.enqueue(value); }
          catch (e) { release(); controller.error(e); }
        },
        async cancel(reason) { try { await reader.cancel(reason); } finally { release(); } },
      });
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (e) { release(); throw e; }
  }
  report() {
    return { limitsRequested: FREE_LIMITS, subrequests: this.count, openConnections: this.connections,
      subrequestsEnforced: true, connectionGuardEnforced: true, cpuEnforced: false, measuredInvocationCpuMs: null,
      memoryMeasuredByThisGuard: false, dailyAccountQuotaDistributed: false, hostedAcceptance: false };
  }
}
