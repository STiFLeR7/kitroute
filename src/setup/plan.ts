import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Host, Patch, SetupPlan, UninstallResult } from '../contracts.js';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const dump = (o: unknown) => `${JSON.stringify(o, null, 2)}\n`;

/** `"<node>" "<bin>" hook --host <h> --event <E>`; refuses (never escapes) paths with shell metacharacters. */
export function buildCommand(node: string, bin: string, host: Host, event: string): string {
  const [n, b] = [node, bin].map(p => p.replaceAll('\\', '/'));
  if ([n, b].some(p => /["$`%!\n\r]/.test(p!))) throw new Error('UNSUPPORTED_PATH_CHARACTERS');
  return `"${n}" "${b}" hook --host ${host} --event ${event}`;
}

/** Parse a config file; '' means missing. Returns the object or a conflict code. */
function parse(text: string): { doc: Obj; hooks: Obj } | string {
  let doc: unknown = {};
  if (text !== '') {
    try { doc = JSON.parse(text); } catch { return 'MALFORMED_JSON'; }
  }
  if (!isObj(doc)) return 'NOT_OBJECT';
  const hooks = doc['hooks'];
  if (hooks !== undefined && !isObj(hooks)) return 'HOOKS_NOT_OBJECT';
  for (const v of Object.values(hooks ?? {})) if (!Array.isArray(v)) return 'HOOK_EVENT_NOT_ARRAY';
  return { doc, hooks: (hooks as Obj | undefined) ?? {} };
}

/** Pure: text after adding the missing owned entries (identical entries are not duplicated). */
export function addEntries(text: string, adds: Patch['add'], remove: Patch['add'] = []): string {
  const p = parse(text);
  if (typeof p === 'string') throw new Error(p);
  for (const r of remove) {
    const kept = ((p.hooks[r.event] as unknown[] | undefined) ?? []).filter(e => !isDeepStrictEqual(e, r.entry));
    if (kept.length) p.hooks[r.event] = kept; else delete p.hooks[r.event];
  }
  for (const a of adds) {
    const arr = (p.hooks[a.event] ??= []) as unknown[];
    if (!arr.some(e => isDeepStrictEqual(e, a.entry))) arr.push(a.entry);
  }
  return dump({ ...p.doc, hooks: p.hooks });
}

/** A patch may also carry `remove`: stale manifest-owned entries replaced in the same transaction. */
export type PlanPatch = Patch & { remove?: Patch['add'] };

const commandsOf = (entry: unknown): string[] =>
  isObj(entry) && Array.isArray(entry['hooks'])
    ? (entry['hooks'] as unknown[]).flatMap(h => (isObj(h) && typeof h['command'] === 'string' ? [h['command']] : []))
    : [];

/** files: path -> current text ('' = missing). entries: patches whose `add` lists the owned entries per file.
 *  manifest: previously recorded owned entries; one that is unchanged but differs from the new entry is replaced. */
export function planSetup(files: Record<string, string>, entries: Patch[], manifest: Patch[] = []): { patches: PlanPatch[]; conflicts: string[] } {
  const patches: PlanPatch[] = [], conflicts: string[] = [];
  for (const e of entries) {
    const text = files[e.file] ?? '';
    const p = parse(text);
    if (typeof p === 'string') { conflicts.push(`${e.file}: ${p}`); continue; }
    const present = (ev: string) => (p.hooks[ev] as unknown[] | undefined) ?? [];
    const add = e.add.filter(a => !present(a.event).some(x => isDeepStrictEqual(x, a.entry)));
    const remove: Patch['add'] = [];
    for (const m of manifest.filter(m => m.file === e.file).flatMap(m => m.add)) {
      if (e.add.some(a => isDeepStrictEqual(a.entry, m.entry)) || !e.add.some(a => a.event === m.event)) continue;
      if (present(m.event).some(x => isDeepStrictEqual(x, m.entry))) remove.push(m);
      else if (present(m.event).some(x => commandsOf(x).some(c => commandsOf(m.entry).includes(c)))) conflicts.push(`${e.file}: ENTRY_MODIFIED ${m.event} ${m.ownedId}`);
    }
    if (add.length || remove.length) patches.push({ file: e.file, beforeHash: sha256(text), add, ...(remove.length ? { remove } : {}) });
  }
  return { patches, conflicts };
}

/** Pure: removes array entries deep-equal to an owned entry; edited owned entries stay and are reported. */
export function uninstall(files: Record<string, string>, ownedPatches: Patch[]): UninstallResult {
  const out: Record<string, string> = { ...files }, conflicts: string[] = [];
  const parsed = new Map<string, Obj>(), changed = new Set<string>();
  for (const patch of ownedPatches) {
    const text = files[patch.file];
    if (text === undefined) continue;
    let p = parsed.get(patch.file);
    if (!p) {
      const r = parse(text);
      if (typeof r === 'string') { conflicts.push(`${patch.file}: ${r}`); continue; }
      parsed.set(patch.file, p = r.doc);
    }
    const hooks = (p['hooks'] ?? {}) as Record<string, unknown[]>;
    for (const a of patch.add) {
      const arr = hooks[a.event];
      if (!arr) continue;
      const kept = arr.filter(e => !isDeepStrictEqual(e, a.entry));
      if (kept.length !== arr.length) {
        changed.add(patch.file);
        if (kept.length) hooks[a.event] = kept; else delete hooks[a.event];
        continue;
      }
      const mine = commandsOf(a.entry);
      if (arr.some(e => commandsOf(e).some(c => mine.includes(c)))) conflicts.push(`${patch.file}: ENTRY_MODIFIED ${a.event} ${a.ownedId}`);
    }
  }
  for (const f of changed) out[f] = dump(parsed.get(f));
  return { files: out, conflicts };
}
