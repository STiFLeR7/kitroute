import type { Capability, DiscoveryContext, Host, Store } from '../contracts.js';
import { withTransaction } from './database.js';

/**
 * Replace the (host, projectId) scope atomically. Any item from another scope aborts with
 * SCOPE_MISMATCH before anything is written. If `revision` is given it commits in the same
 * transaction; if omitted the stored revision is cleared so the next ensureInventory refreshes.
 */
export function replaceInventory(
  store: Store, context: DiscoveryContext, items: Capability[], revision?: string
): void {
  if (items.some((i) => i.host !== context.host || i.projectId !== context.projectId)) {
    throw new Error('SCOPE_MISMATCH');
  }
  const { db } = store;
  withTransaction(store, () => {
    db.prepare('DELETE FROM capabilities WHERE host = ? AND project_id = ?')
      .run(context.host, context.projectId);
    const ins = db.prepare(
      'INSERT INTO capabilities (host, project_id, id, metadata_json, revision) VALUES (?, ?, ?, ?, ?)');
    for (const i of items) ins.run(i.host, i.projectId, i.id, JSON.stringify(i), i.revision);
    if (revision === undefined) {
      db.prepare('DELETE FROM inventory_revisions WHERE host = ? AND project_id = ?')
        .run(context.host, context.projectId);
    } else {
      db.prepare(`INSERT INTO inventory_revisions (host, project_id, revision) VALUES (?, ?, ?)
        ON CONFLICT (host, project_id) DO UPDATE SET revision = excluded.revision`)
        .run(context.host, context.projectId, revision);
    }
  });
}

export function listInventory(store: Store, host: Host, projectId: string): Capability[] {
  const rows = store.db.prepare(
    'SELECT metadata_json FROM capabilities WHERE host = ? AND project_id = ? ORDER BY id')
    .all(host, projectId) as Array<{ metadata_json: string }>;
  return rows.map((r) => JSON.parse(r.metadata_json) as Capability);
}

export function storedRevision(store: Store, host: Host, projectId: string): string | undefined {
  const row = store.db.prepare(
    'SELECT revision FROM inventory_revisions WHERE host = ? AND project_id = ?')
    .get(host, projectId) as { revision: string } | undefined;
  return row?.revision;
}
