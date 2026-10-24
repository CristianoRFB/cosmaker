import { readdirSync, readFileSync } from 'node:fs';

// Linux emulator children (notably Pub/Sub) can create their own process group.
// Match PID AND kernel start time so a recycled PID never becomes a target.
export function processIdentity(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    if (fields[0] === 'Z') return null;
    return { pid: Number(pid), parent: Number(fields[1]), start: fields[19] };
  } catch { return null; }
}

export function captureProcessTree(roots) {
  const alive = new Map();
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    const identity = processIdentity(Number(name));
    if (identity) alive.set(identity.pid, identity);
  }
  const owned = new Map();
  for (const root of roots) {
    const current = alive.get(root.pid);
    if (current?.start === root.start) owned.set(root.pid, current);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const identity of alive.values()) {
      if (!owned.has(identity.pid) && owned.has(identity.parent)) {
        owned.set(identity.pid, identity);
        changed = true;
      }
    }
  }
  return [...owned.values()];
}

export function signalProcessTree(identities, signal) {
  for (const identity of [...identities].reverse()) {
    if (processIdentity(identity.pid)?.start !== identity.start) continue;
    try { process.kill(identity.pid, signal); } catch { /* Already exited. */ }
  }
}
