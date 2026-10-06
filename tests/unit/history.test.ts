import test from 'node:test';
import assert from 'node:assert/strict';
import { toUsageRecord, appendUsage, listUsage, observedUse } from '../../src/history/records.js';
import { openStore } from '../../src/storage/database.js';

const base = {
  host: 'codex', projectId: 'p', sessionId: 's', capabilityId: 'c',
  capabilityName: 'test', event: 'selection', result: 'unknown', elapsedMs: 3, atMs: 1000
};
const MARKERS = ['UNIQUE_SECRET_MARKER', 'UNIQUE_CODE_MARKER', 'UNIQUE_ARGS_MARKER', 'UNIQUE_ERROR_MARKER'];
const dirty = {
  ...base, prompt: MARKERS[0], projectCode: MARKERS[1], toolInput: MARKERS[2], error: MARKERS[3]
};

test('toUsageRecord drops unknown fields', () => {
  const saved = JSON.stringify(toUsageRecord(dirty));
  for (const m of MARKERS) assert.equal(saved.includes(m), false);
  assert.deepEqual(toUsageRecord(dirty), base);
});

test('stored rows and errors contain no markers', () => {
  const store = openStore(':memory:');
  appendUsage(store, dirty as never);
  const rows = store.db.prepare('SELECT * FROM usage').all();
  assert.equal(rows.length, 1);
  assert.equal(Object.keys(rows[0]!).length, 9);
  assert.equal(JSON.stringify(rows).match(/UNIQUE_/), null);
  assert.equal(JSON.stringify(listUsage(store)).match(/UNIQUE_/), null);
  const msgs: string[] = [];
  for (const bad of [{ ...dirty, host: MARKERS[0] }, { ...dirty, event: MARKERS[1] }, { ...dirty, result: MARKERS[2] },
    { ...dirty, capabilityName: ' ' }, { ...dirty, elapsedMs: NaN }]) {
    try { appendUsage(store, bad as never); } catch (e) { msgs.push((e as Error).message); }
  }
  assert.equal(msgs.length, 5);
  for (const m of msgs) assert.equal(m, 'INVALID_USAGE_RECORD');
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM usage').get()!.n, 1);
  store.close();
});

test('invalid fields throw a fixed code', () => {
  const bads: unknown[] = [null, [], 'x', { ...base, host: 'other' }, { ...base, event: 'nope' },
    { ...base, result: 'maybe' }, { ...base, capabilityName: '' }, { ...base, projectId: 5 },
    { ...base, elapsedMs: NaN }, { ...base, elapsedMs: Infinity }, { ...base, atMs: -1 }, { ...base, elapsedMs: '3' }];
  for (const b of bads) assert.throws(() => toUsageRecord(b), { message: 'INVALID_USAGE_RECORD' });
});

test('listUsage is newest first and limited', () => {
  const store = openStore(':memory:');
  for (const atMs of [1, 3, 2]) appendUsage(store, { ...base, atMs } as never);
  assert.deepEqual(listUsage(store, 2).map((r) => r.atMs), [3, 2]);
  store.close();
});

test('observedUse counts only native-load and tool-call', () => {
  const o = (kind: 'native-load' | 'tool-call' | 'file-read' | 'guidance') => ({ capabilityId: 'c', kind, succeeded: null });
  assert.equal(observedUse(o('native-load')), true);
  assert.equal(observedUse(o('tool-call')), true);
  assert.equal(observedUse(o('file-read')), false);
  assert.equal(observedUse(o('guidance')), false);
});
