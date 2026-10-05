import type { Adapter, Capability } from '../contracts.js';
import { discoverSkills } from '../discovery/skills.js';
import { normalizePrompt, renderPrompt, validatePromptOutput } from './shared.js';

export const codex: Adapter = {
  host: 'codex',
  normalize: (raw, event) => normalizePrompt('codex', raw, event),
  discover: (context) => discoverSkills(context),
  render: renderPrompt,
  validateOutput: validatePromptOutput,
  // Native observation is P03; unknown is the truthful default until a loading signal is proven.
  observe: () => null,
};

const norm = (p: string) => p.replace(/\\/g, '/');
const isWin = (p: string) => /^[A-Za-z]:\//.test(p);
const same = (a: string, b: string) => (isWin(a) && isWin(b) ? a.toLowerCase() === b.toLowerCase() : a === b);

// Minimal scan of [[skills.config]] blocks (docs: path = SKILL.md file, enabled = false).
// Returns disabled paths, or null if any block is unparseable (caller fails closed).
// ponytail: no escapes/multiline strings/inline tables; those fail closed rather than get parsed.
function disabledPaths(text: string): string[] | null {
  const out: string[] = [];
  let block: { path?: string; enabled?: boolean; bad?: boolean } | null = null;
  const end = (): boolean => {
    if (!block) return true;
    const ok = !block.bad && !!block.path && block.enabled !== undefined;
    if (ok && block.enabled === false) out.push(block.path!);
    block = null;
    return ok;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[')) {
      if (!end()) return null;
      if (/^\[\[\s*skills\.config\s*\]\]\s*(#.*)?$/.test(line)) block = {};
      continue;
    }
    if (!block) continue;
    const kv = /^([A-Za-z_]+)\s*=\s*(.*)$/.exec(line);
    if (!kv) { block.bad = true; continue; }
    if (kv[1] === 'path') {
      const m = /^(?:"([^"\\]*)"|'([^']*)')\s*(?:#.*)?$/.exec(kv[2]!);
      if (m) block.path = norm(m[1] ?? m[2]!); else block.bad = true;
    } else if (kv[1] === 'enabled') {
      const m = /^(true|false)\s*(?:#.*)?$/.exec(kv[2]!);
      if (m) block.enabled = m[1] === 'true'; else block.bad = true;
    }
  }
  return end() ? out : null;
}

export function applyCodexConfig(items: Capability[], configText: string | null): Capability[] {
  if (configText === null) return items;
  const off = disabledPaths(configText);
  return items.map((c) => {
    if (c.host !== 'codex' || c.kind !== 'skill' || c.policy === 'disabled' || c.policy === 'explicit-only') return c;
    if (off === null) return { ...c, policy: 'unknown' };
    const src = norm(c.source);
    return off.some((p) => same(src, p)) ? { ...c, policy: 'disabled' } : c;
  });
}
