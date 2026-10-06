import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { Patch, SetupPlan } from '../contracts.js';
import { dataDir } from '../paths.js';
import { isDeepStrictEqual } from 'node:util';
import { addEntries, sha256, type PlanPatch } from './plan.js';

export interface Change { file: string; before: string; after: string; beforeHash: string }
export interface ApplyOptions { rename?: (from: string, to: string) => void }
export interface ManifestEntry { file: string; event: string; entry: Record<string, unknown>; ownedId: string }

const manifestPath = () => join(dataDir(), 'setup-manifest.json');
const read = (f: string) => (existsSync(f) ? readFileSync(f, 'utf8') : '');

export function readManifest(): ManifestEntry[] {
  try { return (JSON.parse(readFileSync(manifestPath(), 'utf8')) as { entries: ManifestEntry[] }).entries; } catch { return []; }
}

export function writeManifest(entries: ManifestEntry[]): void {
  if (!entries.length) { rmSync(manifestPath(), { force: true }); return; }
  mkdirSync(dataDir(), { recursive: true });
  // ownership record only; never a backup
  writeFileSync(manifestPath(), `${JSON.stringify({ version: 1, entries }, null, 2)}\n`);
}

function put(file: string, text: string, rename: (a: string, b: string) => void): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.kitroute-${process.pid}.tmp`;
  writeFileSync(tmp, text);
  try { rename(tmp, file); } catch (e) { rmSync(tmp, { force: true }); throw e; }
}

/** Recheck every hash, back up once per existing file, replace via temp sibling + rename; roll back this transaction on failure. */
export function commit(changes: Change[], opts: ApplyOptions = {}): void {
  const rename = opts.rename ?? renameSync;
  for (const c of changes) if (sha256(read(c.file)) !== c.beforeHash) throw new Error(`HASH_CHANGED ${c.file}`);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const existed = new Set(changes.filter(c => existsSync(c.file)).map(c => c.file));
  const done: Change[] = [];
  try {
    for (const c of changes) {
      if (existsSync(c.file)) {
        const b = join(dataDir(), 'backups', stamp, c.file.replace(/[:\\/]+/g, '_'));
        mkdirSync(dirname(b), { recursive: true });
        writeFileSync(b, c.before);
      }
      put(c.file, c.after, rename);
      done.push(c);
    }
  } catch (e) {
    for (const c of done.reverse()) {
      try { if (!existed.has(c.file)) rmSync(c.file, { force: true }); else put(c.file, c.before, renameSync); } catch { /* best effort */ }
    }
    throw e;
  }
}

/** Absolute patch.file paths are used as-is (root is ignored); relative ones resolve against root. */
export function applySetup(plan: { patches: PlanPatch[] } & Partial<SetupPlan>, root: string, opts: ApplyOptions = {}): void {
  const abs = (f: string) => (isAbsolute(f) ? f : resolve(root, f));
  const changes: Change[] = plan.patches.map(p => {
    const file = abs(p.file), before = read(file);
    if (sha256(before) !== p.beforeHash) throw new Error(`HASH_CHANGED ${file}`);
    return { file, before, beforeHash: p.beforeHash, after: addEntries(before, p.add, p.remove) };
  });
  // identity is (file, event, deep-equal entry); ownedId may repeat across rows
  const same = (x: ManifestEntry, file: string, a: Patch['add'][number]) =>
    x.file === file && x.event === a.event && isDeepStrictEqual(x.entry, a.entry);
  const prior = readManifest();
  let intent = prior, final = prior;
  for (const p of plan.patches) {
    const file = abs(p.file);
    final = final.filter(x => !(p.remove ?? []).some(r => same(x, file, r)));
    for (const a of p.add) {
      if (!intent.some(x => same(x, file, a))) intent = [...intent, { file, ...a }];
      if (!final.some(x => same(x, file, a))) final = [...final, { file, ...a }];
    }
  }
  // Record intent (including entries about to be added) before touching host files, so a crash never leaves
  // an owned entry without a manifest row. If the commit fails, put the previous manifest back.
  const old = existsSync(manifestPath()) ? readFileSync(manifestPath(), 'utf8') : null;
  writeManifest(intent);
  try { commit(changes, opts); } catch (e) {
    if (old === null) rmSync(manifestPath(), { force: true }); else writeFileSync(manifestPath(), old);
    throw e;
  }
  writeManifest(final); // now drop rows for replaced entries
}

export const toPatches = (entries: ManifestEntry[]): Patch[] => {
  const by = new Map<string, Patch>();
  for (const e of entries) {
    const p = by.get(e.file) ?? { file: e.file, beforeHash: '', add: [] };
    p.add.push({ event: e.event, entry: e.entry, ownedId: e.ownedId });
    by.set(e.file, p);
  }
  return [...by.values()];
};
