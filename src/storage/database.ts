import { DatabaseSync } from 'node:sqlite';
import type { Store } from '../contracts.js';

const MIGRATIONS = [`
CREATE TABLE capabilities (
  host TEXT NOT NULL,
  project_id TEXT NOT NULL,
  id TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  revision TEXT NOT NULL,
  PRIMARY KEY (host, project_id, id)
);
CREATE TABLE inventory_revisions (
  host TEXT NOT NULL,
  project_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  PRIMARY KEY (host, project_id)
);`];

/** Map any SQLite failure to a fixed code; never echo paths or SQL. */
export function storeError(e: unknown, fallback: string): Error {
  const msg = e instanceof Error ? e.message : '';
  const code = (e as { errcode?: number } | null)?.errcode;
  return new Error(code === 5 || code === 6 || /locked|busy/i.test(msg) ? 'STORE_BUSY' : fallback);
}

/** Run fn inside BEGIN IMMEDIATE; commit on success, roll back on any throw. */
export function withTransaction<T>(store: Store, fn: () => T): T {
  try {
    store.db.exec('BEGIN IMMEDIATE');
  } catch (e) {
    throw storeError(e, 'STORE_WRITE_FAILED');
  }
  try {
    const result = fn();
    store.db.exec('COMMIT');
    return result;
  } catch (e) {
    try { store.db.exec('ROLLBACK'); } catch { /* already rolled back */ }
    throw storeError(e, 'STORE_WRITE_FAILED');
  }
}

export function openStore(path: string): Store {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(path);
    db.exec('PRAGMA busy_timeout = 100');
    if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
    const handle = db;
    const store: Store = { db: handle, close: () => handle.close() };
    const version = () => (handle.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
    // Skip the write lock when already current, so openers never block behind another writer.
    if (version() < MIGRATIONS.length) {
      withTransaction(store, () => {
        for (let v = version(); v < MIGRATIONS.length; v++) handle.exec(MIGRATIONS[v]!);
        handle.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
      });
    }
    return store;
  } catch (e) {
    try { db?.close(); } catch { /* ignore */ }
    throw storeError(e, 'STORE_OPEN_FAILED');
  }
}
