import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { captureProcessTree, processIdentity, signalProcessTree } from '../../scripts/cloud-process-tree.mjs';

it.runIf(process.platform === 'linux')('stops a detached emulator descendant after its parent exits without targeting unrelated or recycled PIDs', async () => {
  const leafCode = `process.on('SIGTERM', () => {}); setInterval(() => {}, 1000); process.send('ready');`;
  const parentCode = `
    const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, ['-e', ${JSON.stringify(leafCode)}], {
      detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc']
    });
    child.once('message', () => process.send(child.pid));
    setInterval(() => {}, 1000);
  `;
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  const parent = spawn(process.execPath, ['-e', parentCode], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let owned = [];
  try {
    const [leafPid] = await once(parent, 'message');
    owned = captureProcessTree([processIdentity(parent.pid)]);
    expect(owned.map(({ pid }) => pid)).toEqual(expect.arrayContaining([parent.pid, leafPid]));
    expect(owned.some(({ pid }) => pid === unrelated.pid)).toBe(false);
    const unrelatedIdentity = processIdentity(unrelated.pid);
    signalProcessTree([{ ...unrelatedIdentity, start: 'not-the-kernel-start-time' }], 'SIGKILL');
    expect(processIdentity(unrelated.pid)).toEqual(unrelatedIdentity);
    const exited = once(parent, 'exit');
    signalProcessTree(owned, 'SIGTERM');
    await exited;
    expect(processIdentity(leafPid)).not.toBeNull();
    owned = captureProcessTree(owned);
    expect(owned.map(({ pid }) => pid)).toContain(leafPid);
    signalProcessTree(owned, 'SIGKILL');
    await expect.poll(() => processIdentity(leafPid)).toBeNull();
    expect(processIdentity(unrelated.pid)).not.toBeNull();
  } finally {
    signalProcessTree(owned, 'SIGKILL');
    parent.kill('SIGKILL');
    unrelated.kill('SIGKILL');
  }
}, 10000);
