import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from '../../src/storage/database.js';
import { listInventory } from '../../src/storage/inventory.js';

const child = fileURLToPath(new URL('../fixtures/writer-process.js', import.meta.url));

function run(mode: string, path: string) {
  const p = spawn(process.execPath, ['--no-warnings', child, mode, path], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  const lines: Array<(l: string) => void> = [];
  p.stdout.on('data', (d) => { out += d; for (const f of lines) f(out); });
  const waitFor = (s: string) => new Promise<void>((res) => {
    if (out.includes(s)) return res();
    lines.push((o) => { if (o.includes(s)) res(); });
  });
  const done = new Promise<{ code: number | null; out: string }>((res) =>
    p.on('close', (code) => res({ code, out })));
  return { waitFor, done };
}

test('second writer fails fast with STORE_BUSY and rolls back; both exit cleanly', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kitroute-conc-'));
  const path = join(dir, 'k.db');
  try {
    openStore(path).close(); // migrate before contention
    const holder = run('hold', path);
    await holder.waitFor('LOCKED');
    const writer = run('write', path);
    const [w, h] = await Promise.all([writer.done, holder.done]);
    assert.equal(h.code, 0);
    assert.equal(w.code, 0);
    const result = JSON.parse(w.out.trim().split('\n').pop()!) as { code: string; ms: number };
    console.log(`measured contention result: ${result.code} after ${result.ms} ms`);
    assert.equal(result.code, 'STORE_BUSY');
    assert.ok(result.ms < 1000, `waited ${result.ms} ms`);
    const store = openStore(path);
    try {
      assert.deepEqual(listInventory(store, 'codex', 'a').map((c) => c.id), ['held']);
    } finally { store.close(); }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
