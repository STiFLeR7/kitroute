import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { appendUsage, pruneUsage, listUsage } from '../../src/history/records.js';
import { openStore } from '../../src/storage/database.js';

const DAY = 24 * 60 * 60 * 1000;
const rec = (atMs: number) => ({
  host: 'codex', projectId: 'p', sessionId: 's', capabilityId: 'c',
  capabilityName: 'n', event: 'selection', result: 'unknown', elapsedMs: 1, atMs
}) as never;

test('prune deletes older than 30 days, keeps boundary, never touches inventory', () => {
  const store = openStore(':memory:');
  const now = 100 * DAY;
  store.db.prepare("INSERT INTO capabilities VALUES ('codex','p','x','{}','r')").run();
  store.db.prepare("INSERT INTO inventory_revisions VALUES ('codex','p','r')").run();
  for (const t of [now - 31 * DAY, now - 30 * DAY, now]) appendUsage(store, rec(t));
  assert.equal(pruneUsage(store, now), 1);
  assert.deepEqual(listUsage(store).map((r) => r.atMs), [now, now - 30 * DAY]);
  assert.equal(pruneUsage(store, now), 0);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM capabilities').get()!.n, 1);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM inventory_revisions').get()!.n, 1);
  store.close();
});

test('v1 database migrates to v2 and keeps inventory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kitroute-ret-'));
  const path = join(dir, 'v1.db');
  try {
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE capabilities (host TEXT NOT NULL, project_id TEXT NOT NULL, id TEXT NOT NULL,
      metadata_json TEXT NOT NULL, revision TEXT NOT NULL, PRIMARY KEY (host, project_id, id));
      CREATE TABLE inventory_revisions (host TEXT NOT NULL, project_id TEXT NOT NULL, revision TEXT NOT NULL,
      PRIMARY KEY (host, project_id));
      INSERT INTO capabilities VALUES ('codex','p','x','{}','r');
      PRAGMA user_version = 1;`);
    old.close();
    const store = openStore(path);
    assert.equal((store.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 3);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM capabilities').get()!.n, 1);
    appendUsage(store, rec(5));
    assert.equal(listUsage(store).length, 1);
    store.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
