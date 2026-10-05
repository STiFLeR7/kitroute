import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../../src/storage/database.js';
import { replaceInventory, listInventory } from '../../src/storage/inventory.js';
import { makeCapability } from '../fixtures/capabilities.js';

const ctx = (projectId = 'a', host: 'codex' | 'claude-code' = 'codex') => ({ host, projectId, roots: [] });

async function tmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'kitroute-store-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('project isolation', () => {
  const store = openStore(':memory:');
  try {
    replaceInventory(store, ctx('a'), [makeCapability({ projectId: 'a' })]);
    assert.equal(listInventory(store, 'codex', 'b').length, 0);
    assert.equal(listInventory(store, 'claude-code', 'a').length, 0);
    assert.equal(listInventory(store, 'codex', 'a').length, 1);
  } finally { store.close(); }
});

test('reopen keeps data and user_version = 2; migration is idempotent', async () => {
  await tmp(async (dir) => {
    const path = join(dir, 'k.db');
    let store = openStore(path);
    try { replaceInventory(store, ctx(), [makeCapability()]); } finally { store.close(); }
    store = openStore(path);
    try {
      assert.equal(listInventory(store, 'codex', 'a').length, 1);
      const v = store.db.prepare('PRAGMA user_version').get() as { user_version: number };
      assert.equal(v.user_version, 2);
    } finally { store.close(); }
  });
});

test('failure mid-replace rolls back and keeps old rows', () => {
  const store = openStore(':memory:');
  try {
    replaceInventory(store, ctx(), [makeCapability({ id: 'old' })], 'r1');
    const dup = makeCapability({ id: 'dup' });
    assert.throws(() => replaceInventory(store, ctx(), [makeCapability({ id: 'new' }), dup, dup], 'r2'));
    assert.deepEqual(listInventory(store, 'codex', 'a').map((c) => c.id), ['old']);
    const r = store.db.prepare('SELECT revision FROM inventory_revisions').get() as { revision: string };
    assert.equal(r.revision, 'r1');
  } finally { store.close(); }
});

test('foreign-scope item rejected with SCOPE_MISMATCH and nothing written', () => {
  const store = openStore(':memory:');
  try {
    replaceInventory(store, ctx(), [makeCapability({ id: 'old' })]);
    assert.throws(() => replaceInventory(store, ctx(), [makeCapability({ id: 'x', projectId: 'b' })]),
      /SCOPE_MISMATCH/);
    assert.deepEqual(listInventory(store, 'codex', 'a').map((c) => c.id), ['old']);
  } finally { store.close(); }
});

test('duplicate names with distinct ids are both kept; ordered by id', () => {
  const store = openStore(':memory:');
  try {
    replaceInventory(store, ctx(), [makeCapability({ id: 'z', name: 'debug' }), makeCapability({ id: 'b', name: 'debug' })]);
    assert.deepEqual(listInventory(store, 'codex', 'a').map((c) => c.id), ['b', 'z']);
  } finally { store.close(); }
});

test('removed skill disappears after replace', () => {
  const store = openStore(':memory:');
  try {
    replaceInventory(store, ctx(), [makeCapability({ id: 'a1' }), makeCapability({ id: 'a2' })]);
    replaceInventory(store, ctx(), [makeCapability({ id: 'a1' })]);
    assert.deepEqual(listInventory(store, 'codex', 'a').map((c) => c.id), ['a1']);
  } finally { store.close(); }
});

test('replace touches only its own scope', () => {
  const store = openStore(':memory:');
  try {
    replaceInventory(store, ctx('b'), [makeCapability({ projectId: 'b' })]);
    replaceInventory(store, ctx('a'), []);
    assert.equal(listInventory(store, 'codex', 'b').length, 1);
  } finally { store.close(); }
});

test('open failure surfaces a fixed code without the path', () => {
  assert.throws(() => openStore(join(tmpdir(), 'kitroute-no-such-dir-xyz', 'k.db')),
    (e: Error) => e.message === 'STORE_OPEN_FAILED');
});
