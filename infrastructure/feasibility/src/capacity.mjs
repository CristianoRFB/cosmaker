import { DAY, MiB, tierOf, updateActivity, retentionFor } from '../../media/src/policy.mjs';

export const MAX_BYTES = 20 * MiB;
const int = (n, label, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw Error('Invalid ' + label);
  return n;
};
const sum = values => values.reduce((a, b) => int(a + b, 'sum'), 0);
const iso = day => new Date(Date.UTC(2026, 9, 26) + day * DAY).toISOString();
const dayOf = date => Math.round((Date.parse(date) - Date.UTC(2026, 9, 26)) / DAY);
export function physicalBytes(size, encoding = 'binary') {
  int(size, 'bytes', MAX_BYTES);
  if (!['binary', 'rtdb'].includes(encoding)) throw Error('Unknown encoding');
  return encoding === 'binary' ? size : 4 * Math.ceil(size / 3) + Math.ceil(size / (512 * 1024)) * 1024 + 4096;
}
export function p95(values) {
  if (!values.length) return 0;
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
}
export function finiteGrowth({ capacity, initial = 0, permanentBytesPerDay }) {
  int(capacity, 'capacity'); int(initial, 'initial'); int(permanentBytesPerDay, 'growth');
  return { daysUntilFull: permanentBytesPerDay ? Math.max(0, Math.ceil((capacity - initial) / permanentBytesPerDay)) : null,
    unlimitedGrowthPossible: false, zeroGrowth: permanentBytesPerDay === 0 };
}
export function boundedEnvelope({ capacity, tenants, meanBytes = MAX_BYTES, lifetimeDays = 51, copies = 2, fixedBytes = 0, pendingBytes = 0 }) {
  for (const [k, v] of Object.entries({ capacity, tenants, meanBytes, lifetimeDays, copies, fixedBytes, pendingBytes })) int(v, k);
  if (!tenants || !meanBytes || !lifetimeDays || !copies) throw Error('Positive envelope dimensions required');
  const available = Math.max(0, Math.floor(capacity * .8) - fixedBytes - pendingBytes - 1);
  return { availableAt80Percent: available, globalFilesPerDayUpperBound: available / (meanBytes * lifetimeDays * copies),
    filesPerTenantPerDayUpperBound: available / (meanBytes * lifetimeDays * copies * tenants),
    conditionalOn: 'All files eligible and actually deleted after lifetime; no permanent growth/holds/orphans. Not a commercial entitlement.' };
}

// Pure synthetic event model. No provider calls, credentials, file bytes or live deletes.
// Demand and guarded admission run independently: rejection can change the activity tier.
export function simulate(options, { guarded = false } = {}) {
  const o = { days: 180, tenants: 1, photosPerDay: 2, rateDenominator: 1, sizes: [MAX_BYTES],
    capacity: 1_000_000_000, encoding: 'binary', monthlyEgress: 5_000_000_000,
    workflowDays: 14, deleteLagDays: 1, backupCopies: 1, backupSameQuota: true,
    previewBytes: 0, versionEvery: 0, purgeVersions: false, orphanEvery: 0,
    persistentEvery: 0, protectedEvery: 0, holdEvery: 0, unknownEvery: 0,
    fixedBytesPerTenant: 0, downloadsPerUpload: 1, dailyReadsPer100Assets: 0,
    initialPendingPerTenant: 0, failNotices: false, growthBpsPer30Days: 0,
    suppressFutureUploadsAfterDay: null, ...options };
  for (const k of ['days','tenants','photosPerDay','rateDenominator','capacity','workflowDays','deleteLagDays','backupCopies','previewBytes','versionEvery','orphanEvery','persistentEvery','protectedEvery','holdEvery','unknownEvery','fixedBytesPerTenant','downloadsPerUpload','dailyReadsPer100Assets','initialPendingPerTenant','growthBpsPer30Days']) int(o[k], k);
  if (!o.tenants || o.tenants > 20 || !o.rateDenominator || !o.days || o.days > 730 || !Array.isArray(o.sizes) || !o.sizes.length || o.sizes.some(s => !Number.isSafeInteger(s) || s < 1 || s > MAX_BYTES)) throw Error('Unbounded scenario');
  if (o.monthlyEgress !== null) int(o.monthlyEgress, 'egress');
  const tenant = Array.from({ length: o.tenants }, () => ({ activity: null, events: [], carry: 0n, carryDen: BigInt(o.rateDenominator), assets: [], fixed: o.fixedBytesPerTenant }));
  let sequence = 0, accepted = 0, rejected = 0, requested = 0, logical = 0, previews = 0, versions = 0, backups = 0, externalBackups = 0, orphans = 0;
  const pending = physicalBytes(MAX_BYTES, o.encoding) * o.initialPendingPerTenant * o.tenants;
  const records = [], months = {}; let peak = 0, warningDay = null, firstStorageBlock = null, firstEgressBlock = null, deleted = 0, noticeFailures = 0;
  const activeBytes = () => sum([logical, previews, versions, backups, orphans, o.fixedBytesPerTenant * o.tenants]);
  const tierChanges = [];
  for (let day = 0; day < o.days; day++) {
    const month = iso(day).slice(0, 7), billing = months[month] ||= { egressEstimate: 0, blockedReads: 0, occupiedByteDays: 0, days: 0, calendarDays: new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5,7)), 0)).getUTCDate(), requestedEgress: 0 };
    for (let n = 0; n < tenant.length; n++) {
      const t = tenant[n]; t.events = t.events.filter(e => e.day >= day - 30);
      for (const a of t.assets) {
        if (a.deleted || a.closeDay > day) continue;
        if (a.lastTier !== (t.activity?.tier || 'NONE') || !a.retention) {
          a.retention = retentionFor({ mediaClass: a.mediaClass, origin: 'synthetic_capacity_model', legalHold: a.hold,
            links: [{ id: 'order', completedAt: iso(a.closeDay) }], retention: a.retention }, t.activity?.tier || 'NONE', Date.parse(iso(day)));
          a.lastTier = t.activity?.tier || 'NONE';
        }
        const r = a.retention;
        if (r.noAutoDelete) continue;
        if (day >= dayOf(r.warningAt) && a.warningDay === null && !o.failNotices) a.warningDay = day;
        if (day >= dayOf(r.dueAt) && a.dueDay === null && !o.failNotices) a.dueDay = day;
        if (o.failNotices && day >= dayOf(r.warningAt) && !a.failureCounted) { noticeFailures++; a.failureCounted = true; }
        const effective = Math.max(dayOf(r.graceUntil), (a.warningDay ?? Infinity) + r.graceDays, (a.dueDay ?? Infinity) + r.graceDays) + o.deleteLagDays;
        if (day < effective || a.hold) continue;
        // Model removal of known eligible versions, never name-only deletion pretending to free versions.
        a.deleted = true; deleted++; logical -= a.original; previews -= a.preview; backups -= a.backup; externalBackups -= a.externalBackup;
        if (o.purgeVersions) versions -= a.version;
      }
      const beforeTier = t.activity?.tier;
      const window = { uploads: t.events.length, bytes: sum(t.events.map(e => e.size)), startAt: iso(day - 30), endAt: iso(day) };
      // Fixed non-overlapping windows are closed on day30/60; rolling observations can only raise tier.
      t.activity = updateActivity(t.activity, window, { closed: day > 0 && day % 30 === 0 });
      if (beforeTier !== t.activity?.tier) tierChanges.push({ day, tenant: n, tier: t.activity?.tier || 'NONE' });
      const periods = Math.floor(day / 30), numerator = BigInt(o.photosPerDay) * BigInt(10000 + o.growthBpsPer30Days) ** BigInt(periods);
      const denominator = BigInt(o.rateDenominator) * 10000n ** BigInt(periods);
      // Denominators grow by10000 each period; retain exact fractional carry.
      t.carry *= denominator / t.carryDen; t.carryDen = denominator; t.carry += numerator;
      const count = Number(t.carry / denominator); t.carry %= denominator;
      if (count > 100) throw Error('Scenario growth exceeds declared simulation bound');
      for (let k = 0; k < count; k++) {
        if (o.suppressFutureUploadsAfterDay !== null && day >= o.suppressFutureUploadsAfterDay) continue;
        const index = ++sequence, size = o.sizes[(index - 1) % o.sizes.length], original = physicalBytes(size, o.encoding);
        const preview = o.previewBytes ? physicalBytes(o.previewBytes, o.encoding) : 0;
        const version = o.versionEvery && index % o.versionEvery === 0 ? original : 0;
        const backupBytes = (original + preview + version) * o.backupCopies;
        const backup = o.backupSameQuota ? backupBytes : 0, externalBackup = o.backupSameQuota ? 0 : backupBytes;
        const reserved = sum([original, preview, version, backup]); requested++;
        const projected = activeBytes() + pending + reserved; peak = Math.max(peak, projected);
        if (warningDay === null && projected >= o.capacity * .7) warningDay = day;
        if (guarded && (projected >= o.capacity * .8 || noticeFailures > 0)) { rejected++; if (firstStorageBlock === null) firstStorageBlock = day; continue; }
        if (!guarded && firstStorageBlock === null && projected >= o.capacity * .8) firstStorageBlock = day;
        accepted++;
        if (o.orphanEvery && index % o.orphanEvery === 0) { orphans += reserved; continue; } // Conservative reserved bytes, not a claim of provider measured size.
        const mediaClass = o.protectedEvery && index % o.protectedEvery === 0 ? 'PROTECTED_REGULATED'
          : o.persistentEvery && index % o.persistentEvery === 0 ? 'PERSISTENT_BUSINESS'
            : o.unknownEvery && index % o.unknownEvery === 0 ? 'UNKNOWN_LEGACY' : 'TEMP_WORKFLOW';
        t.assets.push({ original, preview, version, backup, externalBackup, mediaClass, hold: !!(o.holdEvery && index % o.holdEvery === 0), closeDay: day + o.workflowDays, retention: null, lastTier: null, warningDay: null, dueDay: null, deleted: false });
        logical += original; previews += preview; versions += version; backups += backup; externalBackups += externalBackup;
        t.events.push({ day, size });
        const rolling = t.events.filter(e => e.day > day - 30);
        t.activity = updateActivity(t.activity, { uploads: rolling.length, bytes: sum(rolling.map(e => e.size)), startAt: iso(day - 29), endAt: iso(day + 1) });
        const egress = original * (1 + o.downloadsPerUpload + o.backupCopies); // trusted verification + downloads + backup read
        billing.requestedEgress += egress;
        if (guarded && o.monthlyEgress !== null && billing.egressEstimate + egress > o.monthlyEgress) { billing.blockedReads++; if (firstEgressBlock === null) firstEgressBlock = day; }
        else billing.egressEstimate += egress;
      }
    }
    const recurring = tenant.reduce((s, t) => s + Math.ceil(t.assets.filter(a => !a.deleted).length * o.dailyReadsPer100Assets / 100), 0) * physicalBytes(Math.max(...o.sizes), o.encoding);
    billing.requestedEgress += recurring;
    if (guarded && o.monthlyEgress !== null && billing.egressEstimate + recurring > o.monthlyEgress) { billing.blockedReads++; if (firstEgressBlock === null) firstEgressBlock = day; } else billing.egressEstimate += recurring;
    const occupied = activeBytes() + pending; peak = Math.max(peak, occupied); billing.occupiedByteDays += Math.max(0, occupied - pending - orphans); billing.days++;
    records.push({ day, occupied, originals: logical, previews, hiddenVersions: versions, backupsSameQuota: backups, backupsOutsideQuota: externalBackups, orphanReservations: orphans, pendingReservations: pending, fixed: o.fixedBytesPerTenant * o.tenants });
  }
  for (const month of Object.values(months)) {
    month.averageStoredBytes = Math.floor(month.occupiedByteDays / month.calendarDays);
    month.b2HypotheticalFreeEgress = 3 * month.averageStoredBytes;
    month.b2OverageExposureBytes = Math.max(0, month.requestedEgress - month.b2HypotheticalFreeEgress);
    month.partialMonth = month.days !== month.calendarDays; // Actual billing interval must be validated with provider.
  }
  return { mode: guarded ? 'GUARDED_MODEL' : 'UNCONSTRAINED_DEMAND_NOT_PROVIDER_USAGE', options: o, accepted, rejected, requested, deleted, noticeFailures,
    firstStorageBlockDay: firstStorageBlock, firstEgressBlockDay: firstEgressBlock, warningDay, peakProjectedBytes: peak,
    peakOccupiedBytes: Math.max(...records.map(r => r.occupied)), p95OccupiedBytes: p95(records.map(r => r.occupied)), last: records.at(-1), months, tierChanges,
    activeTenantRecords: tenant.filter(t => t.activity !== null).length,
    providerTelemetry: false, realDeletes: false };
}
