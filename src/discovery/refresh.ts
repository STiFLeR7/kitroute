import { createHash } from 'node:crypto';
import { open, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Adapter, Capability, DiscoveryContext, Host, Store } from '../contracts.js';
import { listInventory, replaceInventory, storedRevision } from '../storage/inventory.js';

/** Pass as `revision` to ensureInventory (e.g. from the index command) to always rediscover. */
export const FORCE_REFRESH = '';

const MISSING = 'MISSING';
const NO_FRONTMATTER = 'NO_FRONTMATTER';
const lp = (s: string) => `${s.length}:${s}`;
const readOrNull = (p: string) => readFile(p, 'utf8').catch(() => null);

/** Raw SKILL.md text up to the end of the frontmatter block; never the body. */
async function frontmatterRaw(file: string): Promise<string | null> {
  let fh;
  try { fh = await open(file, 'r'); } catch { return null; }
  try {
    let text = '';
    const buf = Buffer.alloc(4096);
    for (let n = 0; n < 64; n++) { // ponytail: 256 KiB frontmatter cap
      const { bytesRead } = await fh.read(buf, 0, buf.length, null);
      if (!bytesRead) break;
      text += buf.toString('utf8', 0, bytesRead);
      const m = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u.exec(text);
      if (m) return m[0];
      if (!text.startsWith('---')) break;
    }
    return NO_FRONTMATTER;
  } finally {
    await fh.close();
  }
}

export async function sourceRevision(roots: string[], configFiles: string[]): Promise<string> {
  const h = createHash('sha256');
  const add = (s: string) => h.update(lp(s));
  for (const root of roots) {
    add(`root:${root}`);
    let entries;
    try { entries = await readdir(root, { withFileTypes: true }); } catch { add(MISSING); continue; }
    for (const e of entries.filter((d) => d.isDirectory()).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      add(e.name);
      add(await frontmatterRaw(join(root, e.name, 'SKILL.md')) ?? MISSING);
      add(await readOrNull(join(root, e.name, 'agents', 'openai.yaml')) ?? MISSING);
    }
  }
  for (const f of configFiles) { add(`config:${f}`); add(await readOrNull(f) ?? MISSING); }
  return h.digest('hex');
}

export async function ensureInventory(
  store: Store, adapter: Adapter, context: DiscoveryContext, revision: string
): Promise<Capability[]> {
  const saved = storedRevision(store, context.host, context.projectId);
  if (revision !== FORCE_REFRESH && saved === revision) {
    return listInventory(store, context.host, context.projectId);
  }
  let items: Capability[];
  try {
    items = await adapter.discover(context);
  } catch {
    throw new Error('DISCOVERY_FAILED'); // saved index untouched; caller abstains
  }
  replaceInventory(store, context, items, revision === FORCE_REFRESH ? undefined : revision);
  return listInventory(store, context.host, context.projectId);
}

/** Drop fresh records outside the active host/project scope. */
export function scopedFresh(
  fresh: Capability[] | undefined, host: Host, projectId: string
): Capability[] | undefined {
  return fresh?.filter((i) => i.host === host && i.projectId === projectId);
}

export function currentAvailability(
  cached: Capability[], fresh: Capability[] | undefined
): Capability[] {
  const tools = new Map((fresh ?? []).filter(item => item.kind === 'tool')
    .map(item => [JSON.stringify([item.host, item.projectId, item.id]), item]));
  return cached.map<Capability>(item => {
    if (item.kind !== 'tool') return item;
    const current = tools.get(JSON.stringify([item.host, item.projectId, item.id]));
    return current ?? { ...item, availability: 'unknown' };
  }).concat((fresh ?? []).filter(item => item.kind === 'tool' &&
    !cached.some(saved => saved.host === item.host && saved.projectId === item.projectId && saved.id === item.id)));
}
