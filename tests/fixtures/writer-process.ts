// Child process for concurrency.test: `hold` keeps a write transaction open ~300 ms; `write` tries to replace.
import { openStore } from '../../src/storage/database.js';
import { replaceInventory } from '../../src/storage/inventory.js';
import { makeCapability } from './capabilities.js';

const [mode, path] = process.argv.slice(2) as [string, string];
const ctx = { host: 'codex' as const, projectId: 'a', roots: [] };
const store = openStore(path);
try {
  if (mode === 'hold') {
    store.db.exec('BEGIN IMMEDIATE');
    const c = makeCapability({ id: 'held' });
    store.db.prepare('INSERT INTO capabilities (host, project_id, id, metadata_json, revision) VALUES (?, ?, ?, ?, ?)')
      .run(c.host, c.projectId, c.id, JSON.stringify(c), c.revision);
    console.log('LOCKED');
    await new Promise((r) => setTimeout(r, 300));
    store.db.exec('COMMIT');
  } else {
    const t = performance.now();
    let code = 'NONE';
    try { replaceInventory(store, ctx, [makeCapability({ id: 'writer' })], 'rw'); }
    catch (e) { code = (e as Error).message; }
    console.log(JSON.stringify({ code, ms: Math.round(performance.now() - t) }));
  }
} finally {
  store.close();
}
