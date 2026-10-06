import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Adapter, Capability, DiscoveryContext } from '../../src/contracts.js';
import { openStore } from '../../src/storage/database.js';
import { listInventory } from '../../src/storage/inventory.js';
import { ensureInventory, sourceRevision, currentAvailability, scopedFresh, FORCE_REFRESH }
  from '../../src/discovery/refresh.js';
import { projectScopeId } from '../../src/paths.js';
import { makeCapability } from '../fixtures/capabilities.js';

const ctx: DiscoveryContext = { host: 'codex', projectId: 'a', roots: [] };

function fake(results: Array<Capability[] | Error>): Adapter & { calls: number } {
  const a = {
    calls: 0, host: 'codex' as const,
    async discover() {
      const r = results[Math.min(a.calls++, results.length - 1)]!;
      if (r instanceof Error) throw r;
      return r;
    }
  };
  return a as unknown as Adapter & { calls: number };
}

async function tmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'kitroute-refresh-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
const md = (name: string, desc: string, body = 'Body') => `---\nname: ${name}\ndescription: ${desc}\n---\n${body}`;
async function skill(root: string, dir: string, text: string) {
  await mkdir(join(root, dir), { recursive: true });
  await writeFile(join(root, dir, 'SKILL.md'), text);
}

test('first use discovers; unchanged revision reuses without discovery', async () => {
  const store = openStore(':memory:');
  try {
    const ad = fake([[makeCapability({ id: 'x' })]]);
    assert.equal((await ensureInventory(store, ad, ctx, 'r1')).length, 1);
    assert.equal(ad.calls, 1);
    assert.equal((await ensureInventory(store, ad, ctx, 'r1')).length, 1);
    assert.equal(ad.calls, 1);
  } finally { store.close(); }
});

test('revision change picks up additions and removals; FORCE_REFRESH always rediscovers', async () => {
  const store = openStore(':memory:');
  try {
    const ad = fake([[makeCapability({ id: 'x' })], [makeCapability({ id: 'y' }), makeCapability({ id: 'z' })], []]);
    await ensureInventory(store, ad, ctx, 'r1');
    const second = await ensureInventory(store, ad, ctx, 'r2');
    assert.deepEqual(second.map((c) => c.id), ['y', 'z']);
    assert.deepEqual(await ensureInventory(store, ad, ctx, FORCE_REFRESH), []);
    assert.equal(ad.calls, 3);
    await ensureInventory(store, ad, ctx, FORCE_REFRESH);
    assert.equal(ad.calls, 4);
  } finally { store.close(); }
});

test('profile change (different project scope) keeps separate inventories', async () => {
  const store = openStore(':memory:');
  try {
    const pa = projectScopeId('/p/one', 'work'), pb = projectScopeId('/p/one', 'personal');
    const ca = { ...ctx, projectId: pa }, cb = { ...ctx, projectId: pb };
    const ad = fake([[makeCapability({ id: 'x', projectId: pa })], [makeCapability({ id: 'y', projectId: pb })]]);
    await ensureInventory(store, ad, ca, 'r');
    await ensureInventory(store, ad, cb, 'r');
    assert.equal(ad.calls, 2);
    assert.deepEqual(listInventory(store, 'codex', pa).map((c) => c.id), ['x']);
    assert.deepEqual(listInventory(store, 'codex', pb).map((c) => c.id), ['y']);
  } finally { store.close(); }
});

test('discovery failure keeps saved index and throws DISCOVERY_FAILED', async () => {
  const store = openStore(':memory:');
  try {
    const ad = fake([[makeCapability({ id: 'x' })], new Error('/secret/path boom')]);
    await ensureInventory(store, ad, ctx, 'r1');
    await assert.rejects(ensureInventory(store, ad, ctx, 'r2'), (e: Error) => e.message === 'DISCOVERY_FAILED');
    assert.deepEqual(listInventory(store, 'codex', 'a').map((c) => c.id), ['x']);
    await ensureInventory(store, fake([[]]), ctx, 'r1'); // old revision still stored: reuse
    assert.equal(listInventory(store, 'codex', 'a').length, 1);
  } finally { store.close(); }
});

test('sourceRevision: stable, changes on metadata edit/add/remove/config, ignores body', async () => {
  await tmp(async (dir) => {
    const root = join(dir, 'skills'), cfg = join(dir, 'config.toml');
    await skill(root, 'one', md('one', 'First'));
    const r0 = await sourceRevision([root], [cfg]);
    assert.equal(await sourceRevision([root], [cfg]), r0);
    await skill(root, 'one', md('one', 'First', 'Different body'));
    assert.equal(await sourceRevision([root], [cfg]), r0);
    await skill(root, 'one', md('one', 'Edited description'));
    const r1 = await sourceRevision([root], [cfg]);
    assert.notEqual(r1, r0);
    await skill(root, 'two', md('two', 'Second'));
    const r2 = await sourceRevision([root], [cfg]);
    assert.notEqual(r2, r1);
    await rm(join(root, 'two'), { recursive: true });
    assert.equal(await sourceRevision([root], [cfg]), r1);
    await writeFile(cfg, 'x=1');
    assert.notEqual(await sourceRevision([root], [cfg]), r1);
    await mkdir(join(root, 'one', 'agents'));
    const before = await sourceRevision([root], [cfg]);
    await writeFile(join(root, 'one', 'agents', 'openai.yaml'), 'policy: {}');
    assert.notEqual(await sourceRevision([root], [cfg]), before);
    assert.notEqual(await sourceRevision([join(dir, 'missing')], []), await sourceRevision([], []));
  });
});

test('currentAvailability: stale tool becomes unknown; fresh evidence restores; skills untouched', () => {
  const tool = makeCapability({ id: 't', kind: 'tool', availability: 'available' });
  const skillCap = makeCapability({ id: 's' });
  const out = currentAvailability([tool, skillCap], undefined);
  assert.equal(out.find((c) => c.id === 't')!.availability, 'unknown');
  assert.equal(out.find((c) => c.id === 's')!.availability, 'available');
  const fresh = currentAvailability([tool], [{ ...tool, availability: 'available' }]);
  assert.equal(fresh[0]!.availability, 'available');
  const added = currentAvailability([], [makeCapability({ id: 'n', kind: 'tool' })]);
  assert.deepEqual(added.map((c) => c.id), ['n']);
});

test('fresh records from another scope are dropped', () => {
  const mine = makeCapability({ id: 'm', kind: 'tool' });
  const foreign = makeCapability({ id: 'f', kind: 'tool', projectId: 'b' });
  const otherHost = makeCapability({ id: 'h', kind: 'tool', host: 'claude-code' });
  assert.deepEqual(scopedFresh([mine, foreign, otherHost], 'codex', 'a'), [mine]);
  assert.equal(scopedFresh(undefined, 'codex', 'a'), undefined);
});
